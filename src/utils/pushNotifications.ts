import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { devicesApi } from '../services/api';

let handlerConfigured = false;

function ensureNotificationHandler() {
  if (handlerConfigured) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  } catch (err) {
    console.warn('[Push] Notification handler kurulamadı:', err);
  }
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/** İzin al, Expo push token üret, backend'e kaydet. FCM yoksa sessizce null döner — uygulamayı düşürmez. */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    ensureNotificationHandler();

    if (!Device.isDevice) {
      console.warn('[Push] Fiziksel cihaz gerekli.');
      return null;
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Görev Adamı',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#F97316',
          sound: 'default',
        });
      } catch (err) {
        console.warn('[Push] Kanal oluşturulamadı:', err);
      }
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Push] Bildirim izni verilmedi.');
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[Push] Expo projectId bulunamadı (app.json extra.eas.projectId).');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;
    await devicesApi.registerPushToken({
      token,
      platform: Platform.OS,
      deviceName: Device.modelName ?? Device.deviceName ?? undefined,
    });
    console.log('[Push] Token kaydedildi:', token.slice(0, 28) + '…');
    return token;
  } catch (err) {
    console.warn('[Push] Kayıt atlandı (FCM/google-services veya izin):', err);
    return null;
  }
}

export async function unregisterPushToken(token: string | null) {
  if (!token) return;
  try {
    await devicesApi.unregisterPushToken({ token });
  } catch {
    /* ignore */
  }
}

export function addNotificationResponseListener(
  handler: (data: Record<string, unknown>) => void
) {
  try {
    ensureNotificationHandler();
    return Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      handler(data);
    });
  } catch (err) {
    console.warn('[Push] Response listener eklenemedi:', err);
    return { remove: () => undefined };
  }
}
