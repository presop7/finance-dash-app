import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { financeApi } from "../../services/financeApi";
import { alertAsync, confirmAsyncWithLabel } from "../../utils/confirm";
import ModalCloseButton from "../../components/ModalCloseButton";

// Mirrors the limits the backend enforces (routes/feedback.py) so the user
// hears about a problem here instead of after an upload.
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;
const MAX_PICTURES = 5;
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

type Picture = { uri: string; name: string; type: string };

type FeedbackModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle("");
    setDescription("");
    setPictures([]);
    setSending(false);
  }, [visible]);

  const hasContent = title.trim() !== "" || description.trim() !== "" || pictures.length > 0;
  const canSend = title.trim() !== "" && description.trim() !== "" && !sending;

  const handleClose = async () => {
    if (sending) return;
    if (hasContent) {
      const discard = await confirmAsyncWithLabel(
        "Discard report?",
        "What you've written here hasn't been sent yet.",
        "Discard",
      );
      if (!discard) return;
    }
    onClose();
  };

  const handleAddPictures = async () => {
    const remaining = MAX_PICTURES - pictures.length;
    if (remaining <= 0) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const picked: Picture[] = [];
      let skipped = 0;
      for (const asset of result.assets) {
        const type = asset.mimeType ?? "image/jpeg";
        if (!type.startsWith("image/") || (asset.size ?? 0) > MAX_PICTURE_BYTES) {
          skipped += 1;
          continue;
        }
        picked.push({ uri: asset.uri, name: asset.name, type });
      }
      const accepted = picked.slice(0, remaining);
      skipped += picked.length - accepted.length;
      setPictures((prev) => [...prev, ...accepted]);
      if (skipped > 0) {
        await alertAsync(
          "Some pictures weren't added",
          `Pictures must be images under ${MAX_PICTURE_BYTES / (1024 * 1024)} MB, and you can attach up to ${MAX_PICTURES}.`,
        );
      }
    } catch (err) {
      await alertAsync(
        "Couldn't open the picker",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("app_info", `${Platform.OS} ${Platform.Version}`);
      for (const picture of pictures) {
        // React Native's FormData takes this {uri, name, type} shape for files.
        form.append("attachments", picture as unknown as Blob);
      }
      await financeApi.sendFeedback(form);
      await alertAsync("Thanks!", "Your report was sent — we'll take a look.");
      onClose();
    } catch (err) {
      await alertAsync(
        "Couldn't send your report",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={handleClose} />

        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.headerTitle}>Send Feedback</Text>
              <ModalCloseButton onPress={handleClose} />
            </View>

            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.body}>
                <Text style={styles.intro}>
                  Found a bug or have an idea? Tell us what happened — screenshots help a lot.
                </Text>

                <Text style={styles.formLabel}>Title</Text>
                <View style={styles.fieldContainer}>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Short summary"
                    placeholderTextColor={Colors.textMuted}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={MAX_TITLE}
                    editable={!sending}
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.formLabel}>Description</Text>
                <View style={[styles.fieldContainer, styles.descriptionContainer]}>
                  <TextInput
                    style={[styles.fieldInput, styles.descriptionInput]}
                    placeholder="What were you doing, what did you expect, and what happened instead?"
                    placeholderTextColor={Colors.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    maxLength={MAX_DESCRIPTION}
                    editable={!sending}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
                <Text style={styles.counter}>
                  {description.length}/{MAX_DESCRIPTION}
                </Text>

                <Text style={styles.formLabel}>
                  Pictures ({pictures.length}/{MAX_PICTURES})
                </Text>
                <View style={styles.pictureRow}>
                  {pictures.map((picture, index) => (
                    <View key={`${picture.uri}-${index}`} style={styles.thumbWrapper}>
                      <Image source={{ uri: picture.uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        hitSlop={8}
                        disabled={sending}
                        onPress={() => setPictures((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.expense} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {pictures.length < MAX_PICTURES && (
                    <TouchableOpacity
                      style={styles.addPicture}
                      onPress={handleAddPictures}
                      disabled={sending}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="image-outline" size={22} color={Colors.primary} />
                      <Text style={styles.addPictureText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleClose}
                    disabled={sending}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!canSend}
                  >
                    {sending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.sendBtnText}>Send Report</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    root: { flex: 1 },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    // Same layout approach as the other sheet modals: the sheet sits at the
    // bottom via justifyContent (not absolute positioning) so
    // KeyboardAvoidingView's padding can actually push it up.
    keyboardAvoider: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "85%",
    },
    scrollArea: { flexShrink: 1 },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 16, fontWeight: "600", color: Colors.textPrimary },
    body: { paddingHorizontal: 16 },
    intro: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
    formLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: Colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
      marginTop: 14,
    },
    fieldContainer: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: Colors.border,
    },
    fieldInput: { flex: 1, fontSize: 13, color: Colors.textPrimary, padding: 0 },
    descriptionContainer: { alignItems: "flex-start" },
    descriptionInput: { minHeight: 110, maxHeight: 220 },
    counter: {
      alignSelf: "flex-end",
      fontSize: 10,
      color: Colors.textMuted,
      marginTop: 4,
    },
    pictureRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    thumbWrapper: { width: 72, height: 72 },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: 10,
      backgroundColor: Colors.surfaceSecondary,
      borderWidth: 0.5,
      borderColor: Colors.border,
    },
    thumbRemove: {
      position: "absolute",
      top: -6,
      right: -6,
      backgroundColor: Colors.surface,
      borderRadius: 10,
    },
    addPicture: {
      width: 72,
      height: 72,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      backgroundColor: Colors.primary + "10",
      borderWidth: 1,
      borderColor: Colors.primary + "60",
      borderStyle: "dashed",
    },
    addPictureText: { fontSize: 11, fontWeight: "600", color: Colors.primary },
    formActions: { flexDirection: "row", gap: 10, marginTop: 22, marginBottom: 8 },
    cancelBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: Colors.surfaceSecondary,
      borderWidth: 0.5,
      borderColor: Colors.border,
    },
    cancelBtnText: { fontSize: 14, fontWeight: "500", color: Colors.textSecondary },
    sendBtn: {
      flex: 2,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.primary,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  });
}
