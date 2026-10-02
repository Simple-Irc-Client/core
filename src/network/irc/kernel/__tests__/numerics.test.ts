import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import { STATUS_CHANNEL } from '@/config/config';
import * as channelsFile from '@features/channels/store/channels';
import * as settingsFile from '@features/settings/store/settings';
import * as usersFile from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import '@/app/i18n';

const handle = (line: string): void => {
  new Kernel({ type: 'raw', line }).handle();
};

// The last call is the reply; in dev builds a Debug window echo precedes it
const lastReply = (mock: ReturnType<typeof vi.spyOn>) => mock.mock.calls.at(-1)?.[0];

describe('dedicated numeric handlers', () => {
  let mockSetAddMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('437 ERR_UNAVAILRESOURCE', () => {
    it('reports an unavailable nick during registration in Status and the wizard', () => {
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
      const mockSetWizardProgress = vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});

      handle(':server 437 * alice :Nick/channel is temporarily unavailable');

      expect(lastReply(mockSetAddMessage)).toMatchObject({
        target: STATUS_CHANNEL,
        message: 'alice: Nick/channel is temporarily unavailable',
        category: MessageCategory.error,
      });
      expect(mockSetWizardProgress).toHaveBeenCalledWith(0, expect.stringContaining('alice: Nick/channel is temporarily unavailable'));
    });

    it('reports an unavailable channel in the current window without touching the wizard', () => {
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
      const mockSetWizardProgress = vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});

      handle(':server 437 mynick #chan :Nick/channel is temporarily unavailable');

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#current', message: '#chan: Nick/channel is temporarily unavailable', category: MessageCategory.error });
      expect(mockSetWizardProgress).not.toHaveBeenCalled();
    });

    it('does not touch the wizard after registration', () => {
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);
      const mockSetWizardProgress = vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});

      handle(':server 437 mynick alice :Nick/channel is temporarily unavailable');

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: STATUS_CHANNEL });
      expect(mockSetWizardProgress).not.toHaveBeenCalled();
    });

    it('does not crash without a target', () => {
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);

      expect(() => handle(':server 437 *')).not.toThrow();
    });
  });

  describe('331 RPL_NOTOPIC', () => {
    it('clears the channel topic', () => {
      const mockSetTopic = vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});

      handle(':server 331 mynick #chan :No topic is set');

      expect(mockSetTopic).toHaveBeenCalledWith('#chan', '');
    });

    it('ignores a reply without a channel', () => {
      const mockSetTopic = vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      handle(':server 331 mynick');

      expect(mockSetTopic).not.toHaveBeenCalled();
    });
  });

  describe('354 RPL_WHOSPCRPL', () => {
    beforeEach(() => {
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => true);
      vi.spyOn(usersFile, 'setUserHost').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserRealname').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});
    });

    it('sets the account of a logged-in user', () => {
      const mockSetUserAccount = vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});

      handle(':ergo.test 354 me 152 #chan ~u host ergo.test alice H alice_acc :Alice');

      expect(mockSetUserAccount).toHaveBeenCalledWith('alice', 'alice_acc');
    });

    it('clears the account when the user is not logged in', () => {
      const mockSetUserAccount = vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});

      handle(':ergo.test 354 me 152 #chan ~u host ergo.test alice H 0 :Alice');

      expect(mockSetUserAccount).toHaveBeenCalledWith('alice', null);
    });

    it('sets realname and away for a user it adds', () => {
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetUserRealname = vi.spyOn(usersFile, 'setUserRealname').mockImplementation(() => {});
      const mockSetUserAway = vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});

      handle(':ergo.test 354 me 152 #chan ~u host ergo.test alice G@ 0 :Alice Example');

      expect(mockSetAddUser).toHaveBeenCalledWith(expect.objectContaining({ nick: 'alice' }));
      expect(mockSetUserRealname).toHaveBeenCalledWith('alice', 'Alice Example');
      expect(mockSetUserAway).toHaveBeenCalledWith('alice', true);
    });

    it('does not set an account when the reply is truncated', () => {
      const mockSetUserAccount = vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});

      handle(':ergo.test 354 me 152 #chan ~u host ergo.test alice');

      expect(mockSetUserAccount).not.toHaveBeenCalled();
    });
  });

  describe('486 ERR_NONONREG / 531 ERR_CANTSENDTOUSER', () => {
    it.each(['486', '531'])('%s shows in the open DM window with that user', (numeric) => {
      vi.spyOn(channelsFile, 'existChannel').mockImplementation((name) => name === 'alice');

      handle(`:server ${numeric} mynick alice :You must log in with services to message this user`);

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: 'alice', message: 'alice: You must log in with services to message this user', category: MessageCategory.error });
    });

    it('falls back to the current window when no DM is open', () => {
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);

      handle(':server 486 mynick alice :You must log in with services to message this user');

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#current' });
    });
  });

  it('470 ERR_LINKCHANNEL reports the forward as info', () => {
    handle(':server 470 mynick #from #to :Forwarding to another channel');

    expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#current', message: '#from → #to: Forwarding to another channel', category: MessageCategory.info });
  });

  describe('channel mode refusals', () => {
    it.each([
      [':server 467 mynick #chan :Channel key already set', '#chan: Channel key already set'],
      [':server 499 mynick #chan :You\'re not a channel owner', '#chan: You\'re not a channel owner'],
      [':server 525 mynick #chan :Key is not well-formed', '#chan: Key is not well-formed'],
      [':server 696 mynick #chan l abc :Invalid limit mode parameter', '#chan l abc: Invalid limit mode parameter'],
      [':server 742 mynick #chan t nt :MODE cannot be set due to channel having an active MLOCK restriction policy', '#chan t nt: MODE cannot be set due to channel having an active MLOCK restriction policy'],
    ])('%s shows in the channel window', (line, message) => {
      handle(line);

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#chan', message, category: MessageCategory.error });
    });

    it('shows a refused user mode in the current window', () => {
      handle(':server 696 mynick mynick s xyz :Invalid snomask');

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#current', message: 'mynick s xyz: Invalid snomask' });
    });
  });

  describe('WHOIS lines', () => {
    it('310 RPL_WHOISHELPOP', () => {
      handle(':server 310 mynick bob :is available for help');

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#current', message: '* bob is available for help', category: MessageCategory.info });
    });

    it('760 RPL_WHOISKEYVALUE', () => {
      handle(':ergo.test 760 mynick bob display-name * :Whois Display');

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#current', message: '* bob display-name: Whois Display', category: MessageCategory.info });
    });
  });

  describe('replies to typed commands', () => {
    it.each([
      [':server 302 mynick :alice=+alice@host.example bob*=-bob@host.example', 'alice=+alice@host.example bob*=-bob@host.example'],
      [':server 340 mynick :alice=+alice@192.0.2.1', 'alice=+alice@192.0.2.1'],
      [':server 303 mynick :alice bob', 'Dostępni: alice bob'],
      [':server 303 mynick :', 'Żaden z podanych nicków nie jest dostępny'],
      [':server 336 mynick #invited', '#invited'],
      [':server 337 mynick :End of INVITE list', 'End of INVITE list'],
    ])('%s shows in the current window', (line, message) => {
      handle(line);

      expect(lastReply(mockSetAddMessage)).toMatchObject({ target: '#current', message, category: MessageCategory.info });
    });
  });
});
