import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import aesjs from "aes-js";

// Supabase's session (access + refresh token) is too big for SecureStore's
// ~2KB limit, so it's stored AES-encrypted in AsyncStorage and only the
// encryption key lives in SecureStore (the Android Keystore / iOS Keychain).
// A copied AsyncStorage file or backup is then useless without the device's
// keystore. This is Supabase's documented "LargeSecureStore" approach; a fresh
// key per write means AES-CTR never reuses a key/counter pair.
type SecureStoreModule = typeof import("expo-secure-store");

async function encrypt(
  SecureStore: SecureStoreModule,
  name: string,
  value: string,
): Promise<string> {
  const key = Crypto.getRandomBytes(32);
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(name, aesjs.utils.hex.fromBytes(key));
  return aesjs.utils.hex.fromBytes(encrypted);
}

async function decrypt(
  SecureStore: SecureStoreModule,
  name: string,
  value: string,
): Promise<string | null> {
  const keyHex = await SecureStore.getItemAsync(name);
  if (!keyHex) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
}

export function createEncryptedStorage(SecureStore: SecureStoreModule) {
  return {
    async getItem(name: string): Promise<string | null> {
      const stored = await AsyncStorage.getItem(name);
      if (!stored) return null;
      const value = await decrypt(SecureStore, name, stored);
      // No key means this was written before encryption existed (plain
      // text) — drop it; the user signs in once more and it's stored
      // encrypted from then on.
      if (value === null) await AsyncStorage.removeItem(name);
      return value;
    },
    async setItem(name: string, value: string): Promise<void> {
      await AsyncStorage.setItem(name, await encrypt(SecureStore, name, value));
    },
    async removeItem(name: string): Promise<void> {
      await AsyncStorage.removeItem(name);
      await SecureStore.deleteItemAsync(name);
    },
  };
}

// Web has no SecureStore. On native, a dev client built before
// expo-secure-store was added lacks the module — fall back to plain
// AsyncStorage there rather than crash at launch (every build made from now
// on includes it, so the fallback only ever applies to that stale client).
export function sessionStorage() {
  if (Platform.OS === "web" || !requireOptionalNativeModule("ExpoSecureStore")) {
    return AsyncStorage;
  }
  return createEncryptedStorage(require("expo-secure-store"));
}
