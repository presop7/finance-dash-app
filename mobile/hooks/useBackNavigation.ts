import { useEffect, useRef } from "react";
import { BackHandler, Platform, ToastAndroid } from "react-native";
import { create } from "zustand";
import i18n from "../i18n";

// What back (browser button, Android's gesture or system button) does, in
// order: close the newest open sheet/dialog; otherwise return to the
// Dashboard; on the Dashboard with nothing open, the first back only warns
// and a second one within EXIT_WINDOW_MS exits — so the app isn't left by
// accident.
//
// The phone apps get the first two from React Native itself (a Modal closes
// on Android's back, and the tab navigator returns to its first tab) — only
// the double-back exit is added there. The web version has none of it built
// in, so it's done here with browser history.

const EXIT_WINDOW_MS = 2000;

export const useExitHint = create<{ visible: boolean }>(() => ({ visible: false }));

// ---- web ----
//
// Every "layer" back can undo gets its own history entry, created when the
// layer appears (a sheet opening, leaving the Dashboard) — not when back is
// pressed — so several fast backs each just pop an entry that's already
// there. Each entry records how many layers existed below and including it;
// on back, whatever layers are above that number are undone, newest first —
// correct even if the browser pops several entries at once.
//
// History is brought in line with the layers once per round of changes
// (reconcile, on a zero-delay timer), not at each open/close: one sheet
// handing over to another (Details -> Edit) closes and opens in the same
// moment, which nets out to no history change at all. Stepping history back
// at the close and forward at the open raced — the late "back" landed after
// the new sheet opened and closed it again.
//
//   base   the Dashboard with nothing open; undoing it only warns
//   tab    another tab is showing; undoing it returns to the Dashboard
//   sheet  an open sheet/dialog; undoing it closes it

type Layer = { kind: "base" } | { kind: "tab" } | { kind: "sheet"; close: () => void; gone: boolean };

const web = Platform.OS === "web" && typeof window !== "undefined";
const layers: Layer[] = [];
let exitTimer: ReturnType<typeof setTimeout> | undefined;
let nav: { onDashboard: () => boolean; toDashboard: () => void } | null = null;

// How many of our entries the current history entry sits on.
let historyDepth = 0;
// A history.go() of our own is under way — its popstate isn't a back press.
let traversing = false;
let reconcileQueued = false;

function scheduleReconcile() {
  if (reconcileQueued) return;
  reconcileQueued = true;
  setTimeout(reconcile, 0);
}

function reconcile() {
  reconcileQueued = false;
  if (traversing) return; // picked up again once that lands
  while (historyDepth < layers.length) {
    historyDepth++;
    window.history.pushState({ fitrackDepth: historyDepth }, "");
  }
  if (historyDepth > layers.length) {
    // Layers that went away without back (closed by tapping, the Dashboard
    // tab tapped): step history back past their entries.
    const extra = historyDepth - layers.length;
    historyDepth = layers.length;
    traversing = true;
    window.history.go(-extra);
  }
}

function ensureBase() {
  if (layers[0]?.kind === "base") return;
  // Only missing during the "press again to exit" window: anything new
  // happening ends that window, so the next back can't exit by mistake.
  clearTimeout(exitTimer);
  exitTimer = undefined;
  useExitHint.setState({ visible: false });
  layers.unshift({ kind: "base" });
  scheduleReconcile();
}

function addLayer(layer: Layer, index = -1) {
  ensureBase();
  layers.splice(index < 0 ? layers.length : index, 0, layer);
  scheduleReconcile();
}

function removeLayer(layer: Layer) {
  const i = layers.indexOf(layer);
  if (i < 0) return; // back already undid it
  layers.splice(i, 1);
  scheduleReconcile();
}

function undo(layer: Layer) {
  if (layer.kind === "sheet") {
    layer.close();
    // A sheet meant to stay put (its close does nothing) keeps its place.
    setTimeout(() => {
      if (!layer.gone && !layers.includes(layer)) addLayer(layer);
    }, 300);
  } else if (layer.kind === "tab") {
    nav?.toDashboard();
  } else {
    // Dashboard, nothing open: warn, and leave the base off for a moment —
    // one more back now leaves the app.
    useExitHint.setState({ visible: true });
    exitTimer = setTimeout(() => {
      exitTimer = undefined;
      useExitHint.setState({ visible: false });
      ensureBase();
    }, EXIT_WINDOW_MS);
  }
}

// Called once at app start. `onDashboard` is true when there's no tab to go
// back from (the Dashboard, or the sign-in screen).
export function installWebBack(navigation: { onDashboard: () => boolean; toDashboard: () => void }) {
  if (!web) return;
  nav = navigation;
  layers.push({ kind: "base" });
  if (window.history.state?.fitrackDepth !== undefined) {
    // A refresh reloads onto one of our own entries: make it the base
    // rather than stacking another on top.
    window.history.replaceState({ fitrackDepth: 1 }, "");
    historyDepth = 1;
  } else {
    reconcile();
  }
  window.addEventListener("popstate", (event) => {
    const depth: number = event.state?.fitrackDepth ?? 0;
    historyDepth = depth;
    if (traversing) {
      // Our own step back landing — not a back press. Anything that
      // changed while it was under way gets its entries now.
      traversing = false;
      scheduleReconcile();
      return;
    }
    while (layers.length > depth) undo(layers.pop()!);
  });
}

// Keeps the tab layer in step with the navigator — call on every change.
export function syncWebTab() {
  if (!web || !nav) return;
  const tab = layers.find((l) => l.kind === "tab");
  if (nav.onDashboard()) {
    if (tab) removeLayer(tab);
  } else if (!tab) {
    addLayer({ kind: "tab" }, 1); // just above the base, under any open sheet
  }
}

// Registers an open sheet's close as the newest thing back undoes; returns
// the unregister. Used through useCloseOnBack / components/AppModal.
export function registerBackClose(close: () => void): () => void {
  if (!web) return () => {};
  const layer: Layer = { kind: "sheet", close, gone: false };
  addLayer(layer);
  return () => {
    layer.gone = true;
    removeLayer(layer);
  };
}

export function useCloseOnBack(visible: boolean, onClose?: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    if (!visible) return;
    return registerBackClose(() => latest.current?.());
  }, [visible]);
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
