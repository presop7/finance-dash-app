// The app tour, in order. Plain everyday words on purpose — no jargon.
//
// host:      where the step is drawn. The add-transaction sheet is its own
//            window above the app, so its steps are drawn inside it.
// target:    the spot to light up (registered with useTutorialTarget). A
//            list lights up the area covering all of them that are on
//            screen (e.g. a toolbar that only appears once used).
//            No target = a centered message with everything dimmed.
// waitFor:   the user must do this (tap the lit-up spot) to move on, and the
//            spot is left usable. Without it, the step has a Next button
//            and the whole screen, lit spot included, is locked.
// tryIt:     an explanation step whose lit spot stays usable, so the user
//            can try what's described. Only for spots where nothing can
//            lead away from the tour (no navigating to another tab).
// skippable: "Skip tour" shows from here on — only after the user has added
//            a transaction and seen it land on the Dashboard.

export type TutorialEvent =
  | "addOpened"
  | "transactionSaved"
  | "tab:Analytics"
  | "tab:Alerts"
  | "tab:Settings";

export type TutorialStep = {
  id: string;
  host: "app" | "addModal";
  target?: string | string[];
  waitFor?: TutorialEvent;
  tryIt?: boolean;
  skippable?: boolean;
};
// Each step's title and text live in the translation files, under
// tour.<id>.title / tour.<id>.text.

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    host: "app",
  },
  {
    id: "fab",
    host: "app",
    target: "fab",
    waitFor: "addOpened",
  },
  {
    id: "add-type",
    host: "addModal",
    target: "add:type",
  },
  {
    id: "add-fields",
    host: "addModal",
    target: "add:fields",
  },
  {
    id: "add-category",
    host: "addModal",
    target: "add:category",
  },
  {
    id: "add-fund",
    host: "addModal",
    target: "add:fund",
  },
  {
    id: "add-yours",
    host: "addModal",
    target: "add:sheet",
    waitFor: "transactionSaved",
  },
  {
    id: "hero",
    host: "app",
    target: "hero",
  },
  {
    id: "recent",
    host: "app",
    target: "card:transactions",
    tryIt: true,
    skippable: true,
  },
  {
    id: "insights",
    host: "app",
    target: "card:insights",
    tryIt: true,
    skippable: true,
  },
  {
    id: "funds",
    host: "app",
    target: "card:funds",
    skippable: true,
  },
  {
    id: "top-expenses",
    host: "app",
    target: "card:topExpenses",
    skippable: true,
  },
  {
    id: "cards-tip",
    host: "app",
    target: "card:insights",
    tryIt: true,
    skippable: true,
  },
  {
    id: "go-analytics",
    host: "app",
    target: "tab:Analytics",
    waitFor: "tab:Analytics",
    skippable: true,
  },
  {
    id: "analytics-toggle",
    host: "app",
    target: "analytics:toggle",
    tryIt: true,
    skippable: true,
  },
  {
    id: "analytics-filters",
    host: "app",
    target: "analytics:filters",
    skippable: true,
  },
  {
    id: "analytics-summary",
    host: "app",
    target: "analytics:summary",
    tryIt: true,
    skippable: true,
  },
  {
    id: "analytics-list",
    host: "app",
    // The selection toolbar joins the lit area once multi-select is on.
    target: ["analytics:list", "analytics:selectToolbar"],
    tryIt: true,
    skippable: true,
  },
  {
    id: "go-alerts",
    host: "app",
    target: "tab:Alerts",
    waitFor: "tab:Alerts",
    skippable: true,
  },
  {
    id: "alerts-list",
    host: "app",
    target: "alerts:list",
    skippable: true,
  },
  {
    id: "alerts-add",
    host: "app",
    target: "alerts:add",
    skippable: true,
  },
  {
    id: "go-settings",
    host: "app",
    target: "tab:Settings",
    waitFor: "tab:Settings",
    skippable: true,
  },
  {
    id: "settings-look",
    host: "app",
    target: "settings:general",
    skippable: true,
  },
  {
    id: "settings-categories",
    host: "app",
    target: "settings:categories",
    skippable: true,
  },
  {
    id: "settings-account",
    host: "app",
    target: "settings:about",
    skippable: true,
  },
  {
    id: "done",
    host: "app",
  },
];
