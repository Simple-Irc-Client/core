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
