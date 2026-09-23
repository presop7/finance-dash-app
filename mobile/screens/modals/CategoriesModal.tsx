import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ColorsType } from "../../constants/colors";
import { useThemeColors, useResolvedScheme } from "../../hooks/useThemeColors";
import { themedCategoryColor } from "../../utils/color";
import { useFinanceStore } from "../../store/useFinanceStore";
import { Category } from "../../constants/categories";
import { FundCategory } from "../../constants/fundCategories";
import { confirmAsync, confirmAsyncWithLabel, alertAsync } from "../../utils/confirm";
import { ApiError } from "../../services/api";
import { financeApi } from "../../services/financeApi";
import type { DeleteConflictDetail } from "../../services/financeApi";
import HoldPressable from "../../components/HoldPressable";
import ModalCloseButton from "../../components/ModalCloseButton";
import CategoryEditModal from "./CategoryEditModal";

export type CategoryTabType = "expense" | "income" | "fund";

type CategoriesModalProps = {
  visible: boolean;
  initialType?: CategoryTabType;
  onClose: () => void;
  // When set, this modal is acting as a picker (opened from the transaction
  // form's "+New" button, not from Settings): tapping a category selects it
  // and closes the modal immediately, instead of doing nothing. Holding a
  // chip still enters multi-select the same as it does from Settings, and
  // editing is reachable only by holding the pencil icon, in both contexts
  // equally — this prop only changes what a plain tap does.
  onPick?: (id: string) => void;
  // Opens directly into editing this category/fund instead of the list —
  // used when the transaction form's category chips are held rather than
  // the manager being opened via "+New".
  initialEditId?: string;
};

export default function CategoriesModal({
  visible,
  initialType = "expense",
  onClose,
  onPick,
  initialEditId,
}: CategoriesModalProps) {
  const {
    expenseCategories,
    incomeCategories,
    fundCategories,
    transactions,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    addIncomeCategory,
    updateIncomeCategory,
    deleteIncomeCategory,
    addFundCategory,
    updateFundCategory,
    deleteFundCategory,
  } = useFinanceStore();
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isDark = useResolvedScheme() === "dark";

  const [activeType, setActiveType] = useState<CategoryTabType>(initialType);
  // The edit/create form lives in its own modal (CategoryEditModal), stacked
  // on top of this one: null means closed, "new" means creating, and an item
  // means editing that one. Keeping it separate (rather than inline below
  // the grid) means the grid's scroll position survives opening and closing
  // it — editing several items near the top no longer means scrolling all
  // the way down to the form and back up each time.
  const [editTarget, setEditTarget] = useState<Category | FundCategory | "new" | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) return;
    setActiveType(initialType);
    setSelectMode(false);
    setSelectedIds(new Set());
    setSearch("");

    // Reads the store directly rather than depending on the destructured
    // category arrays — those changing identity (e.g. a background sync)
    // shouldn't re-run this reset while the modal is legitimately open.
    const store = useFinanceStore.getState();
    const list =
      initialType === "expense"
        ? store.expenseCategories
        : initialType === "income"
          ? store.incomeCategories
          : store.fundCategories;
    const match = initialEditId ? list.find((i) => i.id === initialEditId) : undefined;

    setEditTarget(match ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialType, initialEditId]);

  const items: Array<Category | FundCategory> =
    activeType === "expense"
      ? expenseCategories
      : activeType === "income"
        ? incomeCategories
        : fundCategories;

  const getLabel = (item: Category | FundCategory) =>
    activeType === "fund" ? (item as FundCategory).name : (item as Category).label;

  // Same behavior as the category search in the transaction modal — filters
  // the grid live instead of relying purely on scrolling to find one.
  const trimmedSearch = search.trim().toLowerCase();
  const filteredItems = trimmedSearch
    ? items.filter((item) => getLabel(item).toLowerCase().includes(trimmedSearch))
    : items;

  // How many transactions reference each category/fund — the empty ones
  // (0) are exactly the duplicates worth finding and clearing out.
  const countsById = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      const key = activeType === "fund" ? t.fundCategory : t.category;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [transactions, activeType]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const enterSelectMode = (id: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Drag-to-select, like a phone photo gallery: once in select mode, press
  // down anywhere in the grid and drag across chips to select all of them
  // in one gesture, instead of tapping each one individually. Built on
  // PanResponder rather than per-chip touch handlers, since a child
  // Pressable claiming a touch would stop the grid from ever seeing it move
  // across siblings — the grid itself has to own the gesture.
  const selectModeRef = useRef(selectMode);
  useEffect(() => {
    selectModeRef.current = selectMode;
  }, [selectMode]);

  const gridRef = useRef<View>(null);
  const gridOffsetRef = useRef({ x: 0, y: 0 });
  const chipLayoutsRef = useRef(new Map<string, { x: number; y: number; width: number; height: number }>());
  const dragProcessedRef = useRef(new Set<string>());

  const handleChipLayout = (id: string, event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => {
    chipLayoutsRef.current.set(id, event.nativeEvent.layout);
  };

  // One persistent scale value per pencil icon (keyed by item id) so tapping
  // it gives a quick pop of feedback — a Map instead of a Map lookup per
  // render new Animated.Value would reset the animation state constantly.
  const editIconScalesRef = useRef(new Map<string, Animated.Value>());
  const getEditIconScale = (id: string) => {
    let anim = editIconScalesRef.current.get(id);
    if (!anim) {
      anim = new Animated.Value(1);
      editIconScalesRef.current.set(id, anim);
    }
    return anim;
  };

  const hitTestChip = (pageX: number, pageY: number): string | null => {
    const relX = pageX - gridOffsetRef.current.x;
    const relY = pageY - gridOffsetRef.current.y;
    for (const [id, layout] of chipLayoutsRef.current) {
      if (
        relX >= layout.x &&
        relX <= layout.x + layout.width &&
        relY >= layout.y &&
        relY <= layout.y + layout.height
      ) {
        return id;
      }
    }
    return null;
  };

  // Claiming the gesture immediately (on touch-start, or on the first pixel
  // of movement) broke vertical scrolling — every swipe got intercepted as
  // a drag-select before the ScrollView ever saw it. This gates the claim
  // behind both a short hold *and* actual movement, using the Capture
  // variants so the parent gets first refusal and can "steal" an
  // in-progress gesture once those conditions are met: a quick swipe never
  // holds long enough to be stolen (scrolls normally), a quick tap never
  // moves enough to be stolen (reaches the chip's own onPress), and only a
  // deliberate hold-then-drag engages drag-select.
  const touchStartTimeRef = useRef(0);
  const HOLD_BEFORE_DRAG_MS = 200;
  const MOVE_THRESHOLD = 6;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        if (selectModeRef.current) touchStartTimeRef.current = Date.now();
        return false;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        if (!selectModeRef.current) return false;
        const heldLongEnough = Date.now() - touchStartTimeRef.current >= HOLD_BEFORE_DRAG_MS;
        const movedEnough =
          Math.abs(gestureState.dx) > MOVE_THRESHOLD || Math.abs(gestureState.dy) > MOVE_THRESHOLD;
        return heldLongEnough && movedEnough;
      },
      onPanResponderGrant: (evt) => {
        dragProcessedRef.current = new Set();
        const { pageX, pageY } = evt.nativeEvent;
        gridRef.current?.measureInWindow((x, y) => {
          gridOffsetRef.current = { x, y };
          const id = hitTestChip(pageX, pageY);
          if (id) {
            toggleSelected(id);
            dragProcessedRef.current.add(id);
          }
        });
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const id = hitTestChip(pageX, pageY);
        if (id && !dragProcessedRef.current.has(id)) {
          toggleSelected(id);
          dragProcessedRef.current.add(id);
        }
      },
    }),
  ).current;

  // Only ever called in normal (non-select) mode now — select-mode chips
  // call toggleSelected directly, since they're a separate Pressable branch.
  const handleChipPress = (item: Category | FundCategory) => {
    setEditTarget(item);
  };

  const handleFormSave = async (fields: {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }) => {
    const editingId = editTarget && editTarget !== "new" ? editTarget.id : null;
    try {
      if (activeType === "expense") {
        const payload = { label: fields.name, icon: fields.icon, color: fields.color };
        if (editingId) await updateExpenseCategory(editingId, payload);
        else await addExpenseCategory(payload);
      } else if (activeType === "income") {
        const payload = { label: fields.name, icon: fields.icon, color: fields.color };
        if (editingId) await updateIncomeCategory(editingId, payload);
        else await addIncomeCategory(payload);
      } else {
        const payload = { name: fields.name, icon: fields.icon, color: fields.color };
        if (editingId) await updateFundCategory(editingId, payload);
        else await addFundCategory(payload);
      }
      setEditTarget(null);
    } catch (err) {
      await alertAsync(
        "Couldn't save",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  };

  const handleFormDelete = async () => {
    if (!editTarget || editTarget === "new") return;
    const noun = activeType === "fund" ? "Fund" : "Category";
    const ok = await confirmAsync(`Delete ${noun}`, `Delete "${getLabel(editTarget)}"?`);
    if (!ok) return;

    const deleteFn =
      activeType === "expense"
        ? deleteExpenseCategory
        : activeType === "income"
          ? deleteIncomeCategory
          : deleteFundCategory;
    const id = editTarget.id;

    try {
      await deleteFn(id);
      setEditTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = (err.body as { detail?: DeleteConflictDetail })?.detail;
        const count = detail?.transaction_count ?? 0;
        const confirmAgain = await confirmAsyncWithLabel(
          `Delete ${noun}`,
          `${count} transaction${count === 1 ? "" : "s"} ${count === 1 ? "uses" : "use"} this ${noun.toLowerCase()}. Deleting it will move ${
            count === 1 ? "that transaction" : "them"
          } to "Unassigned".`,
          "Delete Anyway",
        );
        if (!confirmAgain) return;
        try {
          await deleteFn(id, true);
          setEditTarget(null);
        } catch (err2) {
          await alertAsync(
            "Couldn't delete",
            err2 instanceof Error ? err2.message : "Something went wrong.",
          );
        }
      } else {
        await alertAsync(
          "Couldn't delete",
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const noun = activeType === "fund" ? "funds" : "categories";

    const ok = await confirmAsyncWithLabel(
      `Delete ${ids.length} ${noun}`,
      `Delete ${ids.length} selected ${noun}? This cannot be undone.`,
      "Delete",
    );
    if (!ok) return;

    // Deliberately bypasses deleteExpenseCategory/deleteIncomeCategory/
    // deleteFundCategory here — each of those does its own full categories+
    // transactions refetch after every single delete, which for a batch of
    // N means up to 3N sequential round trips (and the refetches get more
    // redundant as more of the batch has already landed). Calling the API
    // directly, in parallel, and refetching once at the very end turns that
    // into N concurrent deletes plus a single refetch.
    const apiDelete = activeType === "fund" ? financeApi.deleteFundCategory : financeApi.deleteCategory;

    setBulkDeleting(true);
    const conflicted: string[] = [];
    const failed: string[] = [];
    const results = await Promise.allSettled(ids.map((id) => apiDelete(id, false)));
    results.forEach((result, i) => {
      if (result.status !== "rejected") return;
      const err = result.reason;
      if (err instanceof ApiError && err.status === 409) conflicted.push(ids[i]);
      else failed.push(ids[i]);
    });

    // Anything still in use gets one combined "delete anyway" prompt rather
    // than one per item — the single-delete flow's 409 handling adapted to
    // a batch instead of asked N times.
    if (conflicted.length > 0) {
      const confirmAgain = await confirmAsyncWithLabel(
        "Some still have transactions",
        `${conflicted.length} of the selected still have transactions attached. Delete them anyway? Their transactions will move to "Unassigned".`,
        "Delete Anyway",
      );
      if (confirmAgain) {
        const retryResults = await Promise.allSettled(conflicted.map((id) => apiDelete(id, true)));
        retryResults.forEach((result, i) => {
          if (result.status === "rejected") failed.push(conflicted[i]);
        });
      }
    }

    await useFinanceStore.getState().hydrate();

    setBulkDeleting(false);
    exitSelectMode();

    if (failed.length > 0) {
      await alertAsync(
        "Some deletions failed",
        `${failed.length} couldn't be deleted — try again.`,
      );
    }
  };

  const noun = activeType === "fund" ? "Fund" : "Category";

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        {/* android.softwareKeyboardLayoutMode isn't set in app.json, so
            Android has no native window-resize to lean on here — "height"
            drives the push-up directly instead of assuming one exists. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Manage Categories</Text>
            <ModalCloseButton onPress={onClose} />
          </View>

          <View style={styles.typeToggle}>
            {(["expense", "income", "fund"] as CategoryTabType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.toggleOption,
                  activeType === type && {
                    backgroundColor:
                      type === "expense"
                        ? Colors.expense
                        : type === "income"
                          ? Colors.income
                          : Colors.primary,
                  },
                ]}
                onPress={() => {
                  setActiveType(type);
                  setEditTarget(null);
                  exitSelectMode();
                  setSearch("");
                }}
              >
                <Text
                  style={[
                    styles.toggleText,
                    activeType === type ? styles.toggleActiveText : styles.toggleInactiveText,
                  ]}
                >
                  {type === "expense" ? "Expense" : type === "income" ? "Income" : "Funds"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${activeType === "fund" ? "funds" : "categories"}`}
              placeholderTextColor={Colors.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {selectMode && (
            <View style={styles.selectBar}>
              <Text style={styles.selectBarText}>{selectedIds.size} selected</Text>
              <View style={styles.selectBarActions}>
                <TouchableOpacity onPress={exitSelectMode} style={styles.selectBarCancelBtn}>
                  <Text style={styles.selectBarCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectBarDeleteBtn,
                    (selectedIds.size === 0 || bulkDeleting) && styles.selectBarDeleteBtnDisabled,
                  ]}
                  onPress={handleBulkDelete}
                  disabled={selectedIds.size === 0 || bulkDeleting}
                >
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                  <Text style={styles.selectBarDeleteText}>
                    {bulkDeleting ? "Deleting…" : "Delete"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <View
              ref={gridRef}
              style={styles.categoriesGrid}
              {...(selectMode ? panResponder.panHandlers : {})}
            >
              {filteredItems.length === 0 && (
                <Text style={styles.emptySearchText}>No matches for "{search.trim()}"</Text>
              )}
              {filteredItems.map((item) => {
                const count = countsById.get(item.id) ?? 0;
                const isSelected = selectedIds.has(item.id);
                const iconAndLabel = (
                  <>
                    {selectMode && (
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                      />
                    )}
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={themedCategoryColor(item.color, Colors.primary, isDark)}
                    />
                    <Text style={styles.categoryChipText}>{getLabel(item)}</Text>
                    <View style={[styles.countBadge, count === 0 && styles.countBadgeEmpty]}>
                      <Text style={[styles.countBadgeText, count === 0 && styles.countBadgeTextEmpty]}>
                        {count}
                      </Text>
                    </View>
                  </>
                );

                // In select mode the chip is a Pressable with just onPress
                // (no hold gesture, no animation) — a quick tap reaches it
                // normally, but the grid's own PanResponder can "steal" an
                // in-progress touch once it's been held and then dragged
                // (see the capture-phase gating above), letting it track the
                // finger moving across siblings for the gallery-style
                // multi-select, which a per-chip touchable alone couldn't do.
                if (selectMode) {
                  return (
                    <Pressable
                      key={item.id}
                      onLayout={(e) => handleChipLayout(item.id, e)}
                      onPress={() => toggleSelected(item.id)}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                    >
                      {iconAndLabel}
                    </Pressable>
                  );
                }

                // Unified across both contexts, so neither interferes with
                // the other: holding the chip always enters multi-select
                // (same as Settings' own behavior always was); a plain tap
                // only does something when this modal is a picker (selects
                // and returns to the transaction form) — otherwise it's
                // inert, since editing no longer lives on the chip itself.
                // Editing is reachable by tapping the pencil icon
                // specifically, which is its own nested Pressable and so
                // claims that touch before the outer chip ever sees it — a
                // tap there opens the edit modal (now a separate modal
                // stacked on top rather than an inline form, so a tap no
                // longer risks losing your place — see CategoryEditModal),
                // while the outer chip itself still needs a hold to enter
                // multi-select, keeping that gesture distinct from tapping
                // the pencil right next to it.
                const editIconScale = getEditIconScale(item.id);
                return (
                  <HoldPressable
                    key={item.id}
                    style={styles.categoryChip}
                    onPress={onPick ? () => onPick(item.id) : undefined}
                    onHoldComplete={() => enterSelectMode(item.id)}
                  >
                    {iconAndLabel}
                    <Pressable
                      style={styles.editIconBtn}
                      hitSlop={8}
                      onPress={() => handleChipPress(item)}
                      onPressIn={() =>
                        Animated.spring(editIconScale, {
                          toValue: 1.35,
                          useNativeDriver: true,
                          speed: 50,
                          bounciness: 8,
                        }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(editIconScale, {
                          toValue: 1,
                          useNativeDriver: true,
                          speed: 50,
                          bounciness: 8,
                        }).start()
                      }
                    >
                      <Animated.View style={{ transform: [{ scale: editIconScale }] }}>
                        <Ionicons name="pencil" size={16} color={Colors.textMuted} />
                      </Animated.View>
                    </Pressable>
                  </HoldPressable>
                );
              })}
            </View>

            {!selectMode && (
              <TouchableOpacity style={styles.addNewBtn} onPress={() => setEditTarget("new")}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.addNewText}>Add New {noun}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    <CategoryEditModal
      visible={editTarget !== null}
      noun={noun}
      item={editTarget && editTarget !== "new" ? editTarget : null}
      getLabel={getLabel}
      onSave={handleFormSave}
      onDelete={editTarget && editTarget !== "new" ? handleFormDelete : undefined}
      onClose={() => setEditTarget(null)}
    />
    </>
  );
}

function createStyles(Colors: ColorsType) {
  return StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  // Deliberately not absolutely positioned: KeyboardAvoidingView's "padding"
  // behavior pushes its content up by padding *itself*, which only moves a
  // normal flow child — an absolutely-positioned bottom:0 child ignores
  // that and stays pinned to the screen edge, under the keyboard. Sitting
  // at the bottom is instead handled by keyboardAvoider's justifyContent.
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "75%",
  },
  keyboardAvoider: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  scrollArea: { flexShrink: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: Colors.textPrimary },
  typeToggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontSize: 13, fontWeight: "500" },
  toggleActiveText: { color: "#fff" },
  toggleInactiveText: { color: Colors.textMuted },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.textPrimary, padding: 0 },
  emptySearchText: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary + "10",
    borderWidth: 0.5,
    borderColor: Colors.primary + "40",
  },
  selectBarText: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  selectBarActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectBarCancelBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  selectBarCancelText: { fontSize: 13, fontWeight: "500", color: Colors.textSecondary },
  selectBarDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.expense,
  },
  selectBarDeleteBtnDisabled: { opacity: 0.5 },
  selectBarDeleteText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "10",
  },
  // A real touch target around the pencil icon, not just a decorative
  // glyph — sized well past the icon itself (roughly double the original)
  // since it has to be comfortably holdable, not just tappable.
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: "500" },
  // Transaction count per category — muted/gray when empty (0) so an empty
  // duplicate stands out at a glance instead of needing to be counted.
  countBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: Colors.primary + "18",
    alignItems: "center",
  },
  countBadgeEmpty: { backgroundColor: Colors.border },
  countBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.primary },
  countBadgeTextEmpty: { color: Colors.textMuted },
  addNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: "dashed",
  },
  addNewText: { fontSize: 14, color: Colors.primary, fontWeight: "500" },
  });
}
