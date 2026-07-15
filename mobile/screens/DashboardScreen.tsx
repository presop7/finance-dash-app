import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import BalanceCard from '../components/BalanceCard'
import { Colors } from '../constants/colors'
import { GlobalStyles } from '../constants/styles'

export default function DashboardScreen() {
  // Temporary hardcoded data — later will come from Zustand store
  const mockData = {
    balance: 3840.00,
    totalIncome: 2200.00,
    totalExpense: 1360.00,
    incomePercentage: 12,
    expensePercentage: 5,
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, GlobalStyles.screenPadding]}>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.name}>Alexander 👋</Text>
        </View>

        {/* Balance Card */}
        <BalanceCard
          balance={mockData.balance}
          totalIncome={mockData.totalIncome}
          totalExpense={mockData.totalExpense}
          incomePercentage={mockData.incomePercentage}
          expensePercentage={mockData.expensePercentage}
        />

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
})