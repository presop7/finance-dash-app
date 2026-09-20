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
  // Applied to every card that needs elevation. boxShadow only, deliberately
  // no `elevation` (Android's legacy Z-order shadow): it's drawn by a
  // separate native pass that doesn't fade in lockstep with an ancestor's
  // opacity animation (e.g. the tab crossfade), visibly lagging and then
  // snapping. boxShadow paints as part of the view's normal layer under the
  // New Architecture and composites correctly with opacity everywhere.
  shadow: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
  },
})