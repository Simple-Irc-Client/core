import { useTranslation } from 'react-i18next';
import { hasReacted, sendReaction } from '@features/reactions/reactions';
import { useActiveSession } from '@features/networks/store/networks';
import { type Message } from '@shared/types';

interface MessageReactionsProps {
  message: Message;
  canReact: boolean;
}

/** Each reaction with its count; clicking one adds ours or takes it back */
const MessageReactions = ({ message, canReact }: MessageReactionsProps) => {
  const { t } = useTranslation();
  const nick = useActiveSession((session) => session.nick);

  return (
    <div className="sic-msg-reactions">
      {message.reactions?.map((reaction) => {
        const isOwn = hasReacted(reaction, nick);
        const nicks = reaction.nicks.join(', ');
        return (
          <button
            key={reaction.emoji}
            type="button"
            className="sic-reaction"
            aria-pressed={isOwn}
            aria-label={t('main.chat.reaction', { emoji: reaction.emoji, nicks })}
            title={nicks}
            disabled={!canReact}
            onClick={() => sendReaction(message, reaction.emoji, !isOwn)}
          >
            <span className="sic-reaction-emoji">{reaction.emoji}</span>
            <span className="sic-reaction-count">{reaction.nicks.length}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MessageReactions;
