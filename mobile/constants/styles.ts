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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
})