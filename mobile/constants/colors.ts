type CategoryColors = {
  bg: string
  icon: string
}

export type ColorsType = {
  primary: string
  secondary: string
  gradientPrimary: string
  gradientIncome: string
  gradientExpense: string
  heroGradientFrom: string
  heroGradientTo: string
  income: string
  expense: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  surface: string
  surfaceSecondary: string
  border: string
  warningBg: string
  warningText: string
  errorBg: string
  errorText: string
  categories: {
    food: CategoryColors
    restaurant: CategoryColors
    transport: CategoryColors
    entertainment: CategoryColors
    salary: CategoryColors
    freelance: CategoryColors
    investment: CategoryColors
    other: CategoryColors
  }
}

export const lightColors: ColorsType = {
    //Primary Colors
        primary: '#1D2B4F',
        secondary: '#F5F6FA',

    // Gradient Colors — shared with dark mode; a vivid card reads fine
    // against either background, so these aren't themed separately.
        gradientPrimary: '#7383ac',
        gradientIncome: '#344e46',
        gradientExpense: '#5a1e0f',

    // BalanceCard's own hero gradient — themed separately from the tokens
    // above: full saturation on light, muted/desaturated on dark (see
    // darkColors) so it doesn't pop so hard against a near-black page.
        heroGradientFrom: '#1D2B4F',
        heroGradientTo: '#7383ac',

    // Income and Expense Colors
        income: '#1D9E75',
        expense: '#D85A30',

    // Text Colors
        textPrimary: '#000000',
        textSecondary: '#757575',
        textMuted: '#BDBDBD',

    // Surface Colors
        surface: '#FFFFFF',
        surfaceSecondary: '#F9FAFB',
        border: '#E5E7EB',

    // Status Colors — for state that should stand out from the UI, not blend in
        warningBg: '#FEF3C7',
        warningText: '#854F0B',
        errorBg: '#FDECEA',
        errorText: '#993C1D',

    // Category Colors
        categories: {
    food: { bg: '#E1F5EE', icon: '#0F6E56' },
    restaurant: { bg: '#FAECE7', icon: '#993C1D' },
    transport: { bg: '#E6F1FB', icon: '#185FA5' },
    entertainment: { bg: '#FAEEDA', icon: '#854F0B' },
    salary: { bg: '#E6F1FB', icon: '#185FA5' },
    freelance: { bg: '#E1F5EE', icon: '#0F6E56' },
    investment: { bg: '#FAEEDA', icon: '#854F0B' },
    other: { bg: '#F1EFE8', icon: '#5F5E5A' },
  }
}

// Complementary dark palette — near-black surfaces (not pure black, so
// elevated cards can still read as "raised" against the page), off-white
// text (not pure white, easier on the eyes), and category/status colors
// brightened just enough to keep contrast against the darker backgrounds.
export const darkColors: ColorsType = {
    //Primary Colors
        primary: '#7C93C9',
        secondary: '#20232B',

    // Gradient Colors — shared with light mode, see lightColors.
        gradientPrimary: '#7383ac',
        gradientIncome: '#344e46',
        gradientExpense: '#5a1e0f',

    // Muted + semi-transparent (vs. light's fully-opaque, saturated pair) —
    // blends into the dark surface behind it rather than popping as a
    // bright card floating on a near-black page.
        heroGradientFrom: '#2A314299',
        heroGradientTo: '#4A556899',

    // Income and Expense Colors
        income: '#2FBF8F',
        expense: '#E8734A',

    // Text Colors
        textPrimary: '#F5F6FA',
        textSecondary: '#A0A4AD',
        textMuted: '#6B6F78',

    // Surface Colors
        surface: '#181A20',
        surfaceSecondary: '#22252D',
        border: '#31353F',

    // Status Colors — for state that should stand out from the UI, not blend in
        warningBg: '#3A2E0A',
        warningText: '#F2C94C',
        errorBg: '#3A1712',
        errorText: '#FF8A70',

    // Category Colors
        categories: {
    food: { bg: '#123B32', icon: '#3ECFA8' },
    restaurant: { bg: '#3A2018', icon: '#E8896A' },
    transport: { bg: '#152E45', icon: '#5CA3E8' },
    entertainment: { bg: '#3A2E12', icon: '#E8B85C' },
    salary: { bg: '#152E45', icon: '#5CA3E8' },
    freelance: { bg: '#123B32', icon: '#3ECFA8' },
    investment: { bg: '#3A2E12', icon: '#E8B85C' },
    other: { bg: '#2A2926', icon: '#9B9994' },
  }
}
