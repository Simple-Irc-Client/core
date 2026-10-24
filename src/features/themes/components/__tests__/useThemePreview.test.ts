import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PREVIEW_STYLE_ID, useThemePreview } from '../useThemePreview';

const preview = (): HTMLStyleElement | null => document.getElementById(PREVIEW_STYLE_ID) as HTMLStyleElement | null;

describe('useThemePreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    preview()?.remove();
  });

  it('should apply the draft a moment after typing stops, after every other style', () => {
    document.head.appendChild(document.createElement('style'));
    const { rerender } = renderHook(({ css }) => useThemePreview(css, true), { initialProps: { css: '.a{}' } });

    vi.advanceTimersByTime(200);
    rerender({ css: '.a{color:red}' });
    vi.advanceTimersByTime(200);
    expect(preview()).toBeNull();

    vi.advanceTimersByTime(100);
    expect(preview()?.textContent).toBe('.a{color:red}');
    expect(document.head.lastElementChild).toBe(preview());
  });

  it('should update the one preview style rather than add another', () => {
    const { rerender } = renderHook(({ css }) => useThemePreview(css, true), { initialProps: { css: '.a{}' } });
    vi.advanceTimersByTime(300);
    rerender({ css: '.b{}' });
    vi.advanceTimersByTime(300);

    expect(document.querySelectorAll(`#${PREVIEW_STYLE_ID}`)).toHaveLength(1);
    expect(preview()?.textContent).toBe('.b{}');
  });

  it('should apply nothing while turned off', () => {
    renderHook(() => useThemePreview('.a{color:red}', false));
    vi.advanceTimersByTime(300);

    expect(preview()).toBeNull();
  });

  it('should take the preview away when closed', () => {
    const { unmount } = renderHook(() => useThemePreview('.a{color:red}', true));
    vi.advanceTimersByTime(300);

    unmount();

    expect(preview()).toBeNull();
  });

  it('should not apply a draft still waiting when closed', () => {
    const { unmount } = renderHook(() => useThemePreview('.a{color:red}', true));
    unmount();
    vi.advanceTimersByTime(300);

    expect(preview()).toBeNull();
  });
});
