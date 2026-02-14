export const languages = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'pl', label: 'Polski', flag: '\u{1F1F5}\u{1F1F1}' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];
export type LanguageSetting = 'auto' | LanguageCode;
