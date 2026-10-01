// The app's text sizes — every fontSize in the app comes from here, so the
// phone apps and the web version read the same everywhere. Nothing is
// smaller than `label`.
export const FONT = {
  label: 11, // small uppercase section labels, tiny counters and badges
  small: 13, // secondary lines: subtitles, "category · date", hints, chart amounts
  body: 15, // the main text you read: row titles, amounts, list items, chips, buttons
  field: 16, // typing fields, and figures that stand out in a row
  title: 18, // sheet and dialog titles
  heading: 22, // screen titles
  display: 26, // the logo title, a single big amount
  hero: 32, // the balance
} as const;
