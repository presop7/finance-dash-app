export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "D MMM YYYY";
export type TimeFormat = "12h" | "24h";

export const DATE_FORMAT_PRESETS: DateFormat[] = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "D MMM YYYY",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatDate(date: Date, format: DateFormat): string {
  const d = pad2(date.getDate());
  const m = pad2(date.getMonth() + 1);
  const y = date.getFullYear();

  switch (format) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "MM/DD/YYYY":
      return `${m}/${d}/${y}`;
    case "YYYY-MM-DD":
      return `${y}-${m}-${d}`;
    case "D MMM YYYY":
      return `${date.getDate()} ${MONTH_ABBR[date.getMonth()]} ${y}`;
  }
}

export function formatTime(date: Date, timeFormat: TimeFormat): string {
  const hours24 = date.getHours();
  const minutes = pad2(date.getMinutes());

  if (timeFormat === "24h") {
    return `${pad2(hours24)}:${minutes}`;
  }

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
