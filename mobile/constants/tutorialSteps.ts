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
    text:
      "Let's take a quick tour so you know where everything is.\n\n" +
      "To make it easier to follow, we've filled the app with some example spending and income. " +
      "Don't worry — the examples disappear as soon as the tour ends.",
  },
  {
    id: "fab",
    host: "app",
    target: "fab",
    waitFor: "addOpened",
    title: "Write down your money",
    text: "This + button is how you write down any money you spend or receive. Tap it now.",
  },
  {
    id: "add-type",
    host: "addModal",
    target: "add:type",
    title: "Spent or received?",
    text:
      "First choose what it is: Expense is money that left your pocket, Income is money that came in.\n\n" +
      "The colours change with your choice, so you can always tell which one you picked.",
  },
  {
    id: "add-fields",
    host: "addModal",
    target: "add:fields",
    title: "Name and amount",
    text:
      "Give it a short name you'll recognise later, like \"Groceries\" or \"Bus ticket\", then type how much it was.\n\n" +
      "The amount is the only thing you have to fill in — the Save button stays grey until you do.",
  },
  {
    id: "add-category",
    host: "addModal",
    target: "add:category",
    title: "Categories",
    text:
      "Categories group similar things together, like Food or Transport, so you can see where your money goes. Tap one to choose it.\n\n" +
      "Missing one? Tap \"+ New\" to make your own. Press and hold a category to change its name, icon or colour.",
  },
  {
    id: "add-fund",
    host: "addModal",
    target: "add:fund",
    title: "Where the money is",
    text:
      "Funds are the places you keep money — your wallet, a bank card, savings. " +
      "Pick where this money came from or went to. \"+ New\" adds another one.",
  },
  {
    id: "add-yours",
    host: "addModal",
    target: "add:sheet",
    waitFor: "transactionSaved",
    title: "Your turn!",
    text:
      "Add a real one now: choose Expense or Income, type a name and an amount, pick a category, then tap Save at the bottom. " +
      "The date is today unless you change it, and a note is optional.",
  },
  {
    id: "hero",
    host: "app",
    target: "hero",
    title: "Your balance",
    text:
      "This shows all the money you have, plus how much came in and went out. See how it changed with what you just added?\n\n" +
      "Tap the period button to switch between this month, this year and more. Press and hold Income or Expenses to see just those.",
  },
  {
    id: "recent",
    host: "app",
    target: "card:transactions",
    tryIt: true,
    skippable: true,
    title: "Your latest entries",
    text:
      "Here are your five newest transactions — yours is at the top. Tap one to see everything about it, " +
      "or slide it from its left or right edge to change or delete it.\n\n" +
      "You can leave the tour any time from now on with \"Skip tour\" in the corner.",
  },
  {
    id: "insights",
    host: "app",
    target: "card:insights",
    tryIt: true,
    skippable: true,
    title: "Handy tips",
    text:
      "Insights point out useful things about your money, like which category costs you the most. " +
      "Tap the card to see the next tip.",
  },
  {
    id: "funds",
    host: "app",
    target: "card:funds",
    skippable: true,
    title: "Your funds",
    text:
      "Each fund gets its own card with its balance and how it changed in the last 30 days. Swipe sideways to see them all.\n\n" +
      "Press and hold a card, then let go, to see only that fund's money. Hold it and drag to change the order.",
  },
  {
    id: "top-expenses",
    host: "app",
    target: "card:topExpenses",
    skippable: true,
    title: "Biggest spending",
    text: "Top Expenses lists the largest amounts you've spent, so the big costs never slip by unnoticed.",
  },
  {
    id: "cards-tip",
    host: "app",
    target: "card:insights",
    tryIt: true,
    skippable: true,
    title: "Make it yours",
    text:
      "Tap a card's title to fold it away, and tap again to open it.\n\n" +
      "Press and hold a title to move the cards into the order you like.",
  },
  {
    id: "go-analytics",
    host: "app",
    target: "tab:Analytics",
    waitFor: "tab:Analytics",
    skippable: true,
    title: "See the bigger picture",
    text: "Now tap Analytics at the bottom of the screen.",
  },
  {
    id: "analytics-toggle",
    host: "app",
    target: "analytics:toggle",
    tryIt: true,
    skippable: true,
    title: "All, spending or income",
    text: "Use this switch to look at everything, only what you spent, or only what came in.",
  },
  {
    id: "analytics-filters",
    host: "app",
    target: "analytics:filters",
    skippable: true,
    title: "Filters",
    text:
      "Filters narrow things down — for example only last month, one category or one fund.\n\n" +
      "You can also tap the dates under the switch to quickly pick a different time period.",
  },
  {
    id: "analytics-summary",
    host: "app",
    target: "analytics:summary",
    tryIt: true,
    skippable: true,
    title: "The summary",
    text:
      "This adds everything up for you. Swipe it to the left — or tap the dots under it — to see charts of which categories take the most money.",
  },
  {
    id: "analytics-list",
    host: "app",
    // The selection toolbar joins the lit area once multi-select is on.
    target: ["analytics:list", "analytics:selectToolbar"],
    tryIt: true,
    skippable: true,
    title: "All your transactions",
    text:
      "Every transaction is listed here. Tap one to see its details.\n\n" +
      "Slide one from its left or right edge: to the left to delete it, to the right to change it. " +
      "Press and hold one to select several at once, then tap more to add them. " +
      "The bar that appears on top lets you delete them or move them to another category together — Discard ends selecting.",
  },
  {
    id: "go-alerts",
    host: "app",
    target: "tab:Alerts",
    waitFor: "tab:Alerts",
    skippable: true,
    title: "Reminders",
    text: "Next, tap Reminders at the bottom.",
  },
  {
    id: "alerts-list",
    host: "app",
    target: "alerts:list",
    skippable: true,
    title: "Let the app keep watch",
    text:
      "Reminders give you a nudge — for example when your money runs low, when you've spent a lot this month, " +
      "or every evening to remind you to write down the day's spending.\n\n" +
      "Use the switch to turn one on or off, tap it to change it, or tap the bin to remove it.",
  },
  {
    id: "alerts-add",
    host: "app",
    target: "alerts:add",
    skippable: true,
    title: "Make your own",
    text: "Tap Add Reminder to create a new one: choose what to watch, set the amount or time, and save.",
  },
  {
    id: "go-settings",
    host: "app",
    target: "tab:Settings",
    waitFor: "tab:Settings",
    skippable: true,
    title: "Settings",
    text: "Last stop — tap Settings.",
  },
  {
    id: "settings-look",
    host: "app",
    target: "settings:general",
    skippable: true,
    title: "Make it feel right",
    text:
      "Choose a light or dark look, your currency, and how dates and times are shown.\n\n" +
      "You can also hide your balance so nobody can peek over your shoulder — press and hold it to see it.",
  },
  {
    id: "settings-categories",
    host: "app",
    target: "settings:categories",
    skippable: true,
    title: "Categories and older records",
    text:
      "Manage all your categories and funds in one place. " +
      "You can also bring in transactions from another app or your bank, from a spreadsheet file (CSV).",
  },
  {
    id: "settings-account",
    host: "app",
    target: "settings:about",
    skippable: true,
    title: "Help and feedback",
    text:
      "Tell us about a problem or an idea with Send Feedback, or take this tour again whenever you like.\n\n" +
      "Just above you'll find Sign Out — and \"Clear All Transactions\", so be careful: that one deletes everything for good.",
  },
  {
    id: "done",
    host: "app",
    title: "You're all set! 🎉",
    text:
      "When you tap Finish, the examples are removed and you'll only see your own money.\n\n" +
      "Happy tracking!",
  },
];
