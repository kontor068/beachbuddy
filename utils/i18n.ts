import { LanguageCode } from '../types';

export const LANGUAGE_STORAGE_KEY = 'calmBeachLanguage';
export const SUPPORTED_LANGUAGES = ['en', 'gr', 'fr', 'de', 'it'] as const satisfies readonly LanguageCode[];

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type SupportedLocale = 'en' | 'el' | 'fr' | 'de' | 'it';

export const languageToLocale = (language: SupportedLanguage): SupportedLocale => {
  if (language === 'gr') return 'el';
  return language;
};

export const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

export const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window === 'undefined') return 'en';

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(stored)) return stored;

  return 'en';
};

export const saveLanguagePreference = (language: SupportedLanguage) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
};

export const formatMessage = (
  template: string,
  params: Record<string, string | number | undefined> = {}
): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? '' : String(value);
  });
