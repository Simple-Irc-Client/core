import { memo } from 'react';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/shared/lib/dateLocale';
import { ChannelCategory, MessageCategory, type Message } from '@shared/types';
import { useSettingsStore } from '@features/settings/store/settings';
import { useContextMenuActions } from '@/providers/ContextMenuContext';
import Avatar from '@shared/components/Avatar';
import ImagesPreview from '@shared/components/ImagesPreview';
import YouTubeThumbnail from '@shared/components/YouTubeThumbnail';
import SocialEmbed from '@shared/components/SocialEmbed';
import MessageText from './MessageText';
import BotIndicator from './BotIndicator';
import EchoedIndicator from './EchoedIndicator';
import E2eeIndicator from '@features/e2ee/components/E2eeIndicator';
import NickHighlightedMessage from './NickHighlightedMessage';
import { getNickFromMessage, getDisplayNickFromMessage } from '@shared/lib/displayName';
import { isSafeCssColor, ensureNickContrast } from '@shared/lib/utils';

const italicCategories = new Set<MessageCategory>([MessageCategory.join, MessageCategory.part, MessageCategory.quit, MessageCategory.kick]);

export const contentCategories = new Set<MessageCategory>([MessageCategory.default, MessageCategory.me, MessageCategory.notice]);

const isBotMessage = (message: Message): boolean =>
  message.nick !== undefined && typeof message.nick !== 'string' && message.nick.bot === true;

interface ChatMessageProps {
  message: Message;
  /** Consecutive message from the same nick — themes may render it without avatar/header. */
  grouped: boolean;
  /** Debug/Status channel message — styled by the fixed [data-debug] rules, not by themes. */
  isDebug: boolean;
  fontSizeClass: string;
}

/**
 * The single chat message renderer. It emits a superset DOM with stable
 * `sic-*` class names and data attributes; the active theme's CSS decides
 * which parts are visible and how they are laid out (see the builtin theme
 * files under @features/themes/builtin for the contract).
 *
 * Trade-off: parts a theme hides are still rendered (e.g. avatars under the
 * classic theme may fetch images even though they are not shown) — the DOM
 * must stay identical across themes so switching is pure CSS.
 */
const ChatMessage = ({ message, grouped, isDebug, fontSizeClass }: ChatMessageProps) => {
  const { handleContextMenuUserClick } = useContextMenuActions();
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const currentChannelCategory = useSettingsStore((s) => s.currentChannelCategory);

  const nick = getNickFromMessage(message);
  const displayNick = getDisplayNickFromMessage(message);
  const avatar = message.nick !== undefined && typeof message.nick !== 'string' ? message.nick.avatar : undefined;
  const rawNickColor = message.nick !== undefined && typeof message.nick !== 'string' ? message.nick.color : undefined;
  const nickColor = !isDebug && rawNickColor && isSafeCssColor(rawNickColor) ? ensureNickContrast(rawNickColor, isDarkMode) : undefined;

  const isContent = contentCategories.has(message.category);
  // Every non-echoed DM message is flagged `highlight` (see kernel.ts) so it
  // still triggers notifications/unread badges — but that makes the visual
  // tint meaningless there since every line in the window would get it. Kept
  // for channels, where it actually distinguishes a mention from the rest.
  const showHighlight = message.highlight && currentChannelCategory !== ChannelCategory.priv;
  // Debug output has fixed single-line styling, so the avatar/header slots are
  // never shown there — skip them entirely (also avoids avatar fetches)
  const showHeaderLayout = isContent && !isDebug;
  const isItalic = italicCategories.has(message.category);
  const isBot = isBotMessage(message);
  const time = new Date(message.time);
  const locale = getDateFnsLocale();

  const handleNickContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (nick) {
      event.preventDefault();
      handleContextMenuUserClick(event, 'user', nick);
    }
  };

  const renderTime = (slotClass: string, withEcho: boolean) => (
    <span className={`sic-msg-time ${slotClass}`}>
      {format(time, 'HH:mm', { locale })}
      <span className="sic-msg-time-seconds">{format(time, ':ss', { locale })}</span>
      {withEcho && message.echoed && <EchoedIndicator />}
      {/*
        Rendered in every time slot, not just the header one: Classic hides the
        header and shows the inline time, so gating this on `withEcho` the way
        the echo tick does would leave Classic users with no lock at all. Themes
        hide the slots they don't use, so exactly one is ever visible.
      */}
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
      data-e2ee={message.e2ee}
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
            {(isItalic || !isContent) && nick ? (
              <NickHighlightedMessage text={message.message} displayNick={displayNick} onContextMenu={handleNickContextMenu} />
            ) : (
              <MessageText text={message.message} />
            )}
          </span>
          {showHeaderLayout && renderTime('sic-msg-time-trailing', true)}
        </div>
        {!isDebug && (
          <div className="sic-msg-embeds">
            <YouTubeThumbnail text={message.message} />
            <ImagesPreview text={message.message} />
            <SocialEmbed text={message.message} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Every new line in a channel replaces the `messages` array, so without this the
 * whole visible backlog (up to `maxMessages`) re-runs its date formatting and
 * its URL/image/embed scans on each incoming message. The `Message` objects
 * themselves keep their identity across that update, so the comparison holds.
 */
export default memo(ChatMessage);
