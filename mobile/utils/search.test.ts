import { matchesWords, searchWords } from "./search";

test("every word, any order, any case, accents ignored", () => {
  const has = (q: string) => matchesWords(searchWords(q), "Metro пазар с брата от него 30", "Храна за вкъщи");
  expect(has("пазар metro")).toBe(true);
  expect(has("  METRO   брат ")).toBe(true);
  expect(has("храна 30")).toBe(true); // category and title together
  expect(has("metro lidl")).toBe(false);
  expect(has("")).toBe(true);
  expect(matchesWords(searchWords("cafe"), "Café de Paris")).toBe(true);
});
