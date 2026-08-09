export type Currency = {
  code: string;
  symbol: string;
  label: string;
};

export const CURRENCIES: Currency[] = [
  { code: "BGN", symbol: "лв", label: "Bulgarian Lev" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "CHF", symbol: "Fr", label: "Swiss Franc" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CAD", symbol: "$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "$", label: "Australian Dollar" },
  { code: "RON", symbol: "lei", label: "Romanian Leu" },
  { code: "PLN", symbol: "zł", label: "Polish Zloty" },
  { code: "TRY", symbol: "₺", label: "Turkish Lira" },
  { code: "SEK", symbol: "kr", label: "Swedish Krona" },
];

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
