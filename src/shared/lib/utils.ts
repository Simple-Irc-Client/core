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
    const [, a, b] = ipv4Match.map(Number);
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
  if (ip.startsWith('2001:0') || ip.startsWith('2001::')) return true;

  return false;
}

// Test cases for URL validation
export function testUrlValidation() {
  // Should allow safe URLs
  console.assert(isSafeUrl('https://example.com') === true, 'Should allow https URLs');
  console.assert(isSafeUrl('http://example.com') === true, 'Should allow http URLs');
  
  // Should block dangerous URLs
  console.assert(isSafeUrl('javascript:alert(1)') === false, 'Should block javascript URLs');
  console.assert(isSafeUrl('data:text/html,<script>alert(1)</script>') === false, 'Should block data URLs');
  console.assert(isSafeUrl('vbscript:msgbox(1)') === false, 'Should block vbscript URLs');
  console.assert(isSafeUrl('file:///etc/passwd') === false, 'Should block file URLs');
  console.assert(isSafeUrl('about:blank') === false, 'Should block about URLs');
  
  // Should handle invalid URLs
  console.assert(isSafeUrl('not-a-url') === false, 'Should handle invalid URLs');
  console.assert(isSafeUrl('') === false, 'Should handle empty strings');
}
