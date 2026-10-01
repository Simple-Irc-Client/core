import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'about:', 'file:'];
    if (dangerousProtocols.includes(parsed.protocol.toLowerCase())) {
      return false;
    }
    
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// For <img> sources: https only (mixed content in the desktop webview), no private hosts (network probing)
export function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    return !isPrivateHost(parsed.hostname);
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

let colorCanvasContext: CanvasRenderingContext2D | null | undefined;

// Canvas converts any color syntax (oklch(), lab(), ...) to sRGB; computed style keeps those as-is
function resolveColorViaCanvas(color: string): [number, number, number] | null {
  if (colorCanvasContext === undefined) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    canvas?.setAttribute('width', '1');
    canvas?.setAttribute('height', '1');
    colorCanvasContext = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
  }
  const ctx = colorCanvasContext;
  if (!ctx) { return null; }
  ctx.fillStyle = color; // callers pass a color the engine already accepted
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : [r, g, b];
}

const RGB_FUNCTION_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/;

/** Null when unresolvable or fully transparent (e.g. an unset `background-color`). */
export function cssColorToRgb(color: string): [number, number, number] | null {
  const value = color.trim();
  if (value.startsWith('#')) { return parseHexColor(value); }
  const rgbMatch = RGB_FUNCTION_RE.exec(value);
  if (rgbMatch) {
    if (rgbMatch[4] !== undefined && Number(rgbMatch[4]) === 0) { return null; }
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }
  if (value === '' || value === 'transparent') { return null; }
  if (typeof document !== 'undefined') {
    const el = document.createElement('span');
    el.style.color = value;
    if (el.style.color === '') { return null; } // not a color at all
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    el.remove();
    const m = RGB_FUNCTION_RE.exec(computed);
    if (m) { return [Number(m[1]), Number(m[2]), Number(m[3])]; }
  }
  return resolveColorViaCanvas(value);
}

export function relativeLuminance(r: number, g: number, b: number): number {
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
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / d + 2) / 6
    : ((r - g) / d + 4) / 6;
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

const contrastRatio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const toHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export const LIGHT_BACKGROUND_LUMINANCE = 0.95;
export const DARK_BACKGROUND_LUMINANCE = 0.05;

const MIN_CONTRAST_RATIO = 3.0;
const READABLE_COLOR_CACHE_LIMIT = 500;
const readableColorCache = new Map<string, string>();

/** Shifts lightness (keeping hue) until the color reaches 3:1 contrast on the given background. */
export function ensureReadableColor(color: string, backgroundLuminance: number): string {
  const cacheKey = `${color}|${backgroundLuminance.toFixed(3)}`;
  const cached = readableColorCache.get(cacheKey);
  if (cached !== undefined) { return cached; }

  const result = computeReadableColor(color, backgroundLuminance);
  // Message colors are sender-controlled (\x04 hex), so bound the cache
  if (readableColorCache.size >= READABLE_COLOR_CACHE_LIMIT) { readableColorCache.clear(); }
  readableColorCache.set(cacheKey, result);
  return result;
}

function computeReadableColor(color: string, backgroundLuminance: number): string {
  const rgb = cssColorToRgb(color);
  if (!rgb) { return color; }
  if (contrastRatio(backgroundLuminance, relativeLuminance(...rgb)) >= MIN_CONTRAST_RATIO) { return color; }

  // A mid-grey background may need either direction
  const darken = contrastRatio(backgroundLuminance, 0) >= contrastRatio(backgroundLuminance, 1);
  const [h, s, l] = rgbToHsl(...rgb);
  let adjusted = rgb;
  for (let newL = l; darken ? newL > 0 : newL < 1;) {
    newL = Math.max(0, Math.min(1, newL + (darken ? -0.05 : 0.05)));
    adjusted = hslToRgb(h, s, newL);
    if (contrastRatio(backgroundLuminance, relativeLuminance(...adjusted)) >= MIN_CONTRAST_RATIO) { break; }
  }
  return toHex(adjusted);
}

// RFC 2812 nick characters
const VALID_NICK_RE = /^[a-zA-Z\d\-_[\]\\`^{}|]+$/;
const DEFAULT_MAX_NICK_LENGTH = 50;

export function isValidNick(nick: string, maxLength: number = DEFAULT_MAX_NICK_LENGTH): boolean {
  return nick.length > 0 && nick.length <= maxLength && VALID_NICK_RE.test(nick);
}

export function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase();

  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '[::1]') {
    return true;
  }

  const ip = (lower.startsWith('[') && lower.endsWith(']')) ? lower.slice(1, -1) : lower;

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

  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;  // ULA
  if (ip.startsWith('fe80')) return true;                        // link-local
  if (ip === '::') return true;                                  // unspecified

  const v4MappedMatch = /^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (v4MappedMatch && v4MappedMatch[1]) {
    return isPrivateHost(v4MappedMatch[1]);
  }

  // Teredo
  if (ip.startsWith('2001:0') || ip.startsWith('2001::')) { return true; }

  return false;
}

// Lines whose credentials are redacted from debug logs
const SENSITIVE_IRC_PATTERNS = /^(AUTHENTICATE |PASS |:.* PRIVMSG\s+NickServ\s+:IDENTIFY )/i;
export function redactSensitiveIrc(line: string): string {
  if (SENSITIVE_IRC_PATTERNS.test(line)) {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) { return line; }
    const identifyMatch = line.match(/^(:.* PRIVMSG\s+NickServ\s+:IDENTIFY)\s/i);
    if (identifyMatch) { return `${identifyMatch[1]} ***`; }
    return `${line.substring(0, spaceIdx)} ***`;
  }
  return line;
}
