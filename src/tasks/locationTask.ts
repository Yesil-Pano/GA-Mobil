/**
 * locationTask.ts
 *
 * expo-task-manager ile çalışan arka plan konum görevi.
 * Bu dosyanın app entry point'i (index.ts) yüklenmeden ÖNCE
 * import edilmesi gerekmez — TaskManager.defineTask() global olarak kaydeder.
 * App.tsx import eder ve görev otomatik çalışmaya başlar.
 *
 * Tetiklenme koşulları (pil dostu):
 *   - Her 10 dakikada bir
 *   - VEYA kullanıcı 100 metre yer değiştirdiğinde
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

export const LOCATION_TASK_NAME = 'ga-background-location';

const BASE_URL = 'http://204.168.249.86:8080/api';

export async function pushLocationToBackend(latitude: number, longitude: number) {
  try {
    const token = await SecureStore.getItemAsync('user_token');
    if (!token) return;

    await fetch(`${BASE_URL}/locations/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitude, longitude }),
    });
  } catch (err) {
    // Arka plan görevlerinde loglama sessiz olmalı
    console.warn('[LocationTask] Konum gönderilemedi:', err);
  }
}

// Görevi global olarak kaydet — bu tanım yalnızca bir kez yapılmalı
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.warn('[LocationTask] Hata:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations?.[0];
    if (loc) {
      await pushLocationToBackend(loc.coords.latitude, loc.coords.longitude);
    }
  }
});
