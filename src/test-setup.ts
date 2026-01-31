import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Suppress console output during tests
vi.stubGlobal('console', {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
});

// Mock navigator.language for consistent i18n behavior in tests
// Use Polish to match existing test expectations
Object.defineProperty(navigator, 'language', {
  value: 'pl',
  configurable: true,
});
Object.defineProperty(navigator, 'languages', {
  value: ['pl'],
  configurable: true,
});

afterEach(() => {
  cleanup();
});
