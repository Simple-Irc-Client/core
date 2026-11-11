import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import AwayMessages from '../AwayMessages';
import { addAwayMessage } from '@features/channels/store/awayMessages';

describe('AwayMessages while closed', () => {
  it('should not re-render when an away message comes in', () => {
    const onRender = vi.fn();
    render(
      <Profiler id="away-messages" onRender={onRender}>
        <AwayMessages open={false} onOpenChange={vi.fn()} />
      </Profiler>,
    );
    onRender.mockClear();

    act(() => {
      addAwayMessage({ id: 'msg-1', message: 'hi', nick: 'sender', target: '#test', time: '2024-01-01T12:00:00.000Z', category: 'default', channel: '#test' });
    });

    expect(onRender).not.toHaveBeenCalled();
  });
});
