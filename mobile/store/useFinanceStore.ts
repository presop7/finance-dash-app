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
  ApiGoal,
  ApiGoalAllocation,
} from "../services/financeApi";
import { ApiError } from "../services/api";
import { isDemoId } from "../utils/demoTransactions";
import i18n from "../i18n";
import { defaultCategoryKey, defaultFundKey } from "../constants/defaultNames";
import { mergeOrder } from "../utils/reorder";

export type Transaction = {
  id: string;
  title: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  fundCategory: string;
  note: string;
  date: Date;
  // An expense paid from a savings goal (marks the goal as used).
  goalId?: string;
  // Set while a create/edit for this row is still waiting in the sync queue.
  isPending?: boolean;
};

// A savings goal: money set aside toward a target, while it stays in the
// user's real funds. Each allocation is money set aside (+) or released (−)
// from one fund; it moves no money and isn't income or expense.
export type GoalAllocation = { id: string; fundId: string; amount: number; date: number };
export type Goal = {
  id: string;
  name: string;
  target: number;
  icon: string;
  color: string | null;
  allocations: GoalAllocation[];
};
export type GoalFields = { name: string; target: number; icon: string; color?: string | null };

export const DEFAULT_DASHBOARD_CARD_ORDER = [
  "insights",
  "transactions",
  "funds",
  "goals",
  "topExpenses",
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
  currency: "EUR",
  hideBalance: false,
  timeFormat: "24h",
  dateFormat: "DD/MM/YYYY",
};

export type ThemePreference = "light" | "dark" | "system";

export type AlertRuleType =
  | "lowBalance"
  | "balanceAbove"
  | "monthlyExpenseOver"
  | "monthlyIncomeOver"
  | "categoryAmount"
  | "dailyReminder"
  // Trackers: progress toward an amount, counted from their own category.
  | "loanTracker" // money owed: expenses in its category pay it back
  | "lendTracker" // money lent: income in its category is it coming back
  | "savingsTracker"; // retired: became a Goal (see migrateSavingsTrackers)

export type AlertRule = {
  id: string;
  type: AlertRuleType;
  // Unused for "dailyReminder" (set to 0) — that type is time-based, not
  // amount-based, and is OS-scheduled off hour/minute instead of evaluated
  // reactively like the other types (see evaluateAlerts/useAlertsMonitor).
  amount: number;
  categoryId?: string;
  categoryType?: "expense" | "income";
  hour?: number;
  minute?: number;
  enabled: boolean;
  lastTriggeredKey?: string;
  // Trackers only.
  name?: string;
};

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: "default_low_balance", type: "lowBalance", amount: 500, enabled: true },
  { id: "default_monthly_expense", type: "monthlyExpenseOver", amount: 500, enabled: true },
  {
    id: "default_daily_reminder",
    type: "dailyReminder",
    amount: 0,
    hour: 20,
    minute: 0,
    enabled: true,
  },
];

// "refreshing" = showing cached data while a background hydrate is in flight.
export type Plan = {
  trialEndsAt: number | null; // ms
  premiumUntil: number | null; // ms
  devAccess: boolean;
  devAccessRequestedAt: number | null; // ms
};
const NO_PLAN: Plan = { trialEndsAt: null, premiumUntil: null, devAccess: false, devAccessRequestedAt: null };
const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : null);
export const mapPlan = (u: ApiUser): Plan => ({
  trialEndsAt: ms(u.trial_ends_at),
  premiumUntil: ms(u.premium_until),
  devAccess: Boolean(u.dev_access),
  devAccessRequestedAt: ms(u.dev_access_requested_at),
});
// The Play test version (dev link): only accounts given access get in.
export const DEV_GATE = process.env.EXPO_PUBLIC_DEV_GATE === "true";
// Asked again a bit earlier than the last sync's server time: a change still
// being saved during that sync is then picked up next time (repeats are fine).
const SYNC_OVERLAP_MS = 2 * 60_000;

export type TipId = "install" | "notifications" | "alerts" | "reminder" | "offers";

export type SyncStatus = "idle" | "loading" | "loaded" | "refreshing" | "error";

type CategoryFields = { label: string; icon: string; color?: string };
type FundCategoryFields = { name: string; icon: string; color: string };
type TransactionFields = Omit<Transaction, "id" | "isPending">;

export type OpStatus = "pending" | "syncing" | "failed";

// Every transaction write is queued as an operation and sent in the background
// (immediately when online, on reconnect otherwise).
// Ops are collapsed to their net effect at enqueue time (see queueWrite helpers
// below), so there is at most one op per transaction and replay never has to
// reason about ordering between conflicting ops.
// Changes to categories, funds, goals and money set aside: applied on screen
// at once and sent in the background like transactions (see runEntityOp).
// New items get their id here, on the device; the server accepts it, so
// nothing has to be renamed once it syncs, and a repeated send is harmless.
export type EntityKind = "category" | "fund" | "goal" | "allocation";
export type EntityOp = {
  opId: string;
  entity: EntityKind;
  action: "create" | "update" | "delete";
  id: string;
  goalId?: string; // allocations: which goal
  body?: Record<string, unknown>;
  status: OpStatus;
};

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
  // Bumped on every updateSettings() call so a slower, superseded response
  // (an out-of-order PATCH, or a hydrate() that started before a more recent
  // local change) can tell it's stale and skip overwriting settings.
  settingsVersion: number;

  // full: re-download every transaction (pull-to-refresh) instead of only
  // what changed since the last sync.
  hydrate: (options?: { full?: boolean }) => Promise<void>;
  entityOps: EntityOp[];
  // The account's plan and dev-link access, from the server (see usePlan).
  plan: Plan;
  // Server time of the last transaction sync; the next one asks for changes since.
  transactionsSyncedAt: string | null;
  reset: () => void;

  updateSettings: (changes: Partial<Settings>) => Promise<void>;

  addTransaction: (transaction: TransactionFields) => Promise<void>;
  updateTransaction: (id: string, changes: TransactionFields) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Resolve to the new category's id.
  addExpenseCategory: (category: CategoryFields) => Promise<string>;
  updateExpenseCategory: (id: string, changes: CategoryFields) => Promise<void>;
  deleteExpenseCategory: (id: string, confirm?: boolean) => Promise<void>;
  addIncomeCategory: (category: CategoryFields) => Promise<string>;
  updateIncomeCategory: (id: string, changes: CategoryFields) => Promise<void>;
  deleteIncomeCategory: (id: string, confirm?: boolean) => Promise<void>;

  goals: Goal[];
  // Goals already told "reached" (so it's told once, again only after
  // dropping below and reaching it again).
  goalsNotified: string[];
  setGoalsNotified: (ids: string[]) => void;
  // Online-only, like categories: they're saved straight to the server.
  addGoal: (fields: GoalFields) => Promise<string>;
  updateGoal: (id: string, fields: GoalFields) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  // amount > 0 sets money aside from the fund, < 0 releases it back.
  addGoalAllocation: (goalId: string, fundId: string, amount: number) => Promise<void>;
  deleteGoalAllocation: (goalId: string, allocationId: string) => Promise<void>;

  // Resolves to the new fund's id.
  addFundCategory: (fundCategory: FundCategoryFields) => Promise<string>;
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
  // Device preference, not account data — deliberately not part of Settings
  // (which round-trips to the backend) or namespaced per-user below.
  themePreference: ThemePreference;
  // This device's notifications (reminders, money alerts): off stops them
  // here even while the browser/phone still allows them.
  notificationsEnabled: boolean;
  setNotificationsEnabled: (on: boolean) => void;
  // Which floating tips may pop up on this device.
  tips: Record<TipId, boolean>;
  // When a transaction was last added on this device (ms) — for the "nothing
  // added in a while" tip; the dates on the transactions themselves can be
  // back-dated.
  lastAddedAt: number | null;
  setTipEnabled: (id: TipId, on: boolean) => void;
  // App language code ("bg", "en", ...), or null to follow the phone's
  // own language. Device preference, like the theme.
  language: string | null;
  setLanguage: (language: string | null) => void;
  // Re-translates the default categories/funds' names (language changed).
  relabelDefaults: () => void;
  setThemePreference: (pref: ThemePreference) => void;
  // Overrides the email-derived dashboard greeting name. Device-only for
  // now to save on backend/DB work — TODO: move into Settings (synced) if
  // cross-device consistency turns out to matter.
  displayNameOverride: string | null;
  setDisplayNameOverride: (name: string | null) => void;
  alertRules: AlertRule[];
  // Switches currency and converts every saved amount at `rate` (1 old = rate
  // new) on the server in one go; the caller checks first that everything
  // is synced. Reminder and tracker amounts (kept on this device) follow.
  convertCurrency: (to: string, rate: number) => Promise<void>;
  addAlertRule: (rule: Omit<AlertRule, "id">) => void;
  updateAlertRule: (id: string, changes: Partial<AlertRule>) => void;
  deleteAlertRule: (id: string) => void;
  toggleAlertRule: (id: string) => void;
  setDashboardCardOrder: (order: string[]) => void;
  toggleDashboardCard: (id: string) => void;
  // Fund ids in the user's chosen Funds-card order; funds missing from it
  // (e.g. newly created) go after, in their normal order.
  fundCardOrder: string[];
  setFundCardOrder: (order: string[]) => void;
  // Expense + income category ids in the user's chosen order (one list:
  // the ids never clash); same rules as fundCardOrder.
  categoryOrder: string[];
  setCategoryOrder: (order: string[]) => void;
  // App-tour sample rows (ids start with "demo-"): memory-only, never synced.
  addDemoTransactions: (demo: Transaction[]) => void;
  removeDemoTransactions: () => void;
};

// Fields shared device-wide across every account signed in on this device.
// Everything else that gets persisted is namespaced under the signed-in user,
// so switching accounts never shows (or clobbers) another user's data.
const DEVICE_FIELDS: readonly string[] = [
  "dashboardCardOrder",
  "dashboardCollapsedCards",
  "themePreference",
  "displayNameOverride",
  "language",
  "notificationsEnabled",
  "tips",
];

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
    // A device field (language, theme, ...) must always come from `blob.device`
    // — never shadowed by the signed-in user's own slot, even if one somehow
    // ended up holding a same-named key (an older build, a bug, anything).
    // setItem already keeps new writes correctly separated; this is what
    // stops a stale leftover from resurfacing only after signing in.
    const userOnly = Object.fromEntries(
      Object.entries(userState).filter(([key]) => !DEVICE_FIELDS.includes(key)),
    );
    return { state: { ...blob.device, ...userOnly }, version: blob.version };
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

// A default's name in the app's language (falls back to the stored name).
const defaultLabel = (key: string | undefined, stored: string) =>
  key ? i18n.t(`defaults.${key}`, { defaultValue: stored }) : stored;

function mapCategory(c: ApiCategory): Category {
  return {
    id: c.id,
    // Untouched defaults (and the shared "Unassigned") are stored in English
    // and shown in the app's language — see constants/defaultNames.
    label: defaultLabel(defaultCategoryKey(c.name, c.icon, c.user_id === null), c.name),
    defaultKey: defaultCategoryKey(c.name, c.icon, c.user_id === null),
    icon: (c.icon ?? "ellipsis-horizontal-outline") as Category["icon"],
    color: c.color ?? undefined,
    locked: c.user_id === null,
  };
}

function mapFundCategory(f: ApiFundCategory): FundCategory {
  return {
    id: f.id,
    name: defaultLabel(defaultFundKey(f.name, f.icon), f.name),
    defaultKey: defaultFundKey(f.name, f.icon),
    icon: f.icon ?? "wallet-outline",
    color: f.color ?? "#1D2B4F",
    locked: f.name === "Unassigned",
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
    ...(t.goal_id ? { goalId: t.goal_id } : {}),
  };
}

function mapGoal(g: ApiGoal): Goal {
  return {
    id: g.id,
    name: g.name,
    target: Number(g.target),
    icon: g.icon ?? "flag-outline",
    color: g.color,
    allocations: g.allocations.map(mapGoalAllocation),
  };
}

function mapGoalAllocation(a: ApiGoalAllocation): GoalAllocation {
  return { id: a.id, fundId: a.fund_category_id, amount: Number(a.amount), date: new Date(a.occurred_at).getTime() };
}

// Savings goals were briefly reminder "trackers" that followed a fund of their
// own. They're now Goals on the server: each old one becomes a goal with the
// same name and target (its fund stays an ordinary fund). Runs after a
// successful load; a failure just leaves it for the next one.
let migratingTrackers = false;
async function migrateSavingsTrackers(get: () => FinanceStore) {
  const old = get().alertRules.filter((r) => r.type === "savingsTracker");
  if (old.length === 0 || migratingTrackers) return;
  migratingTrackers = true;
  try {
    for (const rule of old) {
      await get().addGoal({ name: rule.name || "Goal", target: rule.amount, icon: "flag-outline" });
      get().deleteAlertRule(rule.id);
    }
  } catch {
    // Offline or the server said no: tried again after the next load.
  } finally {
    migratingTrackers = false;
  }
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
    goal_id: fields.goalId ?? null,
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
    goal_id: fields.goalId ?? null,
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

// Placeholder id → server id for creates that have synced. A screen opened on
// the placeholder row (e.g. the edit modal) can still hand back the old id
// after the swap; this routes that edit/delete to the real row.
// ponytail: in-memory only — placeholder ids don't outlive the screens holding them.
const syncedIds = new Map<string, string>();
const resolveId = (id: string) => syncedIds.get(id) ?? id;

async function sendCreate(op: Extract<PendingOp, { kind: "create" }>, currency: string) {
  try {
    return await financeApi.createTransaction(
      toCreatePayload(op.payload, currency, op.clientGeneratedId),
    );
  } catch (err) {
    // 409: an earlier attempt landed but its response was lost (common on a
    // slow network). Look the row up so we still learn its real id.
    if (!isAlreadySettled(err, "create")) throw err;
    const existing = (await financeApi.listTransactions()).find(
      (t) => t.client_generated_id === op.clientGeneratedId,
    );
    if (!existing) throw err;
    return existing;
  }
}

// Sends one queued op to the backend and reconciles local state with the result.
// The user can keep editing while it's in flight: an edit/delete of the same
// transaction replaces the op in the queue, which is how we detect it below.
async function runPendingOp(op: PendingOp, set: FinanceSet, get: FinanceGet): Promise<void> {
  const key = opKey(op);
  const userId = activeUserId();
  const current = () => get().pendingOps.find((o) => opKey(o) === key);
  const dropOp = () =>
    set((state) => ({ pendingOps: state.pendingOps.filter((o) => opKey(o) !== key) }));

  set((state) => ({
    pendingOps: state.pendingOps.map((o) =>
      opKey(o) === key ? { ...o, status: "syncing" as const } : o,
    ),
  }));
  const sent = current();

  try {
    if (op.kind === "create") {
      const created = await sendCreate(op, get().settings.currency);
      if (activeUserId() !== userId) return;
      const real = mapTransaction(created);
      syncedIds.set(op.clientGeneratedId, real.id);
      const now = current();

      if (!now) {
        // Deleted locally while the POST was in flight — the row exists on the
        // server now, so it needs a real delete.
        set((state) => ({
          pendingOps: [
            ...state.pendingOps,
            { kind: "delete", transactionId: real.id, status: "pending" },
          ],
        }));
      } else if (now !== sent && now.kind === "create") {
        // Edited while in flight: keep the local edit and send it as an update
        // against the real id.
        set((state) => ({
          pendingOps: state.pendingOps.map((o) =>
            opKey(o) === key
              ? { kind: "update", transactionId: real.id, payload: now.payload, status: "pending" }
              : o,
          ),
          transactions: state.transactions.map((t) =>
            t.id === op.clientGeneratedId ? { ...t, id: real.id } : t,
          ),
        }));
      } else {
        // Swap the local placeholder (still keyed by clientGeneratedId) for the
        // server row, which carries the real id.
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === op.clientGeneratedId ? real : t,
          ),
        }));
        dropOp();
      }
      return;
    }

    if (op.kind === "update") {
      const updated = await financeApi.updateTransaction(
        op.transactionId,
        toUpdatePayload(op.payload),
      );
      if (activeUserId() !== userId) return;
      // A newer edit/delete queued meanwhile wins; it's sent next.
      if (current() !== sent) return;
      const real = mapTransaction(updated);
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === op.transactionId ? real : t)),
      }));
    } else {
      await financeApi.deleteTransaction(op.transactionId);
      if (activeUserId() !== userId) return;
    }
    dropOp();
  } catch (err) {
    if (activeUserId() !== userId) return;
    if (current() !== sent) return; // superseded — the newer op gets sent next
    if (op.kind !== "create" && isAlreadySettled(err, op.kind)) {
      // Server already reflects the intent (row gone, deleted elsewhere).
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === op.transactionId ? { ...t, isPending: false } : t,
        ),
      }));
      dropOp();
      return;
    }
    // Leave it queued so it can be retried rather than blocking the rest.
    set((state) => ({
      pendingOps: state.pendingOps.map((o) =>
        opKey(o) === key ? { ...o, status: "failed" as const } : o,
      ),
    }));
  }
}

// Sends one queued category/fund/goal change. Done ops leave the queue; a 404
// on update/delete means it's already gone (fine). If the server refuses a new
// item as over the free plan (403), it's taken back off the screen.
async function runEntityOp(op: EntityOp, set: FinanceSet, get: FinanceGet): Promise<void> {
  const userId = activeUserId();
  const mark = (status: OpStatus) =>
    set((state) => ({ entityOps: state.entityOps.map((o) => (o.opId === op.opId ? { ...o, status } : o)) }));
  const drop = () => set((state) => ({ entityOps: state.entityOps.filter((o) => o.opId !== op.opId) }));
  mark("syncing");
  const body = op.body ?? {};
  try {
    if (op.entity === "category") {
      if (op.action === "create") await financeApi.createCategory(body as never);
      else if (op.action === "update") await financeApi.updateCategory(op.id, body as never);
      else await financeApi.deleteCategory(op.id, true);
    } else if (op.entity === "fund") {
      if (op.action === "create") await financeApi.createFundCategory(body as never);
      else if (op.action === "update") await financeApi.updateFundCategory(op.id, body as never);
      else await financeApi.deleteFundCategory(op.id, true);
    } else if (op.entity === "goal") {
      if (op.action === "create") await financeApi.createGoal(body as never);
      else if (op.action === "update") await financeApi.updateGoal(op.id, body as never);
      else await financeApi.deleteGoal(op.id);
    } else {
      if (op.action === "create") await financeApi.addGoalAllocation(op.goalId!, body as never);
      else await financeApi.deleteGoalAllocation(op.goalId!, op.id);
    }
    if (activeUserId() !== userId) return;
    drop();
  } catch (err) {
    if (activeUserId() !== userId) return;
    if (err instanceof ApiError && op.action !== "create" && err.status === 404) {
      drop();
      return;
    }
    if (err instanceof ApiError && op.action === "create" && err.status === 403) {
      // Over the free plan's limit: undo it on screen.
      set((state) => ({
        expenseCategories: state.expenseCategories.filter((c) => c.id !== op.id),
        incomeCategories: state.incomeCategories.filter((c) => c.id !== op.id),
        fundCategories: state.fundCategories.filter((f) => f.id !== op.id),
        goals: state.goals.filter((g) => g.id !== op.id),
        entityOps: state.entityOps.filter((o) => o.opId !== op.opId),
      }));
      return;
    }
    mark("failed");
  }
}

// Adds a change to the queue, folding it into what's already waiting: an edit
// of something not sent yet goes into that create/edit; deleting something
// never sent removes it (and what depends on it) from the queue instead.
function enqueueEntity(
  ops: EntityOp[],
  next: Omit<EntityOp, "opId" | "status">,
): EntityOp[] {
  const same = (o: EntityOp) => o.entity === next.entity && o.id === next.id && o.status === "pending";
  if (next.action === "update") {
    const waiting = ops.find((o) => same(o) && o.action !== "delete");
    if (waiting) return ops.map((o) => (o === waiting ? { ...o, body: { ...o.body, ...next.body } } : o));
  }
  if (next.action === "delete") {
    const unsent = ops.find((o) => same(o) && o.action === "create");
    const rest = ops.filter(
      (o) =>
        !same(o) &&
        // a goal's set-asides go with it
        !(next.entity === "goal" && o.entity === "allocation" && o.goalId === next.id && o.status === "pending"),
    );
    if (unsent) return rest;
    return [...rest, { ...next, opId: Crypto.randomUUID(), status: "pending" }];
  }
  return [...ops, { ...next, opId: Crypto.randomUUID(), status: "pending" }];
}

// After a load from the server: keep what's still waiting to be sent, so the
// screen doesn't jump back to the server's older copy.
function keepQueued<T extends { id: string }>(server: T[], local: T[], ops: EntityOp[], kinds: EntityKind[]): T[] {
  const mine = ops.filter((o) => kinds.includes(o.entity));
  const deleted = new Set(mine.filter((o) => o.action === "delete" && o.entity === kinds[0]).map((o) => o.id));
  const changed = new Set(mine.filter((o) => o.action !== "delete" || o.entity !== kinds[0]).map((o) => o.goalId ?? o.id));
  const fromServer = server
    .filter((s) => !deleted.has(s.id))
    .map((s) => (changed.has(s.id) ? (local.find((l) => l.id === s.id) ?? s) : s));
  const onlyHere = local.filter((l) => changed.has(l.id) && !server.some((s) => s.id === l.id));
  return [...fromServer, ...onlyHere];
}

// Sends queued ops one at a time in the background. Only one runner exists at
// a time, so an op is never sent twice in parallel; writes queued while it
// runs are picked up by the same loop. retryFailed also re-sends ops that
// failed earlier (each at most once per run, so a dead server can't spin it).
let flushing: Promise<void> | null = null;

function flushQueue(set: FinanceSet, get: FinanceGet, retryFailed = false): Promise<void> {
  if (flushing) {
    return retryFailed ? flushing.then(() => flushQueue(set, get, true)) : flushing;
  }
  flushing = (async () => {
    const retried = new Set<string>();
    while (get().isConnected) {
      // Categories, funds and goals first: a queued transaction may use one
      // that was just created.
      const entity = get().entityOps.find(
        (o) => o.status === "pending" || (retryFailed && o.status === "failed" && !retried.has(o.opId)),
      );
      if (entity) {
        retried.add(entity.opId);
        await runEntityOp(entity, set, get);
        continue;
      }
      const op = get().pendingOps.find(
        (o) =>
          o.status === "pending" || (retryFailed && o.status === "failed" && !retried.has(opKey(o))),
      );
      if (!op) break;
      retried.add(opKey(op));
      await runPendingOp(op, set, get);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// Category changes for either list (expense / income): on screen at once,
// sent in the background. Deleting one moves its transactions to that type's
// "Unassigned", as the server does.
type CategoryType = "expense" | "income";
const listKey = (type: CategoryType) => (type === "expense" ? "expenseCategories" : "incomeCategories") as
  | "expenseCategories"
  | "incomeCategories";

async function addCategory(set: FinanceSet, get: FinanceGet, type: CategoryType, category: CategoryFields) {
    const id = Crypto.randomUUID();
    const key = listKey(type);
    set((state) => ({
      [key]: [...state[key], { id, label: category.label, icon: category.icon as Category["icon"], color: category.color }],
      entityOps: enqueueEntity(state.entityOps, {
        entity: "category",
        action: "create",
        id,
        body: { id, name: category.label, icon: category.icon, color: category.color ?? null, type },
      }),
    }));
    void flushQueue(set, get);
    return id;
}

async function updateCategory(set: FinanceSet, get: FinanceGet, type: CategoryType, id: string, changes: CategoryFields) {
    const key = listKey(type);
    set((state) => ({
      [key]: state[key].map((c) =>
        c.id === id ? { ...c, label: changes.label, icon: changes.icon as Category["icon"], color: changes.color, defaultKey: undefined } : c,
      ),
      entityOps: enqueueEntity(state.entityOps, {
        entity: "category",
        action: "update",
        id,
        body: { name: changes.label, icon: changes.icon, color: changes.color ?? null },
      }),
    }));
    void flushQueue(set, get);
}

async function deleteCategory(set: FinanceSet, get: FinanceGet, type: CategoryType, id: string) {
    const key = listKey(type);
    const unassigned = get()[key].find((c) => c.locked && c.id !== id)?.id;
    set((state) => ({
      [key]: state[key].filter((c) => c.id !== id),
      transactions: unassigned
        ? state.transactions.map((t) => (t.category === id ? { ...t, category: unassigned } : t))
        : state.transactions,
      pendingOps: unassigned
        ? state.pendingOps.map((o) =>
            o.kind !== "delete" && o.payload.category === id ? { ...o, payload: { ...o.payload, category: unassigned } } : o,
          )
        : state.pendingOps,
      entityOps: enqueueEntity(state.entityOps, { entity: "category", action: "delete", id }),
    }));
    void flushQueue(set, get);
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
      settingsVersion: 0,

      // Assume online until NetInfo says otherwise, so a first write isn't
      // needlessly queued before the listener has reported in.
      isConnected: true,
      pendingOps: [],

      dashboardCardOrder: DEFAULT_DASHBOARD_CARD_ORDER,
      dashboardCollapsedCards: {},
      fundCardOrder: [],
      categoryOrder: [],
      themePreference: "system",
      notificationsEnabled: true,
      tips: { install: true, notifications: true, alerts: true, reminder: true, offers: true },
      lastAddedAt: null,
      language: null,
      displayNameOverride: null,
      alertRules: DEFAULT_ALERT_RULES,

      plan: NO_PLAN,
      transactionsSyncedAt: null,
      entityOps: [],

      hydrate: async (options) => {
        // With cached data already on screen this is a background refresh, not
        // a cold load — don't blank the UI out behind a spinner for it.
        const hasCache = get().status === "loaded";
        set({ status: hasCache ? "refreshing" : "loading", syncError: null });

        // If the account switches while this is awaiting, whatever comes back
        // belongs to the previous user — applying it would show their data to
        // the new one and persist it into the new user's slot.
        const userId = activeUserId();
        const userSwitched = () => activeUserId() !== userId;

        // Flush queued writes before reading, so the fetched state already
        // includes them. This is also what retries failed ops: any sync —
        // launch, reconnect, sign-in — gets them moving again, rather than
        // them being stuck until connectivity happens to flap.
        if (get().isConnected) {
          await flushQueue(set, get, true);
          if (userSwitched()) return;
        }

        // Snapshot the settings version before fetching: if updateSettings()
        // lands locally while this fetch is in flight, the fetched `me` below
        // reflects pre-update server state and must not overwrite it.
        const settingsVersionAtFetch = get().settingsVersion;

        // Dev link: an account without access sees only the lock screen
        // (the dev backend refuses everything else for it anyway).
        if (DEV_GATE) {
          try {
            const me = await financeApi.getMe();
            if (userSwitched()) return;
            set({ plan: mapPlan(me) });
            if (!me.dev_access) {
              set({ status: "loaded", lastSyncedAt: Date.now() });
              return;
            }
          } catch {
            // Falls through to the normal load, which reports the error.
          }
        }
        const syncedAt = options?.full ? null : get().transactionsSyncedAt;
        const since = syncedAt ? new Date(new Date(syncedAt).getTime() - SYNC_OVERLAP_MS).toISOString() : "1970-01-01T00:00:00Z";

        try {
          const [me, apiCategories, apiFundCategories, changes, apiGoals] = await Promise.all([
            financeApi.getMe(),
            financeApi.listCategories(),
            financeApi.listFundCategories(),
            financeApi.listTransactionChanges(since),
            // Not fatal: keeps the last-known goals if this one call fails.
            financeApi.listGoals().catch(() => null),
          ]);
          if (userSwitched()) return;

          const settingsStale = get().settingsVersion !== settingsVersionAtFetch;

          // Writes queued while this fetch was in flight aren't in the server
          // list yet — keep the local version of those rows (and keep locally
          // deleted ones gone) instead of letting the fetch undo them on screen.
          const pendingKeys = new Set(get().pendingOps.map(opKey));
          // Tour sample rows aren't on the server either — keep them too.
          const localPending = get().transactions.filter(
            (t) => pendingKeys.has(t.id) || isDemoId(t.id),
          );
          const serverRows = changes.transactions
            .filter((t) => !pendingKeys.has(t.id) && !pendingKeys.has(t.client_generated_id))
            .map(mapTransaction);
          // A full load replaces the list; a change sync updates what it has:
          // drops what was deleted, then adds or replaces what changed.
          let merged: Transaction[];
          if (!syncedAt) {
            merged = [...localPending, ...serverRows];
          } else {
            const deleted = new Set(changes.deleted_ids);
            const byId = new Map(
              get()
                .transactions.filter((t) => !deleted.has(t.id))
                .map((t) => [t.id, t] as const),
            );
            for (const row of serverRows) byId.set(row.id, row);
            merged = [...byId.values()];
          }

          set({
            status: "loaded",
            lastSyncedAt: Date.now(),
            ...(settingsStale ? {} : { settings: mapSettings(me) }),
            plan: mapPlan(me),
            transactionsSyncedAt: changes.server_time,
            expenseCategories: keepQueued(
              apiCategories.filter((c) => c.type === "expense").map(mapCategory),
              get().expenseCategories,
              get().entityOps,
              ["category"],
            ),
            incomeCategories: keepQueued(
              apiCategories.filter((c) => c.type === "income").map(mapCategory),
              get().incomeCategories,
              get().entityOps,
              ["category"],
            ),
            fundCategories: keepQueued(apiFundCategories.map(mapFundCategory), get().fundCategories, get().entityOps, ["fund"]),
            ...(apiGoals
              ? { goals: keepQueued(apiGoals.map(mapGoal), get().goals, get().entityOps, ["goal", "allocation"]) }
              : {}),
            transactions: merged.sort((a, b) => b.date.getTime() - a.date.getTime()),
          });
          if (apiGoals) migrateSavingsTrackers(get);
        } catch (err) {
          if (userSwitched()) return;
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
          goals: [],
          plan: NO_PLAN,
          transactionsSyncedAt: null,
          settings: DEFAULT_SETTINGS,
          // Clears in memory only — the signed-out user's queue stays on disk in
          // their own slot (activeUserId is already null here, so this write
          // can't touch it) and comes back when they sign in again.
          pendingOps: [],
          entityOps: [],
        }),

      updateSettings: async (changes) => {
        // Claim the latest version up front so a slower, superseded call
        // (or a racing hydrate()) can tell its result is stale and skip
        // applying it once this one lands.
        const myVersion = get().settingsVersion + 1;
        const previousSettings = get().settings;

        // Apply optimistically, synchronously with the call, rather than
        // waiting for the PATCH round-trip: a control like the Hide Balance
        // Switch moves the instant it's tapped, and if the store's `settings`
        // (its `value` prop) doesn't follow immediately, an unrelated
        // re-render while the request is in flight snaps it back to the old
        // value before the response arrives and flips it again — a visible
        // flip/revert/flip glitch.
        set({ settingsVersion: myVersion, settings: { ...previousSettings, ...changes } });

        try {
          const me = await financeApi.updateSettings({
            currency: changes.currency,
            hide_balance: changes.hideBalance,
            time_format: changes.timeFormat,
            date_format: changes.dateFormat,
          });

          if (get().settingsVersion !== myVersion) return;
          // Only re-set (and so re-render, and so reassign a fresh `value`
          // prop to controls like the Hide Balance Switch) if the server's
          // confirmed value actually differs from what was already applied
          // optimistically. The redundant re-render this used to always do
          // was harmless to state but would land moments after the
          // optimistic one — often while Android's native switch thumb
          // animation was still mid-flight — truncating it into a snap on
          // fast networks while staying smooth on slower ones.
          const confirmed = mapSettings(me);
          const current = get().settings;
          const changed = (Object.keys(confirmed) as (keyof Settings)[]).some(
            (key) => confirmed[key] !== current[key],
          );
          if (changed) set({ settings: confirmed });
        } catch (err) {
          if (get().settingsVersion === myVersion) set({ settings: previousSettings });
          throw err;
        }
      },

      addTransaction: async (transaction) => {
        const clientGeneratedId = Crypto.randomUUID();

        // Transaction writes always land locally first and sync in the
        // background, online or not — the UI never waits on the network (a
        // cold or slow backend used to hold the modal open for 15-20s).
        set((state) => ({
          lastAddedAt: Date.now(),
          pendingOps: [
            ...state.pendingOps,
            { kind: "create", clientGeneratedId, payload: transaction, status: "pending" },
          ],
          transactions: [
            { ...transaction, id: clientGeneratedId, isPending: true },
            ...state.transactions,
          ],
        }));
        void flushQueue(set, get);
      },

      updateTransaction: async (rawId, changes) => {
        const id = resolveId(rawId);
        if (isDemoId(id)) {
          // Tour sample row: change it on screen only, never send it.
          set((state) => ({
            transactions: state.transactions.map((t) => (t.id === id ? { ...changes, id } : t)),
          }));
          return;
        }
        set((state) => {
          const pendingCreate = state.pendingOps.find(
            (op) => op.kind === "create" && op.clientGeneratedId === id,
          );

          const pendingOps: PendingOp[] = pendingCreate
            ? // Not confirmed by the server yet — fold the edit into the queued
              // create so it still syncs as a single POST (runPendingOp turns it
              // into an update if the POST was already in flight).
              state.pendingOps.map((op) =>
                op.kind === "create" && op.clientGeneratedId === id
                  ? { ...op, payload: changes, status: "pending" }
                  : op,
              )
            : state.pendingOps.some((op) => op.kind === "update" && op.transactionId === id)
              ? // Repeated edits collapse — only the latest values matter.
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
        void flushQueue(set, get);
      },

      deleteTransaction: async (rawId) => {
        const id = resolveId(rawId);
        if (isDemoId(id)) {
          set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));
          return;
        }
        set((state) => {
          const hasPendingCreate = state.pendingOps.some(
            (op) => op.kind === "create" && op.clientGeneratedId === id,
          );

          // A row that never reached the server just disappears — dropping the
          // queued create means nothing is sent at all, not a create-then-delete.
          // (If the POST was already in flight, runPendingOp queues the delete.)
          const withoutThisRow = state.pendingOps.filter((op) => opKey(op) !== id);

          return {
            pendingOps: hasPendingCreate
              ? withoutThisRow
              : [...withoutThisRow, { kind: "delete", transactionId: id, status: "pending" }],
            transactions: state.transactions.filter((t) => t.id !== id),
          };
        });
        void flushQueue(set, get);
      },

      addExpenseCategory: async (category) => addCategory(set, get, "expense", category),
      updateExpenseCategory: async (id, changes) => updateCategory(set, get, "expense", id, changes),
      deleteExpenseCategory: async (id) => deleteCategory(set, get, "expense", id),
      addIncomeCategory: async (category) => addCategory(set, get, "income", category),
      updateIncomeCategory: async (id, changes) => updateCategory(set, get, "income", id, changes),
      deleteIncomeCategory: async (id) => deleteCategory(set, get, "income", id),

      addFundCategory: async (fundCategory) => {
        const id = Crypto.randomUUID();
        set((state) => ({
          fundCategories: [...state.fundCategories, { id, ...fundCategory }],
          entityOps: enqueueEntity(state.entityOps, {
            entity: "fund",
            action: "create",
            id,
            body: { id, name: fundCategory.name, currency: get().settings.currency, icon: fundCategory.icon, color: fundCategory.color },
          }),
        }));
        void flushQueue(set, get);
        return id;
      },

      updateFundCategory: async (id, changes) => {
        set((state) => ({
          fundCategories: state.fundCategories.map((f) =>
            f.id === id ? { ...f, ...changes, defaultKey: undefined } : f,
          ),
          entityOps: enqueueEntity(state.entityOps, {
            entity: "fund",
            action: "update",
            id,
            body: { name: changes.name, icon: changes.icon, color: changes.color },
          }),
        }));
        void flushQueue(set, get);
      },

      // Like the server: its transactions (and money set aside from it) move
      // to "Unassigned".
      deleteFundCategory: async (id) => {
        const unassigned = get().fundCategories.find((f) => f.locked && f.id !== id)?.id;
        set((state) => ({
          fundCategories: state.fundCategories.filter((f) => f.id !== id),
          transactions: unassigned
            ? state.transactions.map((t) => (t.fundCategory === id ? { ...t, fundCategory: unassigned } : t))
            : state.transactions,
          pendingOps: unassigned
            ? state.pendingOps.map((o) =>
                o.kind !== "delete" && o.payload.fundCategory === id
                  ? { ...o, payload: { ...o.payload, fundCategory: unassigned } }
                  : o,
              )
            : state.pendingOps,
          goals: unassigned
            ? state.goals.map((g) => ({
                ...g,
                allocations: g.allocations.map((a) => (a.fundId === id ? { ...a, fundId: unassigned } : a)),
              }))
            : state.goals,
          entityOps: enqueueEntity(state.entityOps, { entity: "fund", action: "delete", id }),
        }));
        void flushQueue(set, get);
      },

      setConnected: (connected) => {
        const wasConnected = get().isConnected;
        set({ isConnected: connected });
        // Coming back online: sync, which drains the queue then refetches.
        if (!wasConnected && connected && get().pendingOps.length + get().entityOps.length > 0) {
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
        // Through the single runner, so it can't race an in-flight send of the same op.
        set((state) => ({
          pendingOps: state.pendingOps.map((o) =>
            opKey(o) === key ? { ...o, status: "pending" as const } : o,
          ),
        }));
        await flushQueue(set, get);
      },

      goals: [],
      goalsNotified: [],
      setGoalsNotified: (ids) => set({ goalsNotified: ids }),

      addGoal: async (fields) => {
        const id = Crypto.randomUUID();
        set((state) => ({
          goals: [
            ...state.goals,
            { id, name: fields.name, target: fields.target, icon: fields.icon, color: fields.color ?? null, allocations: [] },
          ],
          entityOps: enqueueEntity(state.entityOps, {
            entity: "goal",
            action: "create",
            id,
            body: { id, name: fields.name, target: fields.target, icon: fields.icon, color: fields.color ?? null },
          }),
        }));
        void flushQueue(set, get);
        return id;
      },

      updateGoal: async (id, fields) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, name: fields.name, target: fields.target, icon: fields.icon, color: fields.color ?? g.color } : g,
          ),
          entityOps: enqueueEntity(state.entityOps, {
            entity: "goal",
            action: "update",
            id,
            body: { name: fields.name, target: fields.target, icon: fields.icon, color: fields.color ?? null },
          }),
        }));
        void flushQueue(set, get);
      },

      deleteGoal: async (id) => {
        // The server unlinks its expenses too; mirror that here.
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
          transactions: state.transactions.map((t) => (t.goalId === id ? { ...t, goalId: undefined } : t)),
          pendingOps: state.pendingOps.map((o) =>
            o.kind !== "delete" && o.payload.goalId === id ? { ...o, payload: { ...o.payload, goalId: undefined } } : o,
          ),
          entityOps: enqueueEntity(state.entityOps, { entity: "goal", action: "delete", id }),
        }));
        void flushQueue(set, get);
      },

      addGoalAllocation: async (goalId, fundId, amount) => {
        const id = Crypto.randomUUID();
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId ? { ...g, allocations: [...g.allocations, { id, fundId, amount, date: Date.now() }] } : g,
          ),
          entityOps: enqueueEntity(state.entityOps, {
            entity: "allocation",
            action: "create",
            id,
            goalId,
            body: { id, fund_category_id: fundId, amount },
          }),
        }));
        void flushQueue(set, get);
      },

      deleteGoalAllocation: async (goalId, allocationId) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId ? { ...g, allocations: g.allocations.filter((a) => a.id !== allocationId) } : g,
          ),
          entityOps: enqueueEntity(state.entityOps, { entity: "allocation", action: "delete", id: allocationId, goalId }),
        }));
        void flushQueue(set, get);
      },

      convertCurrency: async (to, rate) => {
        await financeApi.convertCurrency({ from_currency: get().settings.currency, to_currency: to, rate });
        set((state) => ({
          alertRules: state.alertRules.map((r) =>
            r.amount ? { ...r, amount: Math.round(r.amount * rate * 100) / 100 } : r,
          ),
        }));
        await get().hydrate();
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

      setThemePreference: (pref) => set({ themePreference: pref }),
      setNotificationsEnabled: (on) => set({ notificationsEnabled: on }),
      setTipEnabled: (id, on) => set((state) => ({ tips: { ...state.tips, [id]: on } })),
      setLanguage: (language) => set({ language }),
      relabelDefaults: () =>
        set((state) => ({
          expenseCategories: state.expenseCategories.map((c) =>
            c.defaultKey ? { ...c, label: defaultLabel(c.defaultKey, c.label) } : c,
          ),
          incomeCategories: state.incomeCategories.map((c) =>
            c.defaultKey ? { ...c, label: defaultLabel(c.defaultKey, c.label) } : c,
          ),
          fundCategories: state.fundCategories.map((f) =>
            f.defaultKey ? { ...f, name: defaultLabel(f.defaultKey, f.name) } : f,
          ),
        })),
      setDisplayNameOverride: (name) => set({ displayNameOverride: name }),
      setDashboardCardOrder: (order) => set({ dashboardCardOrder: order }),
      setFundCardOrder: (order) => set({ fundCardOrder: order }),
      setCategoryOrder: (order) => set((state) => ({ categoryOrder: mergeOrder(state.categoryOrder, order) })),

      addDemoTransactions: (demo) =>
        set((state) => ({
          transactions: [...state.transactions.filter((t) => !isDemoId(t.id)), ...demo].sort(
            (a, b) => b.date.getTime() - a.date.getTime(),
          ),
        })),
      removeDemoTransactions: () =>
        set((state) => ({ transactions: state.transactions.filter((t) => !isDemoId(t.id)) })),

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
        themePreference: state.themePreference,
        language: state.language,
        notificationsEnabled: state.notificationsEnabled,
        tips: state.tips,
        displayNameOverride: state.displayNameOverride,
        // per-user
        fundCardOrder: state.fundCardOrder,
        lastAddedAt: state.lastAddedAt,
        categoryOrder: state.categoryOrder,
        alertRules: state.alertRules,
        pendingOps: state.pendingOps,
        // Tour sample rows are memory-only: never written to disk.
        transactions: state.transactions.filter((t) => !isDemoId(t.id)),
        expenseCategories: state.expenseCategories,
        incomeCategories: state.incomeCategories,
        fundCategories: state.fundCategories,
        goals: state.goals,
        entityOps: state.entityOps,
        goalsNotified: state.goalsNotified,
        plan: state.plan,
        transactionsSyncedAt: state.transactionsSyncedAt,
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
          // Tips added later start on, not missing.
          tips: { ...current.tips, ...saved.tips },
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
//
// On the web it always refreshes on return: pull-to-refresh doesn't exist
// there (react-native-web's RefreshControl draws nothing), so coming back to
// the tab or the home-screen web app is the way to get fresh data.
AppState.addEventListener("change", (appState) => {
  if (appState !== "active" || !activeUserId()) return;
  const { isConnected, pendingOps, entityOps, hydrate } = useFinanceStore.getState();
  if (isConnected && (pendingOps.length + entityOps.length > 0 || Platform.OS === "web")) void hydrate();
});
