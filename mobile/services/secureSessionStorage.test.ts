/// <reference types="jest" />
// Encrypted session storage checks. Run: npm test
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo", () => ({ requireOptionalNativeModule: () => null }));
jest.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => new Uint8Array(require("crypto").randomBytes(n)),
}));

import { createEncryptedStorage } from "./secureSessionStorage";

const keychain = new Map<string, string>();
const fakeSecureStore = {
  setItemAsync: async (k: string, v: string) => void keychain.set(k, v),
  getItemAsync: async (k: string) => keychain.get(k) ?? null,
  deleteItemAsync: async (k: string) => void keychain.delete(k),
} as any;

const storage = createEncryptedStorage(fakeSecureStore);
const NAME = "sb-project-auth-token";
const SESSION = JSON.stringify({ access_token: "secret-access", refresh_token: "secret-refresh" });

beforeEach(async () => {
  keychain.clear();
  await AsyncStorage.clear();
});

test("round-trips the session and never stores it in plain text", async () => {
  await storage.setItem(NAME, SESSION);

  const onDisk = await AsyncStorage.getItem(NAME);
  expect(onDisk).not.toContain("secret");
  expect(keychain.has(NAME)).toBe(true);
  expect(await storage.getItem(NAME)).toBe(SESSION);
});

test("without the keystore key the stored data is unreadable", async () => {
  await storage.setItem(NAME, SESSION);
  keychain.clear(); // e.g. the AsyncStorage file copied to another device

  expect(await storage.getItem(NAME)).toBeNull();
});

test("a plain-text session from before encryption is dropped, not trusted", async () => {
  await AsyncStorage.setItem(NAME, SESSION);

  expect(await storage.getItem(NAME)).toBeNull();
  expect(await AsyncStorage.getItem(NAME)).toBeNull();
});

test("removeItem clears both the data and its key", async () => {
  await storage.setItem(NAME, SESSION);
  await storage.removeItem(NAME);

  expect(await AsyncStorage.getItem(NAME)).toBeNull();
  expect(keychain.has(NAME)).toBe(false);
});
