import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

type DateTimeFieldsProps = {
  date: Date;
  onChange: (date: Date) => void;
  onInteract?: () => void;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad2 = (n: number) => n.toString().padStart(2, "0");

function formatDateText(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatTimeText(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Web (browser) has no native date/time picker in this app —
// @react-native-community/datetimepicker ships no web implementation.
// This gives web users a typeable field plus a custom calendar/time popover.
export default function DateTimeFields({
  date,
  onChange,
  onInteract,
}: DateTimeFieldsProps) {
  const [dateText, setDateText] = useState(formatDateText(date));
  const [timeText, setTimeText] = useState(formatTimeText(date));
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimeList, setShowTimeList] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    new Date(date.getFullYear(), date.getMonth(), 1),
  );

  useEffect(() => {
    setDateText(formatDateText(date));
    setTimeText(formatTimeText(date));
    setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [date.getTime()]);

  const commitDateText = (text: string) => {
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      const next = new Date(date);
      next.setFullYear(Number(yyyy), Number(mm) - 1, Number(dd));
      if (
        next.getDate() === Number(dd) &&
        next.getMonth() === Number(mm) - 1 &&
        next <= new Date()
      ) {
        onChange(next);
        return;
      }
    }
    setDateText(formatDateText(date));
  };

  const commitTimeText = (text: string) => {
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const [, hh, mm] = match;
      const h = Number(hh);
      const m = Number(mm);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const next = new Date(date);
        next.setHours(h, m, 0, 0);
        onChange(next);
        return;
      }
    }
    setTimeText(formatTimeText(date));
  };

  const selectDay = (day: number) => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    if (next > new Date()) return;
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    onChange(next);
    setShowCalendar(false);
  };

  const selectTime = (h: number, m: number) => {
    const next = new Date(date);
    next.setHours(h, m, 0, 0);
    onChange(next);
    setShowTimeList(false);
  };

  const firstWeekday =
    (new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay() + 6) %
    7; // Mon=0
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const isCurrentMonthFuture =
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1) > new Date();

  const timeOptions: { h: number; m: number }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) timeOptions.push({ h, m });
  }

  return (
    <>
      <View style={styles.dateTimeRow}>
        {/* Date */}
        <View style={[styles.fieldContainer, styles.dateField]}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={Colors.textMuted}
          />
          <TextInput
            style={styles.dateTimeInput}
            value={dateText}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={Colors.textMuted}
            onChangeText={setDateText}
            onFocus={onInteract}
            onBlur={() => commitDateText(dateText)}
            onSubmitEditing={() => commitDateText(dateText)}
          />
          <TouchableOpacity
            onPress={() => {
              onInteract?.();
              setShowTimeList(false);
              setShowCalendar((v) => !v);
            }}
          >
            <Ionicons
              name={showCalendar ? "chevron-up" : "chevron-down"}
              size={14}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Time */}
        <View style={[styles.fieldContainer, styles.timeField]}>
          <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.dateTimeInput}
            value={timeText}
            placeholder="HH:MM"
            placeholderTextColor={Colors.textMuted}
            onChangeText={setTimeText}
            onFocus={onInteract}
            onBlur={() => commitTimeText(timeText)}
            onSubmitEditing={() => commitTimeText(timeText)}
          />
          <TouchableOpacity
            onPress={() => {
              onInteract?.();
              setShowCalendar(false);
              setShowTimeList((v) => !v);
            }}
          >
            <Ionicons
              name={showTimeList ? "chevron-up" : "chevron-down"}
              size={14}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Custom calendar popover */}
      {showCalendar && (
        <View style={styles.popover}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              onPress={() =>
                setViewMonth(
                  new Date(
                    viewMonth.getFullYear(),
                    viewMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.calendarMonthLabel}>
              {viewMonth.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              disabled={isCurrentMonthFuture}
              onPress={() =>
                setViewMonth(
                  new Date(
                    viewMonth.getFullYear(),
                    viewMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  isCurrentMonthFuture ? Colors.textMuted : Colors.textPrimary
                }
              />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekdayText}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <View key={`blank-${i}`} style={styles.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const cellDate = new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth(),
                day,
              );
              const isSelected =
                cellDate.getFullYear() === date.getFullYear() &&
                cellDate.getMonth() === date.getMonth() &&
                cellDate.getDate() === date.getDate();
              const isFuture = cellDate > new Date();
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                  disabled={isFuture}
                  onPress={() => selectDay(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isFuture && styles.dayTextDisabled,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Custom time popover */}
      {showTimeList && (
        <View style={[styles.popover, styles.timePopover]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {timeOptions.map(({ h, m }) => {
              const isSelected =
                date.getHours() === h && date.getMinutes() === m;
              return (
                <TouchableOpacity
                  key={`${h}-${m}`}
                  style={[
                    styles.timeOption,
                    isSelected && styles.timeOptionSelected,
                  ]}
                  onPress={() => selectTime(h, m)}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      isSelected && styles.timeOptionTextSelected,
                    ]}
                  >
                    {pad2(h)}:{pad2(m)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dateTimeRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  fieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 6,
    minWidth: 0,
  },
  dateField: {
    flex: 2,
    minWidth: 0,
  },
  timeField: {
    flex: 1,
    minWidth: 0,
  },
  dateTimeInput: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    fontSize: 13,
    color: Colors.textPrimary,
  },
  popover: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  calendarMonthLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  dayTextDisabled: {
    color: Colors.textMuted,
  },
  timePopover: {
    maxHeight: 180,
  },
  timeOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  timeOptionSelected: {
    backgroundColor: Colors.primary + "15",
  },
  timeOptionText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  timeOptionTextSelected: {
    color: Colors.primary,
    fontWeight: "600",
  },
});
