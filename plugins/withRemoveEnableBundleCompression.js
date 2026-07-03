const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * React Native 0.79 öncesinde 'enableBundleCompression' özelliği
 * ReactExtension'da mevcut değildi ve build hatası veriyordu.
 * Bu plugin sadece o satırı kaldırır.
 * NOT: 'REACT_NATIVE_RELEASE_LEVEL' satırı RN 0.81+ için GEREKLİ —
 * bu satırı kaldırmıyoruz.
 */
module.exports = function withRemoveEnableBundleCompression(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents
      .replace(/[ \t]*enableBundleCompression[^\n]*\n/g, '');
    return config;
  });
};
