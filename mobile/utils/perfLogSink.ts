// TEMPORARY diagnostic — shared by perfProbe.ts, perfWatchdog.ts and
// CategoryPieChart's mount log, feeding components/PerfOverlay.tsx. Exists
// because neither the Metro terminal nor `adb logcat` reliably surfaced
// console output in this session's --no-dev testing setup (and adb needs a
// USB connection that isn't always available anyway) — putting the log
// lines directly on screen sidesteps needing either.
const MAX_LINES = 60;
let lines: string[] = [];
type Listener = () => void;
const listeners = new Set<Listener>();

// Notifying listeners synchronously on every single pushLog was itself
// causing the exact problem this file exists to measure: PerfOverlay
// re-rendering (up to 60 Text rows) on every new line can itself take a
// few ms, which can trip the watchdog's own threshold, which logs another
// line, which re-renders again — a burst of "real" stalls turning into a
// self-sustaining stream of ones the overlay caused just by being open and
// updating. Batching at most one re-render per this window breaks that
// loop, at the cost of the panel lagging the true event by up to this long.
const NOTIFY_THROTTLE_MS = 400;
let notifyScheduled = false;

function scheduleNotify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    listeners.forEach((l) => l());
  }, NOTIFY_THROTTLE_MS);
}

export function pushLog(line: string): void {
  const stamped = `${(performance.now() / 1000).toFixed(2)}s  ${line}`;
  lines = [...lines, stamped].slice(-MAX_LINES);
  scheduleNotify();
}

// For useSyncExternalStore in PerfOverlay — subscribe registers a
// re-render trigger, getSnapshot hands back the current (immutable) array.
export function subscribePerfLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPerfLogSnapshot(): string[] {
  return lines;
}

export function clearPerfLog(): void {
  lines = [];
  listeners.forEach((l) => l());
}
