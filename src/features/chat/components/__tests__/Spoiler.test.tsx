import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Spoiler from '../Spoiler';
import { parseIrcFormatting } from '@/shared/lib/ircFormatting';

const renderSpoiler = (text: string) => render(<Spoiler segments={parseIrcFormatting(text)} />);

describe('Spoiler', () => {
  it('covers the text with its color and keeps it from screen readers', () => {
    renderSpoiler('\x0314,14the secret');

    const spoiler = screen.getByRole('button', { name: 'main.spoiler.reveal' });
    expect(spoiler).toHaveStyle({ color: '#7F7F7F', backgroundColor: '#7F7F7F' });
    expect(spoiler).not.toHaveAttribute('data-revealed');
    expect(spoiler.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the text readable on the box once clicked', () => {
    const { container } = renderSpoiler('\x0314,14the secret');

    fireEvent.click(screen.getByRole('button'));

    const spoiler = container.querySelector('.sic-spoiler') as HTMLElement;
    expect(spoiler).toHaveAttribute('data-revealed');
    expect(spoiler).toHaveTextContent('the secret');
    expect(spoiler.style.color).not.toBe(spoiler.style.backgroundColor);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden]')).not.toBeInTheDocument();
  });

  it.each(['Enter', ' '])('is revealed by the %j key', (key) => {
    const { container } = renderSpoiler('\x0301,01dark');

    fireEvent.keyDown(screen.getByRole('button'), { key });

    expect(container.querySelector('.sic-spoiler')).toHaveAttribute('data-revealed');
  });

  it('is not revealed by other keys', () => {
    renderSpoiler('\x0301,01dark');

    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });

    expect(screen.getByRole('button')).not.toHaveAttribute('data-revealed');
  });

  it('keeps bold and italic of the runs inside', () => {
    const { container } = renderSpoiler('\x0314,14plain \x02bold');

    fireEvent.click(screen.getByRole('button'));

    expect(container.querySelector('.sic-spoiler')).toHaveTextContent('plain bold');
    expect(screen.getByText('bold')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('bold').style.color).toBe('');
  });
});
