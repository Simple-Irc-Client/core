import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChannelListDialog from '../ChannelListDialog';
import type { ChannelList } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Emulate the dialog shell staying mounted while `open` is false — this is the
// Radix close-animation window during which the orphaned-table flash occurred.
// Children render regardless of `open`, so the only thing keeping the table out
// of the DOM is ChannelListDialog's own `{open && ...}` gate.
vi.mock('@shared/components/ui/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
  };
});

vi.mock('../ChannelListTable', () => ({
  default: () => <div data-testid="channel-list-table" />,
}));

const channelList: ChannelList[] = [{ name: '#test', users: 10, topic: '' }];

describe('ChannelListDialog', () => {
  const props = {
    onOpenChange: vi.fn(),
    channelList,
    isLoading: false,
    onJoin: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the channel list table while open', () => {
    render(<ChannelListDialog open onOpenChange={props.onOpenChange} channelList={channelList} isLoading={false} onJoin={props.onJoin} />);

    expect(screen.getByTestId('channel-list-table')).toBeInTheDocument();
  });

  it('does not render the channel list table once closing, even while the dialog shell is still mounted', () => {
    render(<ChannelListDialog open={false} onOpenChange={props.onOpenChange} channelList={channelList} isLoading={false} onJoin={props.onJoin} />);

    expect(screen.queryByTestId('channel-list-table')).not.toBeInTheDocument();
  });
});
