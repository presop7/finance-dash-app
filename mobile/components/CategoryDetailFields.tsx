import { Text, StyleSheet } from "react-native";
import { ColorsType } from "../constants/colors";
import { useThemeColors, getThemedStyles } from "../hooks/useThemeColors";
import { useTranslation } from "react-i18next";
import { FONT } from "../constants/typography";

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
  inCircle = false,
}: {
  label: string;
  amount: number;
  currencyCode: string;
  pct: number;
  count: number;
  // Shown inside the pie chart's round center: a circle is narrower at the
  // top and bottom than across the middle, so the first and last lines (name,
  // count) get side margins — the name wraps instead of being cut by the
  // circle's edge — while the amount and % in the middle keep the full width.
  inCircle?: boolean;
}) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  return (
    <>
      <Text style={[styles.label, inCircle && styles.roundEdgeLine]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {amount.toFixed(2)} {currencyCode}
      </Text>
      <Text style={styles.pct}>{t("charts.pctOfTotal", { pct: pct.toFixed(1) })}</Text>
      <Text style={[styles.count, inCircle && styles.roundEdgeLine]}>
        {t("charts.transactions", { count })}
      </Text>
    </>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    label: { width: "100%", fontSize: FONT.small, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
    amount: { width: "100%", fontSize: FONT.small, fontWeight: "700", color: Colors.textPrimary, marginTop: 2, textAlign: "center" },
    pct: { width: "100%", fontSize: FONT.label, color: Colors.textMuted, marginTop: 1, textAlign: "center" },
    count: { width: "100%", fontSize: FONT.label, color: Colors.textMuted, marginTop: 1, textAlign: "center" },
    roundEdgeLine: { width: undefined, alignSelf: "stretch", marginHorizontal: 16 },
  });
}
