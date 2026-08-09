export type TimeframePreset = "7d" | "30d" | "90d" | "month" | "year" | "all";

export const TIMEFRAME_LABELS: Record<TimeframePreset, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  month: "This Month",
  year: "This Year",
  all: "All Time",
};

export const TIMEFRAME_PRESETS: TimeframePreset[] = [
  "7d",
  "30d",
  "90d",
  "month",
  "year",
  "all",
];

export function daysAgo(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

type Range = {
  start: Date | null;
  end: Date;
  prevStart: Date | null;
  prevEnd: Date | null;
};

// `start`/`prevStart` are null for "all time", meaning unbounded.
export function getRangeForPreset(
  preset: TimeframePreset,
  now: Date = new Date(),
): Range {
  switch (preset) {
    case "7d":
      return {
        start: daysAgo(7, now),
        end: now,
        prevStart: daysAgo(14, now),
        prevEnd: daysAgo(7, now),
      };
    case "30d":
      return {
        start: daysAgo(30, now),
        end: now,
        prevStart: daysAgo(60, now),
        prevEnd: daysAgo(30, now),
      };
    case "90d":
      return {
        start: daysAgo(90, now),
        end: now,
        prevStart: daysAgo(180, now),
        prevEnd: daysAgo(90, now),
      };
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now, prevStart, prevEnd };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const prevStart = new Date(now.getFullYear() - 1, 0, 1);
      const prevEnd = new Date(now.getFullYear(), 0, 1);
      return { start, end: now, prevStart, prevEnd };
    }
    case "all":
      return { start: null, end: now, prevStart: null, prevEnd: null };
  }
}

export function isWithinRange(
  date: Date,
  start: Date | null,
  end: Date,
): boolean {
  const t = date.getTime();
  if (start && t < start.getTime()) return false;
  return t <= end.getTime();
}

export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}
