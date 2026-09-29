import { Alert, Platform } from "react-native";
import i18n from "../i18n";
import { openWebDialog, type DialogButton } from "../components/WebDialogHost";

// The phone's system alert; on web (where react-native-web's Alert.alert
// does nothing) the app's own dialog — see components/WebDialogHost.tsx.
export function showDialog(title: string, message: string, buttons: DialogButton[]) {
  if (Platform.OS === "web") openWebDialog({ title, message, buttons });
  else Alert.alert(title, message, buttons);
}

export function confirmAsync(title: string, message: string): Promise<boolean> {
  return confirmAsyncWithLabel(title, message, i18n.t("common.delete"));
}

// A simple informational/error alert.
export function alertAsync(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    showDialog(title, message, [{ text: i18n.t("common.ok"), style: "cancel", onPress: () => resolve() }]);
  });
}

// Confirm with a custom confirm-button label (e.g. "Delete Anyway" for a
// warning, "Sign Out"). Pass destructive: false for a harmless action so the
// button isn't shown in red.
export function confirmAsyncWithLabel(
  title: string,
  message: string,
  confirmLabel: string,
  { destructive = true }: { destructive?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    showDialog(title, message, [
      { text: i18n.t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}

// Three-way prompt for leaving a screen/modal with unsaved changes: apply
// them, discard them, or stay put.
export function confirmUnsavedChanges(
  title: string,
  message: string,
  applyLabel: string,
  discardLabel: string,
): Promise<"apply" | "discard" | "cancel"> {
  return new Promise((resolve) => {
    showDialog(title, message, [
      { text: discardLabel, style: "destructive", onPress: () => resolve("discard") },
      { text: i18n.t("common.cancel"), style: "cancel", onPress: () => resolve("cancel") },
      { text: applyLabel, onPress: () => resolve("apply") },
    ]);
  });
}
