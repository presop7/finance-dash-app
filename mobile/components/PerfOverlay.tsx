// TEMPORARY diagnostic — a floating, collapsible log panel mounted once at
// the app root (see App.tsx), fed by perfLogSink.ts. Neither the Metro
// terminal nor `adb logcat` (which also needs a USB connection anyway)
// reliably surfaced console output while testing with --no-dev --minify —
// this puts the same lines directly on screen instead, so no separate
// tooling or cable is needed at all. Delete this, its mount in App.tsx, and
// utils/perf{Probe,Watchdog,LogSink}.ts once this performance pass is done.
import { useState, useSyncExternalStore } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share } from "react-native";
import { subscribePerfLog, getPerfLogSnapshot, clearPerfLog } from "../utils/perfLogSink";

export default function PerfOverlay() {
  const lines = useSyncExternalStore(subscribePerfLog, getPerfLogSnapshot);
  const [collapsed, setCollapsed] = useState(true);
  // Even the collapsed badge is a real touchable sitting on top of
  // everything else, which blocks Expo's element inspector from picking
  // whatever's underneath it — long-pressing it gets it out of the way
  // entirely for the rest of this session (a reload brings it back).
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  if (collapsed) {
    return (
      <TouchableOpacity
        style={styles.badge}
        onPress={() => setCollapsed(false)}
        onLongPress={() => setHidden(true)}
      >
        <Text style={styles.badgeText}>perf ({lines.length})</Text>
      </TouchableOpacity>
    );
  }

  // The share sheet is the reliable way to get this text off the device —
  // long-pressing a Text to select/copy works too (see selectable below),
  // but is fiddly for a whole multi-line log; most Android share sheets
  // offer a direct "Copy to clipboard" target, and it can also go straight
  // to a messaging app to paste from there. No extra dependency needed —
  // Share ships in react-native itself, unlike clipboard access.
  const shareAll = () => {
    if (lines.length === 0) return;
    Share.share({ message: lines.join("\n") });
  };

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <View style={styles.header}>
        <Text style={styles.headerText}>Perf log ({lines.length})</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={shareAll} hitSlop={8}>
            <Text style={styles.headerBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearPerfLog} hitSlop={8}>
            <Text style={styles.headerBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCollapsed(true)} hitSlop={8}>
            <Text style={styles.headerBtnText}>Hide</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.body}>
        {lines.length === 0 ? (
          <Text style={styles.emptyText}>Nothing logged yet — trigger a toggle/filter/hold, or wait for a stall.</Text>
        ) : (
          // selectable: a long-press still lets a single line be selected
          // and copied the normal Android way, as a fallback to Share above.
          [...lines].reverse().map((line, i) => (
            <Text key={i} style={styles.line} selectable>
              {line}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: 10,
    bottom: 110,
    backgroundColor: "#000000cc",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  badgeText: { color: "#0f0", fontSize: 11, fontWeight: "700" },
  panel: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 90,
    maxHeight: 320,
    backgroundColor: "#000000e6",
    borderRadius: 10,
    zIndex: 9999,
    elevation: 9999,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  headerBtns: { flexDirection: "row", gap: 14 },
  headerBtnText: { color: "#5ac8fa", fontSize: 12, fontWeight: "600" },
  body: { paddingHorizontal: 10, paddingVertical: 6 },
  line: { color: "#0f0", fontSize: 10, marginBottom: 4, fontFamily: "monospace" },
  emptyText: { color: "#888", fontSize: 11, paddingVertical: 10 },
});
