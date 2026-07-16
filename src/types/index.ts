// ─── Auth Models ─────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  username: string;
  fullName: string;
  message?: string;
}

// ─── Work Order Models ────────────────────────────────────────────────────────

/** Shape returned by GET /api/workorders */
export interface WorkOrder {
  id: string;
  title: string;
  customerName: string;
  description: string;
  mobileDescription: string;
  address: string;
  priority: string;
  status: string;
  /** "workType" in entity, serialised as "type" by the backend controller */
  type: string;
  /** "workCategory" in entity, serialised as "category" by the backend controller */
  category: string;
  startDate: string;
  endDate: string;
  plannedDate: string;
  /** [latitude, longitude] */
  position: [number, number];
  assignedToUserId: string | null;
  operationUserName: string;
  openedByUserName: string;
  assignedToUserName: string;
  fieldNote?: string | null;
  fieldNoteAddedAt?: string | null;
  isPeriodic?: boolean;
  recurrenceInterval?: string;
  nextExecutionDate?: string | null;
}

export interface CreateWorkOrderDto {
  title: string;
  customerName: string;
  description: string;
  mobileDescription: string;
  address: string;
  priority: string;
  workType: string;
  workCategory: string;
  startDate: string;
  endDate: string;
  latitude: number;
  longitude: number;
  operationUserId?: string;
  openedByUserId?: string;
  assignedToUserId?: string;
}

export interface FormLookups {
  personnel: Array<{ id: string; fullName: string }>;
  types: string[];
  categories: string[];
}

// ─── User / Profile Models ────────────────────────────────────────────────────

export interface UserProfile {
  fullName: string;
  email: string;
  companyName: string;
}

// ─── Team / Map Models ────────────────────────────────────────────────────────

/** Shape returned by GET /api/teams */
export interface TeamMember {
  id: string;
  name: string;
  phone: string;
  project: string;
  plate: string;
  teamLeader: string;
  /** [latitude, longitude] */
  position: [number, number];
}

/** Shape returned by GET /api/locations/team — canlı konum */
export interface TeamMemberLocation {
  userId: string;
  fullName: string;
  username: string;
  latitude: number;
  longitude: number;
  updatedAt: string | null;
}

// ─── Chat Models (ofis ↔ saha 1:1) ────────────────────────────────────────────

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  isFromFieldWorker: boolean;
  body: string;
  sentAt: string;
  clientMessageId?: string | null;
}

export interface MyConversationResponse {
  id: string;
  counterpartyLabel: string;
  unreadCount: number;
  messages: ChatMessageDto[];
}

import type { PhotoCategory } from '../constants/photos';

/** Mobilde seçilen fotoğraf — URI (görüntü) + base64 (yükleme) */
export interface PhotoItem {
  uri: string;
  base64: string;
  fileName: string;
  mimeType: string;
  category: PhotoCategory;
}

/** Sunucudan yüklenen fotoğraf metadata + görüntü URI */
export interface SavedPhotoItem {
  id: string;
  uri: string;
  fileName: string;
  category: PhotoCategory | null;
  headers?: Record<string, string>;
}

// ─── Navigation Param Lists ───────────────────────────────────────────────────

export type WorkOrdersStackParamList = {
  WorkOrdersList: undefined;
  WorkOrderDetail: { workOrder: WorkOrder };
};

export type RootTabParamList = {
  'İş Emirleri': undefined;
  'Harita': { focusLatitude?: number; focusLongitude?: number; focusLabel?: string } | undefined;
  'Genel Bakış': undefined;
  'Sohbet': undefined;
  'Profil': undefined;
};
