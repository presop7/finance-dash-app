// Best-effort name from the login email's local part (before the @) — e.g.
// "presiyan.peev97@gmail.com" -> "Presiyan". Splits on common separators
// and digits and takes the first chunk, since that's usually the actual
// first name; falls back to the whole local part if that leaves nothing
// (e.g. "info@x.com" -> "Info").
export function nameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  const [first] = local.split(/[._\-+0-9]+/).filter(Boolean);
  const raw = first || local;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// A few reassuring late-night lines rather than one fixed string, so it
// doesn't get stale for anyone who's a regular night owl.
const LATE_NIGHT_MESSAGES = [
  "Still up? Your finances are safe and sound",
  "Burning the midnight oil — your balance is right where you left it",
  "Late-night check-in? Everything's still in order",
];

// Trailing comma is baked in here rather than added by the caller — the
// late-night lines are full sentences and don't want one, unlike the
// time-band greetings, which read as "Good morning, <name>". The emoji
// differs too: a wave for a normal greeting, a night owl for late night.
export function getGreeting(now: Date = new Date()): { text: string; emoji: string } {
  const hour = now.getHours();
  if (hour >= 6 && hour < 12) return { text: "Good morning,", emoji: "👋" };
  if (hour >= 12 && hour < 18) return { text: "Good afternoon,", emoji: "👋" };
  if (hour >= 18) return { text: "Good evening,", emoji: "👋" };
  // 00:00-06:00 — pick deterministically off the date so it's stable within
  // a single night rather than changing on every re-render.
  const index = now.getDate() % LATE_NIGHT_MESSAGES.length;
  return { text: LATE_NIGHT_MESSAGES[index], emoji: "🦉" };
}
