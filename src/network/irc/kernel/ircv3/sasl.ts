import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { finishCapNegotiation } from '@/network/irc/kernel/ircv3/cap';
import { ircSendRawMessage } from '@/network/irc/network';
import { handleSaslChallenge, isSaslInProgress, saveSaslCredentialsForReconnect, setAuthenticatedAccount, setSaslState } from '@/network/irc/sasl';
import { MessageCategory } from '@shared/types';

const RPL_LOGGEDIN = '900';
const RPL_LOGGEDOUT = '901';
const ERR_NICKLOCKED = '902';
const RPL_SASLSUCCESS = '903';
const ERR_SASLFAIL = '904';
const ERR_SASLTOOLONG = '905';
const ERR_SASLABORTED = '906';
const ERR_SASLALREADY = '907';
const RPL_SASLMECHS = '908';

// AUTHENTICATE + (server ready for credentials)
// AUTHENTICATE <base64 challenge> (for mechanisms that need it)
export const onAuthenticate = (ctx: IrcContext): void => {
  const challenge = ctx.line[0] ?? '+';

  if (!isSaslInProgress()) {
    return;
  }

  setSaslState('authenticating');

  const responses = handleSaslChallenge(challenge, 'PLAIN');

  if (responses === null) {
    ircSendRawMessage('AUTHENTICATE *');
    setSaslState('failed');
    finishCapNegotiation();
    return;
  }

  for (const response of responses) {
    ircSendRawMessage(`AUTHENTICATE ${response}`);
  }
};

// :server 900 <nick> <nick>!<ident>@<host> <account> :You are now logged in as <account>
export const onRaw900 = (ctx: IrcContext): void => {
  const account = ctx.line[2] ?? null;
  setAuthenticatedAccount(account);

  showReply(ctx, {
    message: i18next.t('kernel.sasl.loggedIn', { account }),
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 901 <nick> <nick>!<ident>@<host> :You are now logged out
export const onRaw901 = (ctx: IrcContext): void => {
  setAuthenticatedAccount(null);

  showReply(ctx, {
    message: i18next.t('kernel.sasl.loggedOut'),
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 902 <nick> :You must use a nick assigned to you
export const onRaw902 = (ctx: IrcContext): void => {
  setSaslState('failed');

  showReply(ctx, {
    message: i18next.t('kernel.sasl.nickLocked'),
    target: STATUS_CHANNEL,
    category: MessageCategory.error,
  });

  finishCapNegotiation();
};

// :server 903 <nick> :SASL authentication successful
export const onRaw903 = (ctx: IrcContext): void => {
  // Before setSaslState clears the plaintext
  void saveSaslCredentialsForReconnect();
  setSaslState('success');

  showReply(ctx, {
    message: i18next.t('kernel.sasl.success'),
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });

  finishCapNegotiation();
};

// :server 904 <nick> :SASL authentication failed
export const onRaw904 = (ctx: IrcContext): void => {
  setSaslState('failed');

  showReply(ctx, {
    message: i18next.t('kernel.sasl.failed'),
    target: STATUS_CHANNEL,
    category: MessageCategory.error,
  });

  finishCapNegotiation();
};

// :server 905 <nick> :SASL message too long
export const onRaw905 = (ctx: IrcContext): void => {
  setSaslState('failed');

  showReply(ctx, {
    message: i18next.t('kernel.sasl.tooLong'),
    target: STATUS_CHANNEL,
    category: MessageCategory.error,
  });

  finishCapNegotiation();
};

// :server 906 <nick> :SASL authentication aborted
export const onRaw906 = (ctx: IrcContext): void => {
  setSaslState('failed');

  showReply(ctx, {
    message: i18next.t('kernel.sasl.aborted'),
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });

  finishCapNegotiation();
};

// :server 907 <nick> :You have already authenticated using SASL
export const onRaw907 = (): void => {
  setSaslState('success');
  finishCapNegotiation();
};

// :server 908 mynick PLAIN,EXTERNAL :are available SASL mechanisms
export const onRaw908 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const mechanisms = ctx.line.shift();

  showReply(ctx, {
    message: i18next.t('kernel.908', { mechanisms, defaultValue: `Available SASL mechanisms: ${mechanisms}` }),
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  AUTHENTICATE: onAuthenticate,
  [RPL_LOGGEDIN]: onRaw900,
  [RPL_LOGGEDOUT]: onRaw901,
  [ERR_NICKLOCKED]: onRaw902,
  [RPL_SASLSUCCESS]: onRaw903,
  [ERR_SASLFAIL]: onRaw904,
  [ERR_SASLTOOLONG]: onRaw905,
  [ERR_SASLABORTED]: onRaw906,
  [ERR_SASLALREADY]: onRaw907,
  [RPL_SASLMECHS]: onRaw908,
};
