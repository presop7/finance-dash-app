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
  goal_id?: string | null;
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
  goal_id?: string | null;
};
export type ApiTransactionUpdate = Partial<Omit<ApiTransactionCreate, "client_generated_id">>;

export type ApiGoalAllocation = { id: string; fund_category_id: string; amount: string; occurred_at: string };
export type ApiGoal = {
  id: string;
  name: string;
  target: string;
  icon: string | null;
  color: string | null;
  created_at: string;
  allocations: ApiGoalAllocation[];
};
export type ApiGoalFields = { name: string; target: number; icon?: string | null; color?: string | null };

export type ApiTransactionBulkFailure = { index: number; detail: string };
export type ApiTransactionBulkResult = {
  created: ApiTransaction[];
  skipped_duplicates: number;
  failed: ApiTransactionBulkFailure[];
};

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
  trial_ends_at?: string | null;
  premium_until?: string | null;
  dev_access?: boolean;
  dev_access_requested_at?: string | null;
  offer_state?: Record<string, unknown> | null;
};
export type ApiTransactionChanges = { transactions: ApiTransaction[]; deleted_ids: string[]; server_time: string };
export type ApiUserSettingsUpdate = Partial<
  Pick<ApiUser, "currency" | "hide_balance" | "time_format" | "date_format" | "offer_state">
>;

// A 409 delete-conflict body from the backend's delete-with-reassign flow.
export type DeleteConflictDetail = {
  message: string;
  transaction_count: number;
};

// ---- Client functions ----

export const financeApi = {
  getMe: () => api.get<ApiUser>("/auth/me"),
  requestDevAccess: () => api.post<ApiUser>("/auth/me/request-dev-access", {}),
  deleteAccount: () => api.delete<void>("/auth/me"),
  updateSettings: (body: ApiUserSettingsUpdate) => api.patch<ApiUser>("/auth/me", body),
  convertCurrency: (body: { from_currency: string; to_currency: string; rate: number }) =>
    api.post<ApiUser>("/auth/me/convert-currency", body),

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
  // Added/edited after `since` and ids deleted after it (since the epoch: all).
  listTransactionChanges: (since: string) =>
    api.get<ApiTransactionChanges>(`/transactions/changes?since=${encodeURIComponent(since)}`),
  createTransaction: (body: ApiTransactionCreate) =>
    api.post<ApiTransaction>("/transactions", body),
  bulkCreateTransactions: (transactions: ApiTransactionCreate[]) =>
    api.post<ApiTransactionBulkResult>("/transactions/bulk", { transactions }),
  updateTransaction: (id: string, body: ApiTransactionUpdate) =>
    api.patch<ApiTransaction>(`/transactions/${id}`, body),
  deleteTransaction: (id: string) => api.delete<void>(`/transactions/${id}`),

  listGoals: () => api.get<ApiGoal[]>("/goals"),
  createGoal: (body: ApiGoalFields) => api.post<ApiGoal>("/goals", body),
  updateGoal: (id: string, body: Partial<ApiGoalFields>) => api.patch<ApiGoal>(`/goals/${id}`, body),
  deleteGoal: (id: string) => api.delete<void>(`/goals/${id}`),
  addGoalAllocation: (goalId: string, body: { fund_category_id: string; amount: number }) =>
    api.post<ApiGoalAllocation>(`/goals/${goalId}/allocations`, body),
  deleteGoalAllocation: (goalId: string, allocationId: string) =>
    api.delete<void>(`/goals/${goalId}/allocations/${allocationId}`),

  // Multipart: title/description/app_info as fields, each picture as an
  // `attachments` part. The backend emails it to the developer.
  sendFeedback: (form: FormData) => api.postForm<void>("/feedback", form),
};
