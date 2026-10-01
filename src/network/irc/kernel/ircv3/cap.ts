import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { addAvailableCapabilities, endCapNegotiation, getCapabilitiesToRequest, isCapabilityEnabled, markCapabilitiesAcknowledged, markCapabilitiesRequested, parseCapabilityList, removeCapabilities, setAwaitingMoreCaps } from '@/network/irc/capabilities';
import { handleSocketClose } from '@/network/irc/kernel/connection';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { ircDisconnect, ircRequestMetadata, ircSendRawMessage } from '@/network/irc/network';
import { getSaslAccount, getSaslPassword, saveSaslCredentialsForReconnect, setSaslState } from '@/network/irc/sasl';
import { setSTSPolicy } from '@/network/irc/store/stsStore';
import { createSTSPolicy, getCurrentConnectionHost, isCurrentConnectionSecure, parseSTSValue, setPendingSTSUpgrade } from '@/network/irc/sts';
import { setAddMessageToAllChannels } from '@features/channels/store/channels';
import { setSupportedOption } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// :chmurka.pirc.pl CAP * LS * :sts=port=6697,duration=300 unrealircd.org/link-security=2 ...
// :jowisz.pirc.pl CAP * LS :unrealircd.org/json-log
// :saturn.pirc.pl CAP sic-test ACK :away-notify invite-notify extended-join ...
// :server CAP * NAK :some-cap
// :server CAP * NEW :new-cap
// :server CAP * DEL :removed-cap
export const onCap = (ctx: IrcContext): void => {
  ctx.line.shift(); // '*' or nick
  const subcommand = ctx.line.shift()?.toUpperCase(); // LS, ACK, NAK, LIST, NEW, DEL

  if (!subcommand) { return; }

  switch (subcommand) {
    case 'LS':
    case 'LIST': {
      const isMultiline = ctx.line[0] === '*';
      if (isMultiline) {
        ctx.line.shift();
        setAwaitingMoreCaps(true);
      } else {
        setAwaitingMoreCaps(false);
      }

      const capString = ctx.line.join(' ');
      const caps = parseCapabilityList(capString);
      addAvailableCapabilities(caps);

      // STS on a plaintext connection: must upgrade to TLS
      if (caps['sts'] && !isCurrentConnectionSecure()) {
        const parsed = parseSTSValue(caps['sts']);
        const host = getCurrentConnectionHost();
        if (parsed && host) {
          const policy = createSTSPolicy(host, parsed);
          setSTSPolicy(host, policy);

          setPendingSTSUpgrade({
            host,
            port: parsed.port,
            reason: 'sts_upgrade',
          });

          setAddMessageToAllChannels({
            id: uuidv4(),
            message: i18next.t('kernel.stsUpgrade', { port: parsed.port }),
            time: new Date().toISOString(),
            category: MessageCategory.info,
            color: MessageColor.info,
          });

          void saveSaslCredentialsForReconnect();

          // disconnectDirect removes the close handler, so trigger the STS reconnect directly
          ircDisconnect();
          handleSocketClose();
          return;
        }
      } else if (caps['sts'] && isCurrentConnectionSecure()) {
        const parsed = parseSTSValue(caps['sts']);
        const host = getCurrentConnectionHost();
        if (parsed && host) {
          const policy = createSTSPolicy(host, parsed);
          setSTSPolicy(host, policy);
        }
      }

      if (!isMultiline) {
        requestCapabilities();
      }
      break;
    }

    case 'ACK': {
      const capString = ctx.line.join(' ');
      const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
      const ackCaps = cleanString.split(' ').filter((c) => c.length > 0);

      markCapabilitiesAcknowledged(ackCaps);

      for (const cap of ackCaps) {
        setSupportedOption(cap);
      }

      if (isCapabilityEnabled('draft/metadata-2') || isCapabilityEnabled('draft/metadata') || isCapabilityEnabled('draft/metadata-notify-2')) {
        ircRequestMetadata();
        setSupportedOption('metadata');
      }

      if (isCapabilityEnabled('sasl') && getSaslAccount() && getSaslPassword()) {
        startSaslAuthentication();
      } else {
        finishCapNegotiation();
      }
      break;
    }

    case 'NAK': {
      const capString = ctx.line.join(' ');
      const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
      const nakCaps = cleanString.split(' ').filter((c) => c.length > 0);

      if (import.meta.env.DEV) { console.warn('CAP NAK - capabilities rejected:', nakCaps); }

      finishCapNegotiation();
      break;
    }

    case 'NEW': {
      // cap-notify
      const capString = ctx.line.join(' ');
      const caps = parseCapabilityList(capString);
      addAvailableCapabilities(caps);

      const toRequest = getCapabilitiesToRequest();
      if (toRequest.length > 0) {
        ircSendRawMessage(`CAP REQ :${toRequest.join(' ')}`);
        markCapabilitiesRequested(toRequest);
      }
      break;
    }

    case 'DEL': {
      // cap-notify
      const capString = ctx.line.join(' ');
      const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
      const delCaps = cleanString.split(' ').filter((c) => c.length > 0);

      removeCapabilities(delCaps);
      break;
    }
  }
};

export const requestCapabilities = (): void => {
  const toRequest = getCapabilitiesToRequest();

  if (toRequest.length > 0) {
    ircSendRawMessage(`CAP REQ :${toRequest.join(' ')}`);
    markCapabilitiesRequested(toRequest);
  } else {
    finishCapNegotiation();
  }
};

export const startSaslAuthentication = (): void => {
  setSaslState('requested');
  ircSendRawMessage('AUTHENTICATE PLAIN');
};

export const finishCapNegotiation = (): void => {
  endCapNegotiation();
  ircSendRawMessage('CAP END');
};

export const handlers: IrcHandlers = {
  CAP: onCap,
};
