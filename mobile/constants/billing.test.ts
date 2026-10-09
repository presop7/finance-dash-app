import { withAmount } from "./billing";

test("withAmount keeps the store's currency and style", () => {
  expect(withAmount("€37.99", 3.1658)).toBe("€3.17");
  expect(withAmount("37,99 €", 3.1658)).toBe("3,17 €");
  expect(withAmount("12,99 лв.", 1.08)).toBe("1,08 лв.");
  expect(withAmount("US$4.99", 59.88)).toBe("US$59.88");
});
