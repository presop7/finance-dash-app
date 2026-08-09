import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Colors } from "../constants/colors";

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

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", {
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
          <Ionicons
            name="calendar-outline"
            size={18}
            color={Colors.textMuted}
          />
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
          <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.dateTimeText}>{formatTime(date)}</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
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
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) onChange(selectedTime);
          }}
        />
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
    gap: 8,
  },
  dateField: {
    flex: 2,
  },
  timeField: {
    flex: 1,
  },
  dateTimeText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
});
