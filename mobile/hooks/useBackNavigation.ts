import { useEffect, useRef } from "react";
import { BackHandler, Platform, ToastAndroid } from "react-native";
import { create } from "zustand";
import i18n from "../i18n";

// What back (browser button, Android's gesture or system button) does, in
// order: close the newest open sheet/dialog; otherwise return to the
// Dashboard; on the Dashboard, the first back only warns and a second one
// within EXIT_WINDOW_MS exits — so the app isn't left by accident.
//
// The phone apps get the first two from React Native itself (a Modal closes
// on Android's back, and the tab navigator returns to its first tab) — only
// the double-back exit is added there. The web version has none of it
// built in, so it's all done here with one "guard" history entry.

const EXIT_WINDOW_MS = 2000;

// ---- open sheets/dialogs, newest last ----

const closers: (() => void)[] = [];

// Registers `onClose` while `visible`, as the newest thing back should close.
// Used by components/AppModal for every sheet and dialog.
export function useCloseOnBack(visible: boolean, onClose?: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    if (!visible) return;
    const close = () => latest.current?.();
    closers.push(close);
    rearmWebGuard(); // something new to go back from
    return () => {
      const i = closers.indexOf(close);
      if (i >= 0) closers.splice(i, 1);
    };
  }, [visible]);
}

// ---- "press back again to exit" hint ----

export const useExitHint = create<{ visible: boolean }>(() => ({ visible: false }));

// ---- web ----

let exitTimer: ReturnType<typeof setTimeout> | undefined;

function pushWebGuard() {
  window.history.pushState({ fitrackBackGuard: true }, "");
}

// While the "press again" window is open the guard is deliberately missing
// (that's what lets the second back leave). Anything new happening in the
// meantime — a sheet opening, a tab change — puts it back first, so that
// back doesn't exit instead of closing it.
export function rearmWebGuard() {
  if (exitTimer === undefined) return;
  clearTimeout(exitTimer);
  exitTimer = undefined;
  useExitHint.setState({ visible: false });
  pushWebGuard();
}

// Called once at app start (web only). `onDashboard` is true when there's no
// tab to return to (the Dashboard, or the sign-in screen).
export function installWebBack(nav: { onDashboard: () => boolean; toDashboard: () => void }) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  // A refresh reloads onto the guard entry itself — don't stack a second.
  if (!window.history.state?.fitrackBackGuard) pushWebGuard();

  // Fires when back has just consumed the guard.
  window.addEventListener("popstate", () => {
    const close = closers[closers.length - 1];
    if (close) {
      close();
      pushWebGuard();
      return;
    }
    if (!nav.onDashboard()) {
      nav.toDashboard();
      pushWebGuard();
      return;
    }
    // Dashboard: leave the guard off for a moment — back now leaves the app.
    useExitHint.setState({ visible: true });
    exitTimer = setTimeout(() => {
      exitTimer = undefined;
      useExitHint.setState({ visible: false });
      pushWebGuard();
    }, EXIT_WINDOW_MS);
  });
}

// ---- Android app ----

// Must be used inside NavigationContainer: effects run child-first, so this
// listener is registered before the navigator's own, and Android calls the
// newest first — the navigator returns to the Dashboard, and only when it has
// nowhere to go does this get the press. (An open Modal handles back itself
// and never reaches either.)
export function useAndroidDoubleBackExit() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let lastPress = 0;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const now = Date.now();
      if (now - lastPress < EXIT_WINDOW_MS) return false; // second press: exit
      lastPress = now;
      ToastAndroid.show(i18n.t("app.pressBackAgain"), ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, []);
}
