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

// The inverse of formatDate() — parses a raw string (e.g. from an imported
// CSV) using a caller-specified format, since the format can't be reliably
// auto-detected (01/02/2024 is ambiguous between DD/MM and MM/DD). Returns
// null for anything that doesn't cleanly parse, rather than guessing.
export function parseDateString(value: string, format: DateFormat): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let day: number;
  let month: number;
  let year: number;

  switch (format) {
    case "DD/MM/YYYY": {
      const parts = trimmed.split(/[/.-]/);
      if (parts.length !== 3) return null;
      [day, month, year] = parts.map(Number);
      break;
    }
    case "MM/DD/YYYY": {
      const parts = trimmed.split(/[/.-]/);
      if (parts.length !== 3) return null;
      [month, day, year] = parts.map(Number);
      break;
    }
    case "YYYY-MM-DD": {
      const parts = trimmed.split(/[-/.]/);
      if (parts.length !== 3) return null;
      [year, month, day] = parts.map(Number);
      break;
    }
    case "D MMM YYYY": {
      const parts = trimmed.split(/\s+/);
      if (parts.length !== 3) return null;
      day = Number(parts[0]);
      const monthIndex = MONTH_ABBR.findIndex(
        (abbr) => abbr.toLowerCase() === parts[1].slice(0, 3).toLowerCase(),
      );
      if (monthIndex === -1) return null;
      month = monthIndex + 1;
      year = Number(parts[2]);
      break;
    }
  }

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 100) year += 2000; // tolerate 2-digit years

  const date = new Date(year, month - 1, day);
  // Reject overflow (e.g. "31 Feb" silently rolling into March) instead of
  // accepting a date the caller didn't actually mean.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
