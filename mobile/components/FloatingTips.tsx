import { useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import InstallTip from "./InstallTip";
import TipCard from "./TipCard";
import { useFinanceStore } from "../store/useFinanceStore";
import { useAuthStore } from "../store/useAuthStore";
import { useTutorialStore } from "../store/useTutorialStore";
import { useHighlightStore } from "../store/useHighlightStore";
import { hasNotificationPermission, notificationsSupported } from "../utils/notifications";

// The tips that float over the top of the app when it opens, stacked. Each
// can be switched off in Settings → Floating tips; ✕ hides one until the app
// is next opened.
export default function FloatingTips({ onShowNotifications }: { onShowNotifications: () => void }) {
  const insets = useSafeAreaInsets();
  const tips = useFinanceStore((s) => s.tips);
  return (
    <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + 8 }]}>
      {tips.install && <InstallTip />}
      {tips.notifications && <NotificationTip onShow={onShowNotifications} />}
    </View>
  );
}

// Signed in, notifications possible here but not on: a nudge to turn them
// on. "Show me" opens Settings at the Notifications switch and flashes it.
function NotificationTip({ onShow }: { onShow: () => void }) {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.session !== null);
  const enabled = useFinanceStore((s) => s.notificationsEnabled);
  const touring = useTutorialStore((s) => s.active);
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [closed, setClosed] = useState(false);

  // Re-checked when the app comes back: permission may have been given in
  // the phone's or browser's settings meanwhile.
  useEffect(() => {
    if (!notificationsSupported) return;
    const check = () => hasNotificationPermission().then(setPermitted);
    check();
    const sub = AppState.addEventListener("change", (state) => state === "active" && check());
    return () => sub.remove();
  }, []);

  if (!notificationsSupported || !signedIn || touring || closed || permitted === null) return null;
  if (permitted && enabled) return null;

  return (
    <TipCard
      icon="notifications-outline"
      title={t("notificationTip.title")}
      text={t("notificationTip.text")}
      action={t("notificationTip.show")}
      onAction={() => {
        setClosed(true);
        onShow();
        useHighlightStore.getState().highlight("notifications");
      }}
      onClose={() => setClosed(true)}
    />
  );
}

const styles = StyleSheet.create({
  stack: { position: "absolute", left: 12, right: 12, gap: 8 },
});
