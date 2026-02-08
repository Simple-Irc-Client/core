import { describe, it, expect } from 'vitest';
import { isSafeUrl } from '../utils';

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