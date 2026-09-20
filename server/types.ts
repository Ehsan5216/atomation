export type Role = 'ADMIN' | 'USER' | 'WAREHOUSE_USER';
export type WarehouseRole = 'WAREHOUSE_ADMIN' | 'WAREHOUSE_USER';

export const JOB_TITLES = [
  'تکنسین تعمیرکار اعلام حریق',
  'تکنسین اعلام حریق',
  'فورمن اعلام حریق',
  'مهندس اعلام حریق',
  'مهندس ارشد اعلام حریق',
  'مدیر ارشد سیستم',
] as const;

export type JobTitle = (typeof JOB_TITLES)[number] | string;

export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface User {
  id: string;
  username: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  personnelCode?: string;
  jobTitle: string;
  warehouseRole: WarehouseRole;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  tokenVersion?: number;
  createdAt: string;
  lastLogin?: string | null;
}

export interface RequestItem {
  id: string;
  type: string;
  userId: string;
  userName: string;
  userJobTitle: string;
  userPersonnelCode?: string;
  status: string;
  targetDate: string;
  shift: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  timeline?: RequestTimelineItem[];
}

export interface RequestTimelineItem {
  id: string;
  requestId: string;
  userId?: string | null;
  userName: string;
  jobTitle: string;
  action: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface GraphItem {
  id: string;
  registeredById?: string | null;
  registeredByName: string;
  graphDate: string;
  shift: string;
  participantIds: string[];
  participantNames: string[];
  smokeDetector: number;
  heatDetector: number;
  manualCallPoint: number;
  powerSupply: number;
  controlPanel: number;
  modules: number;
  sounder: number;
  notes?: string | null;
  createdAt: string;
}

export interface MessageItem {
  id: string;
  senderId: string;
  senderName: string;
  senderJobTitle?: string;
  recipientId: string;
  recipientName: string;
  recipientJobTitle?: string;
  subject: string;
  body: string;
  attachmentFilename?: string | null;
  attachmentOriginalName?: string | null;
  attachmentSize?: number | null;
  attachmentMime?: string | null;
  attachmentUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Shelf {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  warehouseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  name: string;
  code: string;
  category: string;
  brand: string;
  model: string;
  unit: string;
  description: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  totalStock?: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  itemId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  uploadedById?: string | null;
  createdAt: string;
}

export interface Inventory {
  id: string;
  itemId: string;
  warehouseId: string;
  shelfId: string;
  quantity: number;
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  type: TransactionType;
  itemId: string;
  quantity: number;
  sourceWarehouseId?: string | null;
  sourceShelfId?: string | null;
  destWarehouseId?: string | null;
  destShelfId?: string | null;
  userId: string;
  notes?: string | null;
  referenceNo?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  username: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  fullName: string;
  role: Role;
  jobTitle?: string;
  warehouseRole?: WarehouseRole;
  personnelCode?: string;
  tokenVersion?: number;
}
