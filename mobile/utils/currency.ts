import { getCurrency } from "../constants/currencies";

export function formatCurrency(amount: number, currencyCode: string): string {
  return `${amount.toFixed(2)} ${getCurrency(currencyCode).code}`;
}
