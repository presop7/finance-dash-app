# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This project is on **SDK 57** (React Native 0.86, React 19.2). Keep this link in
sync with the installed SDK whenever it's upgraded — pointing at the wrong
version's docs is worse than having no link.

## Expo Go caveat

`expo-notifications` throws on import on Android in Expo Go (push support was
removed there in SDK 53), so it's loaded lazily in `utils/notifications.ts` and
skipped in that environment. Don't add a top-level
`import ... from "expo-notifications"` anywhere — it will crash the app at
launch on Android. Device notifications need a development build.
