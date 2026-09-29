import { useState } from "react";
import { Modal, Platform, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { shareUrl } from "../../constants/appLinks";
import QrCode from "../../components/QrCode";
import { useTranslation } from "react-i18next";

// "Share Fi-Track" from Settings: a QR code to scan from someone else's
// phone, plus the phone's own share menu for sending the link.
export default function ShareAppModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const [copied, setCopied] = useState(false);
  const url = shareUrl();
  // Browsers without a share menu (most computers) copy the link instead.
  const canWebShare = Platform.OS !== "web" || typeof navigator.share === "function";

  const share = async () => {
    const message = t("share.message");
    try {
      if (Platform.OS !== "web") {
        // Android shares `message` only; iOS shows `url` as a proper link.
        await Share.share(Platform.OS === "ios" ? { message, url } : { message: `${message} ${url}` });
      } else if (canWebShare) {
        await navigator.share({ title: "Fi-Track", text: message, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Closing the share menu without picking anything lands here — fine.
    }
  };

  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <Text style={styles.title}>{t("settings.shareApp")}</Text>
          <Text style={styles.subtitle}>{t("share.subtitle")}</Text>

          <View style={styles.qr}>
            <QrCode value={url} size={200} />
          </View>
          <Text style={styles.url} selectable>
            {url.replace(/^https:\/\//, "")}
          </Text>

          <TouchableOpacity style={styles.button} onPress={share} activeOpacity={0.8}>
            <Text style={styles.buttonText}>
              {copied ? t("share.copied") : canWebShare ? t("share.shareLink") : t("share.copyLink")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={close} activeOpacity={0.7}>
            <Text style={styles.closeText}>{t("common.close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 28,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    dialog: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
    },
    title: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: 6,
      marginBottom: 16,
    },
    qr: { padding: 8, backgroundColor: "#FFFFFF", borderRadius: 12 },
    url: { fontSize: 14, color: Colors.textSecondary, marginTop: 10 },
    button: {
      alignSelf: "stretch",
      backgroundColor: Colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 16,
    },
    buttonText: { color: Colors.surface, fontSize: 15, fontWeight: "600" }, // like the other primary buttons
    closeButton: { alignSelf: "stretch", paddingVertical: 12, alignItems: "center", marginTop: 4 },
    closeText: { fontSize: 15, color: Colors.textSecondary },
  });
}
