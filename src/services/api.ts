import {
  User,
  Warehouse,
  Shelf,
  Item,
  InventoryItem,
  StockTransaction,
  AuditLog,
  DashboardMetrics,
} from '../types/index.js';
import { localDb } from './localDatabase.js';
import { downloadExcelFile } from '../utils/excelExport.js';
import { formatShamsiDate } from '../utils/persian.js';

export const SERVER_DISCONNECTED_MESSAGE = 'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.';

class ApiService {
  private customBaseUrl: string = '';
  private useLocalMode: boolean = false;
  private modeChecked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.customBaseUrl = localStorage.getItem('wms_api_base_url') || '';
      // On Railway Full-Stack, Frontend and Backend run together on the same origin.
      // Offline local mode is only used if explicitly toggled in settings.
      this.useLocalMode = localStorage.getItem('wms_force_local_mode') === 'true';
    }
  }

  getApiBaseUrl(): string {
    return this.customBaseUrl;
  }

  setApiBaseUrl(url: string) {
    this.customBaseUrl = url.trim().replace(/\/+$/, '');
    if (this.customBaseUrl) {
      localStorage.setItem('wms_api_base_url', this.customBaseUrl);
    } else {
      localStorage.removeItem('wms_api_base_url');
    }
  }

  isUsingLocalMode(): boolean {
    return this.useLocalMode;
  }

  setLocalMode(enabled: boolean) {
    this.useLocalMode = enabled;
    if (enabled) {
      localStorage.setItem('wms_force_local_mode', 'true');
    } else {
      localStorage.removeItem('wms_force_local_mode');
    }
  }

  private getToken(): string | null {
    return localStorage.getItem('wms_auth_token');
  }

  setToken(token: string) {
    localStorage.setItem('wms_auth_token', token);
  }

  clearToken() {
    localStorage.removeItem('wms_auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.customBaseUrl ? `${this.customBaseUrl}${endpoint}` : endpoint;
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errMessage = 'خطایی در پردازش درخواست رخ داد.';
        try {
          const errorData = await response.json();
          errMessage = errorData.error || errMessage;
        } catch {
          if (response.status === 404) {
            errMessage = 'مورد یا آدرس درخواستی یافت نشد.';
          } else if (response.status === 401) {
            errMessage = 'نشست کاربری شما منقضی شده است. مجدداً وارد شوید.';
          } else if (response.status === 403) {
            errMessage = 'شما دسترسی لازم برای انجام این عملیات را ندارید.';
          }
        }
        throw new Error(errMessage);
      }

      return await response.json();
    } catch (error: any) {
      // If network failure or server unreachable
      if (
        error.name === 'TypeError' ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('fetch failed')
      ) {
        throw new Error(SERVER_DISCONNECTED_MESSAGE);
      }
      throw error;
    }
  }

  // --- Health Check & Mode Probe ---
  async getHealth(): Promise<{ status: string; warehousesCount: number; isLocalMode: boolean; database?: string }> {
    if (this.useLocalMode) {
      const wh = await localDb.getWarehouses();
      return {
        status: 'آفلاین (پایگاه‌داده محلی مرورگر)',
        warehousesCount: wh.warehouses.length,
        isLocalMode: true,
      };
    }

    try {
      const res = await this.request<{ status: string; warehousesCount: number; database?: string }>('/api/health');
      this.modeChecked = true;
      return { ...res, isLocalMode: false };
    } catch {
      this.modeChecked = true;
      return {
        status: SERVER_DISCONNECTED_MESSAGE,
        warehousesCount: 0,
        isLocalMode: false,
      };
    }
  }

  // --- Auth ---
  async login(credentials: { username: string; password: string }) {
    if (this.useLocalMode) {
      const res = await localDb.login(credentials);
      this.setToken(res.token);
      return res;
    }

    const res = await this.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(res.token);
    return res;
  }

  async getMe() {
    const token = this.getToken();
    if (!token) {
      throw new Error('لطفاً ابتدا با نام کاربری و کلمه عبور وارد سامانه شوید.');
    }

    if (this.useLocalMode) {
      return localDb.getMe(token);
    }

    return await this.request<{ user: User }>('/api/auth/me');
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    if (this.useLocalMode) {
      const me = await this.getMe();
      return localDb.changePassword(me.user.id, data.currentPassword, data.newPassword);
    }

    return this.request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    if (!this.useLocalMode) {
      try {
        await this.request('/api/auth/logout', { method: 'POST' });
      } catch {}
    }
    this.clearToken();
  }

  // --- Warehouses & Shelves ---
  async getWarehouses() {
    if (this.useLocalMode) return localDb.getWarehouses();
    return this.request<{ warehouses: Warehouse[] }>('/api/warehouses');
  }

  async createWarehouse(data: { name: string; code: string; description?: string }) {
    if (this.useLocalMode) return localDb.createWarehouse(data);
    return this.request<{ warehouse: Warehouse }>('/api/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>) {
    if (this.useLocalMode) return localDb.updateWarehouse(id, data);
    return this.request<{ warehouse: Warehouse }>(`/api/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWarehouse(id: string) {
    if (this.useLocalMode) return localDb.deleteWarehouse(id);
    return this.request<{ success: boolean; message?: string }>(`/api/warehouses/${id}`, {
      method: 'DELETE',
    });
  }

  async getShelves(warehouseId?: string) {
    if (this.useLocalMode) return localDb.getShelves(warehouseId);
    const query = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '';
    return this.request<{ shelves: Shelf[] }>(`/api/warehouses/all-shelves/list${query}`);
  }

  async createShelf(data: { name: string; code: string; warehouseId: string; description?: string }) {
    if (this.useLocalMode) return localDb.createShelf(data);
    return this.request<{ shelf: Shelf }>('/api/warehouses/shelves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateShelf(id: string, data: Partial<Shelf>) {
    if (this.useLocalMode) return localDb.updateShelf(id, data);
    return this.request<{ shelf: Shelf }>(`/api/warehouses/shelves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteShelf(id: string) {
    if (this.useLocalMode) return localDb.deleteShelf(id);
    return this.request<{ success: boolean; message?: string }>(`/api/warehouses/shelves/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Items ---
  async getItems(search?: string) {
    if (this.useLocalMode) return localDb.getItems(search);
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<{ items: Item[] }>(`/api/items${query}`);
  }

  async getItemById(id: string) {
    if (this.useLocalMode) return localDb.getItemById(id);
    return this.request<{
      item: Item & {
        totalStock: number;
        inventories: (InventoryItem & { warehouseName: string; shelfName: string })[];
        attachments?: any[];
        transactions: StockTransaction[];
      };
    }>(`/api/items/${id}`);
  }

  async createItem(data: {
    name: string;
    code: string;
    category: string;
    brand: string;
    model: string;
    unit?: string;
    description?: string;
    imageUrl?: string;
  }) {
    if (this.useLocalMode) return localDb.createItem(data);
    return this.request<{ item: Item }>('/api/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateItem(id: string, data: Partial<Item>) {
    if (this.useLocalMode) return localDb.updateItem(id, data);
    return this.request<{ item: Item }>(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteItem(id: string) {
    if (this.useLocalMode) return localDb.deleteItem(id);
    return this.request<{ success: boolean; message?: string }>(`/api/items/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadItemPdf(itemId: string, file: File) {
    if (this.useLocalMode) return localDb.uploadItemPdf(itemId, file);
    const formData = new FormData();
    formData.append('catalogPdf', file);
    return this.request<{ attachment: any }>(`/api/items/${itemId}/upload-pdf`, {
      method: 'POST',
      body: formData,
    });
  }

  async deleteItemAttachment(itemId: string, attachmentId: string) {
    if (this.useLocalMode) return localDb.deleteItemAttachment(itemId, attachmentId);
    return this.request<{ success: boolean }>(`/api/items/${itemId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  // --- Stock Operations ---
  async stockIn(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
  }) {
    if (this.useLocalMode) return localDb.stockIn(data);
    return this.request<{ success: boolean; transaction: StockTransaction; newQuantity: number }>(
      '/api/stock/in',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async stockOut(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
  }) {
    if (this.useLocalMode) return localDb.stockOut(data);
    return this.request<{ success: boolean; transaction: StockTransaction; remainingQuantity: number }>(
      '/api/stock/out',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async transferStock(data: {
    itemId: string;
    sourceWarehouseId: string;
    sourceShelfId: string;
    destWarehouseId: string;
    destShelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
  }) {
    if (this.useLocalMode) return localDb.transferStock(data);
    return this.request<{
      success: boolean;
      transaction: StockTransaction;
      sourceRemaining: number;
      destNewQuantity: number;
    }>('/api/stock/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async correctiveAdjustment(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    newTargetQuantity: number;
    reason: string;
  }) {
    if (this.useLocalMode) return localDb.correctiveAdjustment(data);
    return this.request<{ success: boolean; transaction: StockTransaction; difference: number }>(
      '/api/stock/adjust',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getTransactions(filters?: Record<string, string | number>) {
    if (this.useLocalMode) return localDb.getTransactions(filters);
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.append(k, String(v));
      });
    }
    return this.request<{ transactions: StockTransaction[] }>(`/api/stock/transactions?${params.toString()}`);
  }

  // --- Inventory & Dashboard ---
  async getInventory(filters?: Record<string, string>) {
    if (this.useLocalMode) return localDb.getInventory(filters);
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
    }
    return this.request<{ inventories: InventoryItem[] }>(`/api/inventory?${params.toString()}`);
  }

  async getDashboardMetrics() {
    if (this.useLocalMode) return localDb.getDashboardMetrics();
    return this.request<DashboardMetrics>('/api/inventory/dashboard');
  }

  // --- Users (ADMIN) ---
  async getUsers() {
    if (this.useLocalMode) return localDb.getUsers();
    return this.request<{ users: User[] }>('/api/users');
  }

  async createUser(data: { username: string; fullName: string; password: string; role: string }) {
    if (this.useLocalMode) return localDb.createUser(data);
    return this.request<{ user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: Partial<User & { password?: string }>) {
    if (this.useLocalMode) return localDb.updateUser(id, data);
    return this.request<{ user: User }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    if (this.useLocalMode) return localDb.deleteUser(id);
    return this.request<{ success: boolean; message: string; deletedUser?: User }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Audit Logs (ADMIN) ---
  async getAuditLogs(filters?: Record<string, string | number>) {
    if (this.useLocalMode) return localDb.getAuditLogs(filters);
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, String(v));
      });
    }
    return this.request<{ logs: AuditLog[] }>(`/api/audit-logs?${params.toString()}`);
  }

  // --- Reports & Excel Export ---
  async getReportData(reportType: string, filters?: Record<string, string>) {
    if (this.useLocalMode) return localDb.getReportData(reportType, filters);
    const params = new URLSearchParams({ reportType });
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
    }
    return this.request<{ data: any[] }>(`/api/reports/data?${params.toString()}`);
  }

  getExcelExportUrl(reportType: string, filters?: Record<string, string>): string {
    const params = new URLSearchParams({ reportType });
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
    }
    const token = this.getToken();
    if (token) {
      params.append('token', token);
    }
    const base = this.customBaseUrl || '';
    return `${base}/api/reports/export-excel?${params.toString()}`;
  }

  async exportExcel(reportType: string, filters?: Record<string, string>): Promise<void> {
    if (!this.useLocalMode) {
      // Direct server export
      const url = this.getExcelExportUrl(reportType, filters);
      window.open(url, '_blank');
      return;
    }

    // Client-side export using xlsx directly
    const res = await this.getReportData(reportType, filters);
    const list = res.data;

    let rows: any[] = [];
    let fileName = `گزارش_${reportType}_${Date.now()}.xlsx`;

    if (reportType === 'INVENTORY') {
      fileName = `گزارش_موجودی_کالاها_${Date.now()}.xlsx`;
      rows = list.map((r: any, idx: number) => ({
        'ردیف': idx + 1,
        'کد کالا': r.itemCode,
        'نام کالا': r.itemName,
        'برند': r.itemBrand,
        'مدل': r.itemModel,
        'دسته‌بندی': r.itemCategory,
        'انبار': r.warehouseName,
        'قفسه': r.shelfName,
        'موجودی': r.quantity,
        'واحد شمارش': r.itemUnit,
        'تاریخ آخرین به‌روزرسانی': formatShamsiDate(r.updatedAt),
      }));
    } else if (reportType === 'USER_ACTIVITY') {
      fileName = `گزارش_فعالیت_کاربران_${Date.now()}.xlsx`;
      rows = list.map((l: any, idx: number) => ({
        'ردیف': idx + 1,
        'کاربر': l.username,
        'نوع عملیات': l.action,
        'موجودیت': l.entity,
        'توضیحات': l.details || '-',
        'آدرس IP': l.ipAddress || '-',
        'تاریخ و زمان': formatShamsiDate(l.createdAt),
      }));
    } else {
      fileName = `گزارش_تراکنش_${reportType}_${Date.now()}.xlsx`;
      rows = list.map((t: any, idx: number) => ({
        'ردیف': idx + 1,
        'شماره سند/عطف': t.referenceNo || '-',
        'نوع تراکنش':
          t.type === 'STOCK_IN'
            ? 'ورود کالا'
            : t.type === 'STOCK_OUT'
            ? 'خروج کالا'
            : t.type === 'TRANSFER'
            ? 'انتقال کالا'
            : 'اصلاح موجودی',
        'کد کالا': t.itemCode,
        'نام کالا': t.itemName,
        'برند': t.itemBrand,
        'تعداد': t.quantity,
        'واحد': t.itemUnit,
        'انبار مبدا': t.sourceWarehouseName || '-',
        'قفسه مبدا': t.sourceShelfName || '-',
        'انبار مقصد': t.destWarehouseName || '-',
        'قفسه مقصد': t.destShelfName || '-',
        'ثبت‌کننده': t.userName,
        'توضیحات': t.notes || '-',
        'تاریخ و زمان': formatShamsiDate(t.createdAt),
      }));
    }

    downloadExcelFile(rows, fileName, 'گزارش');
  }

  // --- Backup & Restore (ADMIN) ---
  getBackupDownloadUrl(): string {
    const base = this.customBaseUrl || '';
    return `${base}/api/backup/export`;
  }

  async exportBackup() {
    if (this.useLocalMode) {
      return localDb.exportBackup();
    }
    try {
      return await this.request<any>('/api/backup/export');
    } catch {
      return localDb.exportBackup();
    }
  }

  async restoreBackup(backupData: any, confirmationCode = 'CONFIRM_RESTORE') {
    if (this.useLocalMode) {
      return localDb.restoreBackup(backupData);
    }
    try {
      return await this.request<{ success: boolean; message: string }>('/api/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ backupData, confirmationCode }),
      });
    } catch {
      return localDb.restoreBackup(backupData);
    }
  }

  // --- Local to Server Migration (ADMIN) ---
  async migrateLocalToServer() {
    // 1. Export current local data
    const localData = await localDb.exportBackup();
    
    // 2. Send to backend migration endpoint
    return this.request<{
      success: boolean;
      message: string;
      importedWarehouses: number;
      importedShelves: number;
      importedItems: number;
      importedInventories: number;
      importedTransactions: number;
    }>('/api/backup/migrate-from-local', {
      method: 'POST',
      body: JSON.stringify({ localData }),
    });
  }

  // --- Health & Central Database Verification ---
  async getHealthStatus() {
    try {
      const res = await this.request<{
        status: string;
        server?: string;
        database: { status: string; engine: string; latencyMs?: number } | string;
        databaseEngine?: string;
        multiDeviceReady: boolean;
        warehousesCount: number;
        service: string;
        appName?: string;
        version?: string;
        uptime: number;
      }>('/api/health');
      return res;
    } catch (err: any) {
      return {
        status: 'disconnected',
        database: 'none',
        databaseEngine: 'اتصال به سرور برقرار نیست',
        multiDeviceReady: false,
        warehousesCount: 0,
        service: 'نرم‌افزار انبارداری ذوب‌آهن',
        uptime: 0,
        error: err.message,
      };
    }
  }

  // --- LAN & Server Network Information ---
  async getNetworkInfo() {
    return this.request<{
      hostname: string;
      port: number;
      lanIps: string[];
      primaryLanIp: string;
      serverUrls: string[];
      localUrl: string;
      databaseConnected: boolean;
      databaseLatencyMs: number;
      serverTime: string;
      uptime: number;
      platform: string;
    }>('/api/network-info');
  }
}

export const api = new ApiService();
