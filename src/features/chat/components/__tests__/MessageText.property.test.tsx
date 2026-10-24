import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import fc from 'fast-check';
import MessageText from '../MessageText';
import * as ContextMenuContext from '@/providers/ContextMenuContext';
import * as settings from '@features/settings/store/settings';
import { IRC_FORMAT } from '@/shared/lib/ircFormatting';
import { stripIrcFormatting } from '@/shared/lib/ircFormatting';

const piece = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 20 }),
  fc.constantFrom(...Object.values(IRC_FORMAT), `${IRC_FORMAT.COLOR}4,4`, '||', '#chan', ' '),
  fc.tuple(fc.constantFrom('https://', 'http://', 'javascript:', 'data:text/html,', 'JAVASCRIPT:', 'vbscript:', 'https://x.test/"onmouseover="'), fc.string({ maxLength: 20 })).map(([scheme, rest]) => scheme + rest),
);
const message = fc.array(piece, { maxLength: 12 }).map((pieces) => pieces.join(''));

describe('a message someone wrote, whatever it holds', () => {
  beforeEach(() => {
    vi.spyOn(ContextMenuContext, 'useContextMenuActions').mockReturnValue({ handleContextMenuUserClick: vi.fn(), handleContextMenuClose: vi.fn() });
    vi.spyOn(settings, 'getChannelTypes').mockReturnValue(['#']);
  });

  it('links only to http or https addresses, opened apart from the app', () => {
    fc.assert(fc.property(message, (text) => {
      const { container } = render(<MessageText text={text} />);
      for (const anchor of container.querySelectorAll('a')) {
        expect(new URL(anchor.getAttribute('href') ?? '').protocol).toMatch(/^https?:$/);
        expect(anchor.getAttribute('rel')).toContain('noopener');
      }
      cleanup();
    }), { numRuns: 200 });
  });

  it('renders text and nothing that runs: no script, iframe, or event handler attributes', () => {
    fc.assert(fc.property(message, (text) => {
      const { container } = render(<MessageText text={text} />);
      expect(container.querySelector('script, iframe, object, embed, img')).toBeNull();
      for (const element of container.querySelectorAll('*')) {
        expect([...element.attributes].some((attribute) => attribute.name.startsWith('on'))).toBe(false);
      }
      cleanup();
    }), { numRuns: 200 });
  });

  it('shows all the text, its formatting codes left out', () => {
    fc.assert(fc.property(message, (text) => {
      const { container } = render(<MessageText text={text} />);
      expect(container.textContent).toBe(stripIrcFormatting(text));
      cleanup();
    }), { numRuns: 200 });
  });
});
