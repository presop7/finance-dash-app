// App translations. Import this once, first thing (App.tsx).
//
// Text lives in i18n/locales/<code>.ts, keyed like "settings.theme". English
// is built in and is the fallback: a missing key shows the English text
// rather than nothing. Every other language is loaded only when it's used,
// so adding languages doesn't slow down starting the app (and the web
// version downloads just the one it needs). Components use
// `useTranslation()`; plain functions (notifications, insights) `i18n.t`.
import "intl-pluralrules"; // plural rules for engines without Intl.PluralRules (Hermes)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";

// Shown in the Settings language picker, in their own language.
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "bg", name: "Български" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "pl", name: "Polski" },
  { code: "ro", name: "Română" },
  { code: "zh", name: "中文（简体）" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
];

const LOADERS: Record<string, () => Promise<{ default: object }>> = {
  bg: () => import("./locales/bg"),
  de: () => import("./locales/de"),
  es: () => import("./locales/es"),
  fr: () => import("./locales/fr"),
  it: () => import("./locales/it"),
  pt: () => import("./locales/pt"),
  pl: () => import("./locales/pl"),
  ro: () => import("./locales/ro"),
  zh: () => import("./locales/zh"),
  ja: () => import("./locales/ja"),
  ko: () => import("./locales/ko"),
};

const supported = (code: string) => LANGUAGES.some((l) => l.code === code);

// The phone's (or browser's) own language, if the app has it; else English.
export function deviceLanguage(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "en";
  const code = locale.split(/[-_]/)[0].toLowerCase();
  return supported(code) ? code : "en";
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export async function loadLanguage(code: string): Promise<void> {
  if (code === "en" || i18n.hasResourceBundle(code, "translation")) return;
  const { default: resources } = await LOADERS[code]();
  i18n.addResourceBundle(code, "translation", resources);
}

// `preference` is the saved choice, or null for "same as the phone". If
// another switch starts while this one is still loading, the newer one wins.
let wanted = "en";
export async function applyLanguage(preference: string | null): Promise<void> {
  const code = preference && supported(preference) ? preference : deviceLanguage();
  wanted = code;
  await loadLanguage(code);
  if (wanted === code && i18n.language !== code) await i18n.changeLanguage(code);
}

// Resolves once the phone's language is loaded — the app waits for this
// before showing anything, so it never flashes English first.
export const languageReady: Promise<void> = applyLanguage(null).catch(() => {});

// For dates/numbers formatted with Intl (e.g. "27 Sept" / "27.09" / "9月27日").
export const currentLocale = () => i18n.language || "en";

export default i18n;
