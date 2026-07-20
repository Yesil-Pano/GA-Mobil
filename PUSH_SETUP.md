# Android OS Push (WhatsApp tarzı) — Firebase kurulumu

Android'de uygulama kapalıyken bildirim için **Firebase Cloud Messaging (FCM)** zorunludur.

## Adımlar (5–10 dk)

1. https://console.firebase.google.com → proje oluştur (veya mevcut)
2. Android uygulaması ekle → paket adı: `com.theobuz.GAMobil`
3. `google-services.json` indir
4. Dosyayı şuraya koy: `GA-Mobil/google-services.json`
5. `app.json` içinde `android.googleServicesFile` alanını ekle:

```json
"android": {
  "googleServicesFile": "./google-services.json",
  ...
}
```

6. Expo FCM V1 anahtarını EAS'e yükle (tercihen):
   - `npx eas credentials` → Android → Google Service Account / FCM V1
7. Yeniden: `npx expo prebuild --platform android` (gerekirse) + release APK

Kod tarafı (token kaydı + Expo Push API + atama/sohbet tetikleyicileri) hazırdır.
`google-services.json` olmadan token üretimi Android release APK'da başarısız olur; uygulama açılır ama OS push gelmez.
