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

type Transaction = {
  id: string;
  title: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  fundCategory: string;
  note: string;
  date: Date;
};

type FinanceStore = {
  transactions: Transaction[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  fundCategories: FundCategory[];
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  deleteTransaction: (id: string) => void;
  clearAllTransactions: () => void;
  addExpenseCategory: (category: Category) => void;
  addIncomeCategory: (category: Category) => void;
  addFundCategory: (fundCategory: FundCategory) => void;
};

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set) => ({
      transactions: [],
      expenseCategories: EXPENSE_CATEGORIES,
      incomeCategories: INCOME_CATEGORIES,
      fundCategories: DEFAULT_FUND_CATEGORIES,

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

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      clearAllTransactions: () => set({ transactions: [] }),

      addExpenseCategory: (category) =>
        set((state) => ({
          expenseCategories: [...state.expenseCategories, category],
        })),

      addIncomeCategory: (category) =>
        set((state) => ({
          incomeCategories: [...state.incomeCategories, category],
        })),

      addFundCategory: (fundCategory) =>
        set((state) => ({
          fundCategories: [...state.fundCategories, fundCategory],
        })),
    }),
    {
      name: "finance-store",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    },
  ),
);
