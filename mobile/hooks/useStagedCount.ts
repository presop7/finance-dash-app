import { useEffect, useState } from "react";

// Renders only the first `initial` items on the first pass and the rest one
// beat later — for long chip lists where only the first handful are on
// screen anyway, so the heavy first paint covers a fraction of the work and
// the remainder mounts once the UI has already appeared. `active` lets a
// caller that stays mounted across modal opens restart the staging every
// time it (re)opens instead of only the first time.
export function useStagedCount(total: number, initial: number, active = true): number {
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!active) {
      setFull(false);
      return;
    }
    const timer = setTimeout(() => setFull(true), 60);
    return () => clearTimeout(timer);
  }, [active]);

  return full ? total : Math.min(total, initial);
}
