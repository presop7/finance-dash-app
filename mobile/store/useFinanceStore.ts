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

type FinanceStore = {
  transactions: Transaction[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  fundCategories: FundCategory[];
  dashboardCardOrder: string[];
  dashboardCollapsedCards: Record<string, boolean>;
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
