import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { isDesktopWeb } from "../utils/webPlatform";

// Hold-and-drag multi-select for the web version on touchscreens (phone
// browsers, the installed home-screen app). The gesture library can't take a
// finger over from the browser's own scrolling reliably, so this works with
// the browser directly:
//   - Touch, then move before HOLD_MS: a normal scroll, left to the browser.
//   - Hold still for HOLD_MS: a drag starts. From then on the browser isn't
//     allowed to scroll (it hasn't started yet, so it still honours that),
//     and the row under the finger is found from the page itself
//     (elementFromPoint) — always the row actually under the finger.
//   - Finger near the top/bottom edge while dragging: the list auto-scrolls,
//     a steady step per frame, and whatever passes under the finger is
//     reported too.
// Rows must carry data-rowid (see AnalyticsScreen's select-mode rows).

const HOLD_MS = 250;
const MOVE_TOLERANCE = 10; // px of wobble allowed during the hold
const EDGE_ZONE = 60; // px from the list's top/bottom that auto-scroll
const STEP_PER_FRAME = 9; // px

export const isTouchWeb = Platform.OS === "web" && !isDesktopWeb;

type Handlers = {
  onStart: (rowId: string) => void; // the row the hold landed on
  onOver: (rowId: string) => void; // a row the finger is now over
  onEnd: () => void;
};

export function useWebTouchDragSelect(
  enabled: boolean,
  getScrollNode: () => HTMLElement | null | undefined,
  handlers: Handlers,
) {
  // Latest handlers without re-attaching listeners on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isTouchWeb || !enabled) return;
    const node = getScrollNode();
    if (!node?.addEventListener) return;

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let frame: number | null = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let x = 0;
    let y = 0;

    const rowAt = (px: number, py: number): string | null => {
      const el = document.elementFromPoint(px, py) as HTMLElement | null;
      return el?.closest?.("[data-rowid]")?.getAttribute("data-rowid") ?? null;
    };

    const autoScroll = () => {
      if (!dragging) return;
      const rect = node.getBoundingClientRect();
      const direction = y < rect.top + EDGE_ZONE ? -1 : y > rect.bottom - EDGE_ZONE ? 1 : 0;
      if (direction !== 0) {
        const before = node.scrollTop;
        node.scrollTop = before + direction * STEP_PER_FRAME;
        if (node.scrollTop !== before) {
          const id = rowAt(x, y);
          if (id) handlersRef.current.onOver(id);
        }
      }
      frame = requestAnimationFrame(autoScroll);
    };

    const stop = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (dragging) {
        dragging = false;
        handlersRef.current.onEnd();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      stop();
      if (e.touches.length !== 1) return;
      startX = x = e.touches[0].clientX;
      startY = y = e.touches[0].clientY;
      holdTimer = setTimeout(() => {
        holdTimer = null;
        const id = rowAt(x, y);
        if (!id) return;
        dragging = true;
        handlersRef.current.onStart(id);
        frame = requestAnimationFrame(autoScroll);
      }, HOLD_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
      if (!dragging) {
        // Moved before the hold completed: it's a scroll — let it be one.
        if (holdTimer && Math.hypot(x - startX, y - startY) > MOVE_TOLERANCE) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        return;
      }
      if (e.cancelable) e.preventDefault(); // dragging: no browser scrolling
      const id = rowAt(x, y);
      if (id) handlersRef.current.onOver(id);
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", stop);
    node.addEventListener("touchcancel", stop);
    return () => {
      stop();
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", stop);
      node.removeEventListener("touchcancel", stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
