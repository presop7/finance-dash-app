import { Modal, ModalProps } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useCloseOnBack } from "../hooks/useBackNavigation";

// React Native's Modal, plus: while it's open, back (browser, gesture or
// system button) closes it — the newest open one first. Used for every sheet
// and dialog in the app. A modal meant to stay put passes an onRequestClose
// that does nothing, and back then does nothing either.
// On Android a Modal is its own window, outside the app's gesture root, so
// gestures inside it (hold-and-drag reordering) need a root of their own.
export default function AppModal({ children, ...props }: ModalProps) {
  useCloseOnBack(props.visible ?? true, props.onRequestClose as (() => void) | undefined);
  return (
    <Modal {...props}>
      <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
    </Modal>
  );
}
