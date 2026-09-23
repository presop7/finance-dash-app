module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-detects react-native-worklets (a
    // react-native-reanimated dependency) being installed and adds its
    // babel plugin itself — no manual `plugins` entry needed here.
    presets: ["babel-preset-expo"],
  };
};
