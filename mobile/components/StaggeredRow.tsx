import { ReactNode, useEffect, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { SkeletonBlock } from "./Skeleton";

// Upgrades happen a couple of rows per frame from one shared queue, rather
// than every row upgrading in the same commit the moment it mounts — that's
// the whole point: FlatList mounts a batch of rows as you scroll, and the
// real row (gesture handler, animated panels, icon glyphs) is expensive
// enough that mounting them all at once blocks the JS thread and leaves the
// list showing blank space. This way a row mounts as a cheap skeleton and
// the real content streams in a few at a time.
const ROWS_PER_FRAME = 2;
const queue: Array<() => void> = [];
let pumping = false;

function pump() {
  pumping = false;
  for (let i = 0; i < ROWS_PER_FRAME && queue.length > 0; i++) queue.shift()!();
  if (queue.length > 0) schedule();
}

function schedule() {
  if (pumping) return;
  pumping = true;
  requestAnimationFrame(pump);
}

function useStaggeredReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const upgrade = () => setReady(true);
    queue.push(upgrade);
    schedule();
    return () => {
      const i = queue.indexOf(upgrade);
      if (i >= 0) queue.splice(i, 1);
    };
  }, []);
  return ready;
}

// Matches a TransactionRow's layout (36px icon square, two text lines, an
// amount on the right, 12px padding) closely enough that swapping to the
// real one barely moves anything.
function RowSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  return (
    <View style={[style, styles.row]}>
      <SkeletonBlock width={36} height={36} radius={10} style={styles.icon} />
      <View style={styles.info}>
        <SkeletonBlock width="55%" height={11} radius={5} />
        <SkeletonBlock width="35%" height={9} radius={4} style={styles.subline} />
      </View>
      <SkeletonBlock width={56} height={11} radius={5} />
    </View>
  );
}

export default function StaggeredRow({
  rowStyle,
  children,
}: {
  // Applied to the skeleton so its margins/side borders match the real row.
  rowStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ready = useStaggeredReady();
  if (!ready) return <RowSkeleton style={rowStyle} />;
  return <>{children}</>;
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      height: 61,
      padding: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    icon: { marginRight: 10 },
    info: { flex: 1 },
    subline: { marginTop: 6 },
  });
}
