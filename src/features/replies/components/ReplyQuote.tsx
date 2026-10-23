import { Reply } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDisplayNickFromMessage } from '@shared/lib/displayName';
import { stripIrcFormatting } from '@shared/lib/ircFormatting';
import { type Message } from '@shared/types';

interface ReplyQuoteProps {
  /** The message replied to, when it is shown */
  replied: Message | undefined;
  onShow: () => void;
}

/** Above a reply: what it answers; clicking goes to it */
const ReplyQuote = ({ replied, onShow }: ReplyQuoteProps) => {
  const { t } = useTranslation();

  return (
    <button type="button" className="sic-msg-reply" title={t('main.chat.showReplied')} onClick={onShow}>
      <Reply className="sic-msg-reply-icon" aria-hidden="true" />
      {replied === undefined ? (
        <span className="sic-msg-reply-text">{t('main.chat.replyToEarlier')}</span>
      ) : (
        <>
          <span className="sic-msg-reply-nick">{getDisplayNickFromMessage(replied)}</span>
          <span className="sic-msg-reply-text">{stripIrcFormatting(replied.message)}</span>
        </>
      )}
    </button>
  );
};

export default ReplyQuote;
