import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

type CalendarRangePickerProps = {
  start: Date | null;
  end: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getMonthGrid(viewYear: number, viewMonth: number): (Date | null)[] {
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  // Monday-first offset
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(viewYear, viewMonth, d));
  }
  return days;
}

export default function CalendarRangePicker({ start, end, onChange }: CalendarRangePickerProps) {
  const initial = start ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const days = getMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayPress = (day: Date) => {
    const picked = startOfDay(day);
    if (!start || (start && end)) {
      onChange(picked, null);
      return;
    }
    if (picked.getTime() < start.getTime()) {
      onChange(picked, start);
    } else {
      onChange(start, picked);
    }
  };

  const isInRange = (day: Date) => {
    if (!start || !end) return false;
    const t = day.getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const isEndpoint = (day: Date) => {
    if (start && day.getTime() === start.getTime()) return true;
    if (end && day.getTime() === end.getTime()) return true;
    return false;
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={goPrevMonth} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={goNextMonth} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day, i) => {
          if (!day) return <View key={i} style={styles.dayCell} />;
          const inRange = isInRange(day);
          const endpoint = isEndpoint(day);
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayCell, inRange && styles.dayCellInRange, endpoint && styles.dayCellEndpoint]}
              onPress={() => handleDayPress(day)}
            >
              <Text style={[styles.dayText, endpoint && styles.dayTextEndpoint]}>{day.getDate()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.hint}>
        {!start ? "Tap a start date" : !end ? "Tap an end date" : "Tap to start a new selection"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 12,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthLabel: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellInRange: { backgroundColor: Colors.primary + "18" },
  dayCellEndpoint: { backgroundColor: Colors.primary },
  dayText: { fontSize: 12, color: Colors.textPrimary },
  dayTextEndpoint: { color: "#fff", fontWeight: "600" },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 8, textAlign: "center" },
});
