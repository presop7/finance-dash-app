import { Pressable, StyleSheet, Text, View } from "react-native";
import Modal from "./AppModal";
import { create } from "zustand";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";

// The web version's stand-in for the phone's system alert. The browser's own
// window.alert/confirm show the site address as their title and can't be
// styled, so dialogs are drawn in-app instead. Rendered once, in App.tsx;
// opened through showDialog() in utils/confirm.ts.

export type DialogButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};
type Dialog = { title: string; message: string; buttons: DialogButton[] };

// A queue, so a dialog opened while another is showing waits its turn.
export const useWebDialogStore = create<{ queue: Dialog[] }>(() => ({ queue: [] }));

export function openWebDialog(dialog: Dialog) {
  useWebDialogStore.setState((s) => ({ queue: [...s.queue, dialog] }));
}

export default function WebDialogHost() {
  const dialog = useWebDialogStore((s) => s.queue[0]);
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  if (!dialog) return null;

  const press = (button?: DialogButton) => {
    useWebDialogStore.setState((s) => ({ queue: s.queue.slice(1) }));
    button?.onPress?.();
  };
  // Tapping outside the card counts as Cancel (or does nothing if there's no
  // cancel button, like a plain OK message — then it just closes).
  const cancel = dialog.buttons.find((b) => b.style === "cancel");

  return (
    // Mounted only while a dialog shows, so it opens above any modal that's
    // already on screen.
    <Modal transparent visible animationType="fade" onRequestClose={() => press(cancel)}>
      <Pressable style={styles.backdrop} onPress={() => press(cancel)}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{dialog.title}</Text>
          {!!dialog.message && <Text style={styles.message}>{dialog.message}</Text>}
          <View style={styles.buttons}>
            {dialog.buttons.map((b, i) => (
              <Pressable key={i} style={styles.button} onPress={() => press(b)}>
                <Text
                  style={[
                    styles.buttonText,
                    b.style === "cancel" && styles.cancelText,
                    b.style === "destructive" && styles.destructiveText,
                  ]}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    title: { fontSize: 17, fontWeight: "600", color: Colors.textPrimary },
    message: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, marginTop: 8 },
    buttons: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      marginTop: 12,
    },
    button: { paddingVertical: 10, paddingHorizontal: 12 },
    buttonText: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
    cancelText: { fontWeight: "400", color: Colors.textSecondary },
    destructiveText: { color: Colors.expense },
  });
}
