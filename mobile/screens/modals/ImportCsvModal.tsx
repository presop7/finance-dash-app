import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, getThemedStyles } from "../../hooks/useThemeColors";
import { useFinanceStore } from "../../store/useFinanceStore";
import { CURRENCIES } from "../../constants/currencies";
import { DateFormat, DATE_FORMAT_PRESETS, formatDate } from "../../utils/formatDateTime";
import { alertAsync } from "../../utils/confirm";
import ModalCloseButton from "../../components/ModalCloseButton";
import { financeApi, ApiTransactionBulkResult } from "../../services/financeApi";
import {
  parseCsv,
  parseAmount,
  resolveMainType,
  resolveDistinctValues,
  buildImportPayload,
  categoryKey,
  fundKey,
  ColumnMapping,
  UnresolvedValue,
  BuiltRow,
  RowIssue,
  TypeResolution,
  MainType,
} from "../../utils/csvImport";

type ImportCsvModalProps = {
  visible: boolean;
  onClose: () => void;
};

type Step = "pick" | "mapping" | "review" | "preview" | "importing" | "results";

type FieldKey = "date" | "title" | "amount" | "category" | "fund" | "note";
const REQUIRED_FIELDS: Exclude<FieldKey, "note">[] = ["date", "title", "amount", "category", "fund"];
const FIELD_LABELS: Record<FieldKey, string> = {
  date: "Date",
  title: "Title",
  amount: "Amount",
  category: "Category",
  fund: "Fund / Account",
  note: "Note",
};
const HEADER_HINTS: Record<FieldKey, string[]> = {
  date: ["date", "posted", "transaction date"],
  title: ["title", "description", "name", "payee"],
  amount: ["amount", "value", "sum"],
  category: ["category", "type"],
  fund: ["account", "fund", "wallet", "source", "card"],
  note: ["note", "memo", "comment"],
};
const EMPTY_MAPPING: ColumnMapping = { date: -1, title: -1, amount: -1, category: -1, fund: -1, note: -1 };

type TypeMode = TypeResolution["mode"];
const TYPE_MODE_OPTIONS: { mode: TypeMode; label: string }[] = [
  { mode: "sign", label: "Negative = Expense" },
  { mode: "sign-inverted", label: "Negative = Income" },
  { mode: "all-expense", label: "Everything is Expense" },
  { mode: "all-income", label: "Everything is Income" },
  { mode: "column", label: "Use a column" },
];

function guessMapping(headers: string[]): ColumnMapping {
  const mapping = { ...EMPTY_MAPPING };
  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    (Object.keys(HEADER_HINTS) as FieldKey[]).forEach((field) => {
      if (mapping[field] !== -1) return;
      if (HEADER_HINTS[field].some((hint) => normalized.includes(hint))) {
        mapping[field] = index;
      }
    });
  });
  return mapping;
}

export default function ImportCsvModal({ visible, onClose }: ImportCsvModalProps) {
  const insets = useSafeAreaInsets();
  const {
    settings,
    isConnected,
    expenseCategories,
    incomeCategories,
    fundCategories,
    addExpenseCategory,
    addIncomeCategory,
    addFundCategory,
    hydrate,
  } = useFinanceStore();
  const Colors = useThemeColors();
  const styles = getThemedStyles(createStyles, Colors);

  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [typeMode, setTypeMode] = useState<TypeMode>("sign");
  const [typeColumn, setTypeColumn] = useState(-1);
  const [typeFallback, setTypeFallback] = useState<MainType>("expense");
  const [typeColumnDropdownOpen, setTypeColumnDropdownOpen] = useState(false);
  const [sameCurrency, setSameCurrency] = useState(true);
  const [csvCurrency, setCsvCurrency] = useState(settings.currency);
  const [rateText, setRateText] = useState("1");
  const [unresolved, setUnresolved] = useState<UnresolvedValue[]>([]);
  const [resolutionMap, setResolutionMap] = useState<Map<string, string>>(new Map());
  const [builtRows, setBuiltRows] = useState<BuiltRow[]>([]);
  const [importResult, setImportResult] = useState<ApiTransactionBulkResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [openMappingField, setOpenMappingField] = useState<FieldKey | null>(null);
  // Keyed by `${rowIndex}:${field}` since a row can have more than one issue.
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [creatingKeys, setCreatingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setStep("pick");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping(EMPTY_MAPPING);
    setDateFormat("DD/MM/YYYY");
    setTypeMode("sign");
    setTypeColumn(-1);
    setTypeFallback("expense");
    setTypeColumnDropdownOpen(false);
    setSameCurrency(true);
    setCsvCurrency(settings.currency);
    setRateText("1");
    setUnresolved([]);
    setResolutionMap(new Map());
    setBuiltRows([]);
    setImportResult(null);
    setImportError(null);
    setOpenMappingField(null);
    setEditValues({});
    setCreatingKeys(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv", "text/plain", "*/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      // Files are combined by column position, not by matching header text
      // (exports from the same source app are consistent about column order
      // even if headers vary slightly) — so only the first file's headers are
      // kept for display/mapping, and any file with a different column count
      // than the first can't be safely combined and is skipped.
      let combinedHeaders: string[] | null = null;
      let combinedRows: string[][] = [];
      const skipped: string[] = [];

      for (const asset of result.assets) {
        const text = await (await fetch(asset.uri)).text();
        const parsed = parseCsv(text);
        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          skipped.push(asset.name);
          continue;
        }
        if (!combinedHeaders) {
          combinedHeaders = parsed.headers;
        } else if (parsed.headers.length !== combinedHeaders.length) {
          skipped.push(asset.name);
          continue;
        }
        combinedRows = combinedRows.concat(parsed.rows);
      }

      if (!combinedHeaders || combinedRows.length === 0) {
        await alertAsync("Empty file", "None of the selected files had any rows to import.");
        return;
      }

      setFileName(
        result.assets.length === 1
          ? result.assets[0].name
          : `${result.assets.length - skipped.length} files, ${combinedRows.length} rows`,
      );
      setHeaders(combinedHeaders);
      setRows(combinedRows);
      setMapping(guessMapping(combinedHeaders));
      setStep("mapping");

      if (skipped.length > 0) {
        await alertAsync(
          "Some files skipped",
          `${skipped.join(", ")} ${skipped.length === 1 ? "was" : "were"} skipped (empty, or a different number of columns than the first file).`,
        );
      }
    } catch (err) {
      await alertAsync("Couldn't read file", err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const buildTypeResolution = (): TypeResolution => {
    switch (typeMode) {
      case "column":
        return { mode: "column", columnIndex: typeColumn, fallback: typeFallback };
      default:
        return { mode: typeMode };
    }
  };

  const handleMappingContinue = () => {
    const missing = REQUIRED_FIELDS.filter((f) => mapping[f] === -1);
    if (missing.length > 0) {
      alertAsync("Missing columns", `Please map: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}`);
      return;
    }
    if (typeMode === "column" && typeColumn === -1) {
      alertAsync("Missing column", "Pick which column tells income apart from expense.");
      return;
    }
    if (!sameCurrency && (!rateText || Number(rateText) <= 0)) {
      alertAsync("Missing conversion rate", "Enter how many of your app's currency one unit of the CSV's currency is worth.");
      return;
    }
    const { unresolved: found, autoResolved } = resolveDistinctValues(
      rows,
      mapping,
      buildTypeResolution(),
      expenseCategories,
      incomeCategories,
      fundCategories,
    );
    setResolutionMap(autoResolved);
    setUnresolved(found);
    if (found.length > 0) {
      setStep("review");
    } else {
      goToPreview(autoResolved);
    }
  };

  const goToPreview = (finalResolutionMap: Map<string, string>) => {
    const rate = sameCurrency ? 1 : Number(rateText) || 1;
    const built = buildImportPayload(
      rows,
      headers,
      mapping,
      dateFormat,
      buildTypeResolution(),
      rate,
      settings.currency,
      finalResolutionMap,
    );
    setBuiltRows(built);
    setStep("preview");
  };

  // Applies an inline fix from the Preview step's editable error cards:
  // writes the corrected value into that row's cell, and — for a category or
  // fund fix specifically — tries to resolve the corrected text against
  // existing categories/funds immediately, rather than only relying on
  // resolutionMap (which only has entries for text values that existed in
  // the CSV *before* this edit). Then re-runs buildImportPayload so the row
  // (and only that row, in practice) re-validates live.
  const handleFixRow = (rowIndex: number, issue: RowIssue, rawNewValue: string) => {
    const colIndex = mapping[issue.field];
    if (colIndex < 0) return;

    const newRows = rows.map((r, i) =>
      i === rowIndex ? r.map((c, ci) => (ci === colIndex ? rawNewValue : c)) : r,
    );
    setRows(newRows);

    let nextResolutionMap = resolutionMap;
    const trimmed = rawNewValue.trim();
    if (trimmed && (issue.field === "category" || issue.field === "fund")) {
      if (issue.field === "fund") {
        const match = fundCategories.find((f) => f.name.trim().toLowerCase() === trimmed.toLowerCase());
        if (match) nextResolutionMap = new Map(resolutionMap).set(fundKey(trimmed), match.id);
      } else {
        const amount = parseAmount(newRows[rowIndex][mapping.amount] ?? "");
        if (amount !== null) {
          const mainType = resolveMainType(newRows[rowIndex], amount, buildTypeResolution());
          const list = mainType === "expense" ? expenseCategories : incomeCategories;
          const match = list.find((c) => c.label.trim().toLowerCase() === trimmed.toLowerCase());
          if (match) nextResolutionMap = new Map(resolutionMap).set(categoryKey(mainType, trimmed), match.id);
        }
      }
      if (nextResolutionMap !== resolutionMap) setResolutionMap(nextResolutionMap);
    }

    const rate = sameCurrency ? 1 : Number(rateText) || 1;
    const rebuilt = buildImportPayload(
      newRows,
      headers,
      mapping,
      dateFormat,
      buildTypeResolution(),
      rate,
      settings.currency,
      nextResolutionMap,
    );
    setBuiltRows(rebuilt);
  };

  const resolveManually = (item: UnresolvedValue, id: string) => {
    setResolutionMap((prev) => new Map(prev).set(item.key, id));
  };

  const handleCreateNew = async (item: UnresolvedValue) => {
    // Guards the gap between tap and the create request actually landing:
    // without this, a user who doesn't see instant feedback taps again
    // (and again), creating duplicate categories from a single intent.
    if (creatingKeys.has(item.key) || resolutionMap.has(item.key)) return;
    setCreatingKeys((prev) => new Set(prev).add(item.key));
    try {
      if (item.kind === "fund") {
        await addFundCategory({ name: item.text, icon: "wallet-outline", color: Colors.primary });
        const created = useFinanceStore.getState().fundCategories.find((f) => f.name === item.text);
        if (created) resolveManually(item, created.id);
      } else {
        const addFn = item.mainType === "expense" ? addExpenseCategory : addIncomeCategory;
        await addFn({ label: item.text, icon: "pricetag-outline", color: Colors.primary });
        const list =
          item.mainType === "expense"
            ? useFinanceStore.getState().expenseCategories
            : useFinanceStore.getState().incomeCategories;
        const created = list.find((c) => c.label === item.text);
        if (created) resolveManually(item, created.id);
      }
    } catch (err) {
      await alertAsync("Couldn't create", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
    }
  };

  const handleReviewContinue = () => {
    const allResolved = unresolved.every((u) => resolutionMap.has(u.key));
    if (!allResolved) {
      alertAsync("Unresolved items", "Assign every category/fund below before continuing.");
      return;
    }
    goToPreview(resolutionMap);
  };

  const handleImport = async () => {
    const validPayloads = builtRows.filter((r) => r.ok).map((r) => (r.ok ? r.payload : null)!);
    setStep("importing");
    try {
      const result = await financeApi.bulkCreateTransactions(validPayloads);
      setImportResult(result);
      await hydrate();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setStep("results");
  };

  const handleDone = () => {
    onClose();
  };

  const validRows = builtRows.filter((r) => r.ok);
  const failedRows = builtRows.filter((r) => !r.ok);
  const previewIncome = validRows.reduce((s, r) => (r.ok && r.payload.type === "income" ? s + r.payload.amount : s), 0);
  const previewExpense = validRows.reduce((s, r) => (r.ok && r.payload.type === "expense" ? s + r.payload.amount : s), 0);

  const titleForStep: Record<Step, string> = {
    pick: "Import CSV",
    mapping: "Map Columns",
    review: "Match Categories",
    preview: "Review Import",
    importing: "Importing…",
    results: "Import Complete",
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* android.softwareKeyboardLayoutMode isn't set in app.json, so
          Android has no native window-resize to lean on here — "height"
          drives the push-up directly instead of assuming one exists. */}
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{titleForStep[step]}</Text>
          {step !== "importing" && <ModalCloseButton onPress={onClose} hitSlop={8} />}
        </View>

        {step === "pick" && (
          <View style={styles.centerBody}>
            {!isConnected ? (
              <>
                <Ionicons name="cloud-offline-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.blockedText}>
                  Importing needs an internet connection. Reconnect and try again.
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={40} color={Colors.primary} />
                <Text style={styles.pickIntro}>
                  Choose one or more CSV files exported from another app (they'll be combined,
                  so they need the same columns in the same order). You'll be able to tell us
                  which column is which before anything is imported.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={handlePickFile}>
                  <Text style={styles.primaryBtnText}>Choose CSV File(s)</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {step === "mapping" && (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
            <Text style={styles.fileLabel}>{fileName}</Text>
            <Text style={styles.sectionLabel}>Map Your Columns</Text>
            {(["date", "title", "amount", "category", "fund"] as FieldKey[]).map((field) => (
              <View key={field} style={styles.mappingRow}>
                <Text style={styles.mappingLabel}>{FIELD_LABELS[field]}</Text>
                <TouchableOpacity
                  style={styles.mappingTrigger}
                  onPress={() => setOpenMappingField((f) => (f === field ? null : field))}
                >
                  <Text style={styles.mappingTriggerText}>
                    {mapping[field] >= 0 ? headers[mapping[field]] : "Select a column"}
                  </Text>
                  <Ionicons
                    name={openMappingField === field ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
                {openMappingField === field && (
                  <ScrollView style={styles.dropdown} nestedScrollEnabled>
                    {headers.map((header, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setMapping((m) => ({ ...m, [field]: index }));
                          setOpenMappingField(null);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{header}</Text>
                        {mapping[field] === index && (
                          <Ionicons name="checkmark" size={14} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ))}

            <View style={styles.mappingRow}>
              <Text style={styles.mappingLabel}>Note (optional)</Text>
              <TouchableOpacity
                style={styles.mappingTrigger}
                onPress={() => setOpenMappingField((f) => (f === "note" ? null : "note"))}
              >
                <Text style={styles.mappingTriggerText}>
                  {mapping.note >= 0 ? headers[mapping.note] : "None"}
                </Text>
                <Ionicons
                  name={openMappingField === "note" ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {openMappingField === "note" && (
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setMapping((m) => ({ ...m, note: -1 }));
                      setOpenMappingField(null);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>None</Text>
                    {mapping.note === -1 && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                  </TouchableOpacity>
                  {headers.map((header, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setMapping((m) => ({ ...m, note: index }));
                        setOpenMappingField(null);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{header}</Text>
                      {mapping.note === index && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <Text style={styles.sectionLabel}>How to Tell Income From Expense</Text>
            <View style={styles.chipRow}>
              {TYPE_MODE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.mode}
                  style={[styles.chip, typeMode === opt.mode && styles.chipActive]}
                  onPress={() => setTypeMode(opt.mode)}
                >
                  <Text style={[styles.chipText, typeMode === opt.mode && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {typeMode === "column" && (
              <View style={styles.mappingRow}>
                <Text style={[styles.mappingLabel, { marginTop: 12 }]}>Type Column</Text>
                <TouchableOpacity
                  style={styles.mappingTrigger}
                  onPress={() => setTypeColumnDropdownOpen((v) => !v)}
                >
                  <Text style={styles.mappingTriggerText}>
                    {typeColumn >= 0 ? headers[typeColumn] : "Select a column"}
                  </Text>
                  <Ionicons
                    name={typeColumnDropdownOpen ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
                {typeColumnDropdownOpen && (
                  <ScrollView style={styles.dropdown} nestedScrollEnabled>
                    {headers.map((header, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setTypeColumn(index);
                          setTypeColumnDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{header}</Text>
                        {typeColumn === index && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <Text style={[styles.mappingLabel, { marginTop: 12 }]}>
                  If a value in that column isn't recognized, treat it as:
                </Text>
                <View style={styles.chipRow}>
                  {(["expense", "income"] as MainType[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, typeFallback === t && styles.chipActive]}
                      onPress={() => setTypeFallback(t)}
                    >
                      <Text style={[styles.chipText, typeFallback === t && styles.chipTextActive]}>
                        {t === "expense" ? "Expense" : "Income"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>Date Format Used in the CSV</Text>
            <View style={styles.chipRow}>
              {DATE_FORMAT_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.chip, dateFormat === preset && styles.chipActive]}
                  onPress={() => setDateFormat(preset)}
                >
                  <Text style={[styles.chipText, dateFormat === preset && styles.chipTextActive]}>
                    {formatDate(new Date(2026, 2, 7), preset)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Currency</Text>
            <View style={styles.currencyToggleRow}>
              <Text style={styles.mappingLabel}>Already in {settings.currency}?</Text>
              <Switch
                value={sameCurrency}
                onValueChange={setSameCurrency}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            </View>
            {!sameCurrency && (
              <>
                <View style={styles.chipRow}>
                  {CURRENCIES.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={[styles.chip, csvCurrency === c.code && styles.chipActive]}
                      onPress={() => setCsvCurrency(c.code)}
                    >
                      <Text style={[styles.chipText, csvCurrency === c.code && styles.chipTextActive]}>
                        {c.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.mappingLabel}>
                  1 {csvCurrency} = ___ {settings.currency}
                </Text>
                <TextInput
                  style={styles.rateInput}
                  value={rateText}
                  onChangeText={setRateText}
                  keyboardType="decimal-pad"
                  placeholder="1.00"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}
          </ScrollView>
        )}

        {step === "review" && (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
            <Text style={styles.pickIntro}>
              These category/fund names from your CSV don't match anything you already have.
              Assign each to an existing one, or create it.
            </Text>
            {unresolved.map((item) => {
              const options =
                item.kind === "fund"
                  ? fundCategories
                  : item.mainType === "expense"
                    ? expenseCategories
                    : incomeCategories;
              const resolvedId = resolutionMap.get(item.key);
              const isCreating = creatingKeys.has(item.key);
              const isResolved = resolvedId !== undefined;
              // The selected option (or a freshly created one, which is
              // immediately selected) sorts to the front, right after the
              // Create button, instead of wherever it happens to fall in the
              // store's own order — cheaper than scrolling to find it, and
              // cheaper to implement than actually reordering the store.
              const orderedOptions = isResolved
                ? [...options].sort((a, b) => (a.id === resolvedId ? -1 : b.id === resolvedId ? 1 : 0))
                : options;

              return (
                <View key={item.key} style={styles.reviewCard}>
                  <Text style={styles.reviewText}>
                    "{item.text}" — used in {item.rowCount} row{item.rowCount === 1 ? "" : "s"}
                    {item.kind === "category" ? ` (${item.mainType})` : ""}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={[styles.createChip, (isCreating || isResolved) && styles.createChipDisabled]}
                        onPress={() => handleCreateNew(item)}
                        disabled={isCreating || isResolved}
                      >
                        {isCreating ? (
                          <ActivityIndicator size="small" color={Colors.textMuted} />
                        ) : (
                          <Ionicons
                            name={isResolved ? "checkmark" : "add"}
                            size={14}
                            color={isResolved ? Colors.textMuted : Colors.primary}
                          />
                        )}
                        {!isCreating && !isResolved && (
                          <Text style={styles.createChipText}>Create "{item.text}"</Text>
                        )}
                      </TouchableOpacity>
                      {orderedOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[styles.chip, resolvedId === opt.id && styles.chipActive]}
                          onPress={() => resolveManually(item, opt.id)}
                        >
                          <Text style={[styles.chipText, resolvedId === opt.id && styles.chipTextActive]}>
                            {"label" in opt ? opt.label : opt.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        )}

        {step === "preview" && (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryValue}>{validRows.length}</Text>
                <Text style={styles.summaryCellLabel}>Ready to import</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: Colors.income }]}>
                  +{previewIncome.toFixed(2)}
                </Text>
                <Text style={styles.summaryCellLabel}>Income</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: Colors.expense }]}>
                  -{previewExpense.toFixed(2)}
                </Text>
                <Text style={styles.summaryCellLabel}>Expenses</Text>
              </View>
            </View>

            {failedRows.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>
                  {failedRows.length} row{failedRows.length === 1 ? "" : "s"} will be skipped
                </Text>
                <View style={styles.noticeBox}>
                  <Ionicons name="warning-outline" size={18} color={Colors.warningText} />
                  <Text style={styles.noticeText}>
                    These transactions have missing or unrecognized values. Check them below —
                    fill in anything that should have data, or leave them as they are and the
                    app will just skip those rows.
                  </Text>
                </View>
                {failedRows.slice(0, 25).map((r) =>
                  r.ok ? null : (
                    <View key={r.rowIndex} style={styles.errorCard}>
                      <Text style={styles.errorCardTitle}>
                        Row {r.rowIndex + 1}{r.title ? ` — "${r.title}"` : " — (no title)"}
                      </Text>
                      {r.issues.map((issue) => {
                        const editKey = `${r.rowIndex}:${issue.field}`;
                        return (
                          <View key={editKey} style={styles.errorCardIssue}>
                            <Text style={styles.errorCardReason}>
                              {FIELD_LABELS[issue.field]} column ("{issue.header}") —{" "}
                              {issue.reason}
                            </Text>
                            <View style={styles.errorCardFixRow}>
                              <TextInput
                                style={styles.errorCardInput}
                                value={editValues[editKey] ?? issue.rawValue}
                                onChangeText={(text) =>
                                  setEditValues((prev) => ({ ...prev, [editKey]: text }))
                                }
                                placeholder={`Enter a ${FIELD_LABELS[issue.field].toLowerCase()}`}
                                placeholderTextColor={Colors.textMuted}
                              />
                              <TouchableOpacity
                                style={styles.errorCardFixBtn}
                                onPress={() =>
                                  handleFixRow(r.rowIndex, issue, editValues[editKey] ?? issue.rawValue)
                                }
                              >
                                <Text style={styles.errorCardFixBtnText}>Fix</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ),
                )}
                {failedRows.length > 25 && (
                  <Text style={styles.failedRowText}>…and {failedRows.length - 25} more</Text>
                )}
              </>
            )}
          </ScrollView>
        )}

        {step === "importing" && (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.pickIntro}>Importing your transactions…</Text>
          </View>
        )}

        {step === "results" && (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
            {importError ? (
              <>
                <Ionicons name="alert-circle-outline" size={40} color={Colors.expense} />
                <Text style={styles.pickIntro}>Import failed: {importError}</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={40} color={Colors.income} />
                <Text style={styles.summaryValue}>{importResult?.created.length ?? 0} imported</Text>
                {(importResult?.skipped_duplicates ?? 0) > 0 && (
                  <Text style={styles.pickIntro}>
                    {importResult?.skipped_duplicates} duplicate row{importResult?.skipped_duplicates === 1 ? "" : "s"} skipped.
                  </Text>
                )}
                {(importResult?.failed.length ?? 0) > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>{importResult?.failed.length} rows failed</Text>
                    {importResult?.failed.map((f) => (
                      <Text key={f.index} style={styles.failedRowText}>
                        Row {f.index + 1}: {f.detail}
                      </Text>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}

        <View style={styles.footer}>
          {step === "mapping" && (
            <>
              <TouchableOpacity style={[styles.secondaryBtn, styles.footerBtn]} onPress={() => setStep("pick")}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, styles.footerBtn]} onPress={handleMappingContinue}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}
          {step === "review" && (
            <>
              <TouchableOpacity style={[styles.secondaryBtn, styles.footerBtn]} onPress={() => setStep("mapping")}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, styles.footerBtn]} onPress={handleReviewContinue}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}
          {step === "preview" && (
            <>
              <TouchableOpacity
                style={[styles.secondaryBtn, styles.footerBtn]}
                onPress={() => setStep(unresolved.length > 0 ? "review" : "mapping")}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.footerBtn, validRows.length === 0 && styles.primaryBtnDisabled]}
                onPress={handleImport}
                disabled={validRows.length === 0}
              >
                <Text style={styles.primaryBtnText}>Import {validRows.length} Transactions</Text>
              </TouchableOpacity>
            </>
          )}
          {step === "results" && (
            <TouchableOpacity style={[styles.primaryBtn, styles.footerBtn]} onPress={handleDone}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Colors.textPrimary },
  scrollArea: { flex: 1 },
  body: { padding: 16, paddingBottom: 32 },
  centerBody: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  pickIntro: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 19 },
  blockedText: { fontSize: 13, color: Colors.textMuted, textAlign: "center" },
  fileLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 20,
    marginBottom: 8,
  },
  mappingRow: { marginBottom: 12 },
  mappingLabel: { fontSize: 13, fontWeight: "500", color: Colors.textPrimary, marginBottom: 6 },
  mappingTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  mappingTriggerText: { fontSize: 13, color: Colors.textPrimary },
  dropdown: {
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginTop: 6,
    overflow: "hidden",
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemText: { fontSize: 13, color: Colors.textPrimary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  createChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: "dashed",
  },
  // Shown once creating (in flight) or already resolved: shrinks to an
  // icon-only pill so it's visibly not the "tap to create" affordance
  // anymore, rather than staying full-size and inviting another tap.
  createChipDisabled: {
    minWidth: 32,
    paddingHorizontal: 8,
    borderColor: Colors.border,
    borderStyle: "solid",
    backgroundColor: Colors.surfaceSecondary,
  },
  createChipText: { fontSize: 12, color: Colors.primary, fontWeight: "500" },
  currencyToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  rateInput: {
    padding: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.textPrimary,
    marginTop: 8,
  },
  reviewCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginBottom: 12,
    gap: 8,
  },
  reviewText: { fontSize: 13, color: Colors.textPrimary },
  summaryGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  summaryCell: { alignItems: "center", flex: 1 },
  summaryValue: { fontSize: 20, fontWeight: "700", color: Colors.textPrimary },
  summaryCellLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  failedRowText: { fontSize: 12, color: Colors.expense, marginBottom: 4 },
  noticeBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.warningBg,
    borderWidth: 0.5,
    borderColor: Colors.warningText + "40",
    marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 12, color: Colors.warningText, lineHeight: 18 },
  errorCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginBottom: 10,
    gap: 8,
  },
  errorCardTitle: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  errorCardIssue: { gap: 6 },
  errorCardReason: { fontSize: 12, color: Colors.expense },
  errorCardFixRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  errorCardInput: {
    flex: 1,
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  errorCardFixBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  errorCardFixBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  // No flex here deliberately: this style is reused both for standalone
  // buttons (e.g. "Choose CSV File", sized to content and centered) and for
  // footer buttons (which need to share the row equally) — footerBtn below
  // adds flex:1 only where that's actually wanted.
  primaryBtn: {
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  footerBtn: { flex: 1 },
  secondaryBtn: {
    paddingHorizontal: 24,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: Colors.textPrimary },
  });
}
