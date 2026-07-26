export type Category = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
};

import { Ionicons } from "@expo/vector-icons";

export const EXPENSE_CATEGORIES: Category[] = [
  {
    id: "food",
    label: "Хранителни",
    icon: "cart-outline",
  },
  {
    id: "restaurant",
    label: "Ресторанти",
    icon: "cafe-outline",
  },
  {
    id: "transport",
    label: "Транспорт",
    icon: "car-outline",
  },
  {
    id: "entertainment",
    label: "Забавления",
    icon: "game-controller-outline",
  },
  {
    id: "other",
    label: "Друго",
    icon: "ellipsis-horizontal-outline",
  },
];

export const INCOME_CATEGORIES: Category[] = [
  {
    id: "salary",
    label: "Заплата",
    icon: "business-outline",
  },
  {
    id: "freelance",
    label: "Фрийланс",
    icon: "briefcase-outline",
  },
  {
    id: "investment",
    label: "Инвестиции",
    icon: "trending-up-outline",
  },
  {
    id: "other",
    label: "Друго",
    icon: "ellipsis-horizontal-outline",
  },
];
