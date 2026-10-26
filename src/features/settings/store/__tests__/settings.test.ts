import { describe, expect, it, beforeEach } from 'vitest';
import { useSettingsStore, setWizardCompleted, setWizardStep, setIsPasswordRequired, setTheme, getIsWizardCompleted, getIsPasswordRequired, setWizardProgress, getWizardProgress, toggleDarkMode, setHideAvatarsInUsersList, setFontSize, setFontFormatting, setHideTypingIndicator, setEncryptedPassword, getEncryptedPassword, getPasswordNick, setWizardHintDismissed, getHighlightWords, getWizardNick, setWizardNick } from '../settings';
import { ChannelCategory } from '@shared/types';
import { getActiveNetworkId, getCurrentNick, getServer, useNetworksStore } from '@features/networks/store/networks';
import { useFriendsStore } from '@features/friends/store/friends';
import { connectTestNetwork, resetNetworks, TEST_SERVER } from '@/test/networks';

const OTHER_SERVER = { default: 0, encoding: 'utf8', network: 'OtherNet', servers: ['irc.other.net'] };
const BOUNCER_SERVER = { ...TEST_SERVER, network: 'soju', bouncer: { account: 'alice', encryptedPassword: 'x', networkId: '7' } };

const storedSettings = (): { state: Record<string, unknown> } => JSON.parse(localStorage.getItem('sic-settings') ?? '{}');

describe('settings store', () => {
  beforeEach(() => {
    resetNetworks();
    useSettingsStore.setState({ isWizardCompleted: false, wizardStep: 'nick', wizardNick: '', isPasswordRequired: undefined, theme: 'modern', customThemes: {}, builtinThemeOverrides: {}, wizardProgress: { value: 0, label: '' }, isDarkMode: false, fontSize: 'medium', highlightWords: [], serverPasswords: {} });
    // Nothing saved yet, as on the first start of a new version
    localStorage.clear();
  });

  describe('wizard state', () => {
    it('should set wizard completed status', () => {
      setWizardCompleted(true);
      expect(getIsWizardCompleted()).toBe(true);

      setWizardCompleted(false);
      expect(getIsWizardCompleted()).toBe(false);
    });

    it('should set wizard step', () => {
      setWizardStep('server');
      expect(useSettingsStore.getState().wizardStep).toBe('server');

      setWizardStep('loading');
      expect(useSettingsStore.getState().wizardStep).toBe('loading');

      setWizardStep('password');
      expect(useSettingsStore.getState().wizardStep).toBe('password');

      setWizardStep('channels');
      expect(useSettingsStore.getState().wizardStep).toBe('channels');
    });

    it('should set wizard progress', () => {
      setWizardProgress(50, 'Loading...');

      const progress = getWizardProgress();
      expect(progress.value).toBe(50);
      expect(progress.label).toBe('Loading...');
    });

    it('should update wizard progress', () => {
      setWizardProgress(25, 'Step 1');
      setWizardProgress(75, 'Step 3');

      const progress = getWizardProgress();
      expect(progress.value).toBe(75);
      expect(progress.label).toBe('Step 3');
    });

    it('should set password required status', () => {
      setIsPasswordRequired(true);
      expect(getIsPasswordRequired()).toBe(true);

      setIsPasswordRequired(false);
      expect(getIsPasswordRequired()).toBe(false);
    });

    it('should keep the nick typed in the wizard, also on resetWizardState', () => {
      setWizardNick('alice');
      useSettingsStore.getState().resetWizardState();

      expect(getWizardNick()).toBe('alice');
    });

    it('should dismiss wizard hint permanently', () => {
      expect(useSettingsStore.getState().isWizardHintDismissed).toBe(false);

      setWizardHintDismissed();

      expect(useSettingsStore.getState().isWizardHintDismissed).toBe(true);
    });
  });

  describe('theme management', () => {
    it('should set theme to modern', () => {
      setTheme('modern');
      expect(useSettingsStore.getState().theme).toBe('modern');
    });

    it('should set theme to classic', () => {
      setTheme('classic');
      expect(useSettingsStore.getState().theme).toBe('classic');
    });

    it('should toggle theme', () => {
      setTheme('modern');
      expect(useSettingsStore.getState().theme).toBe('modern');

      setTheme('classic');
      expect(useSettingsStore.getState().theme).toBe('classic');
    });

    it('should set theme to a custom theme id', () => {
      const id = useSettingsStore.getState().addCustomTheme('My theme', '.sic-msg {}');
      setTheme(id);
      expect(useSettingsStore.getState().theme).toBe(id);
    });
  });

  describe('custom themes', () => {
    it('should add a custom theme and return its id', () => {
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg { color: lime; }');

      expect(id).toBeTruthy();
      expect(useSettingsStore.getState().customThemes[id]).toEqual({ name: 'Neon', css: '.sic-msg { color: lime; }' });
    });

    it('should update a custom theme', () => {
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');

      useSettingsStore.getState().updateCustomTheme(id, { css: '.sic-msg { color: red; }' });

      expect(useSettingsStore.getState().customThemes[id]).toEqual({ name: 'Neon', css: '.sic-msg { color: red; }' });
    });

    it('should ignore updates to a nonexistent custom theme', () => {
      useSettingsStore.getState().updateCustomTheme('missing-id', { css: 'x' });

      expect(useSettingsStore.getState().customThemes).toEqual({});
    });

    it('should delete a custom theme', () => {
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');

      useSettingsStore.getState().deleteCustomTheme(id);

      expect(useSettingsStore.getState().customThemes[id]).toBeUndefined();
    });

    it('should fall back to the default theme when deleting the active custom theme', () => {
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');
      setTheme(id);

      useSettingsStore.getState().deleteCustomTheme(id);

      expect(useSettingsStore.getState().theme).toBe('modern');
    });

    it('should keep the active theme when deleting another custom theme', () => {
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');
      setTheme('classic');

      useSettingsStore.getState().deleteCustomTheme(id);

      expect(useSettingsStore.getState().theme).toBe('classic');
    });
  });

  describe('builtin theme overrides', () => {
    it('should store edited CSS for a builtin theme', () => {
      useSettingsStore.getState().setBuiltinThemeCss('classic', '.sic-msg { color: red; }');

      expect(useSettingsStore.getState().builtinThemeOverrides.classic).toBe('.sic-msg { color: red; }');
    });

    it('should drop the override when the CSS equals the shipped default', async () => {
      const { BUILTIN_THEMES } = await import('@features/themes/builtinThemes');
      useSettingsStore.getState().setBuiltinThemeCss('classic', '.sic-msg { color: red; }');

      useSettingsStore.getState().setBuiltinThemeCss('classic', BUILTIN_THEMES.classic.css);

      expect(useSettingsStore.getState().builtinThemeOverrides.classic).toBeUndefined();
    });

    it('should reset a builtin theme override', () => {
      useSettingsStore.getState().setBuiltinThemeCss('modern', '.sic-msg { color: red; }');

      useSettingsStore.getState().resetBuiltinThemeCss('modern');

      expect(useSettingsStore.getState().builtinThemeOverrides.modern).toBeUndefined();
    });

    it('should keep other overrides when resetting one builtin theme', () => {
      useSettingsStore.getState().setBuiltinThemeCss('modern', '.a {}');
      useSettingsStore.getState().setBuiltinThemeCss('classic', '.b {}');

      useSettingsStore.getState().resetBuiltinThemeCss('modern');

      expect(useSettingsStore.getState().builtinThemeOverrides).toEqual({ classic: '.b {}' });
    });
  });

  describe('theme persistence and migration', () => {
    it('should persist theme, customThemes and builtinThemeOverrides', () => {
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');
      useSettingsStore.getState().setBuiltinThemeCss('classic', '.override {}');
      setTheme(id);

      const persisted = JSON.parse(localStorage.getItem('sic-settings') ?? '{}');
      expect(persisted.state.theme).toBe(id);
      expect(persisted.state.customThemes[id]).toEqual({ name: 'Neon', css: '.sic-msg {}' });
      expect(persisted.state.builtinThemeOverrides).toEqual({ classic: '.override {}' });
    });

    it('should keep classic theme when migrating from version 3', async () => {
      localStorage.setItem('sic-settings', JSON.stringify({ state: { theme: 'classic' }, version: 3 }));

      await useSettingsStore.persist.rehydrate();

      expect(useSettingsStore.getState().theme).toBe('classic');
      expect(useSettingsStore.getState().customThemes).toEqual({});
      expect(useSettingsStore.getState().builtinThemeOverrides).toEqual({});
    });

    it('should fall back to modern when migrating an unknown theme value', async () => {
      localStorage.setItem('sic-settings', JSON.stringify({ state: { theme: 'weird' }, version: 3 }));

      await useSettingsStore.persist.rehydrate();

      expect(useSettingsStore.getState().theme).toBe('modern');
    });
  });

  describe('dark mode', () => {
    it('should toggle dark mode', () => {
      expect(useSettingsStore.getState().isDarkMode).toBe(false);

      toggleDarkMode();
      expect(useSettingsStore.getState().isDarkMode).toBe(true);

      toggleDarkMode();
      expect(useSettingsStore.getState().isDarkMode).toBe(false);
    });

    it('should preserve isDarkMode on resetWizardState', () => {
      useSettingsStore.setState({ isDarkMode: true });
      useSettingsStore.getState().resetWizardState();

      expect(useSettingsStore.getState().isDarkMode).toBe(true);
    });
  });

  describe('hide avatars in users list', () => {
    it('should set hideAvatarsInUsersList to true', () => {
      setHideAvatarsInUsersList(true);
      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(true);
    });

    it('should set hideAvatarsInUsersList to false', () => {
      setHideAvatarsInUsersList(true);
      setHideAvatarsInUsersList(false);
      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(false);
    });

    it('should default hideAvatarsInUsersList to false', () => {
      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(false);
    });

    it('should preserve hideAvatarsInUsersList on resetWizardState', () => {
      setHideAvatarsInUsersList(true);
      useSettingsStore.getState().resetWizardState();

      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(true);
    });
  });

  describe('font size', () => {
    it('should set fontSize to small', () => {
      setFontSize('small');
      expect(useSettingsStore.getState().fontSize).toBe('small');
    });

    it('should set fontSize to medium', () => {
      setFontSize('small');
      setFontSize('medium');
      expect(useSettingsStore.getState().fontSize).toBe('medium');
    });

    it('should set fontSize to large', () => {
      setFontSize('large');
      expect(useSettingsStore.getState().fontSize).toBe('large');
    });

    it('should default fontSize to medium', () => {
      expect(useSettingsStore.getState().fontSize).toBe('medium');
    });

    it('should preserve fontSize on resetWizardState', () => {
      setFontSize('large');
      useSettingsStore.getState().resetWizardState();

      expect(useSettingsStore.getState().fontSize).toBe('large');
    });
  });

  describe('persistence', () => {
    it('should write preferences to localStorage', () => {
      useSettingsStore.setState({ isDarkMode: true });
      setTheme('classic');
      setFontSize('large');
      setHideAvatarsInUsersList(true);
      setHideTypingIndicator(true);
      setFontFormatting({ bold: true });

      const stored = storedSettings();
      expect(stored.state.isDarkMode).toBe(true);
      expect(stored.state.theme).toBe('classic');
      expect(stored.state.fontSize).toBe('large');
      expect(stored.state.hideAvatarsInUsersList).toBe(true);
      expect(stored.state.hideTypingIndicator).toBe(true);
      expect(stored.state.fontFormatting).toMatchObject({ bold: true });
    });

    it('should write highlight words to localStorage', () => {
      useSettingsStore.getState().setHighlightWords(['deploy', 'release']);

      expect(storedSettings().state.highlightWords).toEqual(['deploy', 'release']);
      expect(getHighlightWords()).toEqual(['deploy', 'release']);
    });

    it('should write the wizard nick and isWizardCompleted, and nothing of a network', () => {
      setWizardNick('alice');
      setWizardCompleted(true);

      const stored = storedSettings();
      expect(stored.state.wizardNick).toBe('alice');
      expect(stored.state.isWizardCompleted).toBe(true);
      expect(stored.state).not.toHaveProperty('nick');
      expect(stored.state).not.toHaveProperty('server');
    });

    it('should stay in main view after page reload when wizard was completed', async () => {
      localStorage.setItem('sic-settings', JSON.stringify({ state: { isWizardCompleted: true }, version: 5 }));

      await useSettingsStore.persist.rehydrate();

      expect(getIsWizardCompleted()).toBe(true);
    });

    it('should return to wizard after page reload when wizard was never completed', async () => {
      await useSettingsStore.persist.rehydrate();

      expect(getIsWizardCompleted()).toBe(false);
    });

    it('should rehydrate preferences from localStorage', async () => {
      localStorage.setItem('sic-settings', JSON.stringify({
        state: { isDarkMode: true, theme: 'classic', fontSize: 'small', hideTypingIndicator: true, fontFormatting: { colorCode: 4, bold: true, italic: false, underline: false } },
        version: 5,
      }));

      await useSettingsStore.persist.rehydrate();

      const state = useSettingsStore.getState();
      expect(state.isDarkMode).toBe(true);
      expect(state.theme).toBe('classic');
      expect(state.fontSize).toBe('small');
      expect(state.hideTypingIndicator).toBe(true);
      expect(state.fontFormatting.bold).toBe(true);
    });

    it('should preserve fontFormatting on resetWizardState', () => {
      setFontFormatting({ bold: true, italic: true });
      useSettingsStore.getState().resetWizardState();

      expect(useSettingsStore.getState().fontFormatting).toMatchObject({ bold: true, italic: true });
    });
  });

  describe('migration of what an older version kept for one network', () => {
    const storeLegacy = (state: Record<string, unknown>): void => {
      localStorage.setItem('sic-settings', JSON.stringify({ state, version: 4 }));
    };

    it('moves the session to the networks store, and the nick to the wizard', async () => {
      storeLegacy({ nick: 'alice', server: TEST_SERVER, currentChannelName: '#chat', currentChannelCategory: ChannelCategory.channel, isWizardCompleted: true });

      await useSettingsStore.persist.rehydrate();
      await useNetworksStore.persist.rehydrate();

      expect(getWizardNick()).toBe('alice');
      expect(getActiveNetworkId()).toBe('TestNet');
      expect(getServer()).toEqual(TEST_SERVER);
      expect(getCurrentNick()).toBe('alice');
      expect(storedSettings().state).not.toHaveProperty('server');
      expect(getIsWizardCompleted()).toBe(true);
    });

    it('keeps the password of a network under its name', async () => {
      storeLegacy({ server: TEST_SERVER, serverPasswords: { TestNet: { encrypted: 'secret', nick: 'alice' } } });

      await useSettingsStore.persist.rehydrate();
      connectTestNetwork();

      expect(getEncryptedPassword()).toBe('secret');
    });

    it('gives the password kept under a bouncer\'s name to the bouncer network in use', async () => {
      storeLegacy({ server: BOUNCER_SERVER, serverPasswords: { soju: { encrypted: 'secret', nick: 'alice' } } });

      await useSettingsStore.persist.rehydrate();
      connectTestNetwork(BOUNCER_SERVER);

      expect(getEncryptedPassword()).toBe('secret');
      expect(useSettingsStore.getState().serverPasswords).not.toHaveProperty('soju');
    });

    it('gives friends kept under a bouncer\'s name to the bouncer network in use', async () => {
      storeLegacy({ server: BOUNCER_SERVER });
      localStorage.setItem('sic-friends', JSON.stringify({ state: { friendsByNetwork: { soju: ['bob'], OtherNet: ['carol'] } }, version: 1 }));

      await useSettingsStore.persist.rehydrate();
      await useFriendsStore.persist.rehydrate();

      expect(useFriendsStore.getState().friendsByNetwork).toEqual({ 'soju/bouncer:7': ['bob'], OtherNet: ['carol'] });
    });
  });

  describe('encrypted password', () => {
    beforeEach(() => {
      connectTestNetwork();
    });

    it('should set encrypted password and nick for the active network', () => {
      setEncryptedPassword('encrypted-data', 'TestNick');

      expect(getEncryptedPassword()).toBe('encrypted-data');
      expect(getPasswordNick()).toBe('TestNick');
      expect(storedSettings().state.serverPasswords).toEqual({ TestNet: { encrypted: 'encrypted-data', nick: 'TestNick' } });
    });

    it('should clear encrypted password with undefined', () => {
      setEncryptedPassword('encrypted-data', 'TestNick');
      setEncryptedPassword(undefined, undefined);

      expect(getEncryptedPassword()).toBeUndefined();
      expect(getPasswordNick()).toBeUndefined();
    });

    it('should default encrypted password to undefined', () => {
      expect(getEncryptedPassword()).toBeUndefined();
      expect(getPasswordNick()).toBeUndefined();
    });

    it('should store passwords per network', () => {
      setEncryptedPassword('pass1', 'Nick1');
      connectTestNetwork(OTHER_SERVER);
      setEncryptedPassword('pass2', 'Nick2');

      expect(getEncryptedPassword()).toBe('pass2');

      connectTestNetwork();
      expect(getEncryptedPassword()).toBe('pass1');
      expect(getPasswordNick()).toBe('Nick1');
    });

    it('should save nothing before a network is chosen', () => {
      resetNetworks();

      setEncryptedPassword('encrypted-data', 'TestNick');

      expect(useSettingsStore.getState().serverPasswords).toEqual({});
      expect(getEncryptedPassword()).toBeUndefined();
    });
  });
});
