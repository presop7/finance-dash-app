type CategoryColors = {
  bg: string
  icon: string
}

type ColorsType = {
  primary: string
  background: string
  income: string
  expense: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  surface: string
  surfaceSecondary: string
  border: string
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

export const Colors = {
    //Primary Colors
        primary: '#1D2B4F',
        secondary: '#F5F6FA',

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