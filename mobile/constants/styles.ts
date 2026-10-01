import { FONT } from './typography'
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
// Text fields. The typing area fills its box, so a tap anywhere in the box
// lands in it, and keeps 6px between the text and the focus ring (the ring
// itself is styled in public/index.html). 16px text is 1.2× the old 13 and
// also stops iPhone Safari zooming in on a tapped field.
export const FIELD_INPUT = {
  flex: 1,
  alignSelf: 'stretch',
  paddingHorizontal: 6,
  paddingVertical: 8,
  borderRadius: 6,
  fontSize: FONT.field,
} as const
// The bordered box around a field: with the field inside, about 48px tall.
export const FIELD_BOX = { paddingVertical: 6, paddingHorizontal: 8 } as const
