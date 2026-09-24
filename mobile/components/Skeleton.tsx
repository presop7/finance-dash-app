import { StyleProp, View, ViewStyle } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";

// Deliberately static (no shimmer): a JS-driven animation here would compete
// with the very mount work these placeholders exist to cover for.
export function SkeletonBlock({
  width,
  height,
  radius = 10,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const Colors = useThemeColors();
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: Colors.surfaceSecondary,
          borderWidth: 0.5,
          borderColor: Colors.border,
        },
        style,
      ]}
    />
  );
}

// Matches CategoryPicker/FundCategoryPicker's chip layout (48px square icon
// + a label line, 12px gaps, 16px side padding) so nothing jumps when the
// real row replaces it.
export function ChipRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 4 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ alignItems: "center", gap: 6 }}>
          <SkeletonBlock width={48} height={48} radius={14} />
          <SkeletonBlock width={36} height={8} radius={4} />
        </View>
      ))}
    </View>
  );
}

// Matches the filters modal's two-row pill chip sections (36px pills, 8px
// margins) so the sheet — whose height is content-driven — doesn't resize
// when the real chips replace this.
export function PillRowsSkeleton({ rows = 2, perRow = 4 }: { rows?: number; perRow?: number }) {
  const widths = [96, 78, 110, 88, 100];
  return (
    <View>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {Array.from({ length: perRow }, (_, i) => (
            <SkeletonBlock
              key={i}
              width={widths[(r * perRow + i) % widths.length]}
              height={36}
              radius={18}
              style={{ marginRight: 8, marginBottom: 8 }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// Renders as a fragment so the blocks join the caller's own wrapping grid
// (Manage Categories' pill grid) and flow/gap exactly like the real chips.
export function ChipGridSkeleton({ count = 10 }: { count?: number }) {
  const widths = [130, 110, 150, 120, 140, 100];
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} width={widths[i % widths.length]} height={38} radius={20} />
      ))}
    </>
  );
}

// CategoryPicker = search box + chip row.
export function CategoryPickerSkeleton() {
  return (
    <View>
      <SkeletonBlock height={36} style={{ marginHorizontal: 16, marginBottom: 10 }} />
      <ChipRowSkeleton />
    </View>
  );
}
