export const locales = ['fr', 'en', 'km'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export const localeConfig: Record<Locale, { label: string; flag: string }> = {
  fr: { label: 'Français', flag: '🇫🇷' },
  en: { label: 'English', flag: '🇬🇧' },
  km: { label: 'ភាសាខ្មែរ', flag: '🇰🇭' },
};
