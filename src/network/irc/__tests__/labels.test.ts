import { describe, it, expect, beforeEach } from 'vitest';
import { clearLabels, createLabel, takeLabel } from '../labels';

describe('labels', () => {
  beforeEach(() => {
    clearLabels();
  });

  it('generates unique labels', () => {
    const labels = new Set([createLabel({}), createLabel({}), createLabel({})]);

    expect(labels.size).toBe(3);
  });

  it('returns the request a label was created for, once', () => {
    const label = createLabel({ window: '#chan' });

    expect(takeLabel(label)).toEqual({ window: '#chan' });
    expect(takeLabel(label)).toBeUndefined();
  });

  it('ignores labels it never created', () => {
    expect(takeLabel('unknown')).toBeUndefined();
  });

  it('forgets labels the server never answered', () => {
    const label = createLabel({ window: '#chan' }, 0);
    createLabel({}, 60_000);

    expect(takeLabel(label)).toBeUndefined();
  });

  it('keeps answered-in-time labels while pruning', () => {
    const label = createLabel({ window: '#chan' }, 0);
    createLabel({}, 59_999);

    expect(takeLabel(label)).toEqual({ window: '#chan' });
  });

  it('bounds the number of pending labels', () => {
    const first = createLabel({ window: '#first' }, 0);
    for (let i = 0; i < 256; i++) {
      createLabel({}, 1);
    }

    expect(takeLabel(first)).toBeUndefined();
  });

  it('forgets everything on clear', () => {
    const label = createLabel({ window: '#chan' });

    clearLabels();

    expect(takeLabel(label)).toBeUndefined();
  });
});
