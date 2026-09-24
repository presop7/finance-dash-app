import { useCallback, useRef } from "react";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";

// TEMPORARY diagnostic — remove once the Analytics toggle animation
// jank is understood. Measures frame gaps on both threads during a window
// after begin(): the UI thread (via a Reanimated frame callback) and the JS
// thread (via requestAnimationFrame), and logs a one-line summary plus the
// timestamps passed to mark(). A 60fps frame is ~16.7ms, so gaps well above
// that are dropped frames.
export function usePerfProbe(windowMs = 2500) {
  const uiFrames = useSharedValue(0);
  const uiMax = useSharedValue(0);
  const uiSlow = useSharedValue(0);
  const uiVerySlow = useSharedValue(0);
  const marks = useRef<[string, number][]>([]);
  const start = useRef(0);
  const running = useRef(false);

  const uiCallback = useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame;
    if (dt == null) return;
    uiFrames.value += 1;
    if (dt > uiMax.value) uiMax.value = dt;
    if (dt > 25) uiSlow.value += 1;
    if (dt > 40) uiVerySlow.value += 1;
  }, false);

  const begin = useCallback(() => {
    if (running.current) return;
    running.current = true;
    uiFrames.value = 0;
    uiMax.value = 0;
    uiSlow.value = 0;
    uiVerySlow.value = 0;
    marks.current = [];
    start.current = performance.now();
    uiCallback.setActive(true);

    let last = start.current;
    let frames = 0;
    let max = 0;
    let slow = 0;
    let verySlow = 0;
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      frames += 1;
      if (dt > max) max = dt;
      if (dt > 25) slow += 1;
      if (dt > 40) verySlow += 1;
      if (now - start.current < windowMs) {
        requestAnimationFrame(tick);
        return;
      }
      uiCallback.setActive(false);
      running.current = false;
      const fmt = (n: number) => Math.round(n);
      console.log(
        `[perf] ${windowMs}ms window | UI thread: frames=${uiFrames.value} maxGap=${fmt(uiMax.value)}ms >25ms=${uiSlow.value} >40ms=${uiVerySlow.value} | JS thread: frames=${frames} maxGap=${fmt(max)}ms >25ms=${slow} >40ms=${verySlow} | marks: ${marks.current
          .map(([name, at]) => `${name}@${at}ms`)
          .join(", ")}`,
      );
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMs]);

  const mark = useCallback((name: string) => {
    if (!running.current) return;
    marks.current.push([name, Math.round(performance.now() - start.current)]);
  }, []);

  return { begin, mark };
}
