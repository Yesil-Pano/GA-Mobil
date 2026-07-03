const { withAndroidManifest } = require('@expo/config-plugins');
const { getMainApplicationOrThrow } = require('@expo/config-plugins/build/android/Manifest');

/**
 * app.json'daki android.usesCleartextTraffic ayarını AndroidManifest'e yazar.
 * Release APK'da HTTP istekleri varsayılan olarak engellenir; bu olmadan login "Network Error" verir.
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const enabled = config.android?.usesCleartextTraffic ?? false;
    const mainApplication = getMainApplicationOrThrow(config.modResults);
    mainApplication.$['android:usesCleartextTraffic'] = String(enabled);
    return config;
  });
};
