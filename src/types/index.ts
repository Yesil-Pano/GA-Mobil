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

export interface UpdateLocationDto {
  teamUserId: string;
  latitude: number;
  longitude: number;
}

// ─── Navigation Param Lists ───────────────────────────────────────────────────

export type WorkOrdersStackParamList = {
  WorkOrdersList: undefined;
  WorkOrderDetail: { workOrder: WorkOrder };
};

export type RootTabParamList = {
  'İş Emirleri': undefined;
  'Harita': undefined;
  'Genel Bakış': undefined;
  'Sohbet': undefined;
  'Profil': undefined;
};
