// Items in the user's chosen order (ids in `order`); items missing from it
// (e.g. newly created) go after, in their normal order.
export function sortByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id));
}

// Moves `id` into `target`'s spot; everything in between shifts by one.
export function moveTo(order: string[], id: string, target: string): string[] {
  const next = order.filter((o) => o !== id);
  next.splice(order.indexOf(target), 0, id);
  return next;
}

// Saves one list's new order into the order of several lists (expense and
// income categories share one), keeping the other lists' ids.
export function mergeOrder(saved: string[], ids: string[]): string[] {
  return [...ids, ...saved.filter((id) => !ids.includes(id))];
}

export type Size = { width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number; line: number };
export type Flow = { left: number; top: number; gap: number; maxRight: number };

// Where items land in a row that wraps at maxRight (Infinity: one line, a
// horizontal strip) — how flexDirection row + flexWrap + gap lays them out.
export function flowLayout(order: string[], sizes: Map<string, Size>, f: Flow): Map<string, Box> {
  const boxes = new Map<string, Box>();
  let x = f.left;
  let y = f.top;
  let line = 0;
  let lineHeight = 0;
  for (const id of order) {
    const s = sizes.get(id) ?? { width: 0, height: 0 };
    if (x > f.left && x + s.width > f.maxRight) {
      x = f.left;
      y += lineHeight + f.gap;
      line += 1;
      lineHeight = 0;
    }
    boxes.set(id, { x, y, width: s.width, height: s.height, line });
    x += s.width + f.gap;
    lineHeight = Math.max(lineHeight, s.height);
  }
  return boxes;
}

// The dragged item swaps with a neighbour once the finger passes that
// neighbour's middle (in reading order: line by line, then across) — and is
// laid out again after each swap, so it never flips straight back however
// different the items' widths are.
export function dragStep(
  order: string[],
  dragId: string,
  finger: { x: number; y: number },
  layout: (order: string[]) => Map<string, Box>,
): string[] {
  let current = order;
  for (let guard = 0; guard < order.length; guard++) {
    const boxes = layout(current);
    // The line the finger is on (or nearest to).
    let fingerLine = 0;
    let best = Infinity;
    for (const b of boxes.values()) {
      const d = finger.y < b.y ? b.y - finger.y : finger.y > b.y + b.height ? finger.y - b.y - b.height : 0;
      if (d < best) {
        best = d;
        fingerLine = b.line;
      }
    }
    const reading = (line: number, x: number) => line * 1e7 + x;
    const at = reading(fingerLine, finger.x);
    const mid = (id: string) => {
      const b = boxes.get(id)!;
      return reading(b.line, b.x + b.width / 2);
    };
    const i = current.indexOf(dragId);
    const next = current[i + 1];
    const prev = current[i - 1];
    if (next !== undefined && at > mid(next)) current = moveTo(current, dragId, next);
    else if (prev !== undefined && at < mid(prev)) current = moveTo(current, dragId, prev);
    else break;
  }
  return current;
}
