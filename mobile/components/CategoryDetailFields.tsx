import { Text, StyleSheet } from "react-native";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";

// The name/amount/percent/count block shown for a single category — shared
// by the pie chart's center callout and the bar chart's tap overlay, so the
// two charts agree on exactly what a category's "detail" looks like instead
// of drifting apart as separate copies.
export default function CategoryDetailFields({
  label,
  amount,
  currencyCode,
  pct,
  count,
}: {
  label: string;
  amount: number;
  currencyCode: string;
  pct: number;
  count: number;
}) {
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  return (
    <>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {amount.toFixed(2)} {currencyCode}
      </Text>
      <Text style={styles.pct}>{pct.toFixed(1)}% of total</Text>
      <Text style={styles.count}>
        {count} {count === 1 ? "transaction" : "transactions"}
      </Text>
    </>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    label: { width: "100%", fontSize: 10, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
    amount: { width: "100%", fontSize: 11, fontWeight: "700", color: Colors.textPrimary, marginTop: 2, textAlign: "center" },
    pct: { width: "100%", fontSize: 9, color: Colors.textMuted, marginTop: 1, textAlign: "center" },
    count: { width: "100%", fontSize: 8, color: Colors.textMuted, marginTop: 1, textAlign: "center" },
  });
}
