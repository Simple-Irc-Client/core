import { Fragment, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChannelCategory, MessageCategory, type Message } from '@shared/types';
import { useActiveSession } from '@features/networks/store/networks';
import { useContextMenuActions } from '@/providers/ContextMenuContext';
import Avatar from '@shared/components/Avatar';
import ImagesPreview from '@shared/components/ImagesPreview';
import YouTubeThumbnail from '@shared/components/YouTubeThumbnail';
import SocialEmbed from '@shared/components/SocialEmbed';
import MessageText from './MessageText';
import MessageTime from './MessageTime';
import BotIndicator from './BotIndicator';
import EchoedIndicator from './EchoedIndicator';
import E2eeIndicator from '@features/e2ee/components/E2eeIndicator';
import NickHighlightedMessage from './NickHighlightedMessage';
import { getNickFromMessage, getDisplayNickFromMessage } from '@shared/lib/displayName';
import { isSafeCssColor, ensureReadableColor } from '@shared/lib/utils';
import { useThemeBackgroundStore } from '@features/themes/themeBackground';
import AddReactionButton from '@features/reactions/components/AddReactionButton';
import MessageReactions from '@features/reactions/components/MessageReactions';
import ReplyButton from '@features/replies/components/ReplyButton';
import ReplyQuote from '@features/replies/components/ReplyQuote';
import RedactButton from '@features/redaction/components/RedactButton';
import { QUOTE_PREFIX, splitQuotedLines } from '@features/replies/replies';
import { plainText } from '../spoilers';
import { contentCategories } from '../membershipEvents';

const repliableCategories = new Set<MessageCategory>([MessageCategory.default, MessageCategory.me]);

const italicCategories = new Set<MessageCategory>([MessageCategory.join, MessageCategory.part, MessageCategory.quit, MessageCategory.kick]);

const isBotMessage = (message: Message): boolean =>
  message.nick !== undefined && typeof message.nick !== 'string' && message.nick.bot === true;

interface ChatMessageProps {
  message: Message;
  /** Consecutive message from the same nick — themes may render it without avatar/header. */
  grouped: boolean;
  /** Debug/Status channel message — styled by the fixed [data-debug] rules, not by themes. */
  isDebug: boolean;
  fontSizeClass: string;
  /** Reactions can be sent in this window */
  canReact: boolean;
  onAddReaction: (message: Message, anchor: HTMLElement) => void;
  /** Replies can be sent in this window */
  canReply: boolean;
  onReply: (message: Message) => void;
  /** The message this one replies to, when it is shown */
  replied: Message | undefined;
  onShowMessage: (msgid: string) => void;
  /** This message may be deleted by the user */
  canRedact: boolean;
  onRedact: (message: Message) => void;
}

/**
 * Renders the same `sic-*` DOM for every theme; theme CSS hides/arranges parts (contract in
 * themes/builtin/*.css). Hidden parts still render so switching themes is pure CSS.
 */
const ChatMessage = ({ message, grouped, isDebug, fontSizeClass, canReact, onAddReaction, canReply, onReply, replied, onShowMessage, canRedact, onRedact }: ChatMessageProps) => {
  const { t } = useTranslation();
  const { handleContextMenuUserClick } = useContextMenuActions();
  const backgroundLuminance = useThemeBackgroundStore((s) => s.luminance);
  const currentChannelCategory = useActiveSession((session) => session.currentChannelCategory);

  const nick = getNickFromMessage(message);
  const displayNick = getDisplayNickFromMessage(message);
  const avatar = message.nick !== undefined && typeof message.nick !== 'string' ? message.nick.avatar : undefined;
  const rawNickColor = message.nick !== undefined && typeof message.nick !== 'string' ? message.nick.color : undefined;
  const nickColor = !isDebug && rawNickColor && isSafeCssColor(rawNickColor) ? ensureReadableColor(rawNickColor, backgroundLuminance) : undefined;

  const isContent = contentCategories.has(message.category);
  // Every DM message is flagged `highlight` for notifications, so the tint only means something in channels
  const showHighlight = message.highlight && currentChannelCategory !== ChannelCategory.priv;
  // Debug output never shows avatar/header; skipping them also avoids avatar fetches
  const showHeaderLayout = isContent && !isDebug;
  const isItalic = italicCategories.has(message.category);
  const isBot = isBotMessage(message);
  const time = new Date(message.time);
  const isRedacted = message.redacted === true;
  // Reactions point at the server's msgid
  const isReactable = canReact && message.msgid !== undefined && !isRedacted;
  // An encrypted message is never quoted in plaintext
  const isRepliable = canReply && repliableCategories.has(message.category) && !message.system && message.e2ee === undefined && !isRedacted;
  const isRedactable = canRedact && message.msgid !== undefined && repliableCategories.has(message.category) && message.e2ee === undefined && !isRedacted;
  const hasActions = isReactable || isRepliable || isRedactable;
  const isMultiline = message.message.includes('\n');
  const isQuote = isContent && message.message.startsWith(QUOTE_PREFIX) && !isMultiline;
  // Of a multiline message only some lines may be quotes
  const quotedLines = isContent && isMultiline && message.message.split('\n').some((line) => line.startsWith(QUOTE_PREFIX))
    ? splitQuotedLines(message.message)
    : undefined;
  const { replyTo } = message;
  const shownText = plainText(message.message);
  const showsReplyQuote = replyTo !== undefined && isContent && !isDebug;

  const handleNickContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (nick) {
      event.preventDefault();
      handleContextMenuUserClick(event, 'user', nick);
    }
  };

  const renderTime = (slotClass: string, withEcho: boolean) => (
    <span className={`sic-msg-time ${slotClass}`}>
      <MessageTime time={time} />
      {withEcho && message.echoed && <EchoedIndicator />}
      {/* In every slot (unlike the echo tick): single-line themes only show the inline time */}
      {message.e2ee && <E2eeIndicator state={message.e2ee} />}
    </span>
  );

  return (
    <div
      className="sic-msg"
      data-category={message.category}
      data-content={isContent || undefined}
      data-grouped={grouped || undefined}
      data-highlight={showHighlight || undefined}
      data-debug={isDebug || undefined}
      data-system={message.system || undefined}
      data-e2ee={message.e2ee}
      data-quote={isQuote || undefined}
      data-reply={showsReplyQuote || undefined}
      data-redacted={isRedacted || undefined}
      // Focusable, so a tap shows the message's actions where there is no hover
      tabIndex={hasActions ? -1 : undefined}
    >
      <div className="sic-msg-gutter">
        {showHeaderLayout && (
          <Avatar
            src={avatar}
            alt={displayNick}
            fallbackLetter={displayNick.substring(0, 1)}
            className="sic-msg-avatar h-10 w-10 cursor-pointer"
            onContextMenu={handleNickContextMenu}
          />
        )}
      </div>
      <div className="sic-msg-content min-w-0">
        {showsReplyQuote && <ReplyQuote replied={replied} onShow={() => onShowMessage(replyTo)} />}
        {showHeaderLayout && (
          <div className={`sic-msg-header ${fontSizeClass}`}>
            <span
              className="sic-msg-nick cursor-pointer hover:underline"
              style={nickColor ? { color: nickColor } : undefined}
              onContextMenu={handleNickContextMenu}
            >
              {displayNick}
            </span>
            {isBot && <BotIndicator />}
            {renderTime('sic-msg-time-header', true)}
          </div>
        )}
        <div className={`sic-msg-line ${fontSizeClass}`}>
          {renderTime('sic-msg-time-inline', false)}
          {nick !== undefined && !isItalic && (
            <>
              <span
                className="sic-msg-nick sic-msg-nick-inline cursor-pointer hover:underline"
                style={nickColor ? { color: nickColor } : undefined}
                onContextMenu={handleNickContextMenu}
              >
                {displayNick}
              </span>
              {isBot && !isDebug && (
                <span className="sic-msg-bot-inline">
                  <BotIndicator />
                </span>
              )}
            </>
          )}
          <span className="sic-msg-body" style={message.color ? { color: message.color } : undefined}>
            {isRedacted ? (
              <span className="sic-msg-redacted">{t('main.chat.deleted')}</span>
            ) : (isItalic || !isContent) && nick ? (
              <NickHighlightedMessage text={message.message} displayNick={displayNick} onContextMenu={handleNickContextMenu} />
            ) : quotedLines ? (
              quotedLines.map((run, index) => (
                // Runs alternate, so the position stays the run's own
                <Fragment key={index}>
                  {index > 0 && '\n'}
                  {run.quote ? <span className="sic-msg-quote"><MessageText text={run.text} /></span> : <MessageText text={run.text} />}
                </Fragment>
              ))
            ) : (
              <MessageText text={isQuote ? message.message.slice(QUOTE_PREFIX.length) : message.message} />
            )}
          </span>
          {showHeaderLayout && renderTime('sic-msg-time-trailing', true)}
        </div>
        {!isDebug && !isRedacted && (
          // What the line shows: a link inside a spoiler gets no preview
          <div className="sic-msg-embeds">
            <YouTubeThumbnail text={shownText} />
            <ImagesPreview text={shownText} />
            <SocialEmbed text={shownText} />
          </div>
        )}
        {message.reactions && <MessageReactions message={message} canReact={isReactable} />}
      </div>
      {hasActions && (
        <div className="sic-msg-actions">
          {isRepliable && <ReplyButton onClick={() => onReply(message)} />}
          {isReactable && <AddReactionButton onClick={(anchor) => onAddReaction(message, anchor)} />}
          {isRedactable && <RedactButton onClick={() => onRedact(message)} />}
        </div>
      )}
    </div>
  );
};

// Each new line replaces the `messages` array but keeps Message identities, so memo spares the backlog a re-render
export default memo(ChatMessage);
