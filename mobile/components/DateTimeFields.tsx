import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ColorsType } from "../constants/colors";
import { useThemeColors, useResolvedScheme, getThemedStyles } from "../hooks/useThemeColors";
import { currentLocale } from "../i18n";
import FieldIcon from "./FieldIcon";

type DateTimeFieldsProps = {
  date: Date;
  onChange: (date: Date) => void;
  onInteract?: () => void;
};

// Native (iOS/Android): tap-to-open native pickers, exactly as before.
// See DateTimeFields.web.tsx for the web-specific typeable variant —
// @react-native-community/datetimepicker ships no web implementation at all.
export default function DateTimeFields({
  date,
  onChange,
  onInteract,
}: DateTimeFieldsProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);
  const resolvedScheme = useResolvedScheme();

  const formatDate = (d: Date) =>
    d.toLocaleDateString(currentLocale(), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <View style={styles.dateTimeRow}>
        <TouchableOpacity
          style={[styles.fieldContainer, styles.dateField]}
          onPress={() => {
            onInteract?.();
            setShowTimePicker(false);
            setShowDatePicker(true);
          }}
        >
          <FieldIcon name="calendar-outline" />
          <Text style={styles.dateTimeText}>{formatDate(date)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fieldContainer, styles.timeField]}
          onPress={() => {
            onInteract?.();
            setShowDatePicker(false);
            setShowTimePicker(true);
          }}
        >
          <FieldIcon name="time-outline" />
          <Text style={styles.dateTimeText}>{formatTime(date)}</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          themeVariant={resolvedScheme}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={date}
          mode="time"
          display="default"
          themeVariant={resolvedScheme}
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) onChange(selectedTime);
          }}
        />
      )}
    </>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  dateTimeRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  fieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 14, // same ~48px height, and text start, as the typed fields
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 8,
  },
  dateField: {
    flex: 2,
  },
  timeField: {
    flex: 1,
  },
  dateTimeText: {
    paddingHorizontal: 6,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  });
}
