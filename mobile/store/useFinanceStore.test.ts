/// <reference types="jest" />
// Sync-queue checks: transaction writes land locally at once, then reach a fake
// mockServer whose responses the test holds and releases — which is how a slow
// network (or a sleeping backend) is simulated. Run: npm test
import type { ApiTransaction } from "../services/financeApi";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: jest.fn() }));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `local-${++mockUuid}` }));
jest.mock("../services/supabase", () => ({ supabase: {} }));
jest.mock("./useAuthStore", () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: "user-1" } } }) },
}));

// ---- fake mockServer ----
const mockServer = new Map<string, ApiTransaction>();
let mockNextId = 0;
let mockHolding = false;
let mockHeld: (() => void)[] = [];
let mockLoseNextCreate = false;

const mockRespond = () =>
  mockHolding ? new Promise<void>((resolve) => mockHeld.push(resolve)) : Promise.resolve();

jest.mock("../services/financeApi", () => ({
  financeApi: {
    createTransaction: async (body: any) => {
      await mockRespond();
      if ([...mockServer.values()].some((t) => t.client_generated_id === body.client_generated_id)) {
        throw new (require("../services/api").ApiError)(409, "exists");
      }
      const row = { ...body, id: `server-${++mockNextId}`, amount: String(body.amount) };
      mockServer.set(row.id, row);
      if (mockLoseNextCreate) {
        mockLoseNextCreate = false;
        throw new TypeError("Network request failed"); // landed, but the reply was lost
      }
      return row;
    },
    updateTransaction: async (id: string, body: any) => {
      await mockRespond();
      const row = mockServer.get(id);
      if (!row) throw new (require("../services/api").ApiError)(404, "not found");
      const updated = { ...row, ...body, amount: String(body.amount ?? row.amount) };
      mockServer.set(id, updated);
      return updated;
    },
    deleteTransaction: async (id: string) => {
      await mockRespond();
      if (!mockServer.delete(id)) throw new (require("../services/api").ApiError)(404, "not found");
    },
    listTransactions: async () => {
      await mockRespond();
      return [...mockServer.values()];
    },
    getMe: async () => ({
      id: "user-1",
      auth_provider_id: "user-1",
      email: "a@b.c",
      display_name: "A",
      created_at: new Date().toISOString(),
      currency: "BGN",
      hide_balance: false,
      time_format: "24h",
      date_format: "DD/MM/YYYY",
    }),
    listCategories: async () => [],
    listFundCategories: async () => [],
  },
}));

import { useFinanceStore } from "./useFinanceStore";

const store = () => useFinanceStore.getState();
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Lets mockHeld responses through one at a time until nothing is waiting.
async function releaseAll() {
  for (let i = 0; i < 100; i++) {
    await tick();
    const next = mockHeld.shift();
    if (!next) return;
    next();
  }
  throw new Error("queue never settled");
}

const fields = (title: string) => ({
  title,
  type: "expense" as const,
  amount: 10,
  category: "cat-1",
  fundCategory: "fund-1",
  note: "",
  date: new Date("2026-09-01T10:00:00Z"),
});

beforeEach(async () => {
  await releaseAll();
  mockServer.clear();
  mockHolding = false;
  mockHeld = [];
  mockLoseNextCreate = false;
  useFinanceStore.setState({ transactions: [], pendingOps: [], isConnected: true });
});

test("add shows up instantly, then syncs in the background", async () => {
  mockHolding = true; // mockServer is slow / asleep
  await store().addTransaction(fields("Coffee"));

  expect(store().transactions).toMatchObject([{ title: "Coffee", isPending: true }]);
  expect(mockServer.size).toBe(0);

  await releaseAll();
  expect(store().pendingOps).toEqual([]);
  expect(store().transactions).toHaveLength(1);
  expect(store().transactions[0].id).toMatch(/^server-/);
  expect(store().transactions[0].isPending).toBeUndefined();
  expect(mockServer.size).toBe(1);
});

test("editing a row whose create is still in flight keeps the edit", async () => {
  mockHolding = true;
  await store().addTransaction(fields("Coffe"));
  const placeholderId = store().transactions[0].id;
  await tick(); // POST is now in flight

  await store().updateTransaction(placeholderId, fields("Coffee"));
  expect(store().transactions[0].title).toBe("Coffee");

  await releaseAll();
  expect(store().pendingOps).toEqual([]);
  expect([...mockServer.values()].map((t) => t.title)).toEqual(["Coffee"]);
  expect(store().transactions).toMatchObject([{ title: "Coffee" }]);
  expect(store().transactions[0].id).toMatch(/^server-/);
});

test("deleting a row whose create is still in flight deletes it on the server too", async () => {
  mockHolding = true;
  await store().addTransaction(fields("Oops"));
  const placeholderId = store().transactions[0].id;
  await tick();

  await store().deleteTransaction(placeholderId);
  expect(store().transactions).toEqual([]);

  await releaseAll();
  expect(mockServer.size).toBe(0);
  expect(store().transactions).toEqual([]);
  expect(store().pendingOps).toEqual([]);
});

test("a second edit made while the first is in flight wins", async () => {
  await store().addTransaction(fields("A"));
  await releaseAll();
  const id = store().transactions[0].id;

  mockHolding = true;
  await store().updateTransaction(id, fields("B"));
  await tick();
  await store().updateTransaction(id, fields("C"));

  await releaseAll();
  expect(mockServer.get(id)!.title).toBe("C");
  expect(store().transactions).toMatchObject([{ id, title: "C" }]);
  expect(store().pendingOps).toEqual([]);
});

test("an edit sent with the old placeholder id after sync reaches the real row", async () => {
  await store().addTransaction(fields("Lunch"));
  const placeholderId = store().transactions[0].id; // e.g. mockHeld by an open edit modal
  await releaseAll();

  await store().updateTransaction(placeholderId, fields("Dinner"));
  await releaseAll();
  expect([...mockServer.values()].map((t) => t.title)).toEqual(["Dinner"]);
  expect(store().pendingOps).toEqual([]);
});

test("a create whose response was lost is recovered on retry without duplicating", async () => {
  mockLoseNextCreate = true;
  await store().addTransaction(fields("Rent"));
  await releaseAll();
  expect(store().pendingOps).toMatchObject([{ status: "failed" }]);

  await store().hydrate(); // retries failed ops → 409 → looks up the real row
  expect(mockServer.size).toBe(1);
  expect(store().pendingOps).toEqual([]);
  expect(store().transactions).toHaveLength(1);
  expect(store().transactions[0].id).toMatch(/^server-/);
});

test("a refresh landing mid-edit doesn't wipe the local change", async () => {
  await store().addTransaction(fields("Old"));
  await releaseAll();

  mockHolding = true;
  const refresh = store().hydrate(); // GET /transactions now in flight
  await tick();
  await store().addTransaction(fields("New"));

  await tick();
  mockHeld.shift()!(); // only the GET comes back — the POST is still in flight
  await tick();
  expect(store().transactions.map((t) => t.title).sort()).toEqual(["New", "Old"]);

  await releaseAll();
  await refresh;
  expect(mockServer.size).toBe(2);
  expect(store().transactions).toHaveLength(2);
  expect(store().pendingOps).toEqual([]);
});

test("tour sample rows survive a refresh, never reach the server, and clear out", async () => {
  await store().addTransaction(fields("Real"));
  await releaseAll();
  store().addDemoTransactions([{ ...fields("Sample"), id: "demo-1" }]);

  await store().hydrate(); // background refresh while the tour runs
  expect(store().transactions.map((t) => t.title).sort()).toEqual(["Real", "Sample"]);

  await store().updateTransaction("demo-1", fields("Sample edited"));
  await store().deleteTransaction("demo-1");
  await releaseAll();
  expect(mockServer.size).toBe(1);
  expect(store().pendingOps).toEqual([]);

  store().addDemoTransactions([{ ...fields("Sample"), id: "demo-2" }]);
  store().removeDemoTransactions();
  expect(store().transactions.map((t) => t.title)).toEqual(["Real"]);
});

test("offline writes wait, then sync on reconnect", async () => {
  store().setConnected(false);
  await store().addTransaction(fields("Offline"));
  await releaseAll();
  expect(mockServer.size).toBe(0);
  expect(store().pendingOps).toHaveLength(1);

  store().setConnected(true);
  await releaseAll();
  await tick();
  expect(mockServer.size).toBe(1);
  expect(store().pendingOps).toEqual([]);
});

test("a device field (language) always comes from the shared device slot, never a per-user one", async () => {
  // A same-named key sitting under the signed-in user (useAuthStore is
  // mocked to "user-1" for this whole file) — an older build, a bug,
  // anything — must never resurface and shadow the real device value once
  // the persisted blob is re-read after signing in.
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await AsyncStorage.setItem(
    "finance-store",
    JSON.stringify({
      device: { language: "bg" },
      users: { "user-1": { language: "en" } },
      version: 0,
    }),
  );
  await useFinanceStore.persist.rehydrate();
  expect(store().language).toBe("bg");
});
