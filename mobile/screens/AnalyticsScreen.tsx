import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  View,
  Text,
  StyleSheet,
  StyleProp,
  TextStyle,
  TouchableOpacity,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useSharedValue,
  useAnimatedRef,
  useFrameCallback,
  scrollTo,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { useFinanceStore, Transaction } from "../store/useFinanceStore";
import CollapsibleCard from "../components/CollapsibleCard";
import {
  TransactionRow,
  TransactionEmptyState,
  useCategoryDetailsMap,
  getTransactionDetails,
} from "../components/TransactionList";
import SwipeableTransactionRow from "../components/SwipeableTransactionRow";
import TransactionFiltersModal from "./modals/TransactionFiltersModal";
import type { CategoryTabType } from "./modals/CategoriesModal";
import {
  TransactionFilters,
  MainTypeFilter,
  DEFAULT_FILTERS,
  applyFilters,
  countActiveFilters,
  getDateRangeLabel,
} from "../utils/filterTransactions";
import { formatCurrency } from "../utils/currency";
import { financeApi } from "../services/financeApi";
import { confirmAsyncWithLabel, alertAsync } from "../utils/confirm";

export type AnalyticsInitialFilter = {
  mainType?: MainTypeFilter;
  fundIds?: string[];
};

type AnalyticsScreenProps = {
  initialFilter?: AnalyticsInitialFilter | null;
  onTransactionPress?: (transaction: Transaction) => void;
  onHoldEditCategory?: (type: CategoryTabType, id: string) => void;
  // Swipe-edit target — the same "open AddTransactionModal in edit mode"
  // transition TransactionDetailModal's own Edit button already triggers.
  onEditTransaction?: (transaction: Transaction) => void;
  // Opens the shared category manager as a picker for bulk fund/category
  // reassignment — same shape as AddTransactionModal's own
  // onOpenManageCategories/onOpenManageFundCategories, but without the
  // initial-edit-id plumbing those need.
  onOpenCategoryPicker?: (type: CategoryTabType, onPicked: (id: string) => void) => void;
};

export default function AnalyticsScreen({
  initialFilter,
  onTransactionPress,
  onHoldEditCategory,
  onEditTransaction,
  onOpenCategoryPicker,
}: AnalyticsScreenProps) {
  const { transactions, settings } = useFinanceStore();

  const [mainType, setMainType] = useState<MainTypeFilter>(initialFilter?.mainType ?? "all");
  const [filters, setFilters] = useState<TransactionFilters>({
    ...DEFAULT_FILTERS,
    fundIds: initialFilter?.fundIds ?? [],
  });
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  // Set only when the filters modal was opened via the date-range label
  // below (rather than the "Filters" button), so it can jump straight into
  // that dropdown instead of the plain list.
  const [openToDateDropdown, setOpenToDateDropdown] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  // Long-press a row to enter multi-select (mirrors CategoriesModal's own
  // hold-to-select pattern); the held row is auto-selected.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  // useCallback with empty deps (all of these use functional state updates,
  // so they never need anything from the closure) keeps these — and
  // anything built on top of them below — referentially stable across
  // re-renders. That matters a lot here: TransactionRow is React.memo'd, but
  // a fresh onPress/style per row per render defeats that regardless, since
  // memo's prop comparison sees "changed" even when the actual values
  // didn't. Every row was re-rendering on every single selection change
  // (every tap, every row an auto-scroll tick newly selected) instead of
  // just the one row whose `selected` boolean actually flipped.
  const enterSelectMode = useCallback((id: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRowPressToggle = useCallback(
    (transaction: Transaction) => toggleSelected(transaction.id),
    [toggleSelected],
  );

  // Drag-to-select, like a phone photo gallery: once in select mode, press
  // down anywhere in the list and drag across rows to select all of them in
  // one gesture, instead of tapping each one individually. Built on
  // react-native-gesture-handler rather than React Native's own PanResponder
  // — PanResponder is a purely JS-bridge-based system that can't reliably
  // out-race a FlatList's *native* scroll-claim for the same touch, no
  // matter how the hold/move thresholds are tuned (confirmed: scroll either
  // never gave way, or gave way but broke scrolling entirely afterward).
  // Gesture-handler negotiates in the same native gesture arena FlatList's
  // own scroll already lives in — this app already relies on exactly that
  // to let SwipeableTransactionRow's swipe coexist with this same list's
  // scroll, so the same mechanism is used here instead of fighting it again.
  const rowRefsRef = useRef(new Map<string, View>());
  const rowLayoutsRef = useRef(new Map<string, { y: number; height: number }>());
  const dragProcessedRef = useRef(new Set<string>());
  const lastDragYRef = useRef(0);
  // useAnimatedRef (not a plain useRef) — required so scrollTo() in the
  // frame callback below can command the list from the UI thread directly.
  const flatListRef = useAnimatedRef<FlatList<Transaction>>();
  const listContainerRef = useRef<View>(null);

  const setRowRef = (id: string, el: View | null) => {
    if (el) rowRefsRef.current.set(id, el);
    else rowRefsRef.current.delete(id);
  };

  // Refreshes the position cache for every currently-mounted row. Unlike
  // CategoriesModal's chip grid (all direct children of one View, so
  // onLayout's y composes into a usable offset), a FlatList wraps every
  // rendered row in its own cell, so onLayout only ever reports a row's
  // position within *that* cell (~0), not its place in the scrollable
  // content. measureInWindow sidesteps that by reporting each row's actual
  // on-screen position instead.
  const measureRows = () => {
    rowRefsRef.current.forEach((ref, id) => {
      ref.measureInWindow((_x, y, _width, height) => {
        rowLayoutsRef.current.set(id, { y, height });
      });
    });
  };

  const hitTestRow = (pageY: number): string | null => {
    for (const [id, layout] of rowLayoutsRef.current) {
      if (pageY >= layout.y && pageY <= layout.y + layout.height) return id;
    }
    return null;
  };

  // A fast drag can jump several rows between two consecutive move events —
  // hit-testing only the current finger position missed whatever it passed
  // over in between. Selects every row whose range overlaps the whole span
  // travelled since the last update instead of just the single current point.
  const selectRowsInRange = (fromY: number, toY: number) => {
    const min = Math.min(fromY, toY);
    const max = Math.max(fromY, toY);
    for (const [id, layout] of rowLayoutsRef.current) {
      if (dragProcessedRef.current.has(id)) continue;
      if (layout.y + layout.height >= min && layout.y <= max) {
        toggleSelected(id);
        dragProcessedRef.current.add(id);
      }
    }
  };

  // Auto-scroll while dragging into the header/nav-bar edge of the list —
  // holding there keeps scrolling (and keeps selecting whatever scrolls
  // under the finger) until the finger moves back into the middle or is
  // released, same as most gallery-style multi-select pickers.
  //
  // The actual scroll stepping is driven by useFrameCallback (Reanimated),
  // not setInterval — a setInterval loop runs on the JS thread, the same
  // thread React re-renders (from toggleSelected's state updates) compete
  // on, which is what made this choppy. useFrameCallback runs on the UI
  // thread in sync with the display's own refresh, so the scroll motion
  // itself stays smooth regardless of what the JS thread is doing.
  //
  // Hit-testing is tied directly to this callback's own active-auto-scroll
  // branch (a first version instead used useAnimatedReaction watching
  // scrollOffset generally — but scrollOffset is synced from *all*
  // scrolling, including plain manual browsing, so that reaction fired, and
  // silently toggled rows, on completely ordinary scrolls too). It's also
  // throttled here (runOnJS only every few frames, accumulating the
  // skipped frames' distance so the row-position cache stays exactly in
  // sync rather than drifting) — crossing the JS bridge every single frame
  // during auto-scroll was itself heavy enough to be the new source of
  // choppiness once the scroll motion itself moved to the UI thread.
  const EDGE_ZONE = 60;
  // ~9px/frame at 60fps ≈ the old 16px/30ms-tick rate, so the felt speed is
  // unchanged even though this now ticks roughly twice as often.
  const AUTO_SCROLL_STEP_PER_FRAME = 9;
  const HIT_TEST_EVERY_N_FRAMES = 4;
  const listViewportRef = useRef({ top: 0, bottom: 0 });
  const scrollOffset = useSharedValue(0);
  const maxScrollOffset = useSharedValue(Number.MAX_SAFE_INTEGER);
  // 0 = off, 1 = auto-scrolling down, -1 = auto-scrolling up.
  const autoScrollDirection = useSharedValue<0 | 1 | -1>(0);
  const pendingHitTestDelta = useSharedValue(0);
  const autoScrollFrameCount = useSharedValue(0);
  const dragFingerYRef = useRef(0);
  const measureTickRef = useRef(0);

  // Shifts every cached row position by exactly the amount scrolled since
  // the last call — synchronous and exact, so most calls don't need to wait
  // on a fresh (async) measureInWindow round trip at all. Each one of those
  // is ~15-20 native bridge calls; doing that every tick was the original
  // source of choppiness — only refreshed periodically here, just often
  // enough to pick up newly-rendered rows scrolling into view.
  const handleAutoScrollTick = (delta: number) => {
    rowLayoutsRef.current.forEach((layout, id) => {
      rowLayoutsRef.current.set(id, { y: layout.y - delta, height: layout.height });
    });
    measureTickRef.current += 1;
    if (measureTickRef.current % 8 === 0) measureRows();
    // A single-point hit-test at the finger's (stationary) position can
    // miss a row entirely: content can travel further between two checks
    // (throttled to every few frames) than a row is tall, so a row can
    // scroll fully past the finger without ever landing exactly on it.
    // Testing the whole span just scrolled through — same fix already
    // used for fast manual drags in selectRowsInRange — catches it either
    // way.
    const fingerY = dragFingerYRef.current;
    const min = Math.min(fingerY, fingerY - delta);
    const max = Math.max(fingerY, fingerY - delta);
    for (const [id, layout] of rowLayoutsRef.current) {
      if (dragProcessedRef.current.has(id)) continue;
      if (layout.y + layout.height >= min && layout.y <= max) {
        toggleSelected(id);
        dragProcessedRef.current.add(id);
      }
    }
  };

  // Runs every frame regardless of selectMode/drag state — autostarts and
  // cleans itself up on unmount (useFrameCallback's own default behavior),
  // early-returning immediately whenever autoScrollDirection is 0, which is
  // negligible overhead for a worklet. Only the safety reset on unmount is
  // added explicitly, in case the component is ever torn down mid-drag.
  useFrameCallback(() => {
    if (autoScrollDirection.value === 0) return;
    const next = Math.max(
      0,
      Math.min(maxScrollOffset.value, scrollOffset.value + autoScrollDirection.value * AUTO_SCROLL_STEP_PER_FRAME),
    );
    if (next === scrollOffset.value) return;
    const delta = next - scrollOffset.value;
    scrollOffset.value = next;
    scrollTo(flatListRef, 0, next, false);

    pendingHitTestDelta.value += delta;
    autoScrollFrameCount.value += 1;
    if (autoScrollFrameCount.value % HIT_TEST_EVERY_N_FRAMES === 0) {
      const accumulated = pendingHitTestDelta.value;
      pendingHitTestDelta.value = 0;
      runOnJS(handleAutoScrollTick)(accumulated);
    }
  });

  useEffect(() => {
    return () => {
      autoScrollDirection.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const measureListViewport = () => {
    listContainerRef.current?.measureInWindow((_x, y, _width, height) => {
      listViewportRef.current = { top: y, bottom: y + height };
    });
  };

  const updateAutoScroll = (fingerY: number) => {
    dragFingerYRef.current = fingerY;
    const { top, bottom } = listViewportRef.current;
    if (fingerY <= top + EDGE_ZONE) autoScrollDirection.value = -1;
    else if (fingerY >= bottom - EDGE_ZONE) autoScrollDirection.value = 1;
    else autoScrollDirection.value = 0;
  };

  // activateAfterLongPress is gesture-handler's own native equivalent of the
  // hold-before-claiming gate CategoriesModal built by hand with
  // PanResponder — the gesture only activates (and so only then competes
  // for the touch at all) once the finger has stayed put for this long, so
  // a quick scroll swipe is never in the running to begin with and FlatList
  // handles it completely normally. Kept short — every ms here is also a ms
  // added before a plain tap-to-toggle is free to register, since the
  // gesture has to rule itself out before that touch can resolve as a tap.
  const dragSelectGesture = Gesture.Pan()
    .enabled(selectMode)
    .activateAfterLongPress(80)
    .runOnJS(true)
    .onStart((e) => {
      dragProcessedRef.current = new Set();
      measureTickRef.current = 0;
      pendingHitTestDelta.value = 0;
      autoScrollFrameCount.value = 0;
      measureRows();
      measureListViewport();
      lastDragYRef.current = e.absoluteY;
      const id = hitTestRow(e.absoluteY);
      if (id) {
        toggleSelected(id);
        dragProcessedRef.current.add(id);
      }
    })
    .onUpdate((e) => {
      // While auto-scroll is actively driving, its own tick-based hit-test
      // (above) already covers "what's under the finger now" — the content
      // is moving while the finger stays roughly fixed, so running this
      // finger-movement-based hit-test too was redundant, overlapping JS-
      // thread work on top of it and part of what made this choppy.
      if (autoScrollDirection.value === 0) {
        selectRowsInRange(lastDragYRef.current, e.absoluteY);
      }
      lastDragYRef.current = e.absoluteY;
      updateAutoScroll(e.absoluteY);
    })
    .onEnd(() => {
      autoScrollDirection.value = 0;
    })
    .onFinalize(() => {
      autoScrollDirection.value = 0;
    });

  // Changing tabs/filters can hide selected rows without deselecting them —
  // exiting select mode avoids bulk-acting on transactions the user can no
  // longer see.
  useEffect(() => {
    if (selectMode) exitSelectMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainType, filters]);

  const filtered = useMemo(
    () => applyFilters(transactions, filters, mainType),
    [transactions, filters, mainType],
  );

  // Deliberately bypasses the store's deleteTransaction/updateTransaction
  // (each does its own full refetch per call) in favor of calling financeApi
  // directly in parallel and refetching once at the end — the same approach
  // CategoriesModal's own bulk delete already uses, for the same reason.
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirmAsyncWithLabel(
      `Delete ${ids.length} Transaction${ids.length === 1 ? "" : "s"}`,
      `Delete ${ids.length} selected transaction${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      "Delete",
    );
    if (!ok) return;

    setBulkActing(true);
    const results = await Promise.allSettled(ids.map((id) => financeApi.deleteTransaction(id)));
    const failedCount = results.filter((r) => r.status === "rejected").length;
    await useFinanceStore.getState().hydrate();
    setBulkActing(false);
    exitSelectMode();

    if (failedCount > 0) {
      await alertAsync("Some deletions failed", `${failedCount} couldn't be deleted — try again.`);
    }
  };

  const applyBulkField = async (field: "fund_category_id" | "category_id", value: string) => {
    const ids = Array.from(selectedIds);
    setBulkActing(true);
    const results = await Promise.allSettled(
      ids.map((id) => financeApi.updateTransaction(id, { [field]: value })),
    );
    const failedCount = results.filter((r) => r.status === "rejected").length;
    await useFinanceStore.getState().hydrate();
    setBulkActing(false);
    exitSelectMode();

    if (failedCount > 0) {
      await alertAsync("Some updates failed", `${failedCount} transaction${failedCount === 1 ? "" : "s"} couldn't be updated.`);
    }
  };

  // Fund is shared across expense/income, so "Change Fund" always applies.
  // "Change Category" needs every selected transaction to be the same type —
  // expense and income each have their own category list, so a combined
  // picker wouldn't clearly apply to a mixed selection.
  const handleBulkEdit = () => {
    const selectedTransactions = filtered.filter((t) => selectedIds.has(t.id));
    const selectedTypes = new Set(selectedTransactions.map((t) => t.type));
    const sharedType = selectedTypes.size === 1 ? [...selectedTypes][0] : null;

    Alert.alert(
      "Bulk Edit",
      `Apply to ${selectedIds.size} selected transaction${selectedIds.size === 1 ? "" : "s"}`,
      [
        {
          text: "Change Fund",
          onPress: () => onOpenCategoryPicker?.("fund", (id) => applyBulkField("fund_category_id", id)),
        },
        sharedType
          ? {
              text: "Change Category",
              onPress: () =>
                onOpenCategoryPicker?.(sharedType, (id) => applyBulkField("category_id", id)),
            }
          : {
              text: "Change Category",
              onPress: () =>
                alertAsync(
                  "Can't bulk-change category",
                  "The selected transactions are a mix of expense and income, which use separate category lists — select transactions of just one type to change their category together.",
                ),
            },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const summary = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const maxBar = Math.max(summary.income, summary.expense, 1);
  const activeFilterCount = countActiveFilters(filters);
  const detailsById = useCategoryDetailsMap();

  // Bars grow from empty and amounts count up from 0 to the real value
  // whenever the summary changes (switching the Expense/Income/All tab,
  // applying filters, etc.), instead of snapping straight to the new
  // numbers. JS-driven (width and arbitrary number values aren't eligible
  // for the native driver). The bar widths are cheap — Animated mutates the
  // native view directly each tick without going through React — but the
  // count-up numbers used to drive this via addListener -> setState *here*,
  // which re-rendered the whole screen (TransactionList included) on every
  // tick; that's what was choppy. CountUpAmount below owns its own listener
  // and state so those re-renders stay scoped to just the number text.
  const incomeBarAnim = useRef(new Animated.Value(0)).current;
  const expenseBarAnim = useRef(new Animated.Value(0)).current;
  const incomeAmountAnim = useRef(new Animated.Value(0)).current;
  const expenseAmountAnim = useRef(new Animated.Value(0)).current;
  const netAmountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const incomePct = (summary.income / maxBar) * 100;
    const expensePct = (summary.expense / maxBar) * 100;

    [incomeBarAnim, expenseBarAnim, incomeAmountAnim, expenseAmountAnim, netAmountAnim].forEach((a) =>
      a.setValue(0),
    );
    Animated.parallel(
      [
        [incomeBarAnim, incomePct],
        [expenseBarAnim, expensePct],
        [incomeAmountAnim, summary.income],
        [expenseAmountAnim, summary.expense],
        [netAmountAnim, summary.net],
      ].map(([anim, toValue]) =>
        Animated.timing(anim as Animated.Value, {
          toValue: toValue as number,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.income, summary.expense, summary.net, maxBar]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, GlobalStyles.screenPadding]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFiltersModal(true)}
          >
            <Ionicons name="options-outline" size={14} color={Colors.primary} />
            <Text style={styles.filterBtnText}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mainTypeRow}>
          {(["expense", "income", "all"] as MainTypeFilter[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.mainTypeOption, mainType === type && styles.mainTypeOptionActive]}
              onPress={() => setMainType(type)}
            >
              <Text
                style={[
                  styles.mainTypeText,
                  mainType === type && styles.mainTypeTextActive,
                ]}
              >
                {type === "expense" ? "Expenses" : type === "income" ? "Income" : "All"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.dateRangeRow}
          onPress={() => {
            setOpenToDateDropdown(true);
            setShowFiltersModal(true);
          }}
          hitSlop={6}
        >
          <Text style={styles.dateRangeLabel}>{getDateRangeLabel(filters, settings.dateFormat)}</Text>
          <Ionicons name="chevron-down" size={13} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Fixed directly under the header (a sibling of the FlatList, not
          inside it) so it never scrolls out of view while acting on a
          selection. */}
      {selectMode && (
        <View style={styles.selectToolbar}>
          <Text style={styles.selectToolbarText}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.selectToolbarActions}>
            <TouchableOpacity
              onPress={exitSelectMode}
              style={styles.selectDiscardBtn}
              disabled={bulkActing}
            >
              <Text style={styles.selectDiscardText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkEdit}
              style={[
                styles.selectEditBtn,
                (selectedIds.size === 0 || bulkActing) && styles.selectBtnDisabled,
              ]}
              disabled={selectedIds.size === 0 || bulkActing}
            >
              <Ionicons name="pricetag-outline" size={14} color={Colors.primary} />
              <Text style={styles.selectEditText}>Bulk Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkDelete}
              style={[
                styles.selectDeleteBtn,
                (selectedIds.size === 0 || bulkActing) && styles.selectBtnDisabled,
              ]}
              disabled={selectedIds.size === 0 || bulkActing}
            >
              <Ionicons name="trash-outline" size={14} color="#fff" />
              <Text style={styles.selectDeleteText}>{bulkActing ? "Working…" : "Delete"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* A real FlatList, not a ScrollView wrapping a .map() — Analytics can
          show hundreds of transactions, and switching the Expense/Income/All
          toggle swaps out virtually the whole displayed set each time (they're
          mutually exclusive), so this needs to only ever mount what's
          actually on screen rather than every matching row at once. The
          summary card lives in ListHeaderComponent so it scrolls together
          with the list, same as before.

          Wrapped in a GestureDetector so the drag-select gesture above has
          something to attach to — it's disabled entirely outside select
          mode (see .enabled() above), and gesture-handler's own native
          arbitration with the FlatList's scroll (the same mechanism
          SwipeableTransactionRow's swipe already relies on) means normal
          scrolling and tapping stay completely untouched the rest of the
          time — no manual scrollEnabled toggling needed. */}
      <GestureDetector gesture={dragSelectGesture}>
      <View style={styles.scrollView} ref={listContainerRef} onLayout={measureListViewport}>
      <FlatList
        ref={flatListRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          // Keeps scrollOffset accurate for manual scrolling. While
          // auto-scroll is driving, the frame callback is the sole source
          // of truth for scrollOffset — the native onScroll event here
          // lags a frame or two behind the imperative scrollTo() call, so
          // letting it also write scrollOffset created a feedback loop
          // (frame callback pushes forward, delayed onScroll snaps back,
          // next frame corrects again) that showed up as jitter.
          if (autoScrollDirection.value === 0) {
            scrollOffset.value = e.nativeEvent.contentOffset.y;
          }
        }}
        onContentSizeChange={(_w, contentHeight) => {
          const { top, bottom } = listViewportRef.current;
          maxScrollOffset.value = Math.max(0, contentHeight - (bottom - top));
        }}
        scrollEventThrottle={32}
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => {
          const isFirst = index === 0;
          const isLast = index === filtered.length - 1;
          const rowStyle = isFirst ? ROW_STYLE_FIRST : isLast ? ROW_STYLE_LAST : ROW_STYLE_MIDDLE;
          // Select mode swaps to a plain, swipe-less row entirely (same
          // component-swap CategoriesModal's own chips use between normal
          // and select mode) rather than just toggling props on one row
          // component that stays mounted throughout — the swap cleanly ends
          // whatever gesture was in progress (the long-press that entered
          // select mode) instead of leaving it live to race the drag-select
          // responder above, which was re-toggling the just-selected row a
          // moment later.
          if (selectMode) {
            return (
              <View ref={(el) => setRowRef(item.id, el)}>
                <TransactionRow
                  transaction={item}
                  details={getTransactionDetails(detailsById, item)}
                  onPress={handleRowPressToggle}
                  selectMode
                  selected={selectedIds.has(item.id)}
                  isLast={isLast}
                  style={rowStyle}
                />
              </View>
            );
          }
          return (
            <SwipeableTransactionRow
              transaction={item}
              details={getTransactionDetails(detailsById, item)}
              onPress={onTransactionPress}
              onLongPress={() => enterSelectMode(item.id)}
              onEdit={onEditTransaction}
              isLast={isLast}
              // Not the first/last-rounded rowStyle here — Swipeable wraps
              // each row individually, so a row's own rounded corner (only
              // ever visible before because it sits flush against its
              // neighbors) becomes visible as its own isolated shape the
              // moment it detaches from them mid-swipe. Plain, unrounded
              // corners avoid that "corner just appeared" look entirely.
              style={ROW_STYLE_MIDDLE}
            />
          );
        }}
        ListEmptyComponent={TransactionEmptyState}
        ListHeaderComponent={
          <>
            <CollapsibleCard
              title="Summary"
              reorderable={false}
              collapsed={summaryCollapsed}
              onToggleCollapse={() => setSummaryCollapsed((v) => !v)}
            >
              <View style={styles.summaryCard}>
                <View style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.income }]} />
                    <Text style={styles.barLabel}>Income</Text>
                    <CountUpAmount anim={incomeAmountAnim} currency={settings.currency} style={styles.barAmount} />
                  </View>
                  <View style={styles.barTrack}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: incomeBarAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ["0%", "100%"],
                            extrapolate: "clamp",
                          }),
                          backgroundColor: Colors.income,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.expense }]} />
                    <Text style={styles.barLabel}>Expenses</Text>
                    <CountUpAmount anim={expenseAmountAnim} currency={settings.currency} style={styles.barAmount} />
                  </View>
                  <View style={styles.barTrack}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: expenseBarAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ["0%", "100%"],
                            extrapolate: "clamp",
                          }),
                          backgroundColor: Colors.expense,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.netRow}>
                  <Text style={styles.netLabel}>Net</Text>
                  <CountUpAmount
                    anim={netAmountAnim}
                    currency={settings.currency}
                    style={styles.netAmount}
                    negativeStyle={{ color: Colors.expense }}
                    showSign
                  />
                </View>
              </View>
            </CollapsibleCard>

            <Text style={[styles.sectionLabel, GlobalStyles.screenPadding]}>
              All Transactions ({filtered.length})
            </Text>
          </>
        }
        ListFooterComponent={<View style={styles.bottomPadding} />}
        // Renders a small buffer beyond the viewport rather than everything
        // matching the filter — this, plus removeClippedSubviews on
        // Android, is what actually keeps switching Expense/Income/All fast
        // even when it swaps out most of the list.
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
      </View>
      </GestureDetector>

      <TransactionFiltersModal
        visible={showFiltersModal}
        filters={filters}
        onApply={setFilters}
        onClose={() => {
          setShowFiltersModal(false);
          setOpenToDateDropdown(false);
        }}
        onHoldEditCategory={onHoldEditCategory}
        initialDateDropdownOpen={openToDateDropdown}
      />
    </View>
  );
}

// Owns its own listener + state for the count-up animation, so the re-render
// each tick produces is scoped to just this Text rather than the whole
// screen (which is what made the animation choppy when the parent held that
// state instead — every tick re-rendered AnalyticsScreen, TransactionList
// included).
function CountUpAmount({
  anim,
  currency,
  style,
  negativeStyle,
  showSign,
}: {
  anim: Animated.Value;
  currency: string;
  style?: StyleProp<TextStyle>;
  negativeStyle?: StyleProp<TextStyle>;
  showSign?: boolean;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setValue(value));
    return () => anim.removeListener(id);
  }, [anim]);

  return (
    <Text style={[style, negativeStyle && value < 0 && negativeStyle]}>
      {showSign && value >= 0 ? "+" : ""}
      {formatCurrency(value, currency)}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitle: { fontSize: 22, fontWeight: "600", color: Colors.textPrimary },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.primary + "12",
    borderWidth: 0.5,
    borderColor: Colors.primary + "40",
  },
  filterBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  mainTypeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 20,
    padding: 3,
    marginBottom: 8,
  },
  mainTypeOption: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 18,
  },
  mainTypeOptionActive: { backgroundColor: Colors.primary },
  mainTypeText: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },
  mainTypeTextActive: { color: "#fff" },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dateRangeLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textMuted,
    textAlign: "center",
  },
  selectToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primary + "10",
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.primary + "40",
  },
  selectToolbarText: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  selectToolbarActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectDiscardBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  selectDiscardText: { fontSize: 13, fontWeight: "500", color: Colors.textSecondary },
  selectEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  selectEditText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  selectDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.expense,
  },
  selectDeleteText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  selectBtnDisabled: { opacity: 0.5 },
  scrollView: { flex: 1 },
  summaryCard: { paddingHorizontal: 16 },
  barRow: { marginBottom: 12 },
  barLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  barAmount: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceSecondary,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  netLabel: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary },
  netAmount: { fontSize: 16, fontWeight: "700", color: Colors.income },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 16,
    marginBottom: 8,
  },
  // Approximates the old single-card look (TransactionList's own container
  // style) across individually-rendered FlatList rows: each gets the
  // shared background/margin, only the first/last round their outer
  // corners. The old shared drop-shadow across the whole card doesn't
  // carry over cleanly to per-row rendering, so it's dropped here.
  transactionRow: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
  },
  transactionRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  transactionRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bottomPadding: { height: 20 },
});

// Precomputed once at module scope rather than as a fresh array literal per
// row per render — same reference every time, so it doesn't itself defeat
// TransactionRow's React.memo the way a `[styles.a, cond && styles.b]`
// built inline in renderItem would.
const ROW_STYLE_FIRST = [styles.transactionRow, styles.transactionRowFirst];
const ROW_STYLE_LAST = [styles.transactionRow, styles.transactionRowLast];
const ROW_STYLE_MIDDLE = styles.transactionRow;
