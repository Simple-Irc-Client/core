import { describe, it, expect } from 'vitest';
import { isSafeUrl, isSafeCssColor, redactSensitiveIrc } from '../utils';

describe('redactSensitiveIrc', () => {
  it('should redact AUTHENTICATE payloads', () => {
    expect(redactSensitiveIrc('AUTHENTICATE dXNlcm5hbWUAcGFzc3dvcmQ=')).toBe('AUTHENTICATE ***');
  });

  it('should redact AUTHENTICATE + (server challenge)', () => {
    expect(redactSensitiveIrc('AUTHENTICATE +')).toBe('AUTHENTICATE ***');
  });

  it('should be case-insensitive for AUTHENTICATE', () => {
    expect(redactSensitiveIrc('authenticate payload123')).toBe('authenticate ***');
    expect(redactSensitiveIrc('Authenticate payload123')).toBe('Authenticate ***');
  });

  it('should redact PASS commands', () => {
    expect(redactSensitiveIrc('PASS mysecretpassword')).toBe('PASS ***');
    expect(redactSensitiveIrc('PASS :server-password')).toBe('PASS ***');
  });

  it('should be case-insensitive for PASS', () => {
    expect(redactSensitiveIrc('pass secret')).toBe('pass ***');
  });

  it('should redact NickServ IDENTIFY with password only', () => {
    expect(redactSensitiveIrc(':user!u@host PRIVMSG NickServ :IDENTIFY mypassword')).toBe(
      ':user!u@host PRIVMSG NickServ :IDENTIFY ***',
    );
  });

  it('should redact NickServ IDENTIFY with account and password', () => {
    expect(redactSensitiveIrc(':user!u@host PRIVMSG NickServ :IDENTIFY myaccount mypassword')).toBe(
      ':user!u@host PRIVMSG NickServ :IDENTIFY ***',
    );
  });

  it('should be case-insensitive for NickServ IDENTIFY', () => {
    expect(redactSensitiveIrc(':u!u@h PRIVMSG nickserv :identify pass')).toBe(
      ':u!u@h PRIVMSG nickserv :identify ***',
    );
  });

  it('should not redact normal PRIVMSG', () => {
    const line = ':user!u@host PRIVMSG #channel :hello world';
    expect(redactSensitiveIrc(line)).toBe(line);
  });

  it('should not redact normal server messages', () => {
    const line = ':server 001 nick :Welcome to the network';
    expect(redactSensitiveIrc(line)).toBe(line);
  });

  it('should not redact NICK or USER commands', () => {
    const nick = 'NICK mynick';
    const user = 'USER myuser 0 * :realname';
    expect(redactSensitiveIrc(nick)).toBe(nick);
    expect(redactSensitiveIrc(user)).toBe(user);
  });

  it('should return empty string unchanged', () => {
    expect(redactSensitiveIrc('')).toBe('');
  });

  it('should not redact PRIVMSG to channels mentioning NickServ in text', () => {
    const line = ':user!u@host PRIVMSG #help :how do I use NickServ IDENTIFY?';
    expect(redactSensitiveIrc(line)).toBe(line);
  });
});

describe('URL Validation', () => {
  describe('isSafeUrl', () => {
    it('should allow https URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
      expect(isSafeUrl('https://sub.example.com/path?query=value')).toBe(true);
    });

    it('should allow http URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
      expect(isSafeUrl('http://localhost:8080')).toBe(true);
    });

    it('should block javascript URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('javascript:alert(document.cookie)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false); // Case insensitive
    });

    it('should block data URLs', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
      expect(isSafeUrl('DATA:text/plain,test')).toBe(false); // Case insensitive
    });

    it('should block vbscript URLs', () => {
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('VBScript:msgbox(1)')).toBe(false); // Case insensitive
    });

    it('should block file URLs', () => {
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('file:///C:/Windows/system.ini')).toBe(false);
      expect(isSafeUrl('FILE:///path')).toBe(false); // Case insensitive
    });

    it('should block about URLs', () => {
      expect(isSafeUrl('about:blank')).toBe(false);
      expect(isSafeUrl('about:config')).toBe(false);
      expect(isSafeUrl('ABOUT:blank')).toBe(false); // Case insensitive
    });

    it('should handle invalid URLs', () => {
      expect(isSafeUrl('not-a-url')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
      expect(isSafeUrl('http://')).toBe(false);
      expect(isSafeUrl('https://')).toBe(false);
    });

    it('should handle URLs with special characters', () => {
      expect(isSafeUrl('https://example.com/path?query=value&other=test')).toBe(true);
      expect(isSafeUrl('http://example.com:8080/path#fragment')).toBe(true);
      expect(isSafeUrl('https://user:pass@example.com')).toBe(true);
    });
  });
});

describe('CSS Color Validation', () => {
  describe('isSafeCssColor', () => {
    it('should allow valid hex colors', () => {
      expect(isSafeCssColor('#fff')).toBe(true);
      expect(isSafeCssColor('#FFF')).toBe(true);
      expect(isSafeCssColor('#FF0000')).toBe(true);
      expect(isSafeCssColor('#ff0000')).toBe(true);
      expect(isSafeCssColor('#ff000080')).toBe(true); // 8-digit hex (with alpha)
    });

    it('should allow valid named colors', () => {
      expect(isSafeCssColor('red')).toBe(true);
      expect(isSafeCssColor('blue')).toBe(true);
      expect(isSafeCssColor('transparent')).toBe(true);
    });

    it('should allow valid rgb() colors', () => {
      expect(isSafeCssColor('rgb(255, 0, 0)')).toBe(true);
      expect(isSafeCssColor('rgb(0,0,0)')).toBe(true);
    });

    it('should allow valid rgba() colors', () => {
      expect(isSafeCssColor('rgba(255, 0, 0, 0.5)')).toBe(true);
      expect(isSafeCssColor('rgba(0,0,0,1)')).toBe(true);
    });

    it('should reject empty string', () => {
      expect(isSafeCssColor('')).toBe(false);
    });

    it('should reject expression() CSS injection', () => {
      expect(isSafeCssColor('expression(alert(1))')).toBe(false);
    });

    it('should reject url() CSS injection', () => {
      expect(isSafeCssColor('url(https://evil.com/steal)')).toBe(false);
      expect(isSafeCssColor('url(javascript:alert(1))')).toBe(false);
    });

    it('should reject var() CSS injection', () => {
      expect(isSafeCssColor('var(--malicious)')).toBe(false);
    });

    it('should reject calc() CSS injection', () => {
      expect(isSafeCssColor('calc(100px)')).toBe(false);
    });

    it('should reject values with semicolons (property injection)', () => {
      expect(isSafeCssColor('red; background: url(evil)')).toBe(false);
    });

    it('should reject values with curly braces', () => {
      expect(isSafeCssColor('red} .evil { background: url(x)')).toBe(false);
    });

    it('should reject strings exceeding named color max length', () => {
      expect(isSafeCssColor('a'.repeat(31))).toBe(false);
    });

    it('should reject named colors with numbers', () => {
      expect(isSafeCssColor('color123')).toBe(false);
    });

    it('should reject hex color without hash', () => {
      expect(isSafeCssColor('FF0000')).toBe(false);
    });

    it('should reject hex color with too many digits', () => {
      expect(isSafeCssColor('#FF0000FF00')).toBe(false); // 10 hex digits
    });

    it('should reject JavaScript protocol in color value', () => {
      expect(isSafeCssColor('javascript:alert(1)')).toBe(false);
    });

    it('should reject data URI in color value', () => {
      expect(isSafeCssColor('data:text/css,*{}')).toBe(false);
    });

    it('should reject -moz-binding CSS injection', () => {
      expect(isSafeCssColor('-moz-binding:url(evil)')).toBe(false);
    });
  });
});