import axios from 'axios';
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
// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  // Saha APK: HTTP (cleartext). Sunucuda bu porta giden instance güncel backend olmalı.
  baseURL: 'http://204.168.249.86:8080/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Automatically attach the stored JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('user_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  /** POST /auth/login → { token, userId, fullName } */
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data),
};

// ─── Work Orders API ─────────────────────────────────────────────────────────

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
};

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  /** GET /users/me → UserProfile (requires Bearer token) */
  getProfile: () => api.get<UserProfile>('/users/me'),
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
  const token = await SecureStore.getItemAsync('user_token');
  return {
    uri: photosApi.imageUri(photoId),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

export default api;
