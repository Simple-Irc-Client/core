import i18next from '@/app/i18n';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { isChannel, setChannelAvatar, setChannelDisplayName } from '@features/channels/store/channels';
import { getCurrentChannelName, getCurrentNick, isSameName, setCurrentUserAvatar, setCurrentUserColor, setCurrentUserDisplayName, setCurrentUserHomepage, setCurrentUserStatus, setSupportedOption } from '@features/settings/store/settings';
import { setUserAvatar, setUserBot, setUserColor, setUserDisplayName, setUserHomepage, setUserStatus } from '@features/users/store/users';
import { isSafeCssColor, isSafeImageUrl, isSafeUrl } from '@shared/lib/utils';
import { MessageCategory } from '@shared/types';

const RPL_WHOISKEYVALUE = '760';
const RPL_KEYVALUE = '761';
const RPL_METADATAEND = '762';
const ERR_NOMATCHINGKEY = '766';
const RPL_METADATASUBOK = '770';

export const applyMetadata = (nickOrChannel: string, item: string | undefined, value: string | undefined): void => {
  const normalizedValue = (value === undefined || value === '') ? undefined : value;

  if (isChannel(nickOrChannel)) {
    if (item === 'avatar') {
      if (normalizedValue !== undefined) {
        const avatarUrl = normalizedValue.replace('{size}', '64');
        if (isSafeImageUrl(avatarUrl)) {
          setChannelAvatar(nickOrChannel, avatarUrl);
        }
      }
    }
    if (item === 'display-name') {
      setChannelDisplayName(nickOrChannel, normalizedValue ?? '');
    }
  } else {
    const isCurrentUser = isSameName(nickOrChannel, getCurrentNick());

    if (item === 'avatar') {
      if (normalizedValue !== undefined) {
        const avatarUrl = normalizedValue.replace('{size}', '64');
        if (isSafeImageUrl(avatarUrl)) {
          setUserAvatar(nickOrChannel, avatarUrl);
          if (isCurrentUser) { setCurrentUserAvatar(avatarUrl); }
        }
      } else {
        setUserAvatar(nickOrChannel, undefined);
        if (isCurrentUser) { setCurrentUserAvatar(undefined); }
      }
    }
    if (item === 'color') {
      if (normalizedValue === undefined || isSafeCssColor(normalizedValue)) {
        setUserColor(nickOrChannel, normalizedValue);
        if (isCurrentUser) { setCurrentUserColor(normalizedValue); }
      }
    }
    if (item === 'display-name') {
      setUserDisplayName(nickOrChannel, normalizedValue);
      if (isCurrentUser) { setCurrentUserDisplayName(normalizedValue); }
    }
    if (item === 'status') {
      setUserStatus(nickOrChannel, normalizedValue);
      if (isCurrentUser) { setCurrentUserStatus(normalizedValue); }
    }
    if (item === 'homepage') {
      if (normalizedValue === undefined || isSafeUrl(normalizedValue)) {
        setUserHomepage(nickOrChannel, normalizedValue);
        if (isCurrentUser) { setCurrentUserHomepage(normalizedValue); }
      }
    }
    if (item === 'bot') {
      setUserBot(nickOrChannel, normalizedValue !== undefined);
    }
  }
};

// https://ircv3.net/specs/core/metadata-3.2
// :netsplit.pirc.pl METADATA Noop avatar * :https://www.gravatar.com/avatar/55a2daf22200bd0f31cdb6b720911a74.jpg
// :netsplit.pirc.pl METADATA #channel avatar * :https://example.com/channel-avatar.png
// :netsplit.pirc.pl METADATA Noop display-name * :John Doe
export const onMetadata = (ctx: IrcContext): void => {
  const nickOrChannel = ctx.line.shift();
  const item = ctx.line.shift()?.toLowerCase();
  ctx.line.shift(); // flags

  let value = ctx.line.shift();
  if (value?.startsWith(':')) {
    value = value.substring(1) + (ctx.line.length > 0 ? ' ' + ctx.line.join(' ') : '');
    ctx.line = [];
  }

  if (nickOrChannel === undefined) {
    ctx.logParseError(onMetadata, 'nickOrChannel');
    return;
  }

  applyMetadata(nickOrChannel, item, value);
};

// :insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg
// :chmurka.pirc.pl 761 sic-test kazuisticsimplicity ignore_list * :0
// :chmurka.pirc.pl 761 sic-test aqq color * :#0000ff
export const onRaw761 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nickOrChannel = ctx.line.shift();
  const item = ctx.line.shift()?.toLowerCase();
  ctx.line.shift(); // flags
  const value = ctx.trailingOptional();

  if (nickOrChannel === undefined) {
    ctx.logParseError(onRaw761, 'nickOrChannel');
    return;
  }

  applyMetadata(nickOrChannel, item, value);
};

// :chmurka.pirc.pl 762 SIC-test :end of metadata
export const onRaw762 = (): void => {
  // Nothing to do
};

// :insomnia.pirc.pl 766 SIC-test SIC-test Avatar :no matching key
// :ergo.test 766 * probebot display-name :Key deleted
// Also the draft/metadata-2 deletion notice: either way the key is now unset
export const onRaw766 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nickOrChannel = ctx.line.shift();
  const item = ctx.line.shift()?.toLowerCase();

  if (nickOrChannel === undefined) {
    ctx.logParseError(onRaw766, 'nickOrChannel');
    return;
  }

  applyMetadata(nickOrChannel, item, undefined);
};

// :jowisz.pirc.pl 770 Merovingian :avatar           (one key per line — pirc.pl)
// :ergo.test 770 * avatar status bot display-name   (multiple keys per line — ergo)
export const onRaw770 = (ctx: IrcContext): void => {
  ctx.line.shift(); // myNick
  const items = ctx.trailing().toLowerCase();

  for (const item of items.split(' ')) {
    if (item.length > 0) {
      setSupportedOption(`metadata-${item}`);
    }
  }
};

// A metadata line in WHOIS output
// :ergo.test 760 mynick nick display-name * :Whois Display
export const onRaw760 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const key = ctx.line.shift();
  ctx.line.shift(); // visibility
  const value = ctx.trailing();

  showReply(ctx, {
    message: i18next.t('kernel.760', { user, key, value }),
    target: getCurrentChannelName(),
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_WHOISKEYVALUE]: onRaw760,
  METADATA: onMetadata,
  [RPL_KEYVALUE]: onRaw761,
  [RPL_METADATAEND]: onRaw762,
  [RPL_METADATASUBOK]: onRaw770,
  [ERR_NOMATCHINGKEY]: onRaw766,
};
