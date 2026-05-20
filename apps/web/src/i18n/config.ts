export const locales = ['fr', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocaleLabel(locale: Locale): string {
  return locale === 'fr' ? 'Francais' : 'English';
}
