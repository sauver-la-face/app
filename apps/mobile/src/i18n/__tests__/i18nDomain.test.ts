import { describe, it, expect } from "bun:test";
import { detectLanguage } from "../detectLanguage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "../locales/fr.json";
import km from "../locales/km.json";

// Initialisation i18n isolée — sans expo-localization ni react-native
i18n.use(initReactI18next).init({
  compatibilityJSON: "v3",
  resources: {
    fr: { translation: fr },
    km: { translation: km },
  },
  lng: "fr",
  fallbackLng: "fr",
  supportedLngs: ["fr", "km"],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

describe("detectLanguage — détection et fallback", () => {
  it("retourne fr pour une langue non supportée", () => {
    expect(detectLanguage("en")).toBe("fr");
    expect(detectLanguage("ar")).toBe("fr");
    expect(detectLanguage(null)).toBe("fr");
    expect(detectLanguage(undefined)).toBe("fr");
  });

  it("retourne fr pour le code fr", () => {
    expect(detectLanguage("fr")).toBe("fr");
  });

  it("retourne km pour le code km", () => {
    expect(detectLanguage("km")).toBe("km");
  });
});

describe("i18n — traductions", () => {
  it("retourne les traductions françaises correctes", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("auth.login.title")).toBe("Code patient");
    expect(i18n.t("auth.login.button")).toBe("Se connecter");
    expect(i18n.t("common.cancel")).toBe("Annuler");
    expect(i18n.t("consent.accept")).toBe("J'accepte");
  });

  it("retourne les traductions khmères correctes", async () => {
    await i18n.changeLanguage("km");
    expect(i18n.t("auth.login.title")).toBe("លេខកូដអ្នកជំងឺ");
    expect(i18n.t("auth.login.button")).toBe("ចូល");
    expect(i18n.t("common.cancel")).toBe("បោះបង់");
  });

  it("retourne la clé brute si absente dans toutes les langues", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("inexistant.cle")).toBe("inexistant.cle");
  });

  it("change de langue dynamiquement", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.language).toBe("fr");

    await i18n.changeLanguage("km");
    expect(i18n.language).toBe("km");
  });
});
