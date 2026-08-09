import { StyleSheet } from 'react-native'

export const GlobalStyles = StyleSheet.create({
  // Applied to every screen
  screenPadding: {
    paddingHorizontal: 16,
  },
  // Applied to every card
  card: {
    borderRadius: 16,
  },
  // Applied to every card that needs elevation
  shadow: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
})