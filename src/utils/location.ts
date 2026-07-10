import * as Location from 'expo-location';
import { locationApi, teamsApi } from '../services/api';
import { getCurrentUserId, normalizeUserId } from './workOrders';

export type Coordinates = { latitude: number; longitude: number };

export type ResolveLocationOptions = {
  /** GPS için maksimum bekleme (ms). Varsayılan: 4 sn */
  gpsTimeoutMs?: number;
  /** Sunucu isteği için maksimum bekleme (ms). Varsayılan: 5 sn */
  serverTimeoutMs?: number;
  /** Sunucu/önbellek varsa GPS beklemeden dön. Varsayılan: true */
  preferCached?: boolean;
};

const DEFAULT_GPS_TIMEOUT_MS = 4_000;
const DEFAULT_SERVER_TIMEOUT_MS = 5_000;

let resolveInFlight: Promise<Coordinates | null> | null = null;

/** Cihaz + sunucu kaynaklarından konum çözümle (GPS yoksa takılmaz). */
export async function resolveUserLocation(
  options?: ResolveLocationOptions,
): Promise<Coordinates | null> {
  if (resolveInFlight) return resolveInFlight;

  resolveInFlight = doResolveUserLocation(options).finally(() => {
    resolveInFlight = null;
  });
  return resolveInFlight;
}

async function doResolveUserLocation(
  options?: ResolveLocationOptions,
): Promise<Coordinates | null> {
  const gpsTimeoutMs = options?.gpsTimeoutMs ?? DEFAULT_GPS_TIMEOUT_MS;
  const serverTimeoutMs = options?.serverTimeoutMs ?? DEFAULT_SERVER_TIMEOUT_MS;
  const preferCached = options?.preferCached ?? true;

  const [serverLoc, lastKnownLoc] = await Promise.all([
    withTimeout(fetchServerLocation(), serverTimeoutMs, null),
    fetchLastKnownLocation(),
  ]);

  const cached = lastKnownLoc ?? serverLoc;
  if (preferCached && cached) {
    return cached;
  }

  const gpsLoc = await fetchFreshGps(gpsTimeoutMs);
  return gpsLoc ?? cached ?? null;
}

async function fetchServerLocation(): Promise<Coordinates | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const normalized = normalizeUserId(userId);

  try {
    const res = await locationApi.getTeamLocations();
    const mine = res.data.find((m) => normalizeUserId(m.userId) === normalized);
    if (isValidCoords(mine?.latitude, mine?.longitude)) {
      return { latitude: mine!.latitude, longitude: mine!.longitude };
    }
  } catch {
    // /locations/team başarısızsa /teams dene
  }

  try {
    const res = await teamsApi.getAll();
    const mine = res.data.find((t) => normalizeUserId(t.id) === normalized);
    if (mine?.position && isValidCoords(mine.position[0], mine.position[1])) {
      return { latitude: mine.position[0], longitude: mine.position[1] };
    }
  } catch {
    // sunucu yanıt vermedi
  }

  return null;
}

async function fetchLastKnownLocation(): Promise<Coordinates | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const last = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 });
    if (last?.coords && isValidCoords(last.coords.latitude, last.coords.longitude)) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
  } catch {
    // önbellek yok
  }
  return null;
}

async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.status === 'granted';
}

async function fetchFreshGps(timeoutMs: number): Promise<Coordinates | null> {
  try {
    const granted = await ensureForegroundPermission();
    if (!granted) return null;

    const loc = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: true,
      }),
      timeoutMs,
      null,
    );

    if (loc?.coords && isValidCoords(loc.coords.latitude, loc.coords.longitude)) {
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    }
  } catch {
    // GPS zaman aşımı veya sinyal yok
  }
  return null;
}

function isValidCoords(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
