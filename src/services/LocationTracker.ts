// GA-Mobil/src/services/LocationTracker.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import api from './api';

const LOCATION_TASK_NAME = 'GOREV_ADAMI_TRACKER';

interface LocationCoords { latitude: number; longitude: number; }
interface LocationObject { coords: LocationCoords; timestamp: number; }
interface TaskManagerData { locations: LocationObject[]; }

// 🚀 ARKA PLAN GÖREVİ: Giriş yapan gerçek personelin ID'sini hafızadan okur ve canlandırır
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  
  if (data) {
    const taskData = data as TaskManagerData;
    if (taskData.locations && taskData.locations.length > 0) {
      const { latitude, longitude } = taskData.locations[0].coords;
      
      try {
        // 🔒 GERÇEK VERİ: Giriş anında SecureStore'a mühürlediğimiz gerçek kullanıcı GUID'sini çekiyoruz
        const savedUserId = await SecureStore.getItemAsync('user_id');
        
        if (savedUserId) {
          await api.post('/teams/update-location', {
            teamUserId: savedUserId,
            latitude: latitude,
            longitude: longitude
          });
          console.log(`[7/24 Canlı Konum] Sunucuya işlendi: ${latitude}, ${longitude}`);
        }
      } catch (apiError) {
        console.error("Konum sunucuya gönderilemedi:", apiError);
      }
    }
  }
});

export async function startBackgroundLocationTracking(): Promise<void> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') return;

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000, // 5 Dakikada bir tetiklenir
    distanceInterval: 50,
    foregroundService: {
      notificationTitle: "Görev Adamı Sistemi Aktif",
      notificationBody: "Saha koordinatlarınız merkeze anlık raporlanıyor.",
      notificationColor: "#1A233A"
    }
  });
}