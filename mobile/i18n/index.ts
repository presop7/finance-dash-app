// App translations. Import this once, first thing (App.tsx).
//
// Text lives in i18n/locales/<code>.ts, keyed like "settings.theme". English
// is complete and the fallback: a language missing a key shows the English
// text rather than nothing. Components use `useTranslation()`; plain
// functions (notifications, insights) use `i18n.t` directly.
import "intl-pluralrules"; // plural rules for engines without Intl.PluralRules (Hermes)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import bg from "./locales/bg";

// Shown in the Settings language picker, in their own language.
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "bg", name: "Български" },
];

const RESOURCES = {
  en: { translation: en },
  bg: { translation: bg },
};

const supported = (code: string) => LANGUAGES.some((l) => l.code === code);

// The phone's (or browser's) own language, if the app has it; else English.
export function deviceLanguage(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "en";
  const code = locale.split(/[-_]/)[0].toLowerCase();
  return supported(code) ? code : "en";
}

i18n.use(initReactI18next).init({
  resources: RESOURCES,
  lng: deviceLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

// `preference` is the saved choice, or null for "same as the phone".
export function applyLanguage(preference: string | null) {
  const code = preference && supported(preference) ? preference : deviceLanguage();
  if (i18n.language !== code) i18n.changeLanguage(code);
}

// For dates/numbers formatted with Intl (e.g. "27 Sept" / "27 септ.").
export const currentLocale = () => i18n.language || "en";

export default i18n;
