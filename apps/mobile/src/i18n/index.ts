import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

import fr from "./locales/fr.json";
import km from "./locales/km.json";
import { detectLanguage } from "./detectLanguage";

i18n.use(initReactI18next).init({
  compatibilityJSON: "v3",
  resources: {
    fr: { translation: fr },
    km: { translation: km },
  },
  lng: detectLanguage(getLocales()[0]?.languageCode),
  fallbackLng: "fr",
  supportedLngs: ["fr", "km"],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
