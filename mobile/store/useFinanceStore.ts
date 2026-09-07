import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Category } from "../constants/categories";
import { FundCategory } from "../constants/fundCategories";
import { useAuthStore } from "./useAuthStore";
import {
  financeApi,
  ApiCategory,
  ApiFundCategory,
  ApiTransaction,
  ApiUser,
} from "../services/financeApi";
import { ApiError } from "../services/api";

export type Transaction = {
  id: string;
  title: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  fundCategory: string;
  note: string;
  date: Date;
  // Set while a create/edit for this row is still sitting in the offline queue.
  isPending?: boolean;
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

// "refreshing" = showing cached data while a background hydrate is in flight.
export type SyncStatus = "idle" | "loading" | "loaded" | "refreshing" | "error";

type CategoryFields = { label: string; icon: string; color?: string };
type FundCategoryFields = { name: string; icon: string; color: string };
type TransactionFields = Omit<Transaction, "id" | "isPending">;

export type OpStatus = "pending" | "syncing" | "failed";

// Writes made while offline are queued as operations and replayed on reconnect.
// Ops are collapsed to their net effect at enqueue time (see queueWrite helpers
// below), so there is at most one op per transaction and replay never has to
// reason about ordering between conflicting ops.
export type PendingOp =
  // clientGeneratedId doubles as the local placeholder row id until it syncs
  | { kind: "create"; clientGeneratedId: string; payload: TransactionFields; status: OpStatus }
  | { kind: "update"; transactionId: string; payload: TransactionFields; status: OpStatus }
  | { kind: "delete"; transactionId: string; status: OpStatus };

type FinanceStore = {
  // --- synced from the backend, cached on-device per user ---
  status: SyncStatus;
  syncError: string | null;
  lastSyncedAt: number | null;
  // False until the persisted snapshot has been read off disk (AsyncStorage is
  // async, so there's a brief window on boot before the cache lands).
  persistHydrated: boolean;
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

  // --- offline write queue (per-user, persisted) ---
  isConnected: boolean;
  pendingOps: PendingOp[];
  setConnected: (connected: boolean) => void;
  replayPendingOps: () => Promise<void>;
  retryPendingOp: (key: string) => Promise<void>;

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

// Fields shared device-wide across every account signed in on this device.
// Everything else that gets persisted is namespaced under the signed-in user,
// so switching accounts never shows (or clobbers) another user's data.
const DEVICE_FIELDS: readonly string[] = ["dashboardCardOrder", "dashboardCollapsedCards"];

type PersistedBlob = {
  device: Record<string, unknown>;
  users: Record<string, Record<string, unknown>>;
  version?: number;
};

const emptyBlob = (): PersistedBlob => ({ device: {}, users: {} });

const activeUserId = (): string | null =>
  useAuthStore.getState().session?.user.id ?? null;

// localStorage only exists in the browser — AsyncStorage backs native (iOS/Android).
async function readRaw(name: string): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(name);
  return AsyncStorage.getItem(name);
}

async function writeRaw(name: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(name, value);
    return;
  }
  await AsyncStorage.setItem(name, value);
}

async function readBlob(name: string): Promise<PersistedBlob> {
  const str = await readRaw(name);
  if (!str) return emptyBlob();
  try {
    const parsed = JSON.parse(str);
    // Anything not in the {device, users} shape is a pre-split blob from an
    // older build — drop it rather than risk attributing it to the wrong user.
    if (parsed && typeof parsed === "object" && parsed.device && parsed.users) {
      return parsed as PersistedBlob;
    }
    return emptyBlob();
  } catch {
    return emptyBlob();
  }
}

const storage = {
  getItem: async (name: string) => {
    const blob = await readBlob(name);
    const userId = activeUserId();
    const userState = userId ? (blob.users[userId] ?? {}) : {};
    return { state: { ...blob.device, ...userState }, version: blob.version };
  },
  setItem: async (name: string, value: { state: Record<string, unknown>; version?: number }) => {
    const blob = await readBlob(name);
    const userId = activeUserId();

    const device = { ...blob.device };
    const userState = { ...(userId ? (blob.users[userId] ?? {}) : {}) };

    for (const [key, val] of Object.entries(value.state)) {
      if (DEVICE_FIELDS.includes(key)) device[key] = val;
      // With no signed-in user there's nothing meaningful to key per-user data
      // under, so it's simply not written (rather than leaking into `device`).
      else if (userId) userState[key] = val;
    }

    blob.device = device;
    blob.version = value.version;
    if (userId) blob.users[userId] = userState;

    await writeRaw(name, JSON.stringify(blob));
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

// ---- Offline queue helpers ----

// Identifies the transaction an op belongs to. Collapsing guarantees at most
// one op per transaction, so this is a stable unique key for the queue.
const opKey = (op: PendingOp): string =>
  op.kind === "create" ? op.clientGeneratedId : op.transactionId;

function toCreatePayload(fields: TransactionFields, currency: string, clientGeneratedId: string) {
  return {
    title: fields.title,
    fund_category_id: fields.fundCategory,
    category_id: fields.category,
    amount: fields.amount,
    currency,
    type: fields.type,
    note: fields.note || null,
    occurred_at: fields.date.toISOString(),
    client_generated_id: clientGeneratedId,
  };
}

function toUpdatePayload(fields: TransactionFields) {
  return {
    title: fields.title,
    fund_category_id: fields.fundCategory,
    category_id: fields.category,
    amount: fields.amount,
    type: fields.type,
    note: fields.note || null,
    occurred_at: fields.date.toISOString(),
  };
}

// A 404 on update/delete means the row is already gone server-side (deleted from
// another device); a 409 on create means this client_generated_id already landed
// (a previous replay succeeded before the queue could be cleared). Both mean the
// desired end state is already true, so the op is done rather than failed.
function isAlreadySettled(err: unknown, kind: PendingOp["kind"]): boolean {
  if (!(err instanceof ApiError)) return false;
  return kind === "create" ? err.status === 409 : err.status === 404;
}

type FinanceSet = (
  partial: Partial<FinanceStore> | ((state: FinanceStore) => Partial<FinanceStore>),
) => void;
type FinanceGet = () => FinanceStore;

// Sends one queued op to the backend and reconciles local state with the result.
async function runPendingOp(op: PendingOp, set: FinanceSet, get: FinanceGet): Promise<void> {
  const key = opKey(op);
  const setStatus = (status: OpStatus) =>
    set((state) => ({
      pendingOps: state.pendingOps.map((o) => (opKey(o) === key ? { ...o, status } : o)),
    }));
  const dropOp = () =>
    set((state) => ({ pendingOps: state.pendingOps.filter((o) => opKey(o) !== key) }));

  setStatus("syncing");

  try {
    if (op.kind === "create") {
      const created = await financeApi.createTransaction(
        toCreatePayload(op.payload, get().settings.currency, op.clientGeneratedId),
      );
      const real = mapTransaction(created);
      // Swap the local placeholder (still keyed by clientGeneratedId) for the
      // server row, which carries the real id.
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === op.clientGeneratedId ? real : t,
        ),
      }));
    } else if (op.kind === "update") {
      const updated = await financeApi.updateTransaction(
        op.transactionId,
        toUpdatePayload(op.payload),
      );
      const real = mapTransaction(updated);
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === op.transactionId ? real : t)),
      }));
    } else {
      await financeApi.deleteTransaction(op.transactionId);
    }
    dropOp();
  } catch (err) {
    if (isAlreadySettled(err, op.kind)) {
      // Server already reflects the intent. Clear the pending marker; the
      // hydrate at the end of replay reconciles any id mismatch.
      const id = op.kind === "create" ? op.clientGeneratedId : op.transactionId;
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === id ? { ...t, isPending: false } : t,
        ),
      }));
      dropOp();
      return;
    }
    // Leave it queued so it can be retried rather than blocking the rest.
    setStatus("failed");
  }
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      status: "idle",
      syncError: null,
      lastSyncedAt: null,
      persistHydrated: false,
      transactions: [],
      expenseCategories: [],
      incomeCategories: [],
      fundCategories: [],
      settings: DEFAULT_SETTINGS,

      // Assume online until NetInfo says otherwise, so a first write isn't
      // needlessly queued before the listener has reported in.
      isConnected: true,
      pendingOps: [],

      dashboardCardOrder: DEFAULT_DASHBOARD_CARD_ORDER,
      dashboardCollapsedCards: {},
      alertRules: DEFAULT_ALERT_RULES,

      hydrate: async () => {
        // With cached data already on screen this is a background refresh, not
        // a cold load — don't blank the UI out behind a spinner for it.
        const hasCache = get().status === "loaded";
        set({ status: hasCache ? "refreshing" : "loading", syncError: null });

        // Flush queued writes before reading, so the fetched state already
        // includes them. This is also what retries failed ops: any sync —
        // launch, reconnect, sign-in — gets them moving again, rather than
        // them being stuck until connectivity happens to flap.
        if (get().isConnected) {
          for (const op of get().pendingOps.filter((o) => o.status !== "syncing")) {
            await runPendingOp(op, set, get);
          }
        }

        try {
          const [me, apiCategories, apiFundCategories, apiTransactions] = await Promise.all([
            financeApi.getMe(),
            financeApi.listCategories(),
            financeApi.listFundCategories(),
            financeApi.listTransactions(),
          ]);

          set({
            status: "loaded",
            lastSyncedAt: Date.now(),
            settings: mapSettings(me),
            expenseCategories: apiCategories.filter((c) => c.type === "expense").map(mapCategory),
            incomeCategories: apiCategories.filter((c) => c.type === "income").map(mapCategory),
            fundCategories: apiFundCategories.map(mapFundCategory),
            transactions: apiTransactions
              .map(mapTransaction)
              .sort((a, b) => b.date.getTime() - a.date.getTime()),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load your data";
          // A failed refresh keeps the cached data on screen — the hard error
          // screen is only for having nothing to show at all.
          set(
            hasCache
              ? { status: "loaded", syncError: message }
              : { status: "error", syncError: message },
          );
        }
      },

      reset: () =>
        set({
          status: "idle",
          syncError: null,
          lastSyncedAt: null,
          transactions: [],
          expenseCategories: [],
          incomeCategories: [],
          fundCategories: [],
          settings: DEFAULT_SETTINGS,
          // Clears in memory only — the signed-out user's queue stays on disk in
          // their own slot (activeUserId is already null here, so this write
          // can't touch it) and comes back when they sign in again.
          pendingOps: [],
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
        const clientGeneratedId = Crypto.randomUUID();

        if (!get().isConnected) {
          set((state) => ({
            pendingOps: [
              ...state.pendingOps,
              { kind: "create", clientGeneratedId, payload: transaction, status: "pending" },
            ],
            transactions: [
              { ...transaction, id: clientGeneratedId, isPending: true },
              ...state.transactions,
            ],
          }));
          return;
        }

        const created = await financeApi.createTransaction(
          toCreatePayload(transaction, get().settings.currency, clientGeneratedId),
        );
        set((state) => ({
          transactions: [mapTransaction(created), ...state.transactions],
        }));
      },

      updateTransaction: async (id, changes) => {
        if (!get().isConnected) {
          set((state) => {
            const pendingCreate = state.pendingOps.find(
              (op) => op.kind === "create" && op.clientGeneratedId === id,
            );

            const pendingOps: PendingOp[] = pendingCreate
              ? // Never reached the server yet — fold the edit into the queued
                // create so it still syncs as a single POST.
                state.pendingOps.map((op) =>
                  op.kind === "create" && op.clientGeneratedId === id
                    ? { ...op, payload: changes, status: "pending" }
                    : op,
                )
              : state.pendingOps.some((op) => op.kind === "update" && op.transactionId === id)
                ? // Repeated offline edits collapse — only the latest values matter.
                  state.pendingOps.map((op) =>
                    op.kind === "update" && op.transactionId === id
                      ? { ...op, payload: changes, status: "pending" }
                      : op,
                  )
                : [
                    ...state.pendingOps,
                    { kind: "update", transactionId: id, payload: changes, status: "pending" },
                  ];

            return {
              pendingOps,
              transactions: state.transactions.map((t) =>
                t.id === id ? { ...changes, id, isPending: true } : t,
              ),
            };
          });
          return;
        }

        const updated = await financeApi.updateTransaction(id, toUpdatePayload(changes));
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === id ? mapTransaction(updated) : t)),
        }));
      },

      deleteTransaction: async (id) => {
        if (!get().isConnected) {
          set((state) => {
            const hasPendingCreate = state.pendingOps.some(
              (op) => op.kind === "create" && op.clientGeneratedId === id,
            );

            // A row that never reached the server just disappears — dropping the
            // queued create means nothing is sent at all, not a create-then-delete.
            const withoutThisRow = state.pendingOps.filter((op) => opKey(op) !== id);

            return {
              pendingOps: hasPendingCreate
                ? withoutThisRow
                : [...withoutThisRow, { kind: "delete", transactionId: id, status: "pending" }],
              transactions: state.transactions.filter((t) => t.id !== id),
            };
          });
          return;
        }

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

      setConnected: (connected) => {
        const wasConnected = get().isConnected;
        set({ isConnected: connected });
        // Coming back online: sync, which drains the queue then refetches.
        if (!wasConnected && connected && get().pendingOps.length > 0) {
          void get().hydrate();
        }
      },

      // hydrate() drains the queue first and then reconciles against server
      // truth, which is exactly what a replay needs (it also fixes up ids for
      // replayed creates), so this is just a named entry point for it.
      replayPendingOps: async () => {
        await get().hydrate();
      },

      retryPendingOp: async (key) => {
        const op = get().pendingOps.find((o) => opKey(o) === key);
        if (!op || op.status === "syncing") return;
        await runPendingOp(op, set, get);
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
      // The synced slice is cached on-device so the app can render instantly
      // from the last-known snapshot while a fresh hydrate() runs in the
      // background — see the per-user split in the storage adapter above.
      partialize: (state) => ({
        // device-global
        dashboardCardOrder: state.dashboardCardOrder,
        dashboardCollapsedCards: state.dashboardCollapsedCards,
        // per-user
        alertRules: state.alertRules,
        pendingOps: state.pendingOps,
        transactions: state.transactions,
        expenseCategories: state.expenseCategories,
        incomeCategories: state.incomeCategories,
        fundCategories: state.fundCategories,
        settings: state.settings,
        lastSyncedAt: state.lastSyncedAt,
      }),
      // JSON.stringify turns Transaction.date into an ISO string; JSON.parse
      // doesn't revive it, so rebuild the Dates rather than making every
      // consumer handle a string.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<FinanceStore>;
        return {
          ...current,
          ...saved,
          transactions: (saved.transactions ?? []).map((t) => ({
            ...t,
            date: new Date(t.date),
          })),
          pendingOps: (saved.pendingOps ?? []).map((op) => {
            // An op stuck in "syncing" means the app died mid-replay; reset it
            // to "pending" so it's retried instead of skipped forever.
            const status = op.status === "syncing" ? ("pending" as const) : op.status;
            // Queued payloads carry a Date too, which JSON round-tripping
            // flattened to a string — revive it or replay would blow up on
            // .toISOString().
            return op.kind === "delete"
              ? { ...op, status }
              : { ...op, status, payload: { ...op.payload, date: new Date(op.payload.date) } };
          }),
        };
      },
      onRehydrateStorage: () => (state) => {
        useFinanceStore.setState({
          persistHydrated: true,
          // A previous successful sync means there's real cached data to show
          // immediately; hydrate() will then run as a background refresh.
          status: state?.lastSyncedAt ? "loaded" : "idle",
        });
      },
    },
  ),
);

// Connectivity feeds the offline queue: writes are queued while disconnected and
// replayed on the offline -> online transition (handled in setConnected).
const applyConnectivity = (connected: boolean) => {
  if (connected !== useFinanceStore.getState().isConnected) {
    useFinanceStore.getState().setConnected(connected);
  }
};

NetInfo.addEventListener((state) => {
  // `isInternetReachable` is null while it's still being determined — only treat
  // it as offline once it's definitively false, otherwise a brief null on boot
  // would queue writes that could have gone straight through.
  applyConnectivity(Boolean(state.isConnected) && state.isInternetReachable !== false);
});

// NetInfo's web implementation only listens to `navigator.connection`'s change
// event when that API exists (it does in Chromium), so it never sees the plain
// online/offline events browsers actually fire. Subscribe to those directly on
// web so offline handling works there too; native is unaffected.
if (Platform.OS === "web" && typeof window !== "undefined") {
  applyConnectivity(window.navigator.onLine);
  window.addEventListener("online", () => applyConnectivity(true));
  window.addEventListener("offline", () => applyConnectivity(false));
}

// Returning to the app is a natural moment to try again: it covers the case
// where the *backend* was unreachable (asleep, erroring) while the device
// itself stayed online, so no connectivity transition ever fired to retry.
AppState.addEventListener("change", (appState) => {
  if (appState !== "active") return;
  const { isConnected, pendingOps, hydrate } = useFinanceStore.getState();
  if (isConnected && pendingOps.length > 0) void hydrate();
});
