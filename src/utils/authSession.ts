import { DeviceEventEmitter } from 'react-native';

/** DEMO süresi / tenant pasif / 401 sonrası AppShell oturumu kapatır */
export const AUTH_SESSION_EXPIRED = 'ga_auth_session_expired';

export function emitAuthSessionExpired() {
  DeviceEventEmitter.emit(AUTH_SESSION_EXPIRED);
}
