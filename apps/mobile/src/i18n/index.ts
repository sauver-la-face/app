import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { detectLanguage, type SupportedLanguage } from './detectLanguage';
import fr from './locales/fr.json';
import km from './locales/km.json';

export type { SupportedLanguage };
export const SUPPORTED_LANGUAGES = ['fr', 'km'] as const satisfies readonly SupportedLanguage[];

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    km: { translation: km },
  },
  lng: detectLanguage(getLocales()[0]?.languageCode),
  fallbackLng: 'fr',
  supportedLngs: ['fr', 'km'],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
