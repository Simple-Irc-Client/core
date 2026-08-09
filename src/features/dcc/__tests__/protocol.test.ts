import { describe, expect, it } from 'vitest';
import {
  DccKind,
  DccRejectReason,
  decodeDccAddress,
  dedupeFilename,
  encodeDccAddress,
  formatDccCtcp,
  isIpLiteral,
  parseDccCtcp,
  sanitizeFilename,
} from '../protocol';

// 3232235777 === 192.168.1.1, 3467383817 === 206.172.20.9 (a routable address
// used throughout so the private-address guard doesn't mask other assertions).
const PUBLIC_IP_INT = '3467383817';
const PUBLIC_IP = '206.172.20.9';

describe('decodeDccAddress', () => {
  it('decodes the unsigned 32-bit IPv4 form', () => {
    expect(decodeDccAddress('3232235777')).toBe('192.168.1.1');
    expect(decodeDccAddress(PUBLIC_IP_INT)).toBe(PUBLIC_IP);
  });

  it('decodes 0 to the unspecified address rather than failing', () => {
    expect(decodeDccAddress('0')).toBe('0.0.0.0');
  });

  it('decodes the top of the range without sign errors', () => {
    expect(decodeDccAddress('4294967295')).toBe('255.255.255.255');
  });

  it('rejects values above 32 bits', () => {
    expect(decodeDccAddress('4294967296')).toBeNull();
    expect(decodeDccAddress('99999999999999999999')).toBeNull();
  });

  it('passes through literal IPv6, bracketed or bare', () => {
    expect(decodeDccAddress('2001:db8::1')).toBe('2001:db8::1');
    expect(decodeDccAddress('[2001:DB8::1]')).toBe('2001:db8::1');
  });

  it('rejects hostnames so a name is never handed to the connector', () => {
    expect(decodeDccAddress('evil.example.com')).toBeNull();
    expect(decodeDccAddress('')).toBeNull();
    expect(decodeDccAddress('192.168.1.1')).toBeNull();
  });
});

describe('encodeDccAddress', () => {
  it('round-trips with decodeDccAddress', () => {
    expect(decodeDccAddress(encodeDccAddress(PUBLIC_IP))).toBe(PUBLIC_IP);
    expect(decodeDccAddress(encodeDccAddress('10.0.0.1'))).toBe('10.0.0.1');
    expect(decodeDccAddress(encodeDccAddress('255.255.255.255'))).toBe('255.255.255.255');
  });

  it('leaves IPv6 literal', () => {
    expect(encodeDccAddress('2001:db8::1')).toBe('2001:db8::1');
  });

  it('leaves out-of-range dotted quads untouched instead of wrapping', () => {
    expect(encodeDccAddress('999.1.1.1')).toBe('999.1.1.1');
  });
});

describe('isIpLiteral', () => {
  it('accepts dotted quads and IPv6 literals', () => {
    for (const host of ['1.2.3.4', '255.255.255.255', '2001:db8::1', '[2001:db8::1]', '::1']) {
      expect(isIpLiteral(host)).toBe(true);
    }
  });

  it('rejects hostnames, including the cloaks IRC networks hand out', () => {
    for (const host of ['example.com', 'D6D788C7.623ED634.C8132F93.IP', 'user.hidden', '', '999.1.1.1']) {
      expect(isIpLiteral(host)).toBe(false);
    }
  });
});

describe('sanitizeFilename', () => {
  it('keeps ordinary names', () => {
    expect(sanitizeFilename('holiday.jpg')).toBe('holiday.jpg');
    expect(sanitizeFilename('my report v2.pdf')).toBe('my report v2.pdf');
  });

  it('collapses POSIX traversal to the leaf', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('/etc/shadow')).toBe('shadow');
  });

  it('collapses Windows traversal to the leaf', () => {
    expect(sanitizeFilename('..\\..\\windows\\win.ini')).toBe('win.ini');
    expect(sanitizeFilename('C:\\Users\\me\\note.txt')).toBe('note.txt');
  });

  it('strips control characters and NUL', () => {
    expect(sanitizeFilename('ev\u0000il\u001b[0m.txt')).toBe('evil[0m.txt');
  });

  it('replaces characters that are illegal on Windows', () => {
    expect(sanitizeFilename('a<b>c:d"e|f?g*h.txt')).toBe('a_b_c_d_e_f_g_h.txt');
  });

  it('strips leading dots so nothing lands as a hidden file', () => {
    expect(sanitizeFilename('.bashrc')).toBe('bashrc');
    expect(sanitizeFilename('...')).toBeNull();
  });

  it('returns null when nothing usable is left', () => {
    expect(sanitizeFilename('')).toBeNull();
    expect(sanitizeFilename('/')).toBeNull();
    expect(sanitizeFilename('\u0000\u0001')).toBeNull();
  });

  it('truncates long names but preserves the extension', () => {
    const result = sanitizeFilename(`${'a'.repeat(400)}.zip`);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(200);
    expect(result?.endsWith('.zip')).toBe(true);
  });

  it('truncates plainly when the "extension" is not one', () => {
    const result = sanitizeFilename(`${'a'.repeat(300)}.${'b'.repeat(60)}`);
    expect(result?.length).toBe(200);
  });
});

describe('parseDccCtcp — CHAT', () => {
  it('parses a plain chat offer', () => {
    const result = parseDccCtcp(`CHAT chat ${PUBLIC_IP_INT} 5000`);
    expect(result).toEqual({
      ok: true,
      offer: { kind: DccKind.chat, secure: false, host: PUBLIC_IP, port: 5000 },
    });
  });

  it('parses SCHAT as the secure variant', () => {
    const result = parseDccCtcp(`SCHAT chat ${PUBLIC_IP_INT} 5000`);
    expect(result.ok && result.offer.secure).toBe(true);
  });

  it('is case-insensitive on the type and sub-protocol', () => {
    expect(parseDccCtcp(`chat CHAT ${PUBLIC_IP_INT} 5000`).ok).toBe(true);
  });

  it('rejects a chat offer whose sub-protocol is not "chat"', () => {
    const result = parseDccCtcp(`CHAT notchat ${PUBLIC_IP_INT} 5000`);
    expect(result).toEqual({ ok: false, reason: DccRejectReason.malformed });
  });
});

describe('parseDccCtcp — SEND', () => {
  it('parses a plain send offer', () => {
    const result = parseDccCtcp(`SEND holiday.jpg ${PUBLIC_IP_INT} 5000 1024`);
    expect(result).toEqual({
      ok: true,
      offer: {
        kind: DccKind.send,
        secure: false,
        host: PUBLIC_IP,
        port: 5000,
        filename: 'holiday.jpg',
        size: 1024,
      },
    });
  });

  it('parses SSEND as the secure variant', () => {
    const result = parseDccCtcp(`SSEND a.bin ${PUBLIC_IP_INT} 5000 1`);
    expect(result.ok && result.offer.secure).toBe(true);
  });

  it('honours double quotes around a filename with spaces', () => {
    const result = parseDccCtcp(`SEND "my holiday.jpg" ${PUBLIC_IP_INT} 5000 1024`);
    expect(result.ok && result.offer.filename).toBe('my holiday.jpg');
    expect(result.ok && result.offer.size).toBe(1024);
  });

  it('sanitises a traversal filename instead of trusting it', () => {
    const result = parseDccCtcp(`SEND ../../etc/passwd ${PUBLIC_IP_INT} 5000 10`);
    expect(result.ok && result.offer.filename).toBe('passwd');
  });

  it('rejects a filename that sanitises to nothing', () => {
    const result = parseDccCtcp(`SEND "..." ${PUBLIC_IP_INT} 5000 10`);
    expect(result).toEqual({ ok: false, reason: DccRejectReason.badFilename });
  });

  it('rejects a size beyond the configured maximum', () => {
    const result = parseDccCtcp(`SEND big.bin ${PUBLIC_IP_INT} 5000 100`, { maxFileSize: 99 });
    expect(result).toEqual({ ok: false, reason: DccRejectReason.tooLarge });
  });

  it('accepts a size exactly at the maximum', () => {
    expect(parseDccCtcp(`SEND big.bin ${PUBLIC_IP_INT} 5000 99`, { maxFileSize: 99 }).ok).toBe(true);
  });

  it('rejects a non-numeric or overflowing size', () => {
    expect(parseDccCtcp(`SEND a.bin ${PUBLIC_IP_INT} 5000 abc`)).toEqual({
      ok: false,
      reason: DccRejectReason.badSize,
    });
    expect(parseDccCtcp(`SEND a.bin ${PUBLIC_IP_INT} 5000 99999999999999999999`)).toEqual({
      ok: false,
      reason: DccRejectReason.badSize,
    });
  });

  it('rejects a send offer with no size field', () => {
    expect(parseDccCtcp(`SEND a.bin ${PUBLIC_IP_INT} 5000`)).toEqual({
      ok: false,
      reason: DccRejectReason.malformed,
    });
  });
});

describe('parseDccCtcp — rejections', () => {
  it('rejects an empty payload', () => {
    expect(parseDccCtcp('')).toEqual({ ok: false, reason: DccRejectReason.malformed });
  });

  it('rejects truncated payloads at every field boundary', () => {
    for (const params of ['CHAT', 'CHAT chat', `CHAT chat ${PUBLIC_IP_INT}`]) {
      expect(parseDccCtcp(params)).toEqual({ ok: false, reason: DccRejectReason.malformed });
    }
  });

  it('rejects types we do not implement', () => {
    for (const type of ['RESUME', 'ACCEPT', 'XMIT', 'BOGUS']) {
      expect(parseDccCtcp(`${type} a.bin ${PUBLIC_IP_INT} 5000 1`)).toEqual({
        ok: false,
        reason: DccRejectReason.unknownType,
      });
    }
  });

  it('rejects passive (port 0) offers with a distinct reason', () => {
    expect(parseDccCtcp(`SEND a.bin ${PUBLIC_IP_INT} 0 1024`)).toEqual({
      ok: false,
      reason: DccRejectReason.passiveUnsupported,
    });
  });

  it('rejects privileged and out-of-range ports', () => {
    for (const port of ['22', '65536', '-1', '50x0']) {
      expect(parseDccCtcp(`CHAT chat ${PUBLIC_IP_INT} ${port}`)).toEqual({
        ok: false,
        reason: DccRejectReason.badPort,
      });
    }
  });

  it('rejects an unparseable address', () => {
    expect(parseDccCtcp('CHAT chat evil.example.com 5000')).toEqual({
      ok: false,
      reason: DccRejectReason.badAddress,
    });
  });

  it('rejects private, loopback and link-local addresses by default', () => {
    // 3232235777 = 192.168.1.1, 2130706433 = 127.0.0.1, 2851995905 = 169.254.1.1
    for (const address of ['3232235777', '2130706433', '2851995905', '0']) {
      expect(parseDccCtcp(`CHAT chat ${address} 5000`)).toEqual({
        ok: false,
        reason: DccRejectReason.privateAddress,
      });
    }
  });

  it('allows private addresses when the user opted in', () => {
    const result = parseDccCtcp('CHAT chat 3232235777 5000', { allowPrivateAddress: true });
    expect(result.ok && result.offer.host).toBe('192.168.1.1');
  });

  it('tolerates extra whitespace between fields', () => {
    expect(parseDccCtcp(`CHAT   chat    ${PUBLIC_IP_INT}   5000`).ok).toBe(true);
  });

  it('does not crash on an unterminated quote', () => {
    const result = parseDccCtcp(`SEND "unterminated ${PUBLIC_IP_INT} 5000 1024`);
    expect(result.ok).toBe(false);
  });
});

describe('formatDccCtcp', () => {
  it('formats chat offers', () => {
    expect(formatDccCtcp({ kind: DccKind.chat, secure: false, host: PUBLIC_IP, port: 5000 })).toBe(
      `DCC CHAT chat ${PUBLIC_IP_INT} 5000`,
    );
    expect(formatDccCtcp({ kind: DccKind.chat, secure: true, host: PUBLIC_IP, port: 5000 })).toBe(
      `DCC SCHAT chat ${PUBLIC_IP_INT} 5000`,
    );
  });

  it('formats send offers and only quotes when needed', () => {
    expect(
      formatDccCtcp({
        kind: DccKind.send,
        secure: false,
        host: PUBLIC_IP,
        port: 5000,
        filename: 'a.bin',
        size: 7,
      }),
    ).toBe(`DCC SEND a.bin ${PUBLIC_IP_INT} 5000 7`);

    expect(
      formatDccCtcp({
        kind: DccKind.send,
        secure: true,
        host: PUBLIC_IP,
        port: 5000,
        filename: 'my file.bin',
        size: 7,
      }),
    ).toBe(`DCC SSEND "my file.bin" ${PUBLIC_IP_INT} 5000 7`);
  });

  it('round-trips through the parser', () => {
    const offer = {
      kind: DccKind.send,
      secure: true,
      host: PUBLIC_IP,
      port: 6000,
      filename: 'my file.bin',
      size: 12345,
    };
    const parsed = parseDccCtcp(formatDccCtcp(offer).replace(/^DCC /, ''));
    expect(parsed).toEqual({ ok: true, offer });
  });
});

describe('dedupeFilename', () => {
  it('returns the name unchanged when free', () => {
    expect(dedupeFilename('a.txt', () => false)).toBe('a.txt');
  });

  it('appends a counter before the extension', () => {
    const taken = new Set(['a.txt', 'a (1).txt']);
    expect(dedupeFilename('a.txt', (name) => taken.has(name))).toBe('a (2).txt');
  });

  it('appends a counter to extensionless names', () => {
    const taken = new Set(['README']);
    expect(dedupeFilename('README', (name) => taken.has(name))).toBe('README (1)');
  });
});
