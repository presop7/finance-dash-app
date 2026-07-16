export type Category = {
  id: string;
  label: string;
  icon: string;
  color?: string;
};

export const EXPENSE_CATEGORIES: Category[] = [
  {
    id: "food",
    label: "Хранителни",
    icon: "shopping-cart",
  },
  {
    id: "restaurant",
    label: "Ресторанти",
    icon: "coffee",
  },
  {
    id: "transport",
    label: "Транспорт",
    icon: "car",
  },
  {
    id: "entertainment",
    label: "Забавления",
    icon: "device-gamepad",
  },
  {
    id: "other",
    label: "Друго",
    icon: "dots",
  },
];

export const INCOME_CATEGORIES: Category[] = [
  {
    id: "salary",
    label: "Заплата",
    icon: "building-bank",
  },
  {
    id: "freelance",
    label: "Фрийланс",
    icon: "briefcase",
  },
  {
    id: "investment",
    label: "Инвестиции",
    icon: "chart-line",
  },
  {
    id: "other",
    label: "Друго",
    icon: "dots",
  },
];
