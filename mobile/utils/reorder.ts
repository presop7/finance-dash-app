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
