// Today's exchange rate between two of the app's currencies (1 `from` =
// rate `to`), from open.er-api.com: free, no key, updated daily, and it
// covers every currency in constants/currencies.ts (BGN, RSD and UAH too,
// which the ECB-based services lack).
export async function fetchExchangeRate(from: string, to: string): Promise<number> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
  const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
  const rate = data.rates?.[to];
  if (data.result !== "success" || !rate || !(rate > 0)) throw new Error(`No rate for ${from} → ${to}`);
  return rate;
}
