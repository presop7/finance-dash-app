import { create } from "zustand";
import { Category } from "../constants/categories";
import {
  FundCategory,
  DEFAULT_FUND_CATEGORIES,
} from "../constants/fundCategories";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../constants/categories";

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
  // Data
  transactions: Transaction[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  fundCategories: FundCategory[];

  // Transaction actions
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  deleteTransaction: (id: string) => void;

  // Category actions
  addExpenseCategory: (category: Category) => void;
  addIncomeCategory: (category: Category) => void;

  // Fund category actions
  addFundCategory: (fundCategory: FundCategory) => void;
};

export const useFinanceStore = create<FinanceStore>((set) => ({
  // Initial data
  transactions: [],
  expenseCategories: EXPENSE_CATEGORIES,
  incomeCategories: INCOME_CATEGORIES,
  fundCategories: DEFAULT_FUND_CATEGORIES,

  // Transaction actions
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

  // Category actions
  addExpenseCategory: (category) =>
    set((state) => ({
      expenseCategories: [...state.expenseCategories, category],
    })),

  addIncomeCategory: (category) =>
    set((state) => ({
      incomeCategories: [...state.incomeCategories, category],
    })),

  // Fund category actions
  addFundCategory: (fundCategory) =>
    set((state) => ({
      fundCategories: [...state.fundCategories, fundCategory],
    })),
}));
