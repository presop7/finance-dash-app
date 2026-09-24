// Calls `onIdle` once the JS thread has come back on time for `quietFrames`
// consecutive frames (a frame-to-frame gap under ~24ms, i.e. nothing else was
// hogging the thread), or after `maxWaitMs` regardless, so it can never wait
// forever. Returns a cancel function.
//
// Lets work that suffers from JS-thread contention (an animation whose
// frames ride on the JS thread, say) start in a genuinely quiet window
// instead of after a fixed delay that's only a guess about when other work
// will have finished.
export function waitForJsIdle(onIdle: () => void, quietFrames = 10, maxWaitMs = 1800): () => void {
  let cancelled = false;
  let rafId = 0;
  const startedAt = performance.now();
  let last = startedAt;
  let quiet = 0;

  const check = () => {
    if (cancelled) return;
    const now = performance.now();
    quiet = now - last < 24 ? quiet + 1 : 0;
    last = now;
    if (quiet >= quietFrames || now - startedAt > maxWaitMs) {
      onIdle();
      return;
    }
    rafId = requestAnimationFrame(check);
  };
  rafId = requestAnimationFrame(check);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}
