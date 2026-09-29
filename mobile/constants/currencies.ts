export type Currency = {
  code: string;
  symbol: string;
  label: string;
};

export const CURRENCIES: Currency[] = [
  { code: "EUR", symbol: "€", label: "Euro" },
  // Replaced by the euro in 2026; kept for accounts that still use it.
  { code: "BGN", symbol: "лв", label: "Bulgarian Lev" },
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
  { code: "NOK", symbol: "kr", label: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", label: "Danish Krone" },
  { code: "CZK", symbol: "Kč", label: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", label: "Hungarian Forint" },
  { code: "RSD", symbol: "дин", label: "Serbian Dinar" },
  { code: "UAH", symbol: "₴", label: "Ukrainian Hryvnia" },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan" },
  { code: "KRW", symbol: "₩", label: "South Korean Won" },
  { code: "NZD", symbol: "$", label: "New Zealand Dollar" },
];

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
