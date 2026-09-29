/// <reference types="jest" />
// Translation checks. Run: npm test
import fs from "fs";
import path from "path";
import i18n, { LANGUAGES } from "./index";
import en from "./locales/en";

const ROOT = path.join(__dirname, "..");
const SOURCE_DIRS = ["", "screens", "screens/modals", "components", "utils", "hooks", "store"];

// Every literal key passed to t("…") / i18n.t("…") anywhere in the app.
function usedKeys(): { key: string; file: string }[] {
  const found: { key: string; file: string }[] = [];
  for (const dir of SOURCE_DIRS) {
    const full = path.join(ROOT, dir);
    for (const name of fs.readdirSync(full)) {
      if (!/\.(tsx?)$/.test(name) || name.includes(".test.")) continue;
      const src = fs.readFileSync(path.join(full, name), "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9_.-]+)"/g)) {
        found.push({ key: m[1], file: path.join(dir, name) });
      }
    }
  }
  return found;
}

const CODES = LANGUAGES.map((l) => l.code);
// The app loads these with import() on demand; Jest can't, so load them all here.
for (const code of CODES) {
  if (code !== "en") i18n.addResourceBundle(code, "translation", require(`./locales/${code}`).default);
}

// Looked up in the language's own bundle — i18n.exists would fall back to
// English. A plural key "x" exists as x_one / x_other.
const has = (key: string, lng: string) => i18n.getResource(lng, "translation", key) !== undefined;
const exists = (key: string, lng: string) => has(key, lng) || has(`${key}_other`, lng);

test("every key the app uses exists in every language", () => {
  // `defaults.${key}` is built at runtime, so check those keys directly.
  const keys = [...usedKeys().map((k) => k.key), ...Object.keys(en.defaults).map((k) => `defaults.${k}`)];
  const missing = CODES.flatMap((lng) => keys.filter((key) => !exists(key, lng)).map((key) => `${lng}:${key}`));
  expect([...new Set(missing)]).toEqual([]);
});

test("every tour step has a title and text in every language", () => {
  const { TUTORIAL_STEPS } = require("../constants/tutorialSteps");
  const missing = TUTORIAL_STEPS.flatMap((s: { id: string }) =>
    CODES.flatMap((lng) =>
      ["title", "text"].filter((f) => !has(`tour.${s.id}.${f}`, lng)).map((f) => `${lng}:${s.id}.${f}`),
    ),
  );
  expect(missing).toEqual([]);
  expect(usedKeys().length).toBeGreaterThan(200); // the scan really is finding the app's keys
});

test("Bulgarian plurals and placeholders", async () => {
  await i18n.changeLanguage("bg");
  expect(i18n.t("app.syncingCount", { count: 1 })).toBe("Синхронизиране на 1 промяна…");
  expect(i18n.t("app.syncingCount", { count: 3 })).toBe("Синхронизиране на 3 промени…");
  expect(i18n.t("tour.fab.text")).toBe("Докоснете +.");
  await i18n.changeLanguage("en");
  expect(i18n.t("app.syncingCount", { count: 3 })).toBe("Syncing 3 changes…");
});

test("Polish and Romanian extra plural forms", async () => {
  await i18n.changeLanguage("pl");
  expect(i18n.t("charts.transactions", { count: 1 })).toBe("1 transakcja");
  expect(i18n.t("charts.transactions", { count: 3 })).toBe("3 transakcje");
  expect(i18n.t("charts.transactions", { count: 5 })).toBe("5 transakcji");
  await i18n.changeLanguage("ro");
  expect(i18n.t("charts.transactions", { count: 3 })).toBe("3 tranzacții");
  expect(i18n.t("charts.transactions", { count: 25 })).toBe("25 de tranzacții");
  await i18n.changeLanguage("en");
});
