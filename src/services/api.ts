import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type {
  LoginRequest,
  LoginResponse,
  WorkOrder,
  CreateWorkOrderDto,
  FormLookups,
  UserProfile,
  TeamMember,
  TeamMemberLocation,
  ChatMessageDto,
  MyConversationResponse,
} from '../types';
import { emitAuthSessionExpired } from '../utils/authSession';
import {
  clearSessionTokens,
  getAccessToken,
  tryRefreshSession,
} from '../utils/sessionTokens';

const BASE_URL = 'http://204.168.249.86:8080/api';

const authClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const code = (error.response?.data as { code?: string })?.code;
    const original = error.config as RetryConfig | undefined;

    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        const token = await getAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
        }
        return api.request(original);
      }
    }

    if (status === 401 || code === 'DEMO_EXPIRED' || code === 'TENANT_INACTIVE') {
      if (code === 'DEMO_EXPIRED') {
        await SecureStore.setItemAsync(
          'ga_logout_reason',
          (error.response?.data as { message?: string })?.message ||
            'Demo süreniz dolmuştur. Erişim kapatıldı.',
        );
      } else if (code === 'TENANT_INACTIVE') {
        await SecureStore.setItemAsync(
          'ga_logout_reason',
          (error.response?.data as { message?: string })?.message ||
            'Firma erişimi kapatıldı.',
        );
      }
      await clearSessionTokens();
      await SecureStore.deleteItemAsync('remember_me');
      emitAuthSessionExpired();
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (data: LoginRequest) => authClient.post<LoginResponse>('/auth/login', data),
  refresh: (data: { refreshToken: string }) =>
    authClient.post<LoginResponse>('/auth/refresh', data),
  logout: (data: { refreshToken: string }) =>
    authClient.post<{ message: string }>('/auth/logout', data),
};

// ─── Work Orders API ─────────────────────────────────────────────────────────

export const usersApi = {
  /** GET /users/me → UserProfile (requires Bearer token) */
  getProfile: () => api.get<UserProfile>('/users/me'),

  /** GET /users/me/authorization-document → PDF blob (Yetki Belgesi) */
  getAuthorizationDocument: () =>
    api.get<ArrayBuffer>('/users/me/authorization-document', {
      responseType: 'arraybuffer',
      timeout: 60_000,
    }),
};

export const workOrdersApi = {
  /** GET /workorders → WorkOrder[] (scope=mine: yalnızca oturum açan kullanıcıya atananlar) */
  getAll: () => api.get<WorkOrder[]>('/workorders', { params: { scope: 'mine' } }),

  /** GET /workorders/lookups → { personnel, types, categories } */
  getLookups: () => api.get<FormLookups>('/workorders/lookups'),

  /** POST /workorders */
  create: (data: CreateWorkOrderDto) => api.post<{ message: string }>('/workorders', data),

  /** PUT|POST /workorders/{id}/status — nginx PUT engeline karşı POST yedek */
  updateStatus: (id: string, status: string, fieldNote?: string) =>
    api.post<{
      message: string;
      status: string;
      startedAt?: string | null;
      completedAt?: string | null;
      cancelledAt?: string | null;
    }>(`/workorders/${id}/status`, { status, fieldNote }),

  /** POST /workorders/{id}/translate — TR→EN (TESLA) */
  translate: (id: string) =>
    api.post<{
      titleEn?: string;
      descriptionEn?: string;
      mobileDescriptionEn?: string;
      fieldNoteEn?: string | null;
      translationProvider?: string;
      translatedAt?: string;
    }>(`/workorders/${id}/translate`, null, { timeout: 90_000 }),
};

// ─── Teams / Map API ──────────────────────────────────────────────────────────

export const teamsApi = {
  /** GET /teams → TeamMember[] (field worker list) */
  getAll: () => api.get<TeamMember[]>('/teams'),
};

// ─── Location API ─────────────────────────────────────────────────────────────

export const locationApi = {
  /** PUT /locations/me — kendi konumunu güncelle */
  updateMyLocation: (latitude: number, longitude: number) =>
    api.put<void>('/locations/me', { latitude, longitude }),

  /** GET /locations/team — aynı tenant'taki canlı konumlar */
  getTeamLocations: () =>
    api.get<TeamMemberLocation[]>('/locations/team'),
};

// ─── Notifications API ────────────────────────────────────────────────────────

export const notificationsApi = {
  /** GET /notifications — sahacı için yalnızca kendisine hedeflenenler */
  getMine: (take = 5) =>
    api.get<{
      unread: number;
      items: Array<{
        id: string;
        title: string;
        message: string;
        type: string;
        workOrderId?: string | null;
        isRead: boolean;
        createdAt: string;
      }>;
    }>('/notifications', { params: { take } }),

  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ─── Devices / Push ───────────────────────────────────────────────────────────

export const devicesApi = {
  registerPushToken: (payload: { token: string; platform?: string; deviceName?: string }) =>
    api.post<{ message: string }>('/devices/push-token', payload),

  unregisterPushToken: (payload: { token: string }) =>
    api.delete<{ message: string }>('/devices/push-token', { data: payload }),
};

// ─── Photos API ───────────────────────────────────────────────────────────────

export const photosApi = {
  /** POST /photos — base64 fotoğraf yükle */
  upload: (payload: {
    base64Data: string;
    fileName: string;
    contentType: string;
    entityType: string;
    entityId: string;
    description?: string;
  }) => api.post<{ id: string }>('/photos', payload, { timeout: 120_000 }),

  /** GET /photos/{entityType}/{entityId} — metadata listesi */
  list: (entityType: string, entityId: string) =>
    api.get<Array<{ id: string; fileName: string; fileSize: number; createdAt: string; description?: string | null }>>(
      `/photos/${entityType}/${entityId}`,
    ),

  /** GET /photos/{id}/image — görüntü URI (Authorization header gerekir) */
  imageUri: (photoId: string) => `${api.defaults.baseURL}/photos/${photoId}/image`,

  /** DELETE /photos/{id} */
  remove: (id: string) => api.delete(`/photos/${id}`),
};

// ─── Chat API (ofis ↔ saha) ───────────────────────────────────────────────────

export const chatApi = {
  /** GET /chat/conversation — kendi Operasyon konuşması */
  getMyConversation: (take = 50) =>
    api.get<MyConversationResponse>('/chat/conversation', { params: { take } }),

  /** POST /chat/messages — kendi konuşmasına gönder */
  sendMessage: (body: string, clientMessageId?: string) =>
    api.post<ChatMessageDto>('/chat/messages', { body, clientMessageId }),

  /** POST /chat/conversations/{id}/read (nginx PUT engeli için) */
  markRead: (conversationId: string) =>
    api.post<{ message: string }>(`/chat/conversations/${conversationId}/read`),

  /** GET /chat/unread-count */
  unreadCount: () => api.get<{ count: number }>('/chat/unread-count'),
};

/** SignalR hub tabanı — api baseURL'den /api kaldırılır */
export function getChatHubUrl(): string {
  const base = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
  return `${base}/hubs/chat`;
}

/** Fotoğraf görüntüsü için auth header'lı Image source */
export async function getPhotoImageSource(photoId: string) {
  const token = await getAccessToken();
  return {
    uri: photosApi.imageUri(photoId),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

export default api;
