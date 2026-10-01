// Supabase answers in English; show the common cases in the app's language
// (anything else is shown as-is).
const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "auth.errors.invalidCredentials",
  "Email not confirmed": "auth.errors.emailNotConfirmed",
  "User already registered": "auth.errors.alreadyRegistered",
  "Password should be at least 6 characters.": "auth.errors.weakPassword",
  "Unable to validate email address: invalid format": "auth.errors.invalidEmail",
  "Google sign-in needs an app update": "auth.errors.googleNeedsUpdate",
  "Google sign-in failed": "auth.errors.googleFailed",
  "Token has expired or is invalid": "auth.errors.invalidCode",
  "New password should be different from the old password.": "auth.errors.samePassword",
  "email rate limit exceeded": "auth.errors.tooManyRequests",
};

export function translateAuthError(message: string, t: (key: string) => string): string {
  const key = AUTH_ERRORS[message];
  if (key) return t(key);
  // "For security purposes, you can only request this after 52 seconds."
  if (message.startsWith("For security purposes")) return t("auth.errors.tooManyRequests");
  return message;
}
