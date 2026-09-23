function parseHex(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function toHexColor(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.round(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Standard perceptual luma weighting — blue contributes far less to
// perceived brightness than red or green, so a "medium blue" and a "medium
// orange" at the same raw RGB distance from white can look very
// differently dark to the eye. This is why a flat "mix N% toward white"
// made blues specifically still read as murky while other hues looked
// fine — it corrects the same raw RGB amount regardless of hue, but hue
// matters for perceived brightness.
function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Blends a #RRGGBB hex color toward white by `amount` (0-1) — used to lift a
// user-chosen category color (stored once, theme-independent) so it stays
// readable against dark surfaces instead of looking muddy/low-contrast.
export function mixWithWhite(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const mix = (c: number) => c + (255 - c) * amount;
  return toHexColor(mix(r), mix(g), mix(b));
}

// Brightens a color toward white just enough that its *perceived*
// brightness reaches `targetLuminance` (0-1) — rather than a flat mix
// percentage, this adapts per color: an inherently dark-reading hue (blue)
// gets pushed further than one that already reads brighter at the same mix
// amount (orange, teal), so the whole category palette ends up roughly as
// legible as each other against a dark surface instead of blues lagging
// behind.
export function brightenToLuminance(hex: string, targetLuminance: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const current = luminance(r, g, b);
  if (current >= targetLuminance) return hex;
  // Mixing every channel toward 255 by `amount` moves luminance linearly
  // from `current` to 1 (white's luminance), so this is the exact amount
  // needed to land exactly on the target.
  const amount = (targetLuminance - current) / (1 - current);
  return mixWithWhite(hex, Math.min(1, Math.max(0, amount)));
}

// A category's custom color is stored once, picked from a fixed swatch —
// not theme-aware — so every place that renders one directly (category
// chips/dots/icons, as opposed to TransactionList's own row icons) needs
// the same dark-mode brightening, or a "dark blue" swatch stays murky
// everywhere except the transaction list. `fallback` is only used when no
// custom color is set, and is expected to already be a theme-aware token
// (Colors.primary etc.), so it's never brightened itself.
export function themedCategoryColor(
  rawColor: string | null | undefined,
  fallback: string,
  isDark: boolean,
): string {
  if (!rawColor) return fallback;
  return isDark ? brightenToLuminance(rawColor, 0.62) : rawColor;
}
