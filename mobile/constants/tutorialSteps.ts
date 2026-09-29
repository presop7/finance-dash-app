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
  title: string;
  text: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    host: "app",
    title: "Welcome to Fi-Track! 👋",
    text: "A quick tour of the app. The example transactions disappear when it ends.",
  },
  {
    id: "fab",
    host: "app",
    target: "fab",
    waitFor: "addOpened",
    title: "Add money in or out",
    text: "Tap +.",
  },
  {
    id: "add-type",
    host: "addModal",
    target: "add:type",
    title: "Expense or income?",
    text: "Expense = money out. Income = money in.",
  },
  {
    id: "add-fields",
    host: "addModal",
    target: "add:fields",
    title: "Name and amount",
    text: "Add a name and the amount. Only the amount is required.",
  },
  {
    id: "add-category",
    host: "addModal",
    target: "add:category",
    title: "Category",
    text: "Pick one. \"+ New\" adds your own. Hold one to edit it.",
  },
  {
    id: "add-fund",
    host: "addModal",
    target: "add:fund",
    title: "Fund",
    text: "Where the money is: wallet, card, savings. \"+ New\" adds one.",
  },
  {
    id: "add-yours",
    host: "addModal",
    target: "add:sheet",
    waitFor: "transactionSaved",
    title: "Your turn",
    text: "Fill it in and tap Save.",
  },
  {
    id: "hero",
    host: "app",
    target: "hero",
    title: "Your balance",
    text: "Total money, plus money in and out. Tap the period to change it. Hold Income or Expenses to see just those.",
  },
  {
    id: "recent",
    host: "app",
    target: "card:transactions",
    tryIt: true,
    skippable: true,
    title: "Latest transactions",
    text: "Yours is on top. Tap one for details. Swipe from the edge to edit or delete.\n\n\"Skip tour\" is now in the corner.",
  },
  {
    id: "insights",
    host: "app",
    target: "card:insights",
    tryIt: true,
    skippable: true,
    title: "Tips",
    text: "Tap the card for the next tip.",
  },
  {
    id: "funds",
    host: "app",
    target: "card:funds",
    skippable: true,
    title: "Your funds",
    text: "Balance per fund. Swipe for more. Hold and release to see one fund. Hold and drag to reorder.",
  },
  {
    id: "top-expenses",
    host: "app",
    target: "card:topExpenses",
    skippable: true,
    title: "Biggest expenses",
    text: "Your largest spending, at a glance.",
  },
  {
    id: "cards-tip",
    host: "app",
    target: "card:insights",
    tryIt: true,
    skippable: true,
    title: "Arrange your cards",
    text: "Tap a title to fold a card. Hold a title to reorder.",
  },
  {
    id: "go-analytics",
    host: "app",
    target: "tab:Analytics",
    waitFor: "tab:Analytics",
    skippable: true,
    title: "Analytics",
    text: "Tap Analytics below.",
  },
  {
    id: "analytics-toggle",
    host: "app",
    target: "analytics:toggle",
    tryIt: true,
    skippable: true,
    title: "All, expenses or income",
    text: "Switch what the screen shows.",
  },
  {
    id: "analytics-filters",
    host: "app",
    target: "analytics:filters",
    skippable: true,
    title: "Filters",
    text: "Narrow by date, category or fund. Tap the date below the switch for a quick change.",
  },
  {
    id: "analytics-summary",
    host: "app",
    target: "analytics:summary",
    tryIt: true,
    skippable: true,
    title: "Summary",
    text: "Totals at a glance. Swipe or tap the dots for charts.",
  },
  {
    id: "analytics-list",
    host: "app",
    // The selection toolbar joins the lit area once multi-select is on.
    target: ["analytics:list", "analytics:selectToolbar"],
    tryIt: true,
    skippable: true,
    title: "All transactions",
    text: "Tap: details. Swipe from the edge: edit or delete. Hold: select several, then delete or move them together.",
  },
  {
    id: "go-alerts",
    host: "app",
    target: "tab:Alerts",
    waitFor: "tab:Alerts",
    skippable: true,
    title: "Reminders",
    text: "Tap Reminders below.",
  },
  {
    id: "alerts-list",
    host: "app",
    target: "alerts:list",
    skippable: true,
    title: "Reminders",
    text: "Alerts for low balance, big spending, or a daily reminder. Switch on or off, tap to edit, bin to delete.",
  },
  {
    id: "alerts-add",
    host: "app",
    target: "alerts:add",
    skippable: true,
    title: "New reminder",
    text: "Tap Add Reminder.",
  },
  {
    id: "go-settings",
    host: "app",
    target: "tab:Settings",
    waitFor: "tab:Settings",
    skippable: true,
    title: "Settings",
    text: "Tap Settings below.",
  },
  {
    id: "settings-look",
    host: "app",
    target: "settings:general",
    skippable: true,
    title: "Look and format",
    text: "Theme, currency, date and time. Hide Balance keeps it private: hold it to see.",
  },
  {
    id: "settings-categories",
    host: "app",
    target: "settings:categories",
    skippable: true,
    title: "Categories and import",
    text: "Manage categories and funds. Import from a spreadsheet (CSV).",
  },
  {
    id: "settings-account",
    host: "app",
    target: "settings:about",
    skippable: true,
    title: "Help",
    text: "Send feedback or replay this tour. Careful: \"Clear All Transactions\" deletes everything.",
  },
  {
    id: "done",
    host: "app",
    title: "All set! 🎉",
    text: "The examples are removed when you tap Finish.",
  },
];
