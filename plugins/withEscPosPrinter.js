// Expo config plugin: Epson ESC/POS (react-native-esc-pos-printer) için
// Android Bluetooth izinlerini AndroidManifest'e doğru bayraklarla ekler.
// react-native-esc-pos-printer kendi config plugin'i ile gelmediği için gerekli.
//
// - BLUETOOTH / BLUETOOTH_ADMIN: sadece Android <= 11 (API 30) için (maxSdkVersion 30)
// - BLUETOOTH_SCAN: API 31+; usesPermissionFlags="neverForLocation" ile konum izni gerektirmez
// - BLUETOOTH_CONNECT: API 31+; eşleşmiş yazıcıya bağlanmak için
// - ACCESS_FINE_LOCATION: API 30 ve altında BT keşfi için (maxSdkVersion 30)
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  { name: 'android.permission.BLUETOOTH', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_ADMIN', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_SCAN', neverForLocation: true },
  { name: 'android.permission.BLUETOOTH_CONNECT' },
  { name: 'android.permission.ACCESS_FINE_LOCATION', maxSdkVersion: '30' },
];

module.exports = function withEscPosPrinter(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const perm of PERMISSIONS) {
      // Aynı izni Expo'nun android.permissions dizisi zaten eklediyse, onu bul ve
      // bayrakları güncelle; yoksa yeni ekle. Böylece çift kayıt oluşmaz.
      let entry = manifest['uses-permission'].find(
        (p) => p.$ && p.$['android:name'] === perm.name
      );
      if (!entry) {
        entry = { $: { 'android:name': perm.name } };
        manifest['uses-permission'].push(entry);
      }
      if (perm.maxSdkVersion) {
        entry.$['android:maxSdkVersion'] = perm.maxSdkVersion;
      }
      if (perm.neverForLocation) {
        entry.$['android:usesPermissionFlags'] = 'neverForLocation';
      }
    }

    return cfg;
  });
};
