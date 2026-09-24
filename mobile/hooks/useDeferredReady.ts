import { useEffect, useState } from "react";

// Modal bodies with lots of chips/rows are expensive to mount, and mounting
// them in the same moment the native slide-in starts blocks the JS thread
// long enough that the animation gets skipped (the sheet just pops in).
// This flips to true shortly after `visible` does — roughly once the slide
// has settled — so a modal can render its light shell immediately and mount
// the heavy body afterward, with a skeleton standing in meanwhile. Resets on
// close so every open repeats the same sequence.
export function useDeferredReady(visible: boolean, delayMs = 300): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [visible, delayMs]);

  return ready;
}
