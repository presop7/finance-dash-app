import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Category,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../constants/categories";
import {
  FundCategory,
  DEFAULT_FUND_CATEGORIES,
} from "../constants/fundCategories";

export type Transaction = {
  id: string;
  title: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  fundCategory: string;
  note: string;
  date: Date;
};

export const DEFAULT_DASHBOARD_CARD_ORDER = [
  "insights",
  "topExpenses",
  "funds",
  "transactions",
];

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "D MMM YYYY";
export type TimeFormat = "12h" | "24h";

export type Settings = {
  currency: string;
  hideBalance: boolean;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
};

export const DEFAULT_SETTINGS: Settings = {
  currency: "BGN",
  hideBalance: false,
  timeFormat: "24h",
  dateFormat: "DD/MM/YYYY",
};

export type AlertRuleType =
  | "lowBalance"
  | "balanceAbove"
  | "monthlyExpenseOver"
  | "monthlyIncomeOver"
  | "categoryAmount";

export type AlertRule = {
  id: string;
  type: AlertRuleType;
  amount: number;
  categoryId?: string;
  categoryType?: "expense" | "income";
  enabled: boolean;
  lastTriggeredKey?: string;
};

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: "default_low_balance", type: "lowBalance", amount: 500, enabled: true },
  { id: "default_monthly_expense", type: "monthlyExpenseOver", amount: 500, enabled: true },
];

type FinanceStore = {
  transactions: Transaction[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  fundCategories: FundCategory[];
  dashboardCardOrder: string[];
  dashboardCollapsedCards: Record<string, boolean>;
  settings: Settings;
  alertRules: AlertRule[];
  updateSettings: (changes: Partial<Settings>) => void;
  addAlertRule: (rule: Omit<AlertRule, "id">) => void;
  updateAlertRule: (id: string, changes: Partial<AlertRule>) => void;
  deleteAlertRule: (id: string) => void;
  toggleAlertRule: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  updateTransaction: (
    id: string,
    changes: Omit<Transaction, "id">,
  ) => void;
  deleteTransaction: (id: string) => void;
  clearAllTransactions: () => void;
  addExpenseCategory: (category: Category) => void;
  updateExpenseCategory: (id: string, changes: Category) => void;
  deleteExpenseCategory: (id: string) => void;
  addIncomeCategory: (category: Category) => void;
  updateIncomeCategory: (id: string, changes: Category) => void;
  deleteIncomeCategory: (id: string) => void;
  addFundCategory: (fundCategory: FundCategory) => void;
  updateFundCategory: (id: string, changes: FundCategory) => void;
  deleteFundCategory: (id: string) => void;
  setDashboardCardOrder: (order: string[]) => void;
  toggleDashboardCard: (id: string) => void;
};

// localStorage only exists in the browser — AsyncStorage backs native (iOS/Android).
const storage = {
  getItem: async (name: string) => {
    if (Platform.OS === "web") {
      const str = localStorage.getItem(name);
      return str ? JSON.parse(str) : null;
    }
    const str = await AsyncStorage.getItem(name);
    return str ? JSON.parse(str) : null;
  },
  setItem: async (name: string, value: unknown) => {
    if (Platform.OS === "web") {
      localStorage.setItem(name, JSON.stringify(value));
      return;
    }
    await AsyncStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: async (name: string) => {
    if (Platform.OS === "web") {
      localStorage.removeItem(name);
      return;
    }
    await AsyncStorage.removeItem(name);
  },
};

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set) => ({
      transactions: [],
      expenseCategories: EXPENSE_CATEGORIES,
      incomeCategories: INCOME_CATEGORIES,
      fundCategories: DEFAULT_FUND_CATEGORIES,
      dashboardCardOrder: DEFAULT_DASHBOARD_CARD_ORDER,
      dashboardCollapsedCards: {},
      settings: DEFAULT_SETTINGS,
      alertRules: DEFAULT_ALERT_RULES,

      updateSettings: (changes) =>
        set((state) => ({ settings: { ...state.settings, ...changes } })),

      addAlertRule: (rule) =>
        set((state) => ({
          alertRules: [
            ...state.alertRules,
            { ...rule, id: Date.now().toString() },
          ],
        })),

      updateAlertRule: (id, changes) =>
        set((state) => ({
          alertRules: state.alertRules.map((r) =>
            r.id === id ? { ...r, ...changes } : r,
          ),
        })),

      deleteAlertRule: (id) =>
        set((state) => ({
          alertRules: state.alertRules.filter((r) => r.id !== id),
        })),

      toggleAlertRule: (id) =>
        set((state) => ({
          alertRules: state.alertRules.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled } : r,
          ),
        })),

      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [
            {
              ...transaction,
              id: Date.now().toString(),
            },
            ...state.transactions,
          ],
        })),

      updateTransaction: (id, changes) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...changes, id } : t,
          ),
        })),

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      clearAllTransactions: () => set({ transactions: [] }),

      addExpenseCategory: (category) =>
        set((state) => ({
          expenseCategories: [...state.expenseCategories, category],
        })),

      updateExpenseCategory: (id, changes) =>
        set((state) => ({
          expenseCategories: state.expenseCategories.map((c) =>
            c.id === id ? { ...changes, id } : c,
          ),
        })),

      deleteExpenseCategory: (id) =>
        set((state) => ({
          expenseCategories: state.expenseCategories.filter(
            (c) => c.id !== id,
          ),
        })),

      addIncomeCategory: (category) =>
        set((state) => ({
          incomeCategories: [...state.incomeCategories, category],
        })),

      updateIncomeCategory: (id, changes) =>
        set((state) => ({
          incomeCategories: state.incomeCategories.map((c) =>
            c.id === id ? { ...changes, id } : c,
          ),
        })),

      deleteIncomeCategory: (id) =>
        set((state) => ({
          incomeCategories: state.incomeCategories.filter(
            (c) => c.id !== id,
          ),
        })),

      addFundCategory: (fundCategory) =>
        set((state) => ({
          fundCategories: [...state.fundCategories, fundCategory],
        })),

      updateFundCategory: (id, changes) =>
        set((state) => ({
          fundCategories: state.fundCategories.map((f) =>
            f.id === id ? { ...changes, id } : f,
          ),
        })),

      deleteFundCategory: (id) =>
        set((state) => ({
          fundCategories: state.fundCategories.filter((f) => f.id !== id),
        })),

      setDashboardCardOrder: (order) => set({ dashboardCardOrder: order }),

      toggleDashboardCard: (id) =>
        set((state) => ({
          dashboardCollapsedCards: {
            ...state.dashboardCollapsedCards,
            [id]: !state.dashboardCollapsedCards[id],
          },
        })),
    }),
    {
      name: "finance-store",
      storage,
    },
  ),
);
