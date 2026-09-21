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

// How income vs. expense is decided for each row. Not every CSV uses signed
// amounts the same way (or at all) — some export everything positive, some
// invert the usual convention, some are single-type exports, some carry a
// separate debit/credit-style column — so this is a user choice, not an
// automatic assumption.
export type TypeResolution =
  | { mode: "sign" } // negative amount = expense (the common convention)
  | { mode: "sign-inverted" } // negative amount = income
  | { mode: "all-expense" } // every row in the file is an expense
  | { mode: "all-income" } // every row in the file is income
  | {
      mode: "column";
      columnIndex: number;
      // Fallback when a column value doesn't match a recognized keyword.
      fallback: MainType;
    };

const TYPE_KEYWORDS: Record<MainType, string[]> = {
  expense: ["expense", "debit", "withdrawal", "purchase", "spend", "payment", "out"],
  income: ["income", "credit", "deposit", "receipt", "refund", "in"],
};

export function resolveMainType(
  row: string[],
  amount: number,
  typeResolution: TypeResolution,
): MainType {
  switch (typeResolution.mode) {
    case "sign":
      return amount < 0 ? "expense" : "income";
    case "sign-inverted":
      return amount < 0 ? "income" : "expense";
    case "all-expense":
      return "expense";
    case "all-income":
      return "income";
    case "column": {
      const normalized = normalize(row[typeResolution.columnIndex] ?? "");
      for (const type of ["expense", "income"] as MainType[]) {
        if (TYPE_KEYWORDS[type].some((kw) => normalized.includes(kw))) return type;
      }
      return typeResolution.fallback;
    }
  }
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
  typeResolution: TypeResolution,
  expenseCategories: Category[],
  incomeCategories: Category[],
  fundCategories: FundCategory[],
): { unresolved: UnresolvedValue[]; autoResolved: Map<string, string> } {
  const categoryCounts = new Map<string, { text: string; mainType: MainType; count: number }>();
  const fundCounts = new Map<string, { text: string; count: number }>();

  for (const row of rows) {
    const amount = parseAmount(row[mapping.amount] ?? "");
    if (amount === null) continue;
    const mainType = resolveMainType(row, amount, typeResolution);

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

export type FailedField = "date" | "amount" | "category" | "fund";

export type RowIssue = {
  field: FailedField;
  // The CSV's own column header for the field that failed, so the user can
  // find it in their file without guessing which internal field name maps
  // to which column.
  header: string;
  rawValue: string;
  reason: string;
};

export type BuiltRow =
  | { ok: true; payload: ApiTransactionCreate }
  | {
      ok: false;
      rowIndex: number;
      // The row's own title, if it has one, so a failed row is identifiable
      // at a glance instead of just by its (1-indexed) position in the file.
      title: string;
      // Every problem with this row, not just the first one encountered —
      // a row missing both its amount and its category should say so, not
      // make the user fix one, re-check, and only then discover the next.
      issues: RowIssue[];
    };

// resolutionMap must cover every key resolveDistinctValues() either
// auto-resolved or returned as unresolved (the caller fills the gaps from
// the review step) — any row referencing a key that's still missing here
// fails with a clear reason rather than silently dropping data.
export function buildImportPayload(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  dateFormat: DateFormat,
  typeResolution: TypeResolution,
  conversionRate: number,
  appCurrency: string,
  resolutionMap: Map<string, string>,
): BuiltRow[] {
  return rows.map((row, rowIndex) => {
    const issues: RowIssue[] = [];
    const title = (row[mapping.title] ?? "").trim();

    const dateRaw = row[mapping.date] ?? "";
    const date = parseDateString(dateRaw, dateFormat);
    if (!date) {
      issues.push({
        field: "date",
        header: headers[mapping.date] ?? "Date",
        rawValue: dateRaw,
        reason: dateRaw.trim()
          ? `Doesn't match the selected date format (${dateFormat})`
          : "This cell is empty",
      });
    }

    const amountRaw = row[mapping.amount] ?? "";
    const amount = parseAmount(amountRaw);
    if (amount === null || amount === 0) {
      issues.push({
        field: "amount",
        header: headers[mapping.amount] ?? "Amount",
        rawValue: amountRaw,
        reason: amountRaw.trim() ? "Not recognized as a number" : "This cell is empty",
      });
    }
    // Category matching is type-scoped (expense vs. income categories are
    // separate lists), so it can only be checked once the amount parses —
    // an amount fix alone will surface any category problem on the next
    // pass rather than this one guessing at the wrong list.
    const mainType = amount !== null && amount !== 0 ? resolveMainType(row, amount, typeResolution) : null;

    const categoryText = (row[mapping.category] ?? "").trim();
    if (!categoryText) {
      issues.push({
        field: "category",
        header: headers[mapping.category] ?? "Category",
        rawValue: "",
        reason: "This cell is empty",
      });
    } else if (mainType && !resolutionMap.has(categoryKey(mainType, categoryText))) {
      issues.push({
        field: "category",
        header: headers[mapping.category] ?? "Category",
        rawValue: categoryText,
        reason: `"${categoryText}" wasn't matched to a category`,
      });
    }

    const fundText = (row[mapping.fund] ?? "").trim();
    if (!fundText) {
      issues.push({
        field: "fund",
        header: headers[mapping.fund] ?? "Fund/Account",
        rawValue: "",
        reason: "This cell is empty",
      });
    } else if (!resolutionMap.has(fundKey(fundText))) {
      issues.push({
        field: "fund",
        header: headers[mapping.fund] ?? "Fund/Account",
        rawValue: fundText,
        reason: `"${fundText}" wasn't matched to a fund/account`,
      });
    }

    if (issues.length > 0) {
      return { ok: false, rowIndex, title, issues };
    }

    const note = mapping.note >= 0 ? (row[mapping.note] ?? "").trim() : "";

    return {
      ok: true,
      payload: {
        title: title || "Imported transaction",
        fund_category_id: resolutionMap.get(fundKey(fundText))!,
        category_id: resolutionMap.get(categoryKey(mainType!, categoryText))!,
        amount: Math.abs(amount!) * conversionRate,
        currency: appCurrency,
        type: mainType!,
        note: note || null,
        occurred_at: date!.toISOString(),
        client_generated_id: Crypto.randomUUID(),
      },
    };
  });
}
