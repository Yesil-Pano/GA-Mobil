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
} from '../types';
// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
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

  /** PUT /workorders/{id}/status */
  updateStatus: (id: string, status: string, fieldNote?: string) =>
    api.put<{ message: string; status: string }>(`/workorders/${id}/status`, { status, fieldNote }),

  /** PUT /workorders/{id}/schedule — başlangıç/bitiş tarih güncelleme */
  updateSchedule: (id: string, startDate: Date, endDate: Date) =>
    api.put<{ message: string; startDate: string; endDate: string }>(`/workorders/${id}/schedule`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
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

/** Fotoğraf görüntüsü için auth header'lı Image source */
export async function getPhotoImageSource(photoId: string) {
  const token = await SecureStore.getItemAsync('user_token');
  return {
    uri: photosApi.imageUri(photoId),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

export default api;
