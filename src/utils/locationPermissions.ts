import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

const BG_PROMPTED_KEY = 'ga_bg_location_prompted';
const BG_DECLINED_KEY = 'ga_bg_location_declined';

function isGranted(status: Location.PermissionStatus | string): boolean {
  return status === Location.PermissionStatus.GRANTED || status === 'granted';
}

/** Ön plan konum izni — yalnızca henüz verilmemişse sorar. */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (isGranted(current.status)) return true;
  if (current.status === 'denied' && current.canAskAgain === false) return false;
  if (current.status === 'denied') return false;

  const requested = await Location.requestForegroundPermissionsAsync();
  return isGranted(requested.status);
}

/**
 * Arka plan konum izni — uygulama her açılışında sormaz.
 * Yalnızca undetermined veya ilk kez yükseltme gerektiğinde tek seferlik dener.
 */
export async function ensureBackgroundLocationPermission(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!isGranted(fg.status)) {
    const fgOk = await ensureForegroundLocationPermission();
    if (!fgOk) return false;
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  if (isGranted(bg.status)) return true;

  if (bg.canAskAgain === false) return false;

  const declined = await SecureStore.getItemAsync(BG_DECLINED_KEY);
  if (declined === 'true') return false;

  const prompted = await SecureStore.getItemAsync(BG_PROMPTED_KEY);
  if (prompted === 'true' && bg.status === 'denied') return false;

  await SecureStore.setItemAsync(BG_PROMPTED_KEY, 'true');
  const requested = await Location.requestBackgroundPermissionsAsync();
  if (!isGranted(requested.status)) {
    await SecureStore.setItemAsync(BG_DECLINED_KEY, 'true');
    return false;
  }

  await SecureStore.deleteItemAsync(BG_DECLINED_KEY);
  return true;
}
