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
  UpdateLocationDto,
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
  /** GET /workorders → WorkOrder[] */
  getAll: () => api.get<WorkOrder[]>('/workorders'),

  /** GET /workorders/lookups → { personnel, types, categories } */
  getLookups: () => api.get<FormLookups>('/workorders/lookups'),

  /** POST /workorders */
  create: (data: CreateWorkOrderDto) => api.post<{ message: string }>('/workorders', data),
};

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  /** GET /users/me → UserProfile (requires Bearer token) */
  getProfile: () => api.get<UserProfile>('/users/me'),
};

// ─── Teams / Map API ──────────────────────────────────────────────────────────

export const teamsApi = {
  /** GET /teams → TeamMember[] (field worker positions for map) */
  getAll: () => api.get<TeamMember[]>('/teams'),

  /** POST /teams/update-location */
  updateLocation: (data: UpdateLocationDto) =>
    api.post<{ message: string }>('/teams/update-location', data),
};

export default api;
