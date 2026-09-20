import Papa from "papaparse";
import * as Crypto from "expo-crypto";
import { Category } from "../constants/categories";
import { FundCategory } from "../constants/fundCategories";
import { DateFormat, parseDateString } from "./formatDateTime";
import { ApiTransactionCreate } from "../services/financeApi";

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const [headers, ...rows] = result.data;
  return { headers: headers ?? [], rows };
}

export type ColumnMapping = {
  date: number;
  title: number;
  amount: number;
  category: number;
  fund: number;
  // -1 means "not mapped" (Note is the only optional field).
  note: number;
};

export type MainType = "income" | "expense";

const normalize = (text: string) => text.trim().toLowerCase();

// Amount parsing tolerates common export conventions: currency symbols/
// letters, "(50.00)" as a negative-amount convention, and both "1,234.56"
// and "1.234,56" thousands/decimal styles.
export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isParenNegative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[()]/g, "").replace(/[^0-9.,-]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    // "12,50" (decimal) vs "1,234" (thousands) — a trailing 2-digit comma
    // group reads as decimal, anything else as a thousands separator.
    normalized = /,\d{2}$/.test(cleaned) ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) return null;
  return isParenNegative ? -Math.abs(value) : value;
}

// A distinct category/fund text value found in the CSV that doesn't match an
// existing category/fund by name and needs the user to resolve it manually.
export type UnresolvedValue = {
  key: string;
  text: string;
  kind: "category" | "fund";
  // Only set for kind "category" — categories are type-scoped (separate
  // expense/income lists), so the same text can need two different mappings
  // depending on which rows it shows up in.
  mainType?: MainType;
  rowCount: number;
};

export function resolveDistinctValues(
  rows: string[][],
  mapping: ColumnMapping,
  expenseCategories: Category[],
  incomeCategories: Category[],
  fundCategories: FundCategory[],
): { unresolved: UnresolvedValue[]; autoResolved: Map<string, string> } {
  const categoryCounts = new Map<string, { text: string; mainType: MainType; count: number }>();
  const fundCounts = new Map<string, { text: string; count: number }>();

  for (const row of rows) {
    const amount = parseAmount(row[mapping.amount] ?? "");
    if (amount === null) continue;
    const mainType: MainType = amount < 0 ? "expense" : "income";

    const categoryText = (row[mapping.category] ?? "").trim();
    if (categoryText) {
      const key = `category:${mainType}:${normalize(categoryText)}`;
      const entry = categoryCounts.get(key);
      if (entry) entry.count += 1;
      else categoryCounts.set(key, { text: categoryText, mainType, count: 1 });
    }

    const fundText = (row[mapping.fund] ?? "").trim();
    if (fundText) {
      const key = `fund:${normalize(fundText)}`;
      const entry = fundCounts.get(key);
      if (entry) entry.count += 1;
      else fundCounts.set(key, { text: fundText, count: 1 });
    }
  }

  const autoResolved = new Map<string, string>();
  const unresolved: UnresolvedValue[] = [];

  for (const [key, { text, mainType, count }] of categoryCounts) {
    const list = mainType === "expense" ? expenseCategories : incomeCategories;
    const match = list.find((c) => normalize(c.label) === normalize(text));
    if (match) autoResolved.set(key, match.id);
    else unresolved.push({ key, text, kind: "category", mainType, rowCount: count });
  }

  for (const [key, { text, count }] of fundCounts) {
    const match = fundCategories.find((f) => normalize(f.name) === normalize(text));
    if (match) autoResolved.set(key, match.id);
    else unresolved.push({ key, text, kind: "fund", rowCount: count });
  }

  return { unresolved, autoResolved };
}

export const categoryKey = (mainType: MainType, text: string) =>
  `category:${mainType}:${normalize(text)}`;
export const fundKey = (text: string) => `fund:${normalize(text)}`;

export type BuiltRow =
  | { ok: true; payload: ApiTransactionCreate }
  | { ok: false; rowIndex: number; reason: string };

// resolutionMap must cover every key resolveDistinctValues() either
// auto-resolved or returned as unresolved (the caller fills the gaps from
// the review step) — any row referencing a key that's still missing here
// fails with a clear reason rather than silently dropping data.
export function buildImportPayload(
  rows: string[][],
  mapping: ColumnMapping,
  dateFormat: DateFormat,
  conversionRate: number,
  appCurrency: string,
  resolutionMap: Map<string, string>,
): BuiltRow[] {
  return rows.map((row, rowIndex) => {
    const dateRaw = row[mapping.date] ?? "";
    const date = parseDateString(dateRaw, dateFormat);
    if (!date) return { ok: false, rowIndex, reason: `Unrecognized date "${dateRaw}"` };

    const amountRaw = row[mapping.amount] ?? "";
    const amount = parseAmount(amountRaw);
    if (amount === null || amount === 0) {
      return { ok: false, rowIndex, reason: `Unrecognized amount "${amountRaw}"` };
    }

    const mainType: MainType = amount < 0 ? "expense" : "income";

    const categoryText = (row[mapping.category] ?? "").trim();
    const categoryId = resolutionMap.get(categoryKey(mainType, categoryText));
    if (!categoryId) {
      return { ok: false, rowIndex, reason: `Unresolved category "${categoryText}"` };
    }

    const fundText = (row[mapping.fund] ?? "").trim();
    const fundId = resolutionMap.get(fundKey(fundText));
    if (!fundId) return { ok: false, rowIndex, reason: `Unresolved fund/account "${fundText}"` };

    const title = (row[mapping.title] ?? "").trim() || "Imported transaction";
    const note = mapping.note >= 0 ? (row[mapping.note] ?? "").trim() : "";

    return {
      ok: true,
      payload: {
        title,
        fund_category_id: fundId,
        category_id: categoryId,
        amount: Math.abs(amount) * conversionRate,
        currency: appCurrency,
        type: mainType,
        note: note || null,
        occurred_at: date.toISOString(),
        client_generated_id: Crypto.randomUUID(),
      },
    };
  });
}
