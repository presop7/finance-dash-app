import { Modal, ModalProps } from "react-native";
import { useCloseOnBack } from "../hooks/useBackNavigation";

// React Native's Modal, plus: while it's open, back (browser, gesture or
// system button) closes it — the newest open one first. Used for every sheet
// and dialog in the app. A modal meant to stay put passes an onRequestClose
// that does nothing, and back then does nothing either.
export default function AppModal(props: ModalProps) {
  useCloseOnBack(props.visible ?? true, props.onRequestClose as (() => void) | undefined);
  return <Modal {...props} />;
}
