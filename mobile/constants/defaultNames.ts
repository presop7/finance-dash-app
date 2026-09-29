// The categories and funds every account starts with are stored in English
// (backend default_categories.py). They're shown in the app's language until
// the user renames them — recognised by the original name *and* icon, so a
// custom category that happens to be called "Food" isn't touched. The value
// is the translation key under "defaults.".

const DEFAULT_CATEGORY_KEYS: Record<string, string> = {
  "Food|cart-outline": "food",
  "Restaurant|cafe-outline": "restaurant",
  "Transport|car-outline": "transport",
  "Entertainment|game-controller-outline": "entertainment",
  "Other|ellipsis-horizontal-outline": "other",
  "Salary|business-outline": "salary",
  "Freelance|briefcase-outline": "freelance",
  "Investment|trending-up-outline": "investment",
};

const DEFAULT_FUND_KEYS: Record<string, string> = {
  "Cash|cash-outline": "cash",
};

export function defaultCategoryKey(name: string, icon: string | null, shared: boolean): string | undefined {
  if (shared) return "unassigned"; // the locked, shared "Unassigned"
  return DEFAULT_CATEGORY_KEYS[`${name}|${icon}`];
}

export function defaultFundKey(name: string, icon: string | null): string | undefined {
  if (name === "Unassigned") return "unassignedFund";
  return DEFAULT_FUND_KEYS[`${name}|${icon}`];
}
