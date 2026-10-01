import { Text, View, StyleSheet } from "react-native";
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
  // Shown inside the pie chart's round center (120px across): every line is
  // kept to one centered 88px column — the circle's width at the height of
  // the top and bottom lines — so no line runs under the wedges.
  inCircle?: boolean;
}) {
  const Colors = useThemeColors();
  const { t } = useTranslation();
  const styles = getThemedStyles(createStyles, Colors);
  const fields = (
    <>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {amount.toFixed(2)} {currencyCode}
      </Text>
      <Text style={styles.pct}>{t("charts.pctOfTotal", { pct: pct.toFixed(1) })}</Text>
      <Text style={styles.count}>{t("charts.transactions", { count })}</Text>
    </>
  );
  return inCircle ? <View style={styles.circleColumn}>{fields}</View> : fields;
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
    label: { width: "100%", fontSize: FONT.small, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
    amount: { width: "100%", fontSize: FONT.small, fontWeight: "700", color: Colors.textPrimary, marginTop: 2, textAlign: "center" },
    pct: { width: "100%", fontSize: FONT.label, color: Colors.textMuted, marginTop: 1, textAlign: "center" },
    count: { width: "100%", fontSize: FONT.label, color: Colors.textMuted, marginTop: 1, textAlign: "center" },
    circleColumn: { width: 88, alignItems: "center" },
  });
}
