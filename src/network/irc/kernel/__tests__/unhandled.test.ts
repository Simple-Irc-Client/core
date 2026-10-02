/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { MessageColor } from '@/config/theme';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

const captureMessage = vi.fn();
vi.mock('@sentry/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/react')>()),
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}));

describe('kernel unhandled', () => {
  setupKernelTest();

  describe('unhandled numerics', () => {
    it('shows an unhandled error numeric in the current window', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

      const line = ':server 438 mynick newnick :Nick change too fast. Please wait 30 seconds.';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          target: '#current-channel',
          message: 'newnick: Zbyt szybka zmiana nicka. Poczekaj 30 s',
          category: MessageCategory.error,
          color: MessageColor.error,
        }),
      );
      expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
    });

    it('treats documented error numerics outside 400-599 as errors', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

      const line = ':server 723 mynick kill :Insufficient oper privileges.';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ target: '#current-channel', message: 'kill: Insufficient oper privileges.', category: MessageCategory.error }),
      );
    });

    it('shows an unhandled informational numeric in Status', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = ':server 302 mynick :alice=+alice@host.example';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ target: STATUS_CHANNEL, message: 'alice=+alice@host.example', category: MessageCategory.info }),
      );
    });

    it('shows parameters when there is no trailing text', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      const line = ':server 008 mynick +cFkn';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '+cFkn' }));
    });

    it('shows nothing for a numeric with no content', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server 999 mynick' }).handle();
      new Kernel({ type: 'raw', line: ':server 999' }).handle();
      new Kernel({ type: 'raw', line: ':server 999 mynick :' }).handle();

      // Debug echoes only
      expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
    });

    it('does not treat non-numeric commands as numerics', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server FOOBAR mynick :text' }).handle();
      new Kernel({ type: 'raw', line: ':server 4321 mynick :text' }).handle();

      expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('standard server texts', () => {
    it.each([
      [':server 263 me WHO :This command could not be completed because it has been used recently, and is rate-limited.', 'WHO: Ta komenda była użyta zbyt niedawno i jest ograniczona. Spróbuj ponownie za chwilę'],
      [':server 407 me alice,bob :Too many recipients.', 'alice,bob: Zbyt wielu odbiorców'],
      [':server 407 me alice :Too many targets. The maximum is 4 for PRIVMSG.', 'alice: Zbyt wiele celów: maksymalnie 4 dla PRIVMSG'],
      [':server 438 me newnick :Nick change too fast. Please try again later.', 'newnick: Zbyt szybka zmiana nicka. Spróbuj ponownie później'],
      [':server 439 me bob :Message target change too fast. Please wait 12 seconds', 'bob: Zbyt szybka zmiana odbiorcy wiadomości. Poczekaj 12 s'],
      [':server 440 me NickServ :Services are currently unavailable', 'NickServ: Serwisy są obecnie niedostępne. Spróbuj ponownie później'],
      [':server 440 me NickServ :Services are currently down. Please try again later.', 'NickServ: Serwisy są obecnie niedostępne. Spróbuj ponownie później'],
      [':server 479 me #bad,name :Illegal channel name', '#bad,name: Niedozwolona nazwa kanału'],
      [':server 480 me #chan :Cannot join channel (+j) - throttle exceeded, try again later', '#chan: Nie możesz dołączyć do kanału (+j): zbyt wiele wejść, spróbuj później'],
      [':server 484 me alice #chan :Cannot kick or deop a network service', 'alice #chan: Nie można wyrzucić ani odebrać opa serwisowi sieci'],
      [':server 489 me #chan :You\'re neither voiced nor channel operator', '#chan: Nie masz voice ani uprawnień operatora kanału'],
      [':server 489 me #chan :Cannot join channel (Secure connection is required)', '#chan: Nie możesz dołączyć do kanału: wymagane jest szyfrowane połączenie'],
      [':server 491 me :No appropriate operator blocks were found for your host', 'Dla Twojego hosta nie skonfigurowano dostępu operatora'],
      [':server 491 me :No O-lines for your host', 'Dla Twojego hosta nie skonfigurowano dostępu operatora'],
      [':server 500 me #chan :Too many join requests. Please wait a while and try again.', '#chan: Zbyt wiele prób dołączenia. Poczekaj chwilę i spróbuj ponownie'],
      [':server 511 me *!*@host :Your silence list is full', '*!*@host: Twoja lista ignorowanych (SILENCE) jest pełna'],
      [':server 512 me alice :Maximum size for WATCH-list is 128 entries', 'alice: Twoja lista WATCH jest pełna (limit: 128)'],
      [':server 518 me :Cannot invite (+V) at channel #chan', 'Zaproszenia na #chan są wyłączone (+V)'],
      [':server 520 me :Cannot join channel #opers (IRCops only)', 'Nie możesz dołączyć do #opers: tylko dla operatorów IRC'],
      [':server 723 me kill :Insufficient oper privs', 'kill: Niewystarczające uprawnienia operatora IRC'],
    ])('%s', (line, message) => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockReturnValue('#current');

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ message }));
    });

    it('keeps a server\'s own wording that is not a known standard text', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockReturnValue('#current');

      new Kernel({ type: 'raw', line: ':server 438 me newnick :Slow down, you are changing nicks too often' }).handle();

      expect(mockSetAddMessage).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'newnick: Slow down, you are changing nicks too often' }));
    });
  });

  describe('reporting to Sentry', () => {
    it('reports a numeric with no handler, tagged with the network', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getServer').mockReturnValue({ network: 'ExampleNet', default: 0, encoding: 'utf8', servers: [] });
      captureMessage.mockClear();

      new Kernel({ type: 'raw', line: ':server 981 mynick :Something new' }).handle();

      expect(captureMessage).toHaveBeenCalledWith('Unhandled IRC numeric 981', expect.objectContaining({
        level: 'info',
        fingerprint: ['unhandled-irc-numeric', '981'],
        tags: { numeric: '981', network: 'ExampleNet' },
        extra: { eventLine: ':server 981 mynick :Something new' },
      }));
    });

    it('reports each numeric once per session', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      captureMessage.mockClear();

      new Kernel({ type: 'raw', line: ':server 982 mynick :first' }).handle();
      new Kernel({ type: 'raw', line: ':server 982 mynick :second' }).handle();
      new Kernel({ type: 'raw', line: ':server 983 mynick :other' }).handle();

      expect(captureMessage).toHaveBeenCalledTimes(2);
    });

    it('does not report numerics that have a handler', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      captureMessage.mockClear();

      new Kernel({ type: 'raw', line: ':server 251 mynick :There are 3 users' }).handle();

      expect(captureMessage).not.toHaveBeenCalled();
    });
  });
});
