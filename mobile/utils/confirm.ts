import { Alert, Platform } from "react-native";

// react-native-web's Alert.alert() is a no-op, so a native-only confirm
// silently does nothing on web. This branches to window.confirm there.
export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

// Same web/native split as confirmAsync, for a simple informational/error alert.
export function alertAsync(title: string, message: string): Promise<void> {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: "OK", onPress: () => resolve() }]);
  });
}

// Confirm with a custom confirm-button label (e.g. "Delete Anyway" for a warning).
export function confirmAsyncWithLabel(
  title: string,
  message: string,
  confirmLabel: string,
): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

// Three-way prompt for leaving a screen/modal with unsaved changes: apply
// them, discard them, or stay put. web's window.confirm only has two
// options, so there "cancel" (stay) collapses into "discard" is avoided by
// treating OK as apply and Cancel as staying — discard isn't reachable on
// web via this dialog, which is an acceptable trade-off for a dev/debug target.
export function confirmUnsavedChanges(
  title: string,
  message: string,
  applyLabel: string,
  discardLabel: string,
): Promise<"apply" | "discard" | "cancel"> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`) ? "apply" : "cancel");
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: discardLabel, style: "destructive", onPress: () => resolve("discard") },
      { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
      { text: applyLabel, onPress: () => resolve("apply") },
    ]);
  });
}
