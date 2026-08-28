import { api } from "./api";

// ---- Wire types (mirror backend Pydantic schemas, snake_case) ----

export type ApiCategoryType = "income" | "expense";

export type ApiCategory = {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  type: ApiCategoryType;
};
export type ApiCategoryCreate = {
  name: string;
  icon?: string | null;
  color?: string | null;
  type: ApiCategoryType;
};
export type ApiCategoryUpdate = Partial<ApiCategoryCreate>;

export type ApiFundCategory = {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  icon: string | null;
  color: string | null;
  created_at: string;
};
export type ApiFundCategoryCreate = {
  name: string;
  currency: string;
  icon?: string | null;
  color?: string | null;
};
export type ApiFundCategoryUpdate = Partial<ApiFundCategoryCreate>;

export type ApiTransaction = {
  id: string;
  title: string;
  fund_category_id: string;
  category_id: string;
  amount: string;
  currency: string;
  type: "income" | "expense";
  note: string | null;
  occurred_at: string;
  created_at: string;
  client_generated_id: string;
};
export type ApiTransactionCreate = {
  title: string;
  fund_category_id: string;
  category_id: string;
  amount: number;
  currency: string;
  type: "income" | "expense";
  note?: string | null;
  occurred_at: string;
  client_generated_id: string;
};
export type ApiTransactionUpdate = Partial<Omit<ApiTransactionCreate, "client_generated_id">>;

export type ApiUser = {
  id: string;
  auth_provider_id: string;
  email: string;
  display_name: string;
  created_at: string;
  currency: string;
  hide_balance: boolean;
  time_format: "12h" | "24h";
  date_format: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "D MMM YYYY";
};
export type ApiUserSettingsUpdate = Partial<
  Pick<ApiUser, "currency" | "hide_balance" | "time_format" | "date_format">
>;

// A 409 delete-conflict body from the backend's delete-with-reassign flow.
export type DeleteConflictDetail = {
  message: string;
  transaction_count: number;
};

// ---- Client functions ----

export const financeApi = {
  getMe: () => api.get<ApiUser>("/auth/me"),
  updateSettings: (body: ApiUserSettingsUpdate) => api.patch<ApiUser>("/auth/me", body),

  listCategories: () => api.get<ApiCategory[]>("/categories"),
  createCategory: (body: ApiCategoryCreate) => api.post<ApiCategory>("/categories", body),
  updateCategory: (id: string, body: ApiCategoryUpdate) =>
    api.patch<ApiCategory>(`/categories/${id}`, body),
  deleteCategory: (id: string, confirm = false) =>
    api.delete<void>(`/categories/${id}${confirm ? "?confirm=true" : ""}`),

  listFundCategories: () => api.get<ApiFundCategory[]>("/fund_categories"),
  createFundCategory: (body: ApiFundCategoryCreate) =>
    api.post<ApiFundCategory>("/fund_categories", body),
  updateFundCategory: (id: string, body: ApiFundCategoryUpdate) =>
    api.patch<ApiFundCategory>(`/fund_categories/${id}`, body),
  deleteFundCategory: (id: string, confirm = false) =>
    api.delete<void>(`/fund_categories/${id}${confirm ? "?confirm=true" : ""}`),

  listTransactions: () => api.get<ApiTransaction[]>("/transactions"),
  createTransaction: (body: ApiTransactionCreate) =>
    api.post<ApiTransaction>("/transactions", body),
  updateTransaction: (id: string, body: ApiTransactionUpdate) =>
    api.patch<ApiTransaction>(`/transactions/${id}`, body),
  deleteTransaction: (id: string) => api.delete<void>(`/transactions/${id}`),
};
