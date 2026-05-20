const SUPPORTED_LANGUAGES = ['fr', 'km'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function detectLanguage(languageCode: string | null | undefined): SupportedLanguage {
  if (!languageCode) return 'fr';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(languageCode)
    ? (languageCode as SupportedLanguage)
    : 'fr';
}
