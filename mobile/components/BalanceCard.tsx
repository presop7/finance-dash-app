import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../constants/colors'

// TypeScript types — defining what data the component expects
type BalanceCardProps = {
  balance: number
  totalIncome: number
  totalExpense: number
  incomePercentage: number
  expensePercentage: number
}

export default function BalanceCard({
  balance,
  totalIncome,
  totalExpense,
  incomePercentage,
  expensePercentage,
}: BalanceCardProps) {
  return (
    <LinearGradient
      colors={[Colors.primary, '#7383ac']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Main Balance */}
      <Text style={styles.balanceLabel}>Total Balance</Text>
      <Text style={styles.balanceAmount}>
        {balance.toFixed(2)} BGN
      </Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Income and Expense Row */}
      <View style={styles.row}>

        {/* Income */}
        <View style={styles.col}>
          <Text style={styles.colLabel}>Income</Text>
          <Text style={styles.colAmount}>+{totalIncome.toFixed(2)}</Text>
          <Text style={styles.colTrend}>▲ {incomePercentage}%</Text>
        </View>

        {/* Vertical separator */}
        <View style={styles.separator} />

        {/* Expense */}
        <View style={styles.col}>
          <Text style={styles.colLabel}>Expenses</Text>
          <Text style={[styles.colAmount, styles.expenseAmount]}>
            -{totalExpense.toFixed(2)}
          </Text>
          <Text style={[styles.colTrend, styles.expenseTrend]}>
            ▼ {expensePercentage}%
          </Text>
        </View>

      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  colLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  colAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  expenseAmount: {
    color: '#FF8A70',
  },
  colTrend: {
    fontSize: 11,
    color: '#4ade80',
  },
  expenseTrend: {
    color: '#FF8A70',
  },
  separator: {
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
})