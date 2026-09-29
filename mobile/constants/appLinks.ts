import { Platform } from "react-native";

// Where "Share Fi-Track" (Settings) sends people. Until the store listings
// exist everything leads to the web app; when the apps are published, fill
// in the store URLs and the phone apps share their own store page instead.
export const WEB_APP_URL = "https://fi-track-web.onrender.com";
export const PLAY_STORE_URL: string | null = null; // e.g. https://play.google.com/store/apps/details?id=com.presop7.financedash
export const APP_STORE_URL: string | null = null; // e.g. https://apps.apple.com/app/id…

export function shareUrl(): string {
  if (Platform.OS === "android" && PLAY_STORE_URL) return PLAY_STORE_URL;
  if (Platform.OS === "ios" && APP_STORE_URL) return APP_STORE_URL;
  return WEB_APP_URL;
}
