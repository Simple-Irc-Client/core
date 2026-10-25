export const languages = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'es', label: 'Español', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fr', label: 'Français', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'pl', label: 'Polski', flag: '\u{1F1F5}\u{1F1F1}' },
  { code: 'pt-BR', label: 'Português (Brasil)', flag: '\u{1F1E7}\u{1F1F7}' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];
export type LanguageSetting = 'auto' | LanguageCode;
