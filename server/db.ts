import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Warehouse,
  Shelf,
  Item,
  Inventory,
  StockTransaction,
  AuditLog,
  Attachment,
  Role,
  WarehouseRole,
  RequestItem,
  RequestTimelineItem,
  GraphItem,
  MessageItem,
  TransactionType,
} from './types.js';

interface DatabaseSchema {
  users: User[];
  warehouses: Warehouse[];
  shelves: Shelf[];
  items: Item[];
  inventories: Inventory[];
  transactions: StockTransaction[];
  auditLogs: AuditLog[];
  attachments: Attachment[];
  requests: RequestItem[];
  requestTimelines: RequestTimelineItem[];
  graphs: GraphItem[];
  messages: MessageItem[];
}

const DATA_DIR = process.env.DATA_DIR_PATH || path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'warehouse-db.json');

// Mutex for serializing database write transactions (prevents race conditions)
class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const next = new Promise<void>((res) => {
      release = res;
    });
    const current = this.queue;
    this.queue = next;

    await current;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

const dbMutex = new AsyncMutex();

class DatabaseService {
  private state: DatabaseSchema = {
    users: [],
    warehouses: [],
    shelves: [],
    items: [],
    inventories: [],
    transactions: [],
    auditLogs: [],
    attachments: [],
    requests: [],
    requestTimelines: [],
    graphs: [],
    messages: [],
  };

  private isInitialized = false;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (this.isInitialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Filter out default mock warehouses and shelves if present
        const defaultMockWhCodes = new Set(['WH-01', 'WH-02']);
        const cleanWarehouses = (parsed.warehouses || []).filter(
          (w: any) => !defaultMockWhCodes.has(w.code)
        );
        const validWhIds = new Set(cleanWarehouses.map((w: any) => w.id));
        const cleanShelves = (parsed.shelves || []).filter(
          (s: any) => validWhIds.has(s.warehouseId)
        );
        this.state = {
          ...parsed,
          warehouses: cleanWarehouses,
          shelves: cleanShelves,
          items: parsed.items || [],
          inventories: (parsed.inventories || []).filter(
            (inv: any) => validWhIds.has(inv.warehouseId)
          ),
          transactions: parsed.transactions || [],
          auditLogs: parsed.auditLogs || [],
          attachments: parsed.attachments || [],
          requests: parsed.requests || [],
          requestTimelines: parsed.requestTimelines || [],
          graphs: parsed.graphs || [],
          messages: parsed.messages || [],
        };
        this.isInitialized = true;
        this.persistSync();
        return;
      } catch (error) {
        console.error('Failed to load DB file, initializing fresh database:', error);
      }
    }

    this.seedInitialData();
    this.persistSync();
    this.isInitialized = true;
  }

  private persistSync() {
    try {
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Database write error:', err);
    }
  }

  private seedInitialData() {
    const adminPasswordPlain = process.env.ADMIN_INITIAL_PASSWORD || 'Ehsan1984*#';
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(adminPasswordPlain, salt);

    const now = new Date().toISOString();

    // 1. Admin User
    const adminUser: User = {
      id: crypto.randomUUID(),
      username: 'admin',
      fullName: 'دکتر احسان ابوالقاسمی',
      firstName: 'احسان',
      lastName: 'ابوالقاسمی',
      personnelCode: '10001',
      jobTitle: 'مدیر ارشد سیستم',
      warehouseRole: 'WAREHOUSE_ADMIN',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      createdAt: now,
      lastLogin: now,
    };

    // Standard Warehouse Operator user
    const operatorUser: User = {
      id: crypto.randomUUID(),
      username: 'operator',
      fullName: 'کارشناس اعلام حریق',
      firstName: 'علی',
      lastName: 'محمدی',
      personnelCode: '10002',
      jobTitle: 'تکنسین اعلام حریق',
      warehouseRole: 'WAREHOUSE_USER',
      passwordHash: bcrypt.hashSync('Operator123*#', salt),
      role: 'USER',
      isActive: true,
      createdAt: now,
      lastLogin: null,
    };

    const auditLogs: AuditLog[] = [
      {
        id: crypto.randomUUID(),
        userId: adminUser.id,
        username: adminUser.username,
        action: 'SYSTEM_INITIALIZATION',
        entity: 'System',
        entityId: 'SYSTEM',
        details: 'راه‌اندازی سامانه اتوماسیون اداری و عملیاتی واحد اعلام حریق ذوب‌آهن اصفهان',
        ipAddress: '127.0.0.1',
        createdAt: now,
      },
    ];

    this.state = {
      users: [adminUser, operatorUser],
      warehouses: [],
      shelves: [],
      items: [],
      inventories: [],
      transactions: [],
      auditLogs,
      attachments: [],
      requests: [],
      requestTimelines: [],
      graphs: [],
      messages: [],
    };
  }

  // --- Users Operations ---
  async getUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.state.users.map(({ passwordHash: _, ...rest }) => rest);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.state.users.find((u) => u.id === id) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.state.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async createUser(data: {
    username: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    personnelCode?: string;
    jobTitle?: string;
    warehouseRole?: WarehouseRole;
    password: string;
    role: Role;
  }): Promise<Omit<User, 'passwordHash'>> {
    return dbMutex.runExclusive(async () => {
      const existing = this.state.users.find(
        (u) => u.username.toLowerCase() === data.username.toLowerCase()
      );
      if (existing) {
        throw new Error('نام کاربری وارد شده تکراری است.');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);

      const computedFullName = data.fullName
        ? data.fullName.trim()
        : [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || data.username.trim();

      const newUser: User = {
        id: crypto.randomUUID(),
        username: data.username.trim(),
        fullName: computedFullName,
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        personnelCode: data.personnelCode?.trim(),
        jobTitle: data.jobTitle?.trim() || 'تکنسین اعلام حریق',
        warehouseRole: data.warehouseRole || (data.role === 'ADMIN' ? 'WAREHOUSE_ADMIN' : 'WAREHOUSE_USER'),
        passwordHash,
        role: data.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null,
      };

      this.state.users.push(newUser);
      this.persistSync();

      const { passwordHash: _, ...safeUser } = newUser;
      return safeUser;
    });
  }

  async updateUser(
    id: string,
    data: {
      fullName?: string;
      firstName?: string;
      lastName?: string;
      personnelCode?: string;
      jobTitle?: string;
      warehouseRole?: WarehouseRole;
      role?: Role;
      isActive?: boolean;
      password?: string;
    }
  ): Promise<Omit<User, 'passwordHash'>> {
    return dbMutex.runExclusive(async () => {
      const user = this.state.users.find((u) => u.id === id);
      if (!user) throw new Error('کاربر مورد نظر یافت نشد.');

      if (data.firstName !== undefined) user.firstName = data.firstName.trim();
      if (data.lastName !== undefined) user.lastName = data.lastName.trim();
      if (data.personnelCode !== undefined) user.personnelCode = data.personnelCode.trim();
      if (data.jobTitle !== undefined) user.jobTitle = data.jobTitle.trim();
      if (data.warehouseRole !== undefined) user.warehouseRole = data.warehouseRole;

      if (data.fullName !== undefined && data.fullName.trim()) {
        user.fullName = data.fullName.trim();
      } else if (data.firstName !== undefined || data.lastName !== undefined) {
        user.fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username;
      }

      if (data.role !== undefined) user.role = data.role;
      if (data.isActive !== undefined) user.isActive = data.isActive;
      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(data.password, salt);
      }

      this.persistSync();
      const { passwordHash: _, ...safeUser } = user;
      return safeUser;
    });
  }

  async deleteUser(id: string, requesterUserId?: string): Promise<User> {
    return dbMutex.runExclusive(async () => {
      const index = this.state.users.findIndex((u) => u.id === id);
      if (index === -1) {
        throw new Error('کاربر مورد نظر یافت نشد.');
      }
      const user = this.state.users[index];

      // 1. Prevent self-deletion
      if (requesterUserId && id === requesterUserId) {
        throw new Error('امکان حذف حساب کاربری خودتان وجود ندارد.');
      }

      // 2. Prevent system account deletion
      if (user.username.toLowerCase() === 'system') {
        throw new Error('امکان حذف حساب کاربری سیستمی وجود ندارد.');
      }

      // 3. Prevent deleting last remaining active ADMIN
      if (user.role === 'ADMIN') {
        const remainingActiveAdmins = this.state.users.filter(
          (u) => u.role === 'ADMIN' && u.isActive && u.id !== id
        ).length;
        if (remainingActiveAdmins < 1) {
          throw new Error('امکان حذف آخرین مدیر سیستم وجود ندارد. حداقل یک مدیر فعال باید در سیستم باقی بماند.');
        }
      }

      // 4. Preserve historical data references by nullifying userId
      for (const t of this.state.transactions) {
        if (t.userId === id) {
          t.userId = undefined as any;
        }
      }
      for (const att of this.state.attachments) {
        if (att.uploadedById === id) {
          att.uploadedById = undefined;
        }
      }
      for (const a of this.state.auditLogs) {
        if (a.userId === id) {
          a.userId = undefined;
        }
      }

      // 5. Remove user from state
      this.state.users.splice(index, 1);
      this.persistSync();
      return user;
    });
  }

  async updateLastLogin(id: string) {
    const user = this.state.users.find((u) => u.id === id);
    if (user) {
      user.lastLogin = new Date().toISOString();
      this.persistSync();
    }
  }

  // --- Warehouses Operations ---
  async getWarehouses(): Promise<Warehouse[]> {
    return [...this.state.warehouses];
  }

  async getWarehouseById(id: string): Promise<Warehouse | null> {
    return this.state.warehouses.find((w) => w.id === id) || null;
  }

  async createWarehouse(data: { name: string; code: string; description?: string }): Promise<Warehouse> {
    return dbMutex.runExclusive(() => {
      const code = data.code.trim().toUpperCase();
      if (this.state.warehouses.some((w) => w.code.toUpperCase() === code)) {
        throw new Error('کد انبار تکراری است.');
      }
      const now = new Date().toISOString();
      const newWh: Warehouse = {
        id: crypto.randomUUID(),
        name: data.name.trim(),
        code,
        description: data.description?.trim() || '',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      this.state.warehouses.push(newWh);
      this.persistSync();
      return newWh;
    });
  }

  async updateWarehouse(id: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }): Promise<Warehouse> {
    return dbMutex.runExclusive(() => {
      const wh = this.state.warehouses.find((w) => w.id === id);
      if (!wh) throw new Error('انبار یافت نشد.');
      if (data.code) {
        const code = data.code.trim().toUpperCase();
        if (this.state.warehouses.some((w) => w.id !== id && w.code.toUpperCase() === code)) {
          throw new Error('کد انبار تکراری است.');
        }
        wh.code = code;
      }
      if (data.name !== undefined) wh.name = data.name.trim();
      if (data.description !== undefined) wh.description = data.description.trim();
      if (data.isActive !== undefined) wh.isActive = data.isActive;
      wh.updatedAt = new Date().toISOString();
      this.persistSync();
      return wh;
    });
  }

  async deleteWarehouse(id: string): Promise<Warehouse> {
    return dbMutex.runExclusive(() => {
      const wh = this.state.warehouses.find((w) => w.id === id);
      if (!wh) throw new Error('انبار یافت نشد.');

      const activeInv = this.state.inventories.filter(
        (inv) => inv.warehouseId === id && inv.quantity > 0
      );
      if (activeInv.length > 0) {
        const total = activeInv.reduce((sum, inv) => sum + inv.quantity, 0);
        throw new Error(`امکان حذف انبار وجود ندارد زیرا هنوز ${total} عدد کالا در قفسه‌های آن موجود است. ابتدا موجودی را خارج یا منتقل فرمایید.`);
      }

      this.state.shelves = this.state.shelves.filter((s) => s.warehouseId !== id);
      this.state.warehouses = this.state.warehouses.filter((w) => w.id !== id);
      this.state.inventories = this.state.inventories.filter((inv) => inv.warehouseId !== id);
      this.persistSync();
      return wh;
    });
  }

  // --- Shelves Operations ---
  async getShelves(warehouseId?: string): Promise<Shelf[]> {
    if (warehouseId) {
      return this.state.shelves.filter((s) => s.warehouseId === warehouseId);
    }
    return [...this.state.shelves];
  }

  async getShelfById(id: string): Promise<Shelf | null> {
    return this.state.shelves.find((s) => s.id === id) || null;
  }

  async createShelf(data: { name: string; code: string; warehouseId: string; description?: string }): Promise<Shelf> {
    return dbMutex.runExclusive(() => {
      const wh = this.state.warehouses.find((w) => w.id === data.warehouseId);
      if (!wh) throw new Error('انبار مشخص‌شده معتبر نیست.');

      const code = data.code.trim().toUpperCase();
      if (this.state.shelves.some((s) => s.code.toUpperCase() === code)) {
        throw new Error('کد قفسه تکراری است.');
      }

      const now = new Date().toISOString();
      const newShelf: Shelf = {
        id: crypto.randomUUID(),
        name: data.name.trim(),
        code,
        description: data.description?.trim() || '',
        status: 'ACTIVE',
        warehouseId: data.warehouseId,
        createdAt: now,
        updatedAt: now,
      };
      this.state.shelves.push(newShelf);
      this.persistSync();
      return newShelf;
    });
  }

  async updateShelf(id: string, data: { name?: string; code?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE'; warehouseId?: string }): Promise<Shelf> {
    return dbMutex.runExclusive(() => {
      const shelf = this.state.shelves.find((s) => s.id === id);
      if (!shelf) throw new Error('قفسه یافت نشد.');

      if (data.code) {
        const code = data.code.trim().toUpperCase();
        if (this.state.shelves.some((s) => s.id !== id && s.code.toUpperCase() === code)) {
          throw new Error('کد قفسه تکراری است.');
        }
        shelf.code = code;
      }
      if (data.warehouseId) {
        const wh = this.state.warehouses.find((w) => w.id === data.warehouseId);
        if (!wh) throw new Error('انبار نامعتبر است.');
        shelf.warehouseId = data.warehouseId;
      }
      if (data.name !== undefined) shelf.name = data.name.trim();
      if (data.description !== undefined) shelf.description = data.description.trim();
      if (data.status !== undefined) shelf.status = data.status;
      shelf.updatedAt = new Date().toISOString();
      this.persistSync();
      return shelf;
    });
  }

  async deleteShelf(id: string): Promise<Shelf> {
    return dbMutex.runExclusive(() => {
      const shelf = this.state.shelves.find((s) => s.id === id);
      if (!shelf) throw new Error('قفسه یافت نشد.');

      const activeInv = this.state.inventories.filter(
        (inv) => inv.shelfId === id && inv.quantity > 0
      );
      if (activeInv.length > 0) {
        const total = activeInv.reduce((sum, inv) => sum + inv.quantity, 0);
        throw new Error(`امکان حذف قفسه وجود ندارد زیرا هنوز ${total} عدد کالا در آن قرار دارد. ابتدا کالاها را جابجا یا خارج فرمایید.`);
      }

      this.state.shelves = this.state.shelves.filter((s) => s.id !== id);
      this.state.inventories = this.state.inventories.filter((inv) => inv.shelfId !== id);
      this.persistSync();
      return shelf;
    });
  }

  // --- Items Operations ---
  async getItems(search?: string): Promise<(Item & { totalStock: number; attachments: Attachment[] })[]> {
    let list = [...this.state.items];
    if (search) {
      const term = search.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.code.toLowerCase().includes(term) ||
          item.brand.toLowerCase().includes(term) ||
          item.model.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term)
      );
    }

    return list.map((item) => {
      const totalStock = this.state.inventories
        .filter((inv) => inv.itemId === item.id)
        .reduce((sum, inv) => sum + inv.quantity, 0);
      const attachments = this.state.attachments.filter((a) => a.itemId === item.id);
      return { ...item, totalStock, attachments };
    });
  }

  async getItemById(id: string) {
    const item = this.state.items.find((i) => i.id === id);
    if (!item) return null;

    const inventories = this.state.inventories
      .filter((inv) => inv.itemId === id)
      .map((inv) => {
        const wh = this.state.warehouses.find((w) => w.id === inv.warehouseId);
        const shelf = this.state.shelves.find((s) => s.id === inv.shelfId);
        return {
          ...inv,
          warehouseName: wh ? wh.name : 'نامشخص',
          warehouseCode: wh ? wh.code : '',
          shelfName: shelf ? shelf.name : 'نامشخص',
          shelfCode: shelf ? shelf.code : '',
        };
      });

    const totalStock = inventories.reduce((sum, inv) => sum + inv.quantity, 0);
    const attachments = this.state.attachments.filter((a) => a.itemId === id);
    const transactions = this.state.transactions
      .filter((t) => t.itemId === id)
      .map((t) => this.enrichTransaction(t))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      ...item,
      totalStock,
      inventories,
      attachments,
      transactions,
    };
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
  }): Promise<Item> {
    return dbMutex.runExclusive(() => {
      const code = data.code.trim().toUpperCase();
      if (this.state.items.some((i) => i.code.toUpperCase() === code)) {
        throw new Error('کد کالای وارد شده تکراری است.');
      }
      const now = new Date().toISOString();
      const newItem: Item = {
        id: crypto.randomUUID(),
        name: data.name.trim(),
        code,
        category: data.category.trim(),
        brand: data.brand.trim(),
        model: data.model.trim(),
        unit: data.unit?.trim() || 'عدد',
        description: data.description?.trim() || '',
        imageUrl: data.imageUrl || null,
        createdAt: now,
        updatedAt: now,
      };
      this.state.items.push(newItem);
      this.persistSync();
      return newItem;
    });
  }

  async updateItem(id: string, data: Partial<Item>): Promise<Item> {
    return dbMutex.runExclusive(() => {
      const item = this.state.items.find((i) => i.id === id);
      if (!item) throw new Error('کالای مورد نظر یافت نشد.');

      if (data.code) {
        const code = data.code.trim().toUpperCase();
        if (this.state.items.some((i) => i.id !== id && i.code.toUpperCase() === code)) {
          throw new Error('کد کالای وارد شده تکراری است.');
        }
        item.code = code;
      }
      if (data.name !== undefined) item.name = data.name.trim();
      if (data.category !== undefined) item.category = data.category.trim();
      if (data.brand !== undefined) item.brand = data.brand.trim();
      if (data.model !== undefined) item.model = data.model.trim();
      if (data.unit !== undefined) item.unit = data.unit.trim();
      if (data.description !== undefined) item.description = data.description.trim();
      if (data.imageUrl !== undefined) item.imageUrl = data.imageUrl;
      item.updatedAt = new Date().toISOString();
      this.persistSync();
      return item;
    });
  }

  async deleteItem(id: string): Promise<Item> {
    return dbMutex.runExclusive(() => {
      const item = this.state.items.find((i) => i.id === id);
      if (!item) throw new Error('کالای مورد نظر یافت نشد.');

      const totalStock = this.state.inventories
        .filter((inv) => inv.itemId === id)
        .reduce((sum, inv) => sum + inv.quantity, 0);

      if (totalStock > 0) {
        throw new Error(`امکان حذف این کالا وجود ندارد زیرا دارای موجودی فعال (${totalStock} ${item.unit || 'عدد'}) در انبار است. ابتدا موجودی آن را خارج نمایید.`);
      }

      this.state.items = this.state.items.filter((i) => i.id !== id);
      this.state.inventories = this.state.inventories.filter((inv) => inv.itemId !== id);
      this.state.attachments = this.state.attachments.filter((a) => a.itemId !== id);
      this.persistSync();
      return item;
    });
  }

  // --- Attachments / PDF Catalogs ---
  async addAttachment(data: {
    itemId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    storageKey: string;
    url: string;
    uploadedById?: string;
  }): Promise<Attachment> {
    return dbMutex.runExclusive(() => {
      const item = this.state.items.find((i) => i.id === data.itemId);
      if (!item) throw new Error('کالا یافت نشد.');

      const newAtt: Attachment = {
        id: crypto.randomUUID(),
        itemId: data.itemId,
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        storageKey: data.storageKey,
        url: data.url,
        uploadedById: data.uploadedById || null,
        createdAt: new Date().toISOString(),
      };
      this.state.attachments.push(newAtt);
      this.persistSync();
      return newAtt;
    });
  }

  async getAttachmentById(id: string): Promise<Attachment | null> {
    return this.state.attachments.find((a) => a.id === id) || null;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    return dbMutex.runExclusive(() => {
      const idx = this.state.attachments.findIndex((a) => a.id === id);
      if (idx !== -1) {
        this.state.attachments.splice(idx, 1);
        this.persistSync();
        return true;
      }
      return false;
    });
  }

  // --- Inventory & Stock Operations (ATOMIC & RACE-CONDITION PROTECTED) ---

  async getInventoryDetails(filters?: { warehouseId?: string; shelfId?: string; itemId?: string }) {
    let list = [...this.state.inventories];

    if (filters?.warehouseId) {
      list = list.filter((inv) => inv.warehouseId === filters.warehouseId);
    }
    if (filters?.shelfId) {
      list = list.filter((inv) => inv.shelfId === filters.shelfId);
    }
    if (filters?.itemId) {
      list = list.filter((inv) => inv.itemId === filters.itemId);
    }

    return list.map((inv) => {
      const item = this.state.items.find((i) => i.id === inv.itemId);
      const wh = this.state.warehouses.find((w) => w.id === inv.warehouseId);
      const shelf = this.state.shelves.find((s) => s.id === inv.shelfId);
      return {
        ...inv,
        itemName: item ? item.name : 'نامشخص',
        itemCode: item ? item.code : '',
        itemBrand: item ? item.brand : '',
        itemModel: item ? item.model : '',
        itemCategory: item ? item.category : '',
        itemUnit: item ? item.unit : 'عدد',
        warehouseName: wh ? wh.name : 'نامشخص',
        warehouseCode: wh ? wh.code : '',
        shelfName: shelf ? shelf.name : 'نامشخص',
        shelfCode: shelf ? shelf.code : '',
      };
    });
  }

  // Stock In (ورود کالا)
  async stockIn(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
  }): Promise<{ transaction: StockTransaction; newQuantity: number }> {
    return dbMutex.runExclusive(() => {
      if (params.quantity <= 0) {
        throw new Error('تعداد ورودی باید یک عدد مثبت بزرگتر از صفر باشد.');
      }

      const item = this.state.items.find((i) => i.id === params.itemId);
      if (!item) throw new Error('کالای مورد نظر یافت نشد.');

      const wh = this.state.warehouses.find((w) => w.id === params.warehouseId);
      if (!wh || !wh.isActive) throw new Error('انبار مشخص‌شده غیرفعال یا نامعتبر است.');

      const shelf = this.state.shelves.find((s) => s.id === params.shelfId);
      if (!shelf || shelf.warehouseId !== params.warehouseId || shelf.status !== 'ACTIVE') {
        throw new Error('قفسه مشخص‌شده متعلق به این انبار نیست یا غیرفعال است.');
      }

      const now = new Date().toISOString();

      // Find or create inventory row
      let inv = this.state.inventories.find(
        (i) => i.itemId === params.itemId && i.warehouseId === params.warehouseId && i.shelfId === params.shelfId
      );

      if (!inv) {
        inv = {
          id: crypto.randomUUID(),
          itemId: params.itemId,
          warehouseId: params.warehouseId,
          shelfId: params.shelfId,
          quantity: 0,
          updatedAt: now,
        };
        this.state.inventories.push(inv);
      }

      inv.quantity += params.quantity;
      inv.updatedAt = now;

      // Create transaction log
      const tx: StockTransaction = {
        id: crypto.randomUUID(),
        type: 'STOCK_IN',
        itemId: params.itemId,
        quantity: params.quantity,
        destWarehouseId: params.warehouseId,
        destShelfId: params.shelfId,
        userId: params.userId,
        referenceNo: params.referenceNo?.trim() || null,
        notes: params.notes?.trim() || null,
        createdAt: now,
      };
      this.state.transactions.push(tx);

      // Audit log
      this.addAuditLogSync({
        userId: params.userId,
        action: 'STOCK_IN',
        entity: 'Item',
        entityId: params.itemId,
        details: `ورود تعداد ${params.quantity} ${item.unit} کالای «${item.name}» به ${wh.name} / ${shelf.name}`,
      });

      this.persistSync();
      return { transaction: tx, newQuantity: inv.quantity };
    });
  }

  // Stock Out (خروج کالا)
  async stockOut(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
  }): Promise<{ transaction: StockTransaction; remainingQuantity: number }> {
    return dbMutex.runExclusive(() => {
      if (params.quantity <= 0) {
        throw new Error('تعداد خروجی باید یک عدد مثبت باشد.');
      }

      const item = this.state.items.find((i) => i.id === params.itemId);
      if (!item) throw new Error('کالای مورد نظر یافت نشد.');

      const wh = this.state.warehouses.find((w) => w.id === params.warehouseId);
      if (!wh) throw new Error('انبار یافت نشد.');

      const shelf = this.state.shelves.find((s) => s.id === params.shelfId);
      if (!shelf) throw new Error('قفسه یافت نشد.');

      const inv = this.state.inventories.find(
        (i) => i.itemId === params.itemId && i.warehouseId === params.warehouseId && i.shelfId === params.shelfId
      );

      const currentStock = inv ? inv.quantity : 0;

      // CRITICAL REQUIREMENT: Reject if insufficient stock with exact Persian error
      if (currentStock < params.quantity) {
        throw new Error('موجودی کافی نیست.');
      }

      const now = new Date().toISOString();
      inv!.quantity -= params.quantity;
      inv!.updatedAt = now;

      // Record transaction
      const tx: StockTransaction = {
        id: crypto.randomUUID(),
        type: 'STOCK_OUT',
        itemId: params.itemId,
        quantity: params.quantity,
        sourceWarehouseId: params.warehouseId,
        sourceShelfId: params.shelfId,
        userId: params.userId,
        referenceNo: params.referenceNo?.trim() || null,
        notes: params.notes?.trim() || null,
        createdAt: now,
      };
      this.state.transactions.push(tx);

      // Audit log
      this.addAuditLogSync({
        userId: params.userId,
        action: 'STOCK_OUT',
        entity: 'Item',
        entityId: params.itemId,
        details: `خروج تعداد ${params.quantity} ${item.unit} کالای «${item.name}» از ${wh.name} / ${shelf.name}`,
      });

      this.persistSync();
      return { transaction: tx, remainingQuantity: inv!.quantity };
    });
  }

  // Transfer (انتقال کالا - ATOMIC)
  async transferStock(params: {
    itemId: string;
    sourceWarehouseId: string;
    sourceShelfId: string;
    destWarehouseId: string;
    destShelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
  }): Promise<{ transaction: StockTransaction; sourceRemaining: number; destNewQuantity: number }> {
    return dbMutex.runExclusive(() => {
      if (params.quantity <= 0) {
        throw new Error('تعداد انتقال باید یک عدد مثبت باشد.');
      }

      if (params.sourceWarehouseId === params.destWarehouseId && params.sourceShelfId === params.destShelfId) {
        throw new Error('مبدا و مقصد انتقال نمی‌تواند کاملاً یکسان باشد.');
      }

      const item = this.state.items.find((i) => i.id === params.itemId);
      if (!item) throw new Error('کالای مورد نظر یافت نشد.');

      const srcWh = this.state.warehouses.find((w) => w.id === params.sourceWarehouseId);
      const srcShelf = this.state.shelves.find((s) => s.id === params.sourceShelfId);
      const destWh = this.state.warehouses.find((w) => w.id === params.destWarehouseId);
      const destShelf = this.state.shelves.find((s) => s.id === params.destShelfId);

      if (!srcWh || !srcShelf || !destWh || !destShelf) {
        throw new Error('اطلاعات انبار یا قفسه مبدا/مقصد نامعتبر است.');
      }

      const srcInv = this.state.inventories.find(
        (i) => i.itemId === params.itemId && i.warehouseId === params.sourceWarehouseId && i.shelfId === params.sourceShelfId
      );

      const available = srcInv ? srcInv.quantity : 0;
      if (available < params.quantity) {
        throw new Error('موجودی کافی نیست.');
      }

      const now = new Date().toISOString();

      // Find or create destination inventory
      let destInv = this.state.inventories.find(
        (i) => i.itemId === params.itemId && i.warehouseId === params.destWarehouseId && i.shelfId === params.destShelfId
      );

      if (!destInv) {
        destInv = {
          id: crypto.randomUUID(),
          itemId: params.itemId,
          warehouseId: params.destWarehouseId,
          shelfId: params.destShelfId,
          quantity: 0,
          updatedAt: now,
        };
        this.state.inventories.push(destInv);
      }

      // ATOMIC UPDATE
      srcInv!.quantity -= params.quantity;
      srcInv!.updatedAt = now;
      destInv.quantity += params.quantity;
      destInv.updatedAt = now;

      // Transaction log
      const tx: StockTransaction = {
        id: crypto.randomUUID(),
        type: 'TRANSFER',
        itemId: params.itemId,
        quantity: params.quantity,
        sourceWarehouseId: params.sourceWarehouseId,
        sourceShelfId: params.sourceShelfId,
        destWarehouseId: params.destWarehouseId,
        destShelfId: params.destShelfId,
        userId: params.userId,
        referenceNo: params.referenceNo?.trim() || null,
        notes: params.notes?.trim() || null,
        createdAt: now,
      };
      this.state.transactions.push(tx);

      // Audit log
      this.addAuditLogSync({
        userId: params.userId,
        action: 'TRANSFER',
        entity: 'Item',
        entityId: params.itemId,
        details: `انتقال ${params.quantity} ${item.unit} از ${srcWh.name} / ${srcShelf.name} به ${destWh.name} / ${destShelf.name}`,
      });

      this.persistSync();
      return {
        transaction: tx,
        sourceRemaining: srcInv!.quantity,
        destNewQuantity: destInv.quantity,
      };
    });
  }

  // Corrective Adjustment (تراکنش اصلاحی - برای اصلاح بدون حذف تاریخچه)
  async correctiveAdjustment(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    newTargetQuantity: number;
    userId: string;
    reason: string;
  }): Promise<{ transaction: StockTransaction; difference: number }> {
    return dbMutex.runExclusive(() => {
      if (params.newTargetQuantity < 0) {
        throw new Error('موجودی نمی‌تواند منفی باشد.');
      }
      if (!params.reason || params.reason.trim().length < 5) {
        throw new Error('علت اصلاح موجودی و شماره صورتجلسه الزامی است.');
      }

      const item = this.state.items.find((i) => i.id === params.itemId);
      if (!item) throw new Error('کالا یافت نشد.');

      const now = new Date().toISOString();
      let inv = this.state.inventories.find(
        (i) => i.itemId === params.itemId && i.warehouseId === params.warehouseId && i.shelfId === params.shelfId
      );

      if (!inv) {
        inv = {
          id: crypto.randomUUID(),
          itemId: params.itemId,
          warehouseId: params.warehouseId,
          shelfId: params.shelfId,
          quantity: 0,
          updatedAt: now,
        };
        this.state.inventories.push(inv);
      }

      const oldQuantity = inv.quantity;
      const difference = params.newTargetQuantity - oldQuantity;

      inv.quantity = params.newTargetQuantity;
      inv.updatedAt = now;

      const tx: StockTransaction = {
        id: crypto.randomUUID(),
        type: 'ADJUSTMENT',
        itemId: params.itemId,
        quantity: Math.abs(difference),
        sourceWarehouseId: difference < 0 ? params.warehouseId : null,
        sourceShelfId: difference < 0 ? params.shelfId : null,
        destWarehouseId: difference > 0 ? params.warehouseId : null,
        destShelfId: difference > 0 ? params.shelfId : null,
        userId: params.userId,
        referenceNo: 'ADJ-' + Date.now(),
        notes: `تراکنش اصلاحی موجودی: از ${oldQuantity} به ${params.newTargetQuantity}. علت: ${params.reason.trim()}`,
        createdAt: now,
      };
      this.state.transactions.push(tx);

      this.addAuditLogSync({
        userId: params.userId,
        action: 'ADJUSTMENT',
        entity: 'Item',
        entityId: params.itemId,
        details: `اصلاح دستی موجودی کالای «${item.name}» از ${oldQuantity} به ${params.newTargetQuantity}. علت: ${params.reason}`,
      });

      this.persistSync();
      return { transaction: tx, difference };
    });
  }

  // --- Transactions Querying ---
  async getTransactions(filters?: {
    itemId?: string;
    type?: TransactionType;
    warehouseId?: string;
    shelfId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    let list = [...this.state.transactions];

    if (filters?.itemId) {
      list = list.filter((t) => t.itemId === filters.itemId);
    }
    if (filters?.type) {
      list = list.filter((t) => t.type === filters.type);
    }
    if (filters?.userId) {
      list = list.filter((t) => t.userId === filters.userId);
    }
    if (filters?.warehouseId) {
      list = list.filter(
        (t) => t.sourceWarehouseId === filters.warehouseId || t.destWarehouseId === filters.warehouseId
      );
    }
    if (filters?.shelfId) {
      list = list.filter(
        (t) => t.sourceShelfId === filters.shelfId || t.destShelfId === filters.shelfId
      );
    }
    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      list = list.filter((t) => new Date(t.createdAt).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate).getTime();
      list = list.filter((t) => new Date(t.createdAt).getTime() <= end);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit && filters.limit > 0) {
      list = list.slice(0, filters.limit);
    }

    return list.map((t) => this.enrichTransaction(t));
  }

  private enrichTransaction(t: StockTransaction) {
    const item = this.state.items.find((i) => i.id === t.itemId);
    const user = this.state.users.find((u) => u.id === t.userId);
    const srcWh = t.sourceWarehouseId ? this.state.warehouses.find((w) => w.id === t.sourceWarehouseId) : null;
    const srcShelf = t.sourceShelfId ? this.state.shelves.find((s) => s.id === t.sourceShelfId) : null;
    const destWh = t.destWarehouseId ? this.state.warehouses.find((w) => w.id === t.destWarehouseId) : null;
    const destShelf = t.destShelfId ? this.state.shelves.find((s) => s.id === t.destShelfId) : null;

    return {
      ...t,
      itemName: item ? item.name : 'نامشخص',
      itemCode: item ? item.code : '',
      itemBrand: item ? item.brand : '',
      itemModel: item ? item.model : '',
      itemUnit: item ? item.unit : 'عدد',
      userName: user ? user.fullName : 'کاربر ناشناس',
      sourceWarehouseName: srcWh ? srcWh.name : null,
      sourceWarehouseCode: srcWh ? srcWh.code : null,
      sourceShelfName: srcShelf ? srcShelf.name : null,
      sourceShelfCode: srcShelf ? srcShelf.code : null,
      destWarehouseName: destWh ? destWh.name : null,
      destWarehouseCode: destWh ? destWh.code : null,
      destShelfName: destShelf ? destShelf.name : null,
      destShelfCode: destShelf ? destShelf.code : null,
    };
  }

  // --- Audit Logs ---
  async logAudit(entry: {
    userId?: string;
    username?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
  }) {
    return dbMutex.runExclusive(() => {
      this.addAuditLogSync(entry);
      this.persistSync();
    });
  }

  private addAuditLogSync(entry: {
    userId?: string;
    username?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
  }) {
    const user = entry.userId ? this.state.users.find((u) => u.id === entry.userId) : null;
    const log: AuditLog = {
      id: crypto.randomUUID(),
      userId: entry.userId || null,
      username: entry.username || (user ? user.username : 'system'),
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId || null,
      details: entry.details || null,
      ipAddress: entry.ipAddress || '127.0.0.1',
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    // Keep last 5000 audit logs
    if (this.state.auditLogs.length > 5000) {
      this.state.auditLogs.pop();
    }
  }

  async getAuditLogs(filters?: {
    action?: string;
    entity?: string;
    userId?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    let list = [...this.state.auditLogs];
    if (filters?.action) list = list.filter((l) => l.action === filters.action);
    if (filters?.entity) list = list.filter((l) => l.entity === filters.entity);
    if (filters?.userId) list = list.filter((l) => l.userId === filters.userId);

    if (filters?.limit && filters.limit > 0) {
      list = list.slice(0, filters.limit);
    }
    return list;
  }

  // --- Dashboard Summary Metrics ---
  async getDashboardMetrics() {
    const totalWarehouses = this.state.warehouses.length;
    const totalShelves = this.state.shelves.length;
    const totalItems = this.state.items.length;
    const totalUsers = this.state.users.length;
    const totalInventoryCount = this.state.inventories.reduce((sum, inv) => sum + inv.quantity, 0);

    const latestStockIn = this.state.transactions
      .filter((t) => t.type === 'STOCK_IN')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const latestStockOut = this.state.transactions
      .filter((t) => t.type === 'STOCK_OUT')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const latestTransfer = this.state.transactions
      .filter((t) => t.type === 'TRANSFER')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    return {
      totalWarehouses,
      totalShelves,
      totalItems,
      totalUsers,
      totalInventoryCount,
      latestStockIn: latestStockIn ? this.enrichTransaction(latestStockIn) : null,
      latestStockOut: latestStockOut ? this.enrichTransaction(latestStockOut) : null,
      latestTransfer: latestTransfer ? this.enrichTransaction(latestTransfer) : null,
    };
  }

  // --- Backup & Restore ---
  async exportBackup() {
    return {
      exportedAt: new Date().toISOString(),
      version: '3.0.0-automation',
      appName: 'سامانه اتوماسیون اداری و عملیاتی واحد اعلام حریق ذوب‌آهن اصفهان',
      designer: 'دکتر احسان ابوالقاسمی',
      data: {
        users: this.state.users,
        warehouses: this.state.warehouses,
        shelves: this.state.shelves,
        items: this.state.items,
        inventories: this.state.inventories,
        transactions: this.state.transactions,
        auditLogs: this.state.auditLogs,
        attachments: this.state.attachments,
        requests: this.state.requests || [],
        requestTimelines: this.state.requestTimelines || [],
        graphs: this.state.graphs || [],
        messages: this.state.messages || [],
      },
    };
  }

  async restoreBackup(backupData: any, adminUserId: string) {
    return dbMutex.runExclusive(async () => {
      if (!backupData || !backupData.data) {
        throw new Error('فرمت فایل پشتیبان نامعتبر است.');
      }
      const data = backupData.data;
      if (!Array.isArray(data.items) || !Array.isArray(data.warehouses) || !Array.isArray(data.users)) {
        throw new Error('فایل پشتیبان فاقد ساختار جداول استاندارد سامانه است.');
      }

      // Safety snapshot before restoring
      const safetySnapshot = await this.exportBackup();

      this.state = {
        users: data.users || [],
        warehouses: data.warehouses || [],
        shelves: data.shelves || [],
        items: data.items || [],
        inventories: data.inventories || [],
        transactions: data.transactions || [],
        auditLogs: data.auditLogs || [],
        attachments: data.attachments || [],
        requests: data.requests || [],
        requestTimelines: data.requestTimelines || [],
        graphs: data.graphs || [],
        messages: data.messages || [],
      };

      this.addAuditLogSync({
        userId: adminUserId,
        action: 'RESTORE_BACKUP',
        entity: 'System',
        entityId: 'SYSTEM',
        details: 'بازیابی کامل پایگاه داده از روی فایل پشتیبان با تهیه نسخه پشتیبان ایمنی قبلی',
      });

      this.persistSync();
      return { success: true, safetyBackupDate: safetySnapshot.exportedAt };
    });
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 1 };
  }

  // ==========================================
  // REQUESTS & TIMELINE (SHIFT CHANGE WORKFLOW)
  // ==========================================

  async getRequests(filters?: { userId?: string; status?: string; type?: string }): Promise<RequestItem[]> {
    let list = [...(this.state.requests || [])];
    if (filters?.userId) list = list.filter((r) => r.userId === filters.userId);
    if (filters?.status) list = list.filter((r) => r.status === filters.status);
    if (filters?.type) list = list.filter((r) => r.type === filters.type);

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Enrich with timelines
    return list.map((r) => ({
      ...r,
      timeline: (this.state.requestTimelines || [])
        .filter((t) => t.requestId === r.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }));
  }

  async getRequestById(id: string): Promise<RequestItem | null> {
    const req = (this.state.requests || []).find((r) => r.id === id);
    if (!req) return null;
    return {
      ...req,
      timeline: (this.state.requestTimelines || [])
        .filter((t) => t.requestId === req.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    };
  }

  async createRequest(data: {
    type?: string;
    userId: string;
    userName: string;
    userJobTitle?: string;
    userPersonnelCode?: string;
    targetDate: string;
    shift: string;
    reason?: string;
  }): Promise<RequestItem> {
    return dbMutex.runExclusive(async () => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const initialStatus = 'PENDING_FOREMAN';

      const newReq: RequestItem = {
        id,
        type: data.type || 'SHIFT_CHANGE',
        userId: data.userId,
        userName: data.userName,
        userJobTitle: data.userJobTitle || 'پرسنل اعلام حریق',
        userPersonnelCode: data.userPersonnelCode,
        status: initialStatus,
        targetDate: data.targetDate,
        shift: data.shift,
        reason: data.reason,
        createdAt: now,
        updatedAt: now,
      };

      const newTimeline: RequestTimelineItem = {
        id: crypto.randomUUID(),
        requestId: id,
        userId: data.userId,
        userName: data.userName,
        jobTitle: data.userJobTitle || 'پرسنل اعلام حریق',
        action: 'ثبت درخواست جا‌به‌جایی شیفت',
        status: initialStatus,
        notes: data.reason || 'ثبت اولیه درخواست توسط متقاضی',
        createdAt: now,
      };

      if (!this.state.requests) this.state.requests = [];
      if (!this.state.requestTimelines) this.state.requestTimelines = [];

      this.state.requests.push(newReq);
      this.state.requestTimelines.push(newTimeline);
      this.persistSync();

      return {
        ...newReq,
        timeline: [newTimeline],
      };
    });
  }

  async processRequestAction(
    requestId: string,
    user: { id: string; fullName: string; jobTitle: string; role: string },
    action: string,
    notes?: string
  ): Promise<RequestItem> {
    return dbMutex.runExclusive(async () => {
      const req = (this.state.requests || []).find((r) => r.id === requestId);
      if (!req) throw new Error('درخواست مورد نظر یافت نشد.');

      let nextStatus = req.status;
      let actionLabel = action;

      switch (action) {
        case 'FOREMAN_APPROVE':
          if (req.status !== 'PENDING_FOREMAN') {
            throw new Error('این درخواست در مرحله بررسی سرپرست (فورمن) نیست.');
          }
          nextStatus = 'PENDING_ENGINEER';
          actionLabel = 'تأیید سرپرست (فورمن)';
          break;

        case 'FOREMAN_REJECT':
          if (req.status !== 'PENDING_FOREMAN') {
            throw new Error('این درخواست در مرحله بررسی سرپرست (فورمن) نیست.');
          }
          nextStatus = 'REJECTED';
          actionLabel = 'رد توسط سرپرست (فورمن)';
          break;

        case 'ENGINEER_APPROVE':
          if (req.status !== 'PENDING_ENGINEER') {
            throw new Error('این درخواست در مرحله بررسی مهندس نیست.');
          }
          nextStatus = 'APPROVED';
          actionLabel = 'تأیید نهایی مهندس شیفت / مدیریت';
          break;

        case 'ENGINEER_REJECT':
          if (req.status !== 'PENDING_ENGINEER') {
            throw new Error('این درخواست در مرحله بررسی مهندس نیست.');
          }
          nextStatus = 'REJECTED';
          actionLabel = 'رد توسط مهندس شیفت / مدیریت';
          break;

        case 'CANCEL':
          if (req.status === 'APPROVED' || req.status === 'REJECTED' || req.status === 'CANCELLED') {
            throw new Error('امکان لغو درخواستی که قبلاً مختومه شده است وجود ندارد.');
          }
          if (req.userId !== user.id && user.role !== 'ADMIN') {
            throw new Error('فقط ثبت‌کننده درخواست یا مدیر سیستم مجاز به لغو درخواست هستند.');
          }
          nextStatus = 'CANCELLED';
          actionLabel = 'لغو درخواست';
          break;

        default:
          throw new Error('عملیات درخواستی نامعتبر است.');
      }

      const now = new Date().toISOString();
      req.status = nextStatus;
      req.updatedAt = now;

      const newTimeline: RequestTimelineItem = {
        id: crypto.randomUUID(),
        requestId,
        userId: user.id,
        userName: user.fullName,
        jobTitle: user.jobTitle || 'مسئول بررسی',
        action: actionLabel,
        status: nextStatus,
        notes: notes || null,
        createdAt: now,
      };

      if (!this.state.requestTimelines) this.state.requestTimelines = [];
      this.state.requestTimelines.push(newTimeline);
      this.persistSync();

      return {
        ...req,
        timeline: this.state.requestTimelines
          .filter((t) => t.requestId === req.id)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      };
    });
  }

  // ==========================================
  // GRAPHS (ثبت گراف و مانورهای اعلام حریق)
  // ==========================================

  async getGraphs(filters?: { startDate?: string; endDate?: string; shift?: string }): Promise<GraphItem[]> {
    let list = [...(this.state.graphs || [])];
    if (filters?.startDate) list = list.filter((g) => g.graphDate >= filters.startDate!);
    if (filters?.endDate) list = list.filter((g) => g.graphDate <= filters.endDate!);
    if (filters?.shift) list = list.filter((g) => g.shift === filters.shift);

    list.sort((a, b) => new Date(b.graphDate).getTime() - new Date(a.graphDate).getTime());
    return list;
  }

  async createGraph(data: {
    registeredById?: string;
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
    notes?: string;
  }): Promise<GraphItem> {
    return dbMutex.runExclusive(async () => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const newGraph: GraphItem = {
        id,
        registeredById: data.registeredById || null,
        registeredByName: data.registeredByName,
        graphDate: data.graphDate,
        shift: data.shift,
        participantIds: data.participantIds || [],
        participantNames: data.participantNames || [],
        smokeDetector: data.smokeDetector || 0,
        heatDetector: data.heatDetector || 0,
        manualCallPoint: data.manualCallPoint || 0,
        powerSupply: data.powerSupply || 0,
        controlPanel: data.controlPanel || 0,
        modules: data.modules || 0,
        sounder: data.sounder || 0,
        notes: data.notes || null,
        createdAt: now,
      };

      if (!this.state.graphs) this.state.graphs = [];
      this.state.graphs.push(newGraph);
      this.persistSync();

      return newGraph;
    });
  }

  // ==========================================
  // MESSAGES (پیام‌ها و مکاتبات داخلی با پیوست تا 100MB)
  // ==========================================

  async getInboxMessages(userId: string): Promise<MessageItem[]> {
    return (this.state.messages || [])
      .filter((m) => m.recipientId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getSentMessages(userId: string): Promise<MessageItem[]> {
    return (this.state.messages || [])
      .filter((m) => m.senderId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllMessages(): Promise<MessageItem[]> {
    return [...(this.state.messages || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getMessageById(id: string): Promise<MessageItem | null> {
    return (this.state.messages || []).find((m) => m.id === id) || null;
  }

  async createMessage(data: {
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
  }): Promise<MessageItem> {
    return dbMutex.runExclusive(async () => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const newMsg: MessageItem = {
        id,
        senderId: data.senderId,
        senderName: data.senderName,
        senderJobTitle: data.senderJobTitle,
        recipientId: data.recipientId,
        recipientName: data.recipientName,
        recipientJobTitle: data.recipientJobTitle,
        subject: data.subject,
        body: data.body,
        attachmentFilename: data.attachmentFilename || null,
        attachmentOriginalName: data.attachmentOriginalName || null,
        attachmentSize: data.attachmentSize || null,
        attachmentMime: data.attachmentMime || null,
        attachmentUrl: data.attachmentUrl || null,
        isRead: false,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      };

      if (!this.state.messages) this.state.messages = [];
      this.state.messages.push(newMsg);
      this.persistSync();

      return newMsg;
    });
  }

  async markMessageAsRead(id: string, recipientId: string): Promise<void> {
    return dbMutex.runExclusive(async () => {
      const msg = (this.state.messages || []).find((m) => m.id === id && m.recipientId === recipientId);
      if (msg && !msg.isRead) {
        msg.isRead = true;
        msg.readAt = new Date().toISOString();
        msg.updatedAt = new Date().toISOString();
        this.persistSync();
      }
    });
  }

  async getUnreadMessagesCount(userId: string): Promise<number> {
    return (this.state.messages || []).filter((m) => m.recipientId === userId && !m.isRead).length;
  }

  async migrateFromLocal(localData: any, adminUserId: string) {
    return dbMutex.runExclusive(() => {
      if (!localData) throw new Error('داده‌های ارسالی نامعتبر است.');

      let importedWarehouses = 0;
      let importedShelves = 0;
      let importedItems = 0;
      let importedInventories = 0;
      let importedTransactions = 0;

      // 1. Warehouses
      for (const w of localData.warehouses || []) {
        if (!w.id || !w.name || !w.code) continue;
        const exists = this.state.warehouses.some((ex) => ex.code.toUpperCase() === w.code.toUpperCase());
        if (!exists) {
          this.state.warehouses.push({
            id: w.id,
            name: w.name,
            code: w.code.toUpperCase(),
            description: w.description || '',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          importedWarehouses++;
        }
      }

      // 2. Shelves
      for (const s of localData.shelves || []) {
        if (!s.id || !s.warehouseId || !s.code) continue;
        const exists = this.state.shelves.some((ex) => ex.warehouseId === s.warehouseId && ex.code.toUpperCase() === s.code.toUpperCase());
        if (!exists) {
          this.state.shelves.push({
            id: s.id,
            warehouseId: s.warehouseId,
            name: s.name,
            code: s.code.toUpperCase(),
            description: s.description || '',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          importedShelves++;
        }
      }

      // 3. Items
      for (const i of localData.items || []) {
        if (!i.id || !i.name || !i.code) continue;
        const exists = this.state.items.some((ex) => ex.code.toUpperCase() === i.code.toUpperCase());
        if (!exists) {
          this.state.items.push({
            id: i.id,
            name: i.name,
            code: i.code.toUpperCase(),
            category: i.category || 'تجهیزات اعلام حریق',
            brand: i.brand || '',
            model: i.model || '',
            unit: i.unit || 'عدد',
            description: i.description || '',
            imageUrl: i.imageUrl || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          importedItems++;
        }
      }

      // 4. Inventories
      for (const inv of localData.inventories || []) {
        if (!inv.itemId || !inv.warehouseId || !inv.shelfId) continue;
        const existing = this.state.inventories.find(
          (x) => x.itemId === inv.itemId && x.warehouseId === inv.warehouseId && x.shelfId === inv.shelfId
        );
        if (existing) {
          existing.quantity = inv.quantity;
          existing.updatedAt = new Date().toISOString();
        } else {
          this.state.inventories.push({
            id: inv.id || crypto.randomUUID(),
            itemId: inv.itemId,
            warehouseId: inv.warehouseId,
            shelfId: inv.shelfId,
            quantity: inv.quantity || 0,
            updatedAt: new Date().toISOString(),
          });
        }
        importedInventories++;
      }

      // 5. Transactions
      for (const t of localData.transactions || []) {
        if (!t.id || !t.itemId) continue;
        const exists = this.state.transactions.some((ex) => ex.id === t.id);
        if (!exists) {
          this.state.transactions.push({
            id: t.id,
            type: t.type,
            itemId: t.itemId,
            quantity: t.quantity || 1,
            sourceWarehouseId: t.sourceWarehouseId || null,
            sourceShelfId: t.sourceShelfId || null,
            destWarehouseId: t.destWarehouseId || null,
            destShelfId: t.destShelfId || null,
            userId: t.userId || adminUserId,
            notes: t.notes || null,
            referenceNo: t.referenceNo || null,
            createdAt: t.createdAt || new Date().toISOString(),
          });
          importedTransactions++;
        }
      }

      this.addAuditLogSync({
        userId: adminUserId,
        action: 'MIGRATE_FROM_LOCAL',
        entity: 'System',
        entityId: 'SYSTEM',
        details: `انتقال داده‌های پایگاه محلی به سرور مرکزی: ${importedWarehouses} انبار، ${importedShelves} قفسه، ${importedItems} کالا، ${importedInventories} رکورد موجودی و ${importedTransactions} تراکنش`,
      });

      this.persistSync();

      return {
        success: true,
        importedWarehouses,
        importedShelves,
        importedItems,
        importedInventories,
        importedTransactions,
      };
    });
  }
}

import 'dotenv/config';
import { PostgresDatabaseService } from './db/postgres.js';

class ResilientDatabaseManager {
  private pgDb: PostgresDatabaseService | null = null;
  private fileDb: DatabaseService;
  private activeEngine: 'postgres' | 'file' = 'file';
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.fileDb = new DatabaseService();
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl && !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) {
        try {
          const pgCandidate = new PostgresDatabaseService(databaseUrl);
          await pgCandidate.init();
          const pingResult = await pgCandidate.ping();
          if (pingResult.ok) {
            this.pgDb = pgCandidate;
            this.activeEngine = 'postgres';
            console.log(`[Database] Connected to PostgreSQL at ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
            return;
          }
        } catch (err: any) {
          console.warn('[Database] PostgreSQL connection failed, switching to persistent local engine:', err.message);
        }
      }
      this.activeEngine = 'file';
      console.log('[Database] Using persistent file storage (data/warehouse-db.json). Ready for LAN and local use.');
    })();

    return this.initPromise;
  }

  private get target(): any {
    return this.activeEngine === 'postgres' && this.pgDb ? this.pgDb : this.fileDb;
  }

  get isPostgresActive(): boolean {
    return this.activeEngine === 'postgres';
  }

  // Delegate all methods cleanly
  async ping() {
    if (!this.initPromise) await this.init();
    return this.target.ping();
  }

  async getUsers() { if (!this.initPromise) await this.init(); return this.target.getUsers(); }
  async getUserById(id: string) { if (!this.initPromise) await this.init(); return this.target.getUserById(id); }
  async getUserByUsername(username: string) { if (!this.initPromise) await this.init(); return this.target.getUserByUsername(username); }
  async createUser(data: any) { if (!this.initPromise) await this.init(); return this.target.createUser(data); }
  async updateUser(id: string, data: any) { if (!this.initPromise) await this.init(); return this.target.updateUser(id, data); }
  async deleteUser(id: string, requesterUserId?: string) { if (!this.initPromise) await this.init(); return this.target.deleteUser(id, requesterUserId); }
  async updateLastLogin(id: string) { if (!this.initPromise) await this.init(); return this.target.updateLastLogin(id); }

  async getWarehouses() { if (!this.initPromise) await this.init(); return this.target.getWarehouses(); }
  async getWarehouseById(id: string) { if (!this.initPromise) await this.init(); return this.target.getWarehouseById(id); }
  async createWarehouse(data: any) { if (!this.initPromise) await this.init(); return this.target.createWarehouse(data); }
  async updateWarehouse(id: string, data: any) { if (!this.initPromise) await this.init(); return this.target.updateWarehouse(id, data); }
  async deleteWarehouse(id: string) { if (!this.initPromise) await this.init(); return this.target.deleteWarehouse(id); }

  async getShelves(warehouseId?: string) { if (!this.initPromise) await this.init(); return this.target.getShelves(warehouseId); }
  async getShelfById(id: string) { if (!this.initPromise) await this.init(); return this.target.getShelfById(id); }
  async createShelf(data: any) { if (!this.initPromise) await this.init(); return this.target.createShelf(data); }
  async updateShelf(id: string, data: any) { if (!this.initPromise) await this.init(); return this.target.updateShelf(id, data); }
  async deleteShelf(id: string) { if (!this.initPromise) await this.init(); return this.target.deleteShelf(id); }

  async getItems(filters?: any) { if (!this.initPromise) await this.init(); return this.target.getItems(filters); }
  async getItemById(id: string) { if (!this.initPromise) await this.init(); return this.target.getItemById(id); }
  async getItemByCode(code: string) { if (!this.initPromise) await this.init(); return this.target.getItemByCode(code); }
  async createItem(data: any) { if (!this.initPromise) await this.init(); return this.target.createItem(data); }
  async updateItem(id: string, data: any) { if (!this.initPromise) await this.init(); return this.target.updateItem(id, data); }
  async deleteItem(id: string) { if (!this.initPromise) await this.init(); return this.target.deleteItem(id); }

  async getInventories(warehouseId?: string, shelfId?: string) { if (!this.initPromise) await this.init(); return this.target.getInventories(warehouseId, shelfId); }
  async getInventoryDetails(filters?: any) { if (!this.initPromise) await this.init(); return this.target.getInventoryDetails(filters); }
  async getInventoryByItem(itemId: string) { if (!this.initPromise) await this.init(); return this.target.getInventoryByItem(itemId); }

  async stockIn(params: any) { if (!this.initPromise) await this.init(); return this.target.stockIn(params); }
  async stockOut(params: any) { if (!this.initPromise) await this.init(); return this.target.stockOut(params); }
  async transferStock(params: any) { if (!this.initPromise) await this.init(); return this.target.transferStock(params); }
  async correctiveAdjustment(params: any) { if (!this.initPromise) await this.init(); return this.target.correctiveAdjustment(params); }

  async recordTransaction(data: any) { if (!this.initPromise) await this.init(); return this.target.recordTransaction(data); }
  async getTransactions(filters?: any) { if (!this.initPromise) await this.init(); return this.target.getTransactions(filters); }

  async getAuditLogs(filters?: any) { if (!this.initPromise) await this.init(); return this.target.getAuditLogs(filters); }
  async logAudit(data: any) { if (!this.initPromise) await this.init(); return this.target.logAudit(data); }

  async addAttachment(data: any) { if (!this.initPromise) await this.init(); return this.target.addAttachment(data); }
  async getAttachmentsByItem(itemId: string) { if (!this.initPromise) await this.init(); return this.target.getAttachmentsByItem(itemId); }
  async getAttachmentById(id: string) { if (!this.initPromise) await this.init(); return this.target.getAttachmentById(id); }
  async deleteAttachment(id: string) { if (!this.initPromise) await this.init(); return this.target.deleteAttachment(id); }

  async getDashboardMetrics() { if (!this.initPromise) await this.init(); return this.target.getDashboardMetrics(); }
  async exportBackup() { if (!this.initPromise) await this.init(); return this.target.exportBackup(); }
  async restoreBackup(data: any, adminUserId: string) { if (!this.initPromise) await this.init(); return this.target.restoreBackup(data, adminUserId); }
  async migrateFromLocal(data: any, adminUserId: string) { if (!this.initPromise) await this.init(); return this.target.migrateFromLocal(data, adminUserId); }

  // Requests
  async getRequests(filters?: any) { if (!this.initPromise) await this.init(); return this.target.getRequests(filters); }
  async getRequestById(id: string) { if (!this.initPromise) await this.init(); return this.target.getRequestById(id); }
  async createRequest(data: any) { if (!this.initPromise) await this.init(); return this.target.createRequest(data); }
  async processRequestAction(requestId: string, user: any, action: string, notes?: string) {
    if (!this.initPromise) await this.init();
    return this.target.processRequestAction(requestId, user, action, notes);
  }

  // Graphs
  async getGraphs(filters?: any) { if (!this.initPromise) await this.init(); return this.target.getGraphs(filters); }
  async createGraph(data: any) { if (!this.initPromise) await this.init(); return this.target.createGraph(data); }

  // Messages
  async getInboxMessages(userId: string) { if (!this.initPromise) await this.init(); return this.target.getInboxMessages(userId); }
  async getSentMessages(userId: string) { if (!this.initPromise) await this.init(); return this.target.getSentMessages(userId); }
  async getAllMessages() { if (!this.initPromise) await this.init(); return this.target.getAllMessages(); }
  async getMessageById(id: string) { if (!this.initPromise) await this.init(); return this.target.getMessageById(id); }
  async createMessage(data: any) { if (!this.initPromise) await this.init(); return this.target.createMessage(data); }
  async markMessageAsRead(id: string, recipientId: string) { if (!this.initPromise) await this.init(); return this.target.markMessageAsRead(id, recipientId); }
  async getUnreadMessagesCount(userId: string) { if (!this.initPromise) await this.init(); return this.target.getUnreadMessagesCount(userId); }
}

export const db = new ResilientDatabaseManager();
export const isPostgres = () => db.isPostgresActive;


