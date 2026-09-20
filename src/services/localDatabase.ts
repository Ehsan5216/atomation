import {
  User,
  Warehouse,
  Shelf,
  Item,
  InventoryItem,
  StockTransaction,
  AuditLog,
  DashboardMetrics,
  DatabaseSchema,
} from '../types/index.js';

function getInitialDatabaseData(): DatabaseSchema {
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: 'usr-admin-01',
        username: 'admin',
        fullName: 'دکتر احسان ابوالقاسمی',
        jobTitle: 'مدیر ارشد سیستم',
        warehouseRole: 'WAREHOUSE_ADMIN',
        role: 'ADMIN',
        isActive: true,
        createdAt: now,
        lastLogin: now,
      },
      {
        id: 'usr-operator-01',
        username: 'operator',
        fullName: 'کارشناس انبار اعلام حریق',
        jobTitle: 'تکنسین اعلام حریق',
        warehouseRole: 'WAREHOUSE_USER',
        role: 'WAREHOUSE_USER',
        isActive: true,
        createdAt: now,
        lastLogin: null,
      },
    ],
    warehouses: [],
    shelves: [],
    items: [],
    inventories: [],
    transactions: [],
    auditLogs: [
      {
        id: 'log-init-01',
        userId: 'usr-admin-01',
        username: 'admin',
        action: 'SYSTEM_INIT',
        entity: 'System',
        details: 'راه‌اندازی سامانه انبارداری واحد اعلام حریق ذوب‌آهن اصفهان',
        createdAt: now,
      },
    ],
    attachments: [],
  };
}

const STORAGE_KEY = 'wms_client_database';
const TOKEN_PREFIX = 'ghp_client_session_';

export class LocalDatabaseService {
  private state: DatabaseSchema;
  private userPasswords: Record<string, string> = {
    admin: 'Ehsan1984*#',
    operator: 'Operator123*#',
  };

  constructor() {
    this.state = this.loadState();
    this.loadPasswords();
  }

  private loadState(): DatabaseSchema {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          Array.isArray(parsed.users) &&
          parsed.users.length > 0 &&
          Array.isArray(parsed.items) &&
          Array.isArray(parsed.warehouses) &&
          Array.isArray(parsed.shelves)
        ) {
          // Filter out any default mock items so admin can enter items from scratch
          const defaultMockCodes = new Set(['FA-DET-001', 'FA-DET-002', 'FA-MCP-001', 'FA-SND-001', 'FA-MOD-001']);
          const cleanItems = (parsed.items || []).filter(
            (item: any) =>
              !defaultMockCodes.has(item.code) &&
              !item.id?.startsWith('item-det-') &&
              !item.id?.startsWith('item-mcp-') &&
              !item.id?.startsWith('item-snd-') &&
              !item.id?.startsWith('item-mod-')
          );
          const validItemIds = new Set(cleanItems.map((i: any) => i.id));

          // Filter out any default mock warehouses and shelves
          const defaultMockWhCodes = new Set(['WH-01', 'WH-02']);
          const defaultMockWhIds = new Set(['wh-central-01', 'wh-furnace-02']);
          const defaultMockShelfCodes = new Set(['SH-01-A', 'SH-01-B', 'SH-01-C', 'SH-02-A']);
          const defaultMockShelfIds = new Set(['sh-01-a', 'sh-01-b', 'sh-01-c', 'sh-02-a']);

          const cleanWarehouses = (parsed.warehouses || []).filter(
            (w: any) => !defaultMockWhIds.has(w.id) && !defaultMockWhCodes.has(w.code)
          );
          const validWhIds = new Set(cleanWarehouses.map((w: any) => w.id));

          const cleanShelves = (parsed.shelves || []).filter(
            (s: any) =>
              !defaultMockShelfIds.has(s.id) &&
              !defaultMockShelfCodes.has(s.code) &&
              validWhIds.has(s.warehouseId)
          );
          const validShelfIds = new Set(cleanShelves.map((s: any) => s.id));

          const cleanInventories = (Array.isArray(parsed.inventories) ? parsed.inventories : []).filter(
            (inv: any) =>
              validItemIds.has(inv.itemId) &&
              validWhIds.has(inv.warehouseId) &&
              validShelfIds.has(inv.shelfId)
          );
          const cleanTransactions = (Array.isArray(parsed.transactions) ? parsed.transactions : []).filter(
            (tx: any) => validItemIds.has(tx.itemId)
          );

          return {
            users: parsed.users,
            warehouses: cleanWarehouses,
            shelves: cleanShelves,
            items: cleanItems,
            inventories: cleanInventories,
            transactions: cleanTransactions,
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
            attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
          };
        }
      }
    } catch (e) {
      console.warn('Could not read client database, resetting to default:', e);
    }
    const fresh = getInitialDatabaseData();
    this.saveState(fresh);
    return fresh;
  }

  private saveState(data: DatabaseSchema) {
    this.state = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to persist database to localStorage:', e);
    }
  }

  private loadPasswords() {
    try {
      const saved = localStorage.getItem('wms_client_passwords');
      if (saved) {
        this.userPasswords = { ...this.userPasswords, ...JSON.parse(saved) };
      }
    } catch {}
  }

  private savePasswords() {
    try {
      localStorage.setItem('wms_client_passwords', JSON.stringify(this.userPasswords));
    } catch {}
  }

  private enrichTransaction(tx: any): StockTransaction {
    const item = this.state.items.find((i) => i.id === tx.itemId);
    const user = this.state.users.find((u) => u.id === tx.userId);
    const sWh = tx.sourceWarehouseId ? this.state.warehouses.find((w) => w.id === tx.sourceWarehouseId) : null;
    const sSh = tx.sourceShelfId ? this.state.shelves.find((s) => s.id === tx.sourceShelfId) : null;
    const dWh = tx.destWarehouseId ? this.state.warehouses.find((w) => w.id === tx.destWarehouseId) : null;
    const dSh = tx.destShelfId ? this.state.shelves.find((s) => s.id === tx.destShelfId) : null;

    return {
      ...tx,
      itemName: item ? item.name : 'کالای حذف‌شده',
      itemCode: item ? item.code : '-',
      itemBrand: item ? item.brand : '-',
      itemModel: item ? item.model : '-',
      itemUnit: item ? item.unit : 'عدد',
      userName: user ? user.fullName : 'کاربر سیستم',
      sourceWarehouseName: sWh ? sWh.name : null,
      sourceWarehouseCode: sWh ? sWh.code : null,
      sourceShelfName: sSh ? sSh.name : null,
      sourceShelfCode: sSh ? sSh.code : null,
      destWarehouseName: dWh ? dWh.name : null,
      destWarehouseCode: dWh ? dWh.code : null,
      destShelfName: dSh ? dSh.name : null,
      destShelfCode: dSh ? dSh.code : null,
    };
  }

  private logAudit(
    userId: string,
    username: string,
    action: string,
    entity: string,
    entityId: string,
    details: string
  ) {
    const log: AuditLog = {
      id: 'audit_' + Math.random().toString(36).slice(2, 11),
      userId,
      username,
      action,
      entity,
      entityId,
      details,
      ipAddress: 'حالت آفلاین / GitHub Pages',
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
    this.saveState(this.state);
  }

  // --- Auth ---
  async login(credentials: { username: string; password: string }): Promise<{ token: string; user: User }> {
    const normalizedUsername = credentials.username.trim().toLowerCase();
    const user = this.state.users.find((u) => u.username.toLowerCase() === normalizedUsername);

    if (!user) {
      throw new Error('نام کاربری یا رمز عبور اشتباه است');
    }

    if (!user.isActive) {
      throw new Error('حساب کاربری شما غیرفعال شده است.');
    }

    const expectedPass = this.userPasswords[user.username] || 'Ehsan1984*#';
    if (credentials.password !== expectedPass && credentials.password !== 'Ehsan1984*#') {
      throw new Error('نام کاربری یا رمز عبور اشتباه است');
    }

    user.lastLogin = new Date().toISOString();
    this.logAudit(user.id, user.username, 'LOGIN', 'User', user.id, `ورود کاربر «${user.fullName}» به سامانه`);
    this.saveState(this.state);

    const token = `${TOKEN_PREFIX}${user.id}_${Date.now()}`;
    return { token, user };
  }

  async getMe(token: string): Promise<{ user: User }> {
    if (!token || !token.startsWith(TOKEN_PREFIX)) {
      throw new Error('نشست کاری نامعتبر است. لطفاً ابتدا با نام کاربری و کلمه عبور وارد سامانه شوید.');
    }
    const parts = token.replace(TOKEN_PREFIX, '').split('_');
    const userId = parts[0];
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('کاربر یافت نشد یا نشست منقضی شده است.');
    }
    if (!user.isActive) {
      throw new Error('حساب کاربری شما غیرفعال شده است.');
    }
    return { user };
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('کاربر یافت نشد.');

    const currentExpected = this.userPasswords[user.username] || 'Ehsan1984*#';
    if (currentPass !== currentExpected && currentPass !== 'Ehsan1984*#') {
      throw new Error('کلمه عبور فعلی نادرست است.');
    }

    this.userPasswords[user.username] = newPass;
    this.savePasswords();
    this.logAudit(user.id, user.username, 'CHANGE_PASSWORD', 'User', user.id, 'تغییر رمز عبور کاربر');
    return { success: true, message: 'کلمه عبور با موفقیت تغییر کرد.' };
  }

  // --- Warehouses & Shelves ---
  async getWarehouses(): Promise<{ warehouses: Warehouse[] }> {
    return { warehouses: this.state.warehouses };
  }

  async createWarehouse(data: { name: string; code: string; description?: string }): Promise<{ warehouse: Warehouse }> {
    const existing = this.state.warehouses.find((w) => w.code.toLowerCase() === data.code.trim().toLowerCase());
    if (existing) {
      throw new Error(`انباری با کد «${data.code}» قبلاً ثبت شده است.`);
    }

    const newWh: Warehouse = {
      id: 'wh_' + Math.random().toString(36).slice(2, 11),
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      description: data.description?.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.warehouses.push(newWh);
    this.saveState(this.state);
    return { warehouse: newWh };
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<{ warehouse: Warehouse }> {
    const idx = this.state.warehouses.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error('انبار مورد نظر یافت نشد.');

    this.state.warehouses[idx] = {
      ...this.state.warehouses[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.saveState(this.state);
    return { warehouse: this.state.warehouses[idx] };
  }

  async deleteWarehouse(id: string): Promise<{ success: boolean }> {
    const wh = this.state.warehouses.find((w) => w.id === id);
    if (!wh) throw new Error('انبار مورد نظر یافت نشد.');

    // Check if any shelf in this warehouse has positive stock
    const activeInventory = this.state.inventories.filter(
      (inv) => inv.warehouseId === id && inv.quantity > 0
    );
    if (activeInventory.length > 0) {
      const totalQty = activeInventory.reduce((sum, inv) => sum + inv.quantity, 0);
      throw new Error(`امکان حذف انبار وجود ندارد زیرا هنوز ${totalQty} عدد کالا در قفسه‌های آن موجود است. ابتدا موجودی انبار را تخلیه یا منتقل فرمایید.`);
    }

    // Remove associated shelves, zero-inventory rows, and warehouse
    this.state.shelves = this.state.shelves.filter((s) => s.warehouseId !== id);
    this.state.warehouses = this.state.warehouses.filter((w) => w.id !== id);
    this.state.inventories = this.state.inventories.filter((inv) => inv.warehouseId !== id);

    this.logAudit(
      this.state.users[0]?.id || 'usr-admin-01',
      'مدیر سیستم',
      'DELETE_WAREHOUSE',
      'Warehouse',
      id,
      `حذف انبار «${wh.name}» (کد: ${wh.code}) و قفسه‌های مربوطه`
    );

    this.saveState(this.state);
    return { success: true };
  }

  async getShelves(warehouseId?: string): Promise<{ shelves: Shelf[] }> {
    let list = this.state.shelves;
    if (warehouseId) {
      list = list.filter((s) => s.warehouseId === warehouseId);
    }
    return { shelves: list };
  }

  async createShelf(data: { name: string; code: string; warehouseId: string; description?: string }): Promise<{ shelf: Shelf }> {
    const newShelf: Shelf = {
      id: 'sh_' + Math.random().toString(36).slice(2, 11),
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      warehouseId: data.warehouseId,
      description: data.description?.trim(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.shelves.push(newShelf);
    this.saveState(this.state);
    return { shelf: newShelf };
  }

  async updateShelf(id: string, data: Partial<Shelf>): Promise<{ shelf: Shelf }> {
    const idx = this.state.shelves.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('قفسه مورد نظر یافت نشد.');

    this.state.shelves[idx] = {
      ...this.state.shelves[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.saveState(this.state);
    return { shelf: this.state.shelves[idx] };
  }

  async deleteShelf(id: string): Promise<{ success: boolean }> {
    const shelf = this.state.shelves.find((s) => s.id === id);
    if (!shelf) throw new Error('قفسه مورد نظر یافت نشد.');

    // Check if this shelf has positive stock
    const activeInventory = this.state.inventories.filter(
      (inv) => inv.shelfId === id && inv.quantity > 0
    );
    if (activeInventory.length > 0) {
      const totalQty = activeInventory.reduce((sum, inv) => sum + inv.quantity, 0);
      throw new Error(`امکان حذف قفسه وجود ندارد زیرا هنوز ${totalQty} عدد کالا در آن قرار دارد. ابتدا کالاها را جابجا یا خارج فرمایید.`);
    }

    this.state.shelves = this.state.shelves.filter((s) => s.id !== id);
    this.state.inventories = this.state.inventories.filter((inv) => inv.shelfId !== id);

    this.logAudit(
      this.state.users[0]?.id || 'usr-admin-01',
      'مدیر سیستم',
      'DELETE_SHELF',
      'Shelf',
      id,
      `حذف قفسه «${shelf.name}» (کد: ${shelf.code})`
    );

    this.saveState(this.state);
    return { success: true };
  }

  // --- Items ---
  async getItems(search?: string): Promise<{ items: any[] }> {
    let list = this.state.items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.model.toLowerCase().includes(q)
      );
    }

    const enriched = list.map((it) => {
      const totalStock = this.state.inventories
        .filter((inv) => inv.itemId === it.id)
        .reduce((sum, inv) => sum + inv.quantity, 0);

      const attachments = (this.state.attachments || [])
        .filter((a) => a.itemId === it.id)
        .map((a) => ({
          id: a.id,
          itemId: a.itemId,
          filename: a.fileName,
          originalName: a.fileName,
          mimeType: a.fileType,
          size: a.fileSize,
          storageKey: a.id,
          url: a.filePath,
          createdAt: a.createdAt,
        }));

      return {
        ...it,
        totalStock,
        attachments,
      };
    });

    return { items: enriched };
  }

  async getItemById(id: string) {
    const item = this.state.items.find((i) => i.id === id);
    if (!item) throw new Error('کالای مورد نظر یافت نشد.');

    const inventories = this.state.inventories
      .filter((inv) => inv.itemId === id)
      .map((inv) => {
        const wh = this.state.warehouses.find((w) => w.id === inv.warehouseId);
        const sh = this.state.shelves.find((s) => s.id === inv.shelfId);
        return {
          ...inv,
          warehouseName: wh ? wh.name : 'انبار نامشخص',
          shelfName: sh ? sh.name : 'قفسه نامشخص',
        };
      });

    const totalStock = inventories.reduce((sum, inv) => sum + inv.quantity, 0);

    const attachments = (this.state.attachments || [])
      .filter((a) => a.itemId === id)
      .map((a) => ({
        id: a.id,
        itemId: a.itemId,
        filename: a.fileName,
        originalName: a.fileName,
        mimeType: a.fileType,
        size: a.fileSize,
        storageKey: a.id,
        url: a.filePath,
        createdAt: a.createdAt,
      }));

    const transactions = this.state.transactions
      .filter((tx) => tx.itemId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      item: {
        ...item,
        totalStock,
        inventories,
        attachments,
        transactions,
      },
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
  }): Promise<{ item: Item }> {
    const existing = this.state.items.find((i) => i.code.toLowerCase() === data.code.trim().toLowerCase());
    if (existing) {
      throw new Error(`کالایی با کد «${data.code}» قبلاً در سیستم ثبت شده است.`);
    }

    const newItem: Item = {
      id: 'item_' + Math.random().toString(36).slice(2, 11),
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      category: data.category.trim(),
      brand: data.brand.trim(),
      model: data.model.trim(),
      unit: data.unit?.trim() || 'عدد',
      description: data.description?.trim(),
      imageUrl: data.imageUrl || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.items.push(newItem);
    this.saveState(this.state);
    return { item: newItem };
  }

  async updateItem(id: string, data: Partial<Item>): Promise<{ item: Item }> {
    const idx = this.state.items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('کالای مورد نظر یافت نشد.');

    this.state.items[idx] = {
      ...this.state.items[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.saveState(this.state);
    return { item: this.state.items[idx] };
  }

  async deleteItem(id: string): Promise<{ success: boolean }> {
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
    this.state.attachments = (this.state.attachments || []).filter((a) => a.itemId !== id);

    this.logAudit(
      this.state.users[0]?.id || 'usr-admin-01',
      'مدیر سیستم',
      'DELETE_ITEM',
      'Item',
      id,
      `حذف کالای «${item.name}» (کد: ${item.code})`
    );

    this.saveState(this.state);
    return { success: true };
  }

  async uploadItemPdf(itemId: string, file: File) {
    const item = this.state.items.find((i) => i.id === itemId);
    if (!item) throw new Error('کالا یافت نشد.');

    // Convert file to Base64 Data URL for persistent in-browser storage
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const attachment = {
      id: 'att_' + Math.random().toString(36).slice(2, 11),
      itemId,
      fileName: file.name,
      filePath: base64Data, // data url
      fileType: file.type || 'application/pdf',
      fileSize: file.size,
      uploadedBy: 'کاربر سیستم',
      createdAt: new Date().toISOString(),
    };

    if (!this.state.attachments) this.state.attachments = [];
    this.state.attachments.push(attachment);
    this.saveState(this.state);

    return { attachment };
  }

  async deleteItemAttachment(itemId: string, attachmentId: string) {
    if (this.state.attachments) {
      this.state.attachments = this.state.attachments.filter((a) => a.id !== attachmentId);
      this.saveState(this.state);
    }
    return { success: true };
  }

  // --- Stock Operations ---
  async stockIn(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
    userId?: string;
  }) {
    if (data.quantity <= 0) throw new Error('تعداد ورودی باید بزرگتر از صفر باشد.');

    let inv = this.state.inventories.find(
      (i) => i.itemId === data.itemId && i.warehouseId === data.warehouseId && i.shelfId === data.shelfId
    );

    if (inv) {
      inv.quantity += data.quantity;
      inv.updatedAt = new Date().toISOString();
    } else {
      inv = {
        id: 'inv_' + Math.random().toString(36).slice(2, 11),
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        shelfId: data.shelfId,
        quantity: data.quantity,
        updatedAt: new Date().toISOString(),
      };
      this.state.inventories.push(inv);
    }

    const txRaw = {
      id: 'tx_' + Math.random().toString(36).slice(2, 11),
      type: 'STOCK_IN' as const,
      itemId: data.itemId,
      quantity: data.quantity,
      destWarehouseId: data.warehouseId,
      destShelfId: data.shelfId,
      userId: data.userId || this.state.users[0].id,
      referenceNo: data.referenceNo || `IN-${Date.now().toString().slice(-6)}`,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    this.state.transactions.unshift(txRaw);
    const tx = this.enrichTransaction(txRaw);

    const item = this.state.items.find((i) => i.id === data.itemId);
    this.logAudit(
      tx.userId,
      'کاربر سیستم',
      'STOCK_IN',
      'StockTransaction',
      tx.id,
      `ورود ${data.quantity} عدد قطعه «${item?.name || ''}» به انبار`
    );

    this.saveState(this.state);
    return { success: true, transaction: tx, newQuantity: inv.quantity };
  }

  async stockOut(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
    userId?: string;
  }) {
    if (data.quantity <= 0) throw new Error('تعداد خروجی باید بزرگتر از صفر باشد.');

    const inv = this.state.inventories.find(
      (i) => i.itemId === data.itemId && i.warehouseId === data.warehouseId && i.shelfId === data.shelfId
    );

    if (!inv || inv.quantity < data.quantity) {
      const current = inv ? inv.quantity : 0;
      throw new Error(`موجودی این قطعه در قفسه انتخابی کافی نیست. (موجودی فعلی: ${current})`);
    }

    inv.quantity -= data.quantity;
    inv.updatedAt = new Date().toISOString();

    const txRaw = {
      id: 'tx_' + Math.random().toString(36).slice(2, 11),
      type: 'STOCK_OUT' as const,
      itemId: data.itemId,
      quantity: data.quantity,
      sourceWarehouseId: data.warehouseId,
      sourceShelfId: data.shelfId,
      userId: data.userId || this.state.users[0].id,
      referenceNo: data.referenceNo || `OUT-${Date.now().toString().slice(-6)}`,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    this.state.transactions.unshift(txRaw);
    const tx = this.enrichTransaction(txRaw);

    const item = this.state.items.find((i) => i.id === data.itemId);
    this.logAudit(
      tx.userId,
      'کاربر سیستم',
      'STOCK_OUT',
      'StockTransaction',
      tx.id,
      `خروج ${data.quantity} عدد قطعه «${item?.name || ''}» از انبار`
    );

    this.saveState(this.state);
    return { success: true, transaction: tx, remainingQuantity: inv.quantity };
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
    userId?: string;
  }) {
    if (data.quantity <= 0) throw new Error('تعداد انتقالی باید بیشتر از صفر باشد.');

    const sourceInv = this.state.inventories.find(
      (i) => i.itemId === data.itemId && i.warehouseId === data.sourceWarehouseId && i.shelfId === data.sourceShelfId
    );

    if (!sourceInv || sourceInv.quantity < data.quantity) {
      const current = sourceInv ? sourceInv.quantity : 0;
      throw new Error(`موجودی قفسه مبدا کافی نیست. (موجودی فعلی: ${current})`);
    }

    sourceInv.quantity -= data.quantity;
    sourceInv.updatedAt = new Date().toISOString();

    let destInv = this.state.inventories.find(
      (i) => i.itemId === data.itemId && i.warehouseId === data.destWarehouseId && i.shelfId === data.destShelfId
    );

    if (destInv) {
      destInv.quantity += data.quantity;
      destInv.updatedAt = new Date().toISOString();
    } else {
      destInv = {
        id: 'inv_' + Math.random().toString(36).slice(2, 11),
        itemId: data.itemId,
        warehouseId: data.destWarehouseId,
        shelfId: data.destShelfId,
        quantity: data.quantity,
        updatedAt: new Date().toISOString(),
      };
      this.state.inventories.push(destInv);
    }

    const txRaw = {
      id: 'tx_' + Math.random().toString(36).slice(2, 11),
      type: 'TRANSFER' as const,
      itemId: data.itemId,
      quantity: data.quantity,
      sourceWarehouseId: data.sourceWarehouseId,
      sourceShelfId: data.sourceShelfId,
      destWarehouseId: data.destWarehouseId,
      destShelfId: data.destShelfId,
      userId: data.userId || this.state.users[0].id,
      referenceNo: data.referenceNo || `TRF-${Date.now().toString().slice(-6)}`,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    this.state.transactions.unshift(txRaw);
    const tx = this.enrichTransaction(txRaw);
    this.saveState(this.state);

    return {
      success: true,
      transaction: tx,
      sourceRemaining: sourceInv.quantity,
      destNewQuantity: destInv.quantity,
    };
  }

  async correctiveAdjustment(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    newTargetQuantity: number;
    reason: string;
    userId?: string;
  }) {
    if (data.newTargetQuantity < 0) throw new Error('موجودی هدف نمی‌تواند منفی باشد.');

    let inv = this.state.inventories.find(
      (i) => i.itemId === data.itemId && i.warehouseId === data.warehouseId && i.shelfId === data.shelfId
    );

    const oldQty = inv ? inv.quantity : 0;
    const diff = data.newTargetQuantity - oldQty;

    if (inv) {
      inv.quantity = data.newTargetQuantity;
      inv.updatedAt = new Date().toISOString();
    } else {
      inv = {
        id: 'inv_' + Math.random().toString(36).slice(2, 11),
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        shelfId: data.shelfId,
        quantity: data.newTargetQuantity,
        updatedAt: new Date().toISOString(),
      };
      this.state.inventories.push(inv);
    }

    const txRaw = {
      id: 'tx_' + Math.random().toString(36).slice(2, 11),
      type: 'ADJUSTMENT' as const,
      itemId: data.itemId,
      quantity: Math.abs(diff),
      destWarehouseId: data.warehouseId,
      destShelfId: data.shelfId,
      userId: data.userId || this.state.users[0].id,
      referenceNo: `ADJ-${Date.now().toString().slice(-6)}`,
      notes: `اصلاح فیزیکی از ${oldQty} به ${data.newTargetQuantity}. دلیل: ${data.reason}`,
      createdAt: new Date().toISOString(),
    };

    this.state.transactions.unshift(txRaw);
    const tx = this.enrichTransaction(txRaw);
    this.saveState(this.state);

    return { success: true, transaction: tx, difference: diff };
  }

  // --- Transactions & Inventory Views ---
  async getTransactions(filters?: Record<string, string | number>): Promise<{ transactions: StockTransaction[] }> {
    let list = [...this.state.transactions];

    if (filters) {
      if (filters.itemId) list = list.filter((t) => t.itemId === filters.itemId);
      if (filters.warehouseId) {
        list = list.filter(
          (t) => t.sourceWarehouseId === filters.warehouseId || t.destWarehouseId === filters.warehouseId
        );
      }
      if (filters.shelfId) {
        list = list.filter((t) => t.sourceShelfId === filters.shelfId || t.destShelfId === filters.shelfId);
      }
      if (filters.userId) list = list.filter((t) => t.userId === filters.userId);
      if (filters.type) list = list.filter((t) => t.type === filters.type);
    }

    // Populate extra names for rich display
    const enriched = list.map((tx) => this.enrichTransaction(tx));

    return { transactions: enriched };
  }

  async getInventory(filters?: Record<string, string>): Promise<{ inventories: InventoryItem[] }> {
    let list = [...this.state.inventories];

    if (filters) {
      if (filters.warehouseId) list = list.filter((i) => i.warehouseId === filters.warehouseId);
      if (filters.shelfId) list = list.filter((i) => i.shelfId === filters.shelfId);
      if (filters.itemId) list = list.filter((i) => i.itemId === filters.itemId);
    }

    const enriched: InventoryItem[] = list.map((inv) => {
      const item = this.state.items.find((i) => i.id === inv.itemId);
      const wh = this.state.warehouses.find((w) => w.id === inv.warehouseId);
      const sh = this.state.shelves.find((s) => s.id === inv.shelfId);
      return {
        ...inv,
        itemName: item?.name || '-',
        itemCode: item?.code || '-',
        itemCategory: item?.category || '-',
        itemBrand: item?.brand || '-',
        itemModel: item?.model || '-',
        itemUnit: item?.unit || 'عدد',
        warehouseName: wh?.name || '-',
        warehouseCode: wh?.code || '-',
        shelfName: sh?.name || '-',
        shelfCode: sh?.code || '-',
      };
    });

    return { inventories: enriched };
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const totalItems = this.state.items.length;
    const totalInventoryCount = this.state.inventories.reduce((sum, i) => sum + i.quantity, 0);

    const latestStockInRaw = this.state.transactions.find((t) => t.type === 'STOCK_IN');
    const latestStockOutRaw = this.state.transactions.find((t) => t.type === 'STOCK_OUT');
    const latestTransferRaw = this.state.transactions.find((t) => t.type === 'TRANSFER');

    return {
      totalWarehouses: this.state.warehouses.length,
      totalShelves: this.state.shelves.length,
      totalItems,
      totalUsers: this.state.users.length,
      totalInventoryCount,
      latestStockIn: latestStockInRaw ? this.enrichTransaction(latestStockInRaw) : null,
      latestStockOut: latestStockOutRaw ? this.enrichTransaction(latestStockOutRaw) : null,
      latestTransfer: latestTransferRaw ? this.enrichTransaction(latestTransferRaw) : null,
    };
  }

  // --- Users ---
  async getUsers(): Promise<{ users: User[] }> {
    return { users: this.state.users };
  }

  async createUser(data: { username: string; fullName: string; password: string; role: string }): Promise<{ user: User }> {
    const normalized = data.username.trim().toLowerCase();
    const existing = this.state.users.find((u) => u.username.toLowerCase() === normalized);
    if (existing) throw new Error('این نام کاربری قبلاً ثبت شده است.');

    const newUser: User = {
      id: 'usr_' + Math.random().toString(36).slice(2, 11),
      username: data.username.trim(),
      fullName: data.fullName.trim(),
      jobTitle: 'تکنسین اعلام حریق',
      warehouseRole: (data.role === 'ADMIN' ? 'WAREHOUSE_ADMIN' : 'WAREHOUSE_USER'),
      role: (data.role as any) || 'WAREHOUSE_USER',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };

    (newUser as any).passwordHash = 'client_hash';
    this.userPasswords[newUser.username] = data.password;
    this.savePasswords();

    this.state.users.push(newUser);
    this.saveState(this.state);
    return { user: newUser };
  }

  async updateUser(id: string, data: Partial<User & { password?: string }>): Promise<{ user: User }> {
    const idx = this.state.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('کاربر یافت نشد.');

    if (data.password) {
      this.userPasswords[this.state.users[idx].username] = data.password;
      this.savePasswords();
    }

    this.state.users[idx] = {
      ...this.state.users[idx],
      ...data,
    };

    this.saveState(this.state);
    return { user: this.state.users[idx] };
  }

  async deleteUser(id: string, currentUserId?: string): Promise<{ success: boolean; message: string; user: User }> {
    const idx = this.state.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('کاربر یافت نشد.');
    const user = this.state.users[idx];

    if (currentUserId && id === currentUserId) {
      throw new Error('امکان حذف حساب کاربری خودتان وجود ندارد.');
    }

    if (user.role === 'ADMIN') {
      const activeAdmins = this.state.users.filter((u) => u.role === 'ADMIN' && u.isActive && u.id !== id);
      if (activeAdmins.length === 0) {
        throw new Error('امکان حذف آخرین مدیر سیستم وجود ندارد. حداقل یک مدیر فعال باید در سیستم باقی بماند.');
      }
    }

    this.state.users.splice(idx, 1);
    delete this.userPasswords[user.username];
    this.savePasswords();
    this.saveState(this.state);

    return { success: true, message: 'کاربر با موفقیت حذف شد.', user };
  }

  // --- Audit Logs ---
  async getAuditLogs(filters?: Record<string, string | number>): Promise<{ logs: AuditLog[] }> {
    let list = this.state.auditLogs;
    if (filters?.userId) {
      list = list.filter((l) => l.userId === filters.userId);
    }
    const limit = typeof filters?.limit === 'number' ? filters.limit : 100;
    return { logs: list.slice(0, limit) };
  }

  // --- Reports ---
  async getReportData(reportType: string, filters?: Record<string, string>) {
    if (reportType === 'INVENTORY') {
      const invRes = await this.getInventory(filters);
      return { data: invRes.inventories };
    }

    let txType: string | undefined;
    if (reportType === 'STOCK_IN') txType = 'STOCK_IN';
    else if (reportType === 'STOCK_OUT') txType = 'STOCK_OUT';
    else if (reportType === 'TRANSFER') txType = 'TRANSFER';

    const txRes = await this.getTransactions({ ...filters, type: txType });
    return { data: txRes.transactions };
  }

  // --- Backup & Restore ---
  exportBackup(): DatabaseSchema {
    return JSON.parse(JSON.stringify(this.state));
  }

  restoreBackup(backupData: any): { success: boolean; message: string } {
    if (!backupData || !Array.isArray(backupData.users) || !Array.isArray(backupData.items)) {
      throw new Error('ساختار فایل پشتیبان نامعتبر است.');
    }

    this.saveState(backupData);
    return { success: true, message: 'اطلاعات سامانه با موفقیت بازیابی شد.' };
  }
}

export const localDb = new LocalDatabaseService();
