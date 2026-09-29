/// <reference types="jest" />
// Translation checks. Run: npm test
import fs from "fs";
import path from "path";
import i18n from "./index";

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

// A plural key "x" exists as x_one / x_other.
const exists = (key: string, lng: string) =>
  i18n.exists(key, { lng }) || i18n.exists(`${key}_other`, { lng });

test("every key the app uses exists in English and Bulgarian", () => {
  const missing = usedKeys().filter(({ key }) => !exists(key, "en") || !exists(key, "bg"));
  expect(missing).toEqual([]);
});

test("every tour step has a title and text in both languages", () => {
  const { TUTORIAL_STEPS } = require("../constants/tutorialSteps");
  const missing = TUTORIAL_STEPS.flatMap((s: { id: string }) =>
    ["en", "bg"].flatMap((lng) =>
      ["title", "text"].filter((f) => !i18n.exists(`tour.${s.id}.${f}`, { lng })).map((f) => `${lng}:${s.id}.${f}`),
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
