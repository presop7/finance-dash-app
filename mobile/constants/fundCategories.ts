export type FundCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export const DEFAULT_FUND_CATEGORIES: FundCategory[] = [
  {
    id: "cash",
    name: "Cash",
    icon: "cash-outline",
    color: "#1D9E75",
  },
];
