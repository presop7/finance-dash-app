export type FundCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  // The "Unassigned" fund — where transactions go when their fund is
  // deleted; the server won't let it be renamed or deleted.
  locked?: boolean;
  // Set for the untouched default funds: shown translated (defaultNames).
  defaultKey?: string;
};

export const DEFAULT_FUND_CATEGORIES: FundCategory[] = [
  {
    id: "cash",
    name: "Cash",
    icon: "cash-outline",
    color: "#1D9E75",
  },
];
