// Generated (not the category's own stored swatch) chart palette: every
// expense category is drawn from the warm half of the color wheel (purple
// through red/orange to yellow), every income category from the cool half
// (yellow-green through green/teal to blue) — so on a mixed pie, which half
// a slice sits in tells you money-out vs money-in at a glance, on top of
// its own hue distinguishing the category. Picked deterministically from
// the category's id so a given category always lands on the same color
// instead of reshuffling on every render.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const EXPENSE_HUE_START = 280; // purple
const EXPENSE_HUE_SPAN = 140; // wraps through 360/0 up to 60 (yellow)
const INCOME_HUE_START = 90; // yellow-green
const INCOME_HUE_SPAN = 150; // up to 240 (blue)

export function categoryChartColor(key: string, kind: "expense" | "income"): string {
  const hash = hashString(key);
  const t = (hash % 997) / 997;
  const sat = 62 + (Math.floor(hash / 997) % 22); // 62-83
  const light = 46 + (Math.floor(hash / 104729) % 14); // 46-59
  const hue =
    kind === "expense"
      ? (EXPENSE_HUE_START + t * EXPENSE_HUE_SPAN) % 360
      : INCOME_HUE_START + t * INCOME_HUE_SPAN;
  return hslToHex(hue, sat, light);
}
