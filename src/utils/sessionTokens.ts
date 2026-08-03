import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'user_token';
const REFRESH_KEY = 'refresh_token';

export function decodeJwtExp(token: string): number | null {
  try {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Access token süresi withinMinutes içinde dolacaksa true */
export function shouldRefreshAccessToken(token: string, withinMinutes = 15): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec <= withinMinutes * 60;
}

export async function saveSessionTokens(accessToken: string, refreshToken?: string | null): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearSessionTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Refresh token ile yeni access token al. Başarılıysa true. */
export async function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    try {
      const { authApi } = await import('../services/api');
      const { data } = await authApi.refresh({ refreshToken });
      if (!data.token) return false;
      await saveSessionTokens(data.token, data.refreshToken ?? refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Oturum var mı — access veya refresh ile */
export async function hasStoredSession(): Promise<boolean> {
  const access = await getAccessToken();
  if (access) return true;
  const refresh = await getRefreshToken();
  return !!refresh;
}
