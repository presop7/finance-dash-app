// TEMPORARY diagnostic — remove once the current performance pass is done.
// Two pieces:
//
// 1. `perfTag(name)` — drop this at the start of any interesting bit of
//    work (a handler, an effect, a mount) across the app. It's cheap (just
//    records a name + timestamp) so it's fine to sprinkle liberally; it
//    doesn't do anything by itself.
// 2. `startPerfWatchdog()` — call this once, near the app's root. It runs an
//    always-on requestAnimationFrame loop and logs any JS-thread frame gap
//    over WARN_MS, together with whichever perfTag()s fired in the leadup —
//    so a freeze gets caught and roughly attributed even when nobody
//    thought to wrap that specific interaction in usePerfProbe() ahead of
//    time.
//
// Deliberately NOT gated on __DEV__ — this performance pass is specifically
// run with `--no-dev --minify` (closer to real device performance than a
// dev bundle), which sets __DEV__ false, and a __DEV__ check would silently
// disable this exactly when it's being used. Flip ENABLED to false instead
// once this diagnostic pass is done, ahead of deleting the file entirely.
import { pushLog } from "./perfLogSink";

const ENABLED = true;
// A 60fps frame is ~16.7ms — a gap past that is already a dropped frame,
// well below what reads as an obvious "freeze". Lowered from 50 now that
// the big freezes are gone, to actually catch the "micro" ones being
// chased next.
const WARN_MS = 24;
const HISTORY_SIZE = 8;
// A tag older than this by the time a gap is logged is probably unrelated —
// keeps a freeze from being blamed on whatever happened to tag last, ages ago.
const RELEVANT_WINDOW_MS = 1500;

type TagEntry = { name: string; at: number };
const history: TagEntry[] = [];

export function perfTag(name: string): void {
  if (!ENABLED) return;
  history.push({ name, at: performance.now() });
  if (history.length > HISTORY_SIZE) history.shift();
}

let started = false;

export function startPerfWatchdog(): void {
  if (!ENABLED || started) return;
  started = true;

  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (dt > WARN_MS) {
      const recent = history
        .filter((h) => now - h.at < RELEVANT_WINDOW_MS)
        .map((h) => `${h.name}(-${Math.round(now - h.at)}ms)`)
        .join(", ");
      const msg = `[perf-watchdog] JS thread stalled ${Math.round(dt)}ms${recent ? ` — recent: ${recent}` : " — no recent tag, likely native/UI-thread work or a cold mount"}`;
      console.warn(msg);
      pushLog(msg);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
