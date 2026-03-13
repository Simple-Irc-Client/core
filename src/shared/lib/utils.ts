import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'about:', 'file:'];
    if (dangerousProtocols.includes(parsed.protocol.toLowerCase())) {
      return false;
    }
    
    // Only allow http and https
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const SAFE_CSS_COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]{1,30}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\))$/i;

export function isSafeCssColor(value: string): boolean {
  return SAFE_CSS_COLOR_RE.test(value);
}

function parseHexColor(hex: string): [number, number, number] | null {
  hex = hex.replace('#', '');
  if (hex.length === 3) { hex = (hex[0] ?? '') + (hex[0] ?? '') + (hex[1] ?? '') + (hex[1] ?? '') + (hex[2] ?? '') + (hex[2] ?? ''); }
  if (hex.length < 6) { return null; }
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) { return null; }
  return [r, g, b];
}

function parseCssColorToRgb(color: string): [number, number, number] | null {
  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(color);
  if (rgbMatch) { return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]; }
  if (color.startsWith('#')) { return parseHexColor(color); }
  // For named colors, use a temporary element
  if (typeof document !== 'undefined') {
    const el = document.createElement('span');
    el.style.color = color;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(computed);
    if (m) { return [Number(m[1]), Number(m[2]), Number(m[3])]; }
  }
  return null;
}

/** Relative luminance per WCAG 2.0 */
function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) { return [0, 0, l]; }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) { h = ((g - b) / d + (g < b ? 6 : 0)) / 6; }
  else if (max === g) { h = ((b - r) / d + 2) / 6; }
  else { h = ((r - g) / d + 4) / 6; }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) { t += 1; }
    if (t > 1) { t -= 1; }
    if (t < 1/6) { return p + (q - p) * 6 * t; }
    if (t < 1/2) { return q; }
    if (t < 2/3) { return p + (q - p) * (2/3 - t) * 6; }
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

const MIN_CONTRAST_RATIO = 3.0;

/**
 * Adjusts a nick color to ensure readable contrast against the theme background.
 * Returns the adjusted color as a hex string, or the original if already readable.
 */
export function ensureNickContrast(color: string, isDark: boolean): string {
  const rgb = parseCssColorToRgb(color);
  if (!rgb) { return color; }

  const bgLuminance = isDark ? 0.05 : 0.95; // approximate dark/light background luminance
  const colorLuminance = relativeLuminance(...rgb);

  const lighter = Math.max(bgLuminance, colorLuminance);
  const darker = Math.min(bgLuminance, colorLuminance);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  if (ratio >= MIN_CONTRAST_RATIO) { return color; }

  // Adjust lightness to meet contrast ratio
  const [h, s, l] = rgbToHsl(...rgb);
  let newL = l;
  const step = isDark ? 0.05 : -0.05;
  for (let i = 0; i < 20; i++) {
    newL = Math.max(0, Math.min(1, newL + step));
    const [nr, ng, nb] = hslToRgb(h, s, newL);
    const newLum = relativeLuminance(nr, ng, nb);
    const newLighter = Math.max(bgLuminance, newLum);
    const newDarker = Math.min(bgLuminance, newLum);
    const newRatio = (newLighter + 0.05) / (newDarker + 0.05);
    if (newRatio >= MIN_CONTRAST_RATIO) {
      const toHex = (v: number) => v.toString(16).padStart(2, '0');
      return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
    }
  }

  // Fallback: return a readable default
  const [fr, fg, fb] = hslToRgb(h, s, newL);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(fr)}${toHex(fg)}${toHex(fb)}`;
}

// IRC nick validation: RFC 2812 allows letters, digits, and special chars - [ ] \ ` ^ { } |
const VALID_NICK_RE = /^[a-zA-Z\d\-_[\]\\`^{}|]+$/;
const DEFAULT_MAX_NICK_LENGTH = 50;

export function isValidNick(nick: string, maxLength: number = DEFAULT_MAX_NICK_LENGTH): boolean {
  return nick.length > 0 && nick.length <= maxLength && VALID_NICK_RE.test(nick);
}

export function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase();

  // Localhost variants
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '[::1]') {
    return true;
  }

  // IPv6 in brackets
  const ip = (lower.startsWith('[') && lower.endsWith(']')) ? lower.slice(1, -1) : lower;

  // IPv4 private ranges
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (ipv4Match) {
    const [, a = 0, b = 0] = ipv4Match.map(Number);
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 127) return true;                          // 127.0.0.0/8
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
    if (a === 0) return true;                            // 0.0.0.0/8
  }

  // IPv6 private
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;  // ULA
  if (ip.startsWith('fe80')) return true;                        // link-local
  if (ip === '::') return true;                                  // unspecified

  // IPv4-mapped IPv6
  const v4MappedMatch = /^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (v4MappedMatch && v4MappedMatch[1]) {
    return isPrivateHost(v4MappedMatch[1]);
  }

  // Teredo
  if (ip.startsWith('2001:0') || ip.startsWith('2001::')) { return true; }

  return false;
}

/** Redact sensitive IRC messages (credentials, passwords) for safe debug logging */
const SENSITIVE_IRC_PATTERNS = /^(AUTHENTICATE |PASS |:.* PRIVMSG\s+NickServ\s+:IDENTIFY )/i;
export function redactSensitiveIrc(line: string): string {
  if (SENSITIVE_IRC_PATTERNS.test(line)) {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) { return line; }
    // For ":sender PRIVMSG NickServ :IDENTIFY ...", keep up to "IDENTIFY"
    const identifyMatch = line.match(/^(:.* PRIVMSG\s+NickServ\s+:IDENTIFY)\s/i);
    if (identifyMatch) { return `${identifyMatch[1]} ***`; }
    // For "AUTHENTICATE <payload>" or "PASS <password>"
    return `${line.substring(0, spaceIdx)} ***`;
  }
  return line;
}
