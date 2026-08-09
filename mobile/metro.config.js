// Learn more https://docs.expo.dev/guides/monorepos/#modify-the-metro-config
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zustand's package.json "exports" map resolves to an ESM build on web
// (esm/middleware.mjs) that contains raw `import.meta.env` for Vite
// compatibility. Metro doesn't strip import.meta, and Expo's web bundle
// is served as a classic (non-module) script, so the browser throws
// "Cannot use 'import.meta' outside a module" and the whole bundle fails
// to parse. Disabling package-exports resolution makes Metro fall back to
// the CJS "main" entry, which uses process.env.NODE_ENV instead.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
