module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // expo-router/babel is built into babel-preset-expo in SDK 50+, so no extra plugin needed
    plugins: []
  };
};
