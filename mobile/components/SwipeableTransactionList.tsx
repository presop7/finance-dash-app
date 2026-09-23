import { View, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";
import { GlobalStyles } from "../constants/styles";
import { Transaction } from "../store/useFinanceStore";
import SwipeableTransactionRow from "./SwipeableTransactionRow";
import {
  TransactionEmptyState,
  useCategoryDetailsMap,
  getTransactionDetails,
} from "./TransactionList";

type SwipeableTransactionListProps = {
  transactions: Transaction[];
  onTransactionPress?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
};

// Dashboard's "Recent Transactions" card and Top Expenses share this — a
// plain, unvirtualized list (fine for a handful of rows; Analytics uses a
// real FlatList directly instead, since it can run into the hundreds). Kept
// in its own file rather than folded into TransactionList.tsx: that file's
// TransactionRow is what SwipeableTransactionRow itself wraps, so importing
// SwipeableTransactionRow back into TransactionList.tsx would be a circular
// import.
export default function SwipeableTransactionList({
  transactions,
  onTransactionPress,
  onEdit,
}: SwipeableTransactionListProps) {
  const detailsById = useCategoryDetailsMap();

  if (transactions.length === 0) {
    return <TransactionEmptyState />;
  }

  return (
    <View style={styles.container}>
      {transactions.map((transaction, index) => (
        <SwipeableTransactionRow
          key={transaction.id}
          transaction={transaction}
          details={getTransactionDetails(detailsById, transaction)}
          onPress={onTransactionPress}
          onEdit={onEdit}
          isLast={index === transactions.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    // Clips each row (including its revealed action panel) to the card's
    // own rounded corners — without this, swiping the first/last row would
    // let its square action panel poke out past the card's rounded top/
    // bottom edge.
    overflow: "hidden",
    ...GlobalStyles.shadow,
  },
});
