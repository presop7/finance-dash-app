// Search that doesn't need the exact wording: every word typed must appear
// somewhere (in any order) in the text — e.g. "pazar metro" finds "Metro
// пазар". Case, accents and extra spaces don't matter.
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function searchWords(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

export function matchesWords(words: string[], ...texts: (string | undefined)[]): boolean {
  if (words.length === 0) return true;
  const haystack = fold(texts.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}
