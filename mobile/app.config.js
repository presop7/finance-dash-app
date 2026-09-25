// Dynamic config (replaces the old static app.json) so a development build
// can get its own app name and Android/iOS package id, distinct from
// preview/production — otherwise Android treats them as the same app (same
// package id) and installing a dev build would just overwrite whichever one
// is already on the device instead of sitting alongside it. eas.json's
// "development" build profile sets APP_VARIANT=development to select this.
const IS_DEV = process.env.APP_VARIANT === "development";

module.exports = {
  expo: {
    name: IS_DEV ? "Dev Fi-Track" : "Fi-Track",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? "com.presop7.financedash.dev" : "com.presop7.financedash",
    },
    android: {
      package: IS_DEV ? "com.presop7.financedash.dev" : "com.presop7.financedash",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#17181c",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "@react-native-community/datetimepicker",
      "expo-status-bar",
      "expo-font",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          resizeMode: "contain",
          backgroundColor: "#17181c",
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "5374fcaf-e55b-437f-9b71-3334bc4ce12b",
      },
    },
  },
};
