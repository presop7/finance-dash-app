/// <reference types="jest" />
// New-user currency guess. Run: npm test
import { detectCurrency } from "./detectCurrency";

test("the time zone wins over the phone's language setting", () => {
  expect(detectCurrency("Europe/Sofia", "en-US")).toBe("EUR"); // Bulgarian phone in English
  expect(detectCurrency("Europe/London", "bg-BG")).toBe("GBP");
  expect(detectCurrency("America/Chicago", "en-US")).toBe("USD");
  expect(detectCurrency("Asia/Seoul", "ko-KR")).toBe("KRW");
  expect(detectCurrency("Australia/Sydney", "en-AU")).toBe("AUD");
});

test("falls back to the language region, else gives up so the app asks", () => {
  expect(detectCurrency("Etc/UTC", "de-AT")).toBe("EUR");
  expect(detectCurrency("Etc/UTC", "pl-PL")).toBe("PLN");
  expect(detectCurrency("Etc/UTC", "en")).toBeNull(); // no region at all
  expect(detectCurrency("Asia/Kolkata", "hi-IN")).toBeNull(); // not a currency the app offers
});
