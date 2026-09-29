/// <reference types="jest" />
// Web back behaviour: sheets first, then the Dashboard, and only there a
// press-twice-to-exit. Simulates browser session history: pushState adds an
// entry (dropping any forward ones), back() moves one entry back and fires
// popstate with that entry's state — at the very first entry it "leaves".
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  Object.defineProperty(rn.Platform, "OS", { get: () => "web" });
  return rn;
});
jest.mock("../i18n", () => ({ t: (k: string) => k }));

let entries: unknown[] = [null];
let index = 0;
let listener: (e: { state: unknown }) => void = () => {};
let leftApp = false;
(global as any).window = {
  history: {
    get state() {
      return entries[index];
    },
    pushState: (state: unknown) => {
      entries = [...entries.slice(0, index + 1), state];
      index++;
    },
    replaceState: (state: unknown) => {
      entries[index] = state;
    },
    back: () => pressBack(),
  },
  addEventListener: (_: string, fn: (e: { state: unknown }) => void) => (listener = fn),
};
function pressBack(steps = 1) {
  if (index - steps < 0) {
    leftApp = true;
    return;
  }
  index -= steps;
  listener({ state: entries[index] });
}

import { installWebBack, registerBackClose, syncWebTab, useExitHint } from "./useBackNavigation";

jest.useFakeTimers();
let tab = "Dashboard";
const goTo = (name: string) => {
  tab = name;
  syncWebTab(); // what the navigator's onStateChange calls
};
installWebBack({ onDashboard: () => tab === "Dashboard", toDashboard: () => goTo("Dashboard") });

// A sheet whose close unregisters it, as a real Modal's does once hidden.
function openSheet() {
  const sheet = { open: true, unregister: () => {} };
  sheet.unregister = registerBackClose(() => {
    sheet.open = false;
    sheet.unregister();
  });
  return sheet;
}

afterEach(() => {
  jest.advanceTimersByTime(2100); // let any exit window lapse
  leftApp = false;
});

test("two stacked sheets, fast double back: each closes, the app stays", () => {
  const add = openSheet();
  const editCategory = openSheet();
  pressBack();
  pressBack();
  expect(editCategory.open).toBe(false);
  expect(add.open).toBe(false);
  expect(leftApp).toBe(false);
  expect(useExitHint.getState().visible).toBe(false);
});

test("from another tab, fast backs: Dashboard first, then a warning — never straight out", () => {
  goTo("Settings");
  pressBack();
  expect(tab).toBe("Dashboard");
  pressBack();
  expect(leftApp).toBe(false);
  expect(useExitHint.getState().visible).toBe(true);
});

test("on the Dashboard with nothing open, the second back exits", () => {
  pressBack();
  expect(useExitHint.getState().visible).toBe(true);
  pressBack();
  expect(leftApp).toBe(true);
});

test("once the warning lapses, a single back only warns again", () => {
  pressBack();
  jest.advanceTimersByTime(2100);
  expect(useExitHint.getState().visible).toBe(false);
  pressBack();
  expect(leftApp).toBe(false);
});

test("a sheet closed by tapping leaves no stray step behind", () => {
  const sheet = openSheet();
  sheet.unregister(); // closed with its X
  pressBack();
  expect(useExitHint.getState().visible).toBe(true); // straight to the Dashboard warning
  expect(leftApp).toBe(false);
});

test("the browser popping two entries in one go still undoes both layers", () => {
  goTo("Analytics");
  const sheet = openSheet();
  pressBack(2);
  expect(sheet.open).toBe(false);
  expect(tab).toBe("Dashboard");
  expect(leftApp).toBe(false);
});

test("opening something during the warning ends it, so back can't exit", () => {
  pressBack(); // warning
  const sheet = openSheet();
  expect(useExitHint.getState().visible).toBe(false);
  pressBack();
  expect(sheet.open).toBe(false);
  expect(leftApp).toBe(false);
});

test("a sheet that mustn't be dismissed stays, and keeps its place", () => {
  registerBackClose(() => {}); // e.g. the name prompt
  pressBack();
  jest.advanceTimersByTime(300);
  pressBack();
  jest.advanceTimersByTime(300);
  expect(leftApp).toBe(false);
  expect(useExitHint.getState().visible).toBe(false);
});
