// Developer-only tools (test data buttons, diagnostics). Shown in a dev
// server bundle, or when EXPO_PUBLIC_DEV_TOOLS=true is set in the local
// .env — needed because the dev client is often run with --no-dev (which
// turns __DEV__ off). EAS beta/store builds never set it, so testers and
// users never see these.
export const DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === "true";
