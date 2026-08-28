import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Category } from "../constants/categories";
import { FundCategory } from "../constants/fundCategories";
import {
  financeApi,
  ApiCategory,
  ApiFundCategory,
  ApiTransaction,
  ApiUser,
} from "../services/financeApi";

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

export type SyncStatus = "idle" | "loading" | "loaded" | "error";

type CategoryFields = { label: string; icon: string; color?: string };
type FundCategoryFields = { name: string; icon: string; color: string };
type TransactionFields = Omit<Transaction, "id">;

type FinanceStore = {
  // --- synced from the backend, not persisted locally ---
  status: SyncStatus;
  syncError: string | null;
  transactions: Transaction[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  fundCategories: FundCategory[];
  settings: Settings;

  hydrate: () => Promise<void>;
  reset: () => void;

  updateSettings: (changes: Partial<Settings>) => Promise<void>;

  addTransaction: (transaction: TransactionFields) => Promise<void>;
  updateTransaction: (id: string, changes: TransactionFields) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  addExpenseCategory: (category: CategoryFields) => Promise<void>;
  updateExpenseCategory: (id: string, changes: CategoryFields) => Promise<void>;
  deleteExpenseCategory: (id: string, confirm?: boolean) => Promise<void>;
  addIncomeCategory: (category: CategoryFields) => Promise<void>;
  updateIncomeCategory: (id: string, changes: CategoryFields) => Promise<void>;
  deleteIncomeCategory: (id: string, confirm?: boolean) => Promise<void>;

  addFundCategory: (fundCategory: FundCategoryFields) => Promise<void>;
  updateFundCategory: (id: string, changes: FundCategoryFields) => Promise<void>;
  deleteFundCategory: (id: string, confirm?: boolean) => Promise<void>;

  // --- local-only, persisted to AsyncStorage ---
  dashboardCardOrder: string[];
  dashboardCollapsedCards: Record<string, boolean>;
  alertRules: AlertRule[];
  addAlertRule: (rule: Omit<AlertRule, "id">) => void;
  updateAlertRule: (id: string, changes: Partial<AlertRule>) => void;
  deleteAlertRule: (id: string) => void;
  toggleAlertRule: (id: string) => void;
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

// ---- Mappers: backend (snake_case) <-> app shape (camelCase) ----

function mapCategory(c: ApiCategory): Category {
  return {
    id: c.id,
    label: c.name,
    icon: (c.icon ?? "ellipsis-horizontal-outline") as Category["icon"],
    color: c.color ?? undefined,
  };
}

function mapFundCategory(f: ApiFundCategory): FundCategory {
  return {
    id: f.id,
    name: f.name,
    icon: f.icon ?? "wallet-outline",
    color: f.color ?? "#1D2B4F",
  };
}

function mapTransaction(t: ApiTransaction): Transaction {
  return {
    id: t.id,
    title: t.title,
    type: t.type,
    amount: Number(t.amount),
    category: t.category_id,
    fundCategory: t.fund_category_id,
    note: t.note ?? "",
    date: new Date(t.occurred_at),
  };
}

function mapSettings(u: ApiUser): Settings {
  return {
    currency: u.currency,
    hideBalance: u.hide_balance,
    timeFormat: u.time_format,
    dateFormat: u.date_format,
  };
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      status: "idle",
      syncError: null,
      transactions: [],
      expenseCategories: [],
      incomeCategories: [],
      fundCategories: [],
      settings: DEFAULT_SETTINGS,

      dashboardCardOrder: DEFAULT_DASHBOARD_CARD_ORDER,
      dashboardCollapsedCards: {},
      alertRules: DEFAULT_ALERT_RULES,

      hydrate: async () => {
        set({ status: "loading", syncError: null });
        try {
          const [me, apiCategories, apiFundCategories, apiTransactions] = await Promise.all([
            financeApi.getMe(),
            financeApi.listCategories(),
            financeApi.listFundCategories(),
            financeApi.listTransactions(),
          ]);

          set({
            status: "loaded",
            settings: mapSettings(me),
            expenseCategories: apiCategories.filter((c) => c.type === "expense").map(mapCategory),
            incomeCategories: apiCategories.filter((c) => c.type === "income").map(mapCategory),
            fundCategories: apiFundCategories.map(mapFundCategory),
            transactions: apiTransactions
              .map(mapTransaction)
              .sort((a, b) => b.date.getTime() - a.date.getTime()),
          });
        } catch (err) {
          set({
            status: "error",
            syncError: err instanceof Error ? err.message : "Failed to load your data",
          });
        }
      },

      reset: () =>
        set({
          status: "idle",
          syncError: null,
          transactions: [],
          expenseCategories: [],
          incomeCategories: [],
          fundCategories: [],
          settings: DEFAULT_SETTINGS,
        }),

      updateSettings: async (changes) => {
        const me = await financeApi.updateSettings({
          currency: changes.currency,
          hide_balance: changes.hideBalance,
          time_format: changes.timeFormat,
          date_format: changes.dateFormat,
        });
        set({ settings: mapSettings(me) });
      },

      addTransaction: async (transaction) => {
        const created = await financeApi.createTransaction({
          title: transaction.title,
          fund_category_id: transaction.fundCategory,
          category_id: transaction.category,
          amount: transaction.amount,
          currency: get().settings.currency,
          type: transaction.type,
          note: transaction.note || null,
          occurred_at: transaction.date.toISOString(),
          client_generated_id: Crypto.randomUUID(),
        });
        set((state) => ({
          transactions: [mapTransaction(created), ...state.transactions],
        }));
      },

      updateTransaction: async (id, changes) => {
        const updated = await financeApi.updateTransaction(id, {
          title: changes.title,
          fund_category_id: changes.fundCategory,
          category_id: changes.category,
          amount: changes.amount,
          type: changes.type,
          note: changes.note || null,
          occurred_at: changes.date.toISOString(),
        });
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === id ? mapTransaction(updated) : t)),
        }));
      },

      deleteTransaction: async (id) => {
        await financeApi.deleteTransaction(id);
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        }));
      },

      addExpenseCategory: async (category) => {
        const created = await financeApi.createCategory({
          name: category.label,
          icon: category.icon,
          color: category.color ?? null,
          type: "expense",
        });
        set((state) => ({
          expenseCategories: [...state.expenseCategories, mapCategory(created)],
        }));
      },

      updateExpenseCategory: async (id, changes) => {
        const updated = await financeApi.updateCategory(id, {
          name: changes.label,
          icon: changes.icon,
          color: changes.color ?? null,
        });
        set((state) => ({
          expenseCategories: state.expenseCategories.map((c) =>
            c.id === id ? mapCategory(updated) : c,
          ),
        }));
      },

      deleteExpenseCategory: async (id, confirm = false) => {
        await financeApi.deleteCategory(id, confirm);
        const [categories, transactions] = await Promise.all([
          financeApi.listCategories(),
          financeApi.listTransactions(),
        ]);
        set({
          expenseCategories: categories.filter((c) => c.type === "expense").map(mapCategory),
          transactions: transactions
            .map(mapTransaction)
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        });
      },

      addIncomeCategory: async (category) => {
        const created = await financeApi.createCategory({
          name: category.label,
          icon: category.icon,
          color: category.color ?? null,
          type: "income",
        });
        set((state) => ({
          incomeCategories: [...state.incomeCategories, mapCategory(created)],
        }));
      },

      updateIncomeCategory: async (id, changes) => {
        const updated = await financeApi.updateCategory(id, {
          name: changes.label,
          icon: changes.icon,
          color: changes.color ?? null,
        });
        set((state) => ({
          incomeCategories: state.incomeCategories.map((c) =>
            c.id === id ? mapCategory(updated) : c,
          ),
        }));
      },

      deleteIncomeCategory: async (id, confirm = false) => {
        await financeApi.deleteCategory(id, confirm);
        const [categories, transactions] = await Promise.all([
          financeApi.listCategories(),
          financeApi.listTransactions(),
        ]);
        set({
          incomeCategories: categories.filter((c) => c.type === "income").map(mapCategory),
          transactions: transactions
            .map(mapTransaction)
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        });
      },

      addFundCategory: async (fundCategory) => {
        const created = await financeApi.createFundCategory({
          name: fundCategory.name,
          currency: get().settings.currency,
          icon: fundCategory.icon,
          color: fundCategory.color,
        });
        set((state) => ({
          fundCategories: [...state.fundCategories, mapFundCategory(created)],
        }));
      },

      updateFundCategory: async (id, changes) => {
        const updated = await financeApi.updateFundCategory(id, {
          name: changes.name,
          icon: changes.icon,
          color: changes.color,
        });
        set((state) => ({
          fundCategories: state.fundCategories.map((f) =>
            f.id === id ? mapFundCategory(updated) : f,
          ),
        }));
      },

      deleteFundCategory: async (id, confirm = false) => {
        await financeApi.deleteFundCategory(id, confirm);
        const [fundCategories, transactions] = await Promise.all([
          financeApi.listFundCategories(),
          financeApi.listTransactions(),
        ]);
        set({
          fundCategories: fundCategories.map(mapFundCategory),
          transactions: transactions
            .map(mapTransaction)
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        });
      },

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
      // Only local-only UI/notification state persists on-device — everything
      // else is backend-synced and always rehydrated fresh via hydrate().
      partialize: (state) => ({
        dashboardCardOrder: state.dashboardCardOrder,
        dashboardCollapsedCards: state.dashboardCollapsedCards,
        alertRules: state.alertRules,
      }),
    },
  ),
);
