import { RefObject, useCallback } from "react";
import { ScrollView, View } from "react-native";
import { create } from "zustand";
import { TUTORIAL_STEPS, TutorialEvent } from "../constants/tutorialSteps";
import { supabase } from "../services/supabase";
import { generateDemoTransactions } from "../utils/demoTransactions";
import { useFinanceStore } from "./useFinanceStore";

// ---- Spots the tour can light up ----

type Target = { view: View; scroll?: (view: View) => void };
// Module-level rather than store state: registering a spot must not
// re-render anything; the overlay looks spots up when a step starts.
const targets = new Map<string, Target>();

export const getTutorialTarget = (id: string) => targets.get(id);

// Ref callback for the element to light up. `scroll` (optional) brings it
// into view first when it sits inside a scrolling screen.
export function tutorialTarget(id: string, scroll?: (view: View) => void) {
  return (view: View | null) => {
    if (view) targets.set(id, { view, scroll });
    else targets.delete(id);
  };
}

// Same, memoized — for components that re-render often.
export function useTutorialTarget(id: string, scroll?: (view: View) => void) {
  return useCallback(tutorialTarget(id, scroll), [id, scroll]);
}

// Scrolls a ScrollView so `view` sits near the top of the visible area.
export function scrollIntoView(scrollRef: RefObject<ScrollView | null>, view: View, margin = 140) {
  const scroll = scrollRef.current;
  const inner = (scroll as any)?.getInnerViewRef?.();
  if (!scroll || !inner) return;
  view.measureLayout(
    inner,
    (_x, y) => scroll.scrollTo({ y: Math.max(0, y - margin), animated: true }),
    () => {},
  );
}

// Set by App.tsx so a replay started from Settings begins on the Dashboard.
let goToDashboard: (() => void) | null = null;
export const setTutorialNavigator = (fn: () => void) => {
  goToDashboard = fn;
};

// ---- Tour progress ----

const SAMPLES_BELOW = 10; // real transactions; at or above this, no samples

// Back works between explanation steps on the same screen. It can't cross
// a step the user completed by doing something (tapping +, Save, a tab):
// that action already moved the app on — the form closed, the tab changed —
// and the earlier step's spot is no longer there to show.
export function canGoBack(index: number): boolean {
  const prev = TUTORIAL_STEPS[index - 1];
  return Boolean(prev) && !prev.waitFor && prev.host === TUTORIAL_STEPS[index].host;
}

type TutorialState = {
  active: boolean;
  index: number;
  // Started again from Settings: the user already knows the app, so they
  // can skip at any point (a first-time tour only allows it later on).
  replay: boolean;
  start: (replay?: boolean) => void;
  next: () => void;
  back: () => void;
  finish: () => void;
  // The user did something a step may be waiting for.
  emit: (event: TutorialEvent) => void;
  // The add-transaction sheet closed before the user saved: go back to the
  // "tap +" step so the sheet steps can run again.
  addSheetClosed: () => void;
  // A new account whose currency couldn't be worked out: ask them once the
  // tour is out of the way (see CurrencyPromptModal).
  askCurrency: boolean;
  setAskCurrency: (ask: boolean) => void;
};

export const useTutorialStore = create<TutorialState>((set, get) => ({
  active: false,
  index: 0,
  replay: false,
  askCurrency: false,
  setAskCurrency: (ask) => set({ askCurrency: ask }),

  start: (replay = false) => {
    const finance = useFinanceStore.getState();
    // Samples are there to fill an empty app. An account with real history
    // tours its own numbers instead — samples would only get lost among them
    // and skew its totals while the tour runs.
    if (finance.transactions.length < SAMPLES_BELOW) {
      finance.addDemoTransactions(
        generateDemoTransactions(
          finance.expenseCategories,
          finance.incomeCategories,
          finance.fundCategories.map((f) => f.id),
        ),
      );
    }
    goToDashboard?.();
    set({ active: true, index: 0, replay });
  },

  next: () => {
    const { index, finish } = get();
    if (index + 1 >= TUTORIAL_STEPS.length) finish();
    else set({ index: index + 1 });
  },

  back: () => {
    const { index } = get();
    if (canGoBack(index)) set({ index: index - 1 });
  },

  finish: () => {
    useFinanceStore.getState().removeDemoTransactions();
    set({ active: false, index: 0 });
    // Remembered on the account, so the tour doesn't start again on another
    // device. Best-effort: offline, it simply isn't recorded.
    supabase.auth.updateUser({ data: { tutorial_done: true } }).catch(() => {});
  },

  emit: (event) => {
    const { active, index, next } = get();
    if (active && TUTORIAL_STEPS[index].waitFor === event) next();
  },

  addSheetClosed: () => {
    const { active, index } = get();
    if (active && TUTORIAL_STEPS[index].host === "addModal") {
      set({ index: TUTORIAL_STEPS.findIndex((s) => s.id === "fab") });
    }
  },
}));

export const tutorialEmit = (event: TutorialEvent) => useTutorialStore.getState().emit(event);
