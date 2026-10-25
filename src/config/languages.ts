export const languages = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'bg', label: 'Български', flag: '\u{1F1E7}\u{1F1EC}' },
  { code: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'es', label: 'Español', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fr', label: 'Français', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'id', label: 'Bahasa Indonesia', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: 'it', label: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'lt', label: 'Lietuvių', flag: '\u{1F1F1}\u{1F1F9}' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: 'nl', label: 'Nederlands', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'pl', label: 'Polski', flag: '\u{1F1F5}\u{1F1F1}' },
  { code: 'pt-BR', label: 'Português (Brasil)', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'ro', label: 'Română', flag: '\u{1F1F7}\u{1F1F4}' },
  { code: 'tr', label: 'Türkçe', flag: '\u{1F1F9}\u{1F1F7}' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];
export type LanguageSetting = 'auto' | LanguageCode;
