/// <reference types="jest" />
// Web back behaviour: sheet first, then Dashboard, then press-twice-to-exit.
// Simulates the browser's history: back() pops an entry and fires popstate,
// unless it's at the very first entry (then it "leaves the app").
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  Object.defineProperty(rn.Platform, "OS", { get: () => "web" });
  return rn;
});
jest.mock("../i18n", () => ({ t: (k: string) => k }));

const entries: unknown[] = ["page"];
let listener: () => void = () => {};
let leftApp = false;
(global as any).window = {
  history: {
    get state() {
      return entries[entries.length - 1];
    },
    pushState: (state: unknown) => entries.push(state),
  },
  addEventListener: (_: string, fn: () => void) => (listener = fn),
};
function pressBack() {
  if (entries.length === 1) {
    leftApp = true;
    return;
  }
  entries.pop();
  listener();
}

import { installWebBack, rearmWebGuard, useExitHint } from "./useBackNavigation";

jest.useFakeTimers();
let tab = "Dashboard";
installWebBack({ onDashboard: () => tab === "Dashboard", toDashboard: () => (tab = "Dashboard") });

test("back returns to the Dashboard from another tab", () => {
  tab = "Settings";
  pressBack();
  expect(tab).toBe("Dashboard");
  expect(leftApp).toBe(false);
});

test("on the Dashboard the first back only warns; a second one within the window exits", () => {
  pressBack();
  expect(leftApp).toBe(false);
  expect(useExitHint.getState().visible).toBe(true);
  pressBack();
  expect(leftApp).toBe(true);
});

test("after the window passes, a single back only warns again", () => {
  leftApp = false;
  jest.advanceTimersByTime(2100);
  expect(useExitHint.getState().visible).toBe(false);
  pressBack();
  expect(leftApp).toBe(false);
  jest.advanceTimersByTime(2100);
});

test("anything new during the window (a tab change) puts the guard back", () => {
  pressBack(); // warn
  tab = "Analytics";
  rearmWebGuard(); // what the navigator's state change calls
  pressBack();
  expect(tab).toBe("Dashboard");
  expect(leftApp).toBe(false);
});
