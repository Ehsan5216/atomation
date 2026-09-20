-- ====================================================================
-- پایگاه داده PostgreSQL سامانه انبارداری واحد اعلام حریق ذوب‌آهن اصفهان
-- طراح و تحلیل‌گر سیستم: دکتر احسان ابوالقاسمی
-- ====================================================================

-- 1. جدول نقش‌های کاربری (Roles)
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (id, name, description)
VALUES 
  ('ADMIN', 'مدیر سیستم', 'دسترسی نامحدود به تمامی بخش‌ها، تعریف انبار، کالا، کاربر و پشتیبان‌گیری'),
  ('WAREHOUSE_USER', 'کارشناس انبار', 'ثبت ورود، خروج، انتقال کالا و مشاهده گزارش‌ها و موجودی')
ON CONFLICT (id) DO NOTHING;

-- 2. جدول کاربران سامانه (Users)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- 3. جدول دسته‌بندی قطعات و تجهیزات اعلام حریق (Categories)
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (id, name, description)
VALUES
  ('cat-01', 'دتکتورها و آشکارسازها', 'انواع دتکتور دودی نوری، حرارتی، شعله و گاز'),
  ('cat-02', 'شستی‌های اعلام حریق', 'شستی‌های دستی متعارف و آدرس‌پذیر ضد انفجار'),
  ('cat-03', 'تجهیزات هشداردهنده صوتی و نوری', 'آژیرها، فلاشرها و بوق‌های اعلام خطر صنعتی'),
  ('cat-04', 'ماژول‌ها و اینترفیس‌ها', 'ماژول‌های ورودی/خروجی، ایزولاتور و کنترل فرمان'),
  ('cat-05', 'پانل‌های مرکزی و تکرارکننده‌ها', 'پانل مرکزی اعلام حریق، باتری‌ها و منابع تغذیه')
ON CONFLICT (name) DO NOTHING;

-- 4. جدول انبارها (Warehouses)
CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses (code);

-- 5. جدول قفسه‌های انبار (Shelves)
CREATE TABLE IF NOT EXISTS shelves (
  id VARCHAR(64) PRIMARY KEY,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_warehouse_shelf_code UNIQUE (warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shelves_warehouse_id ON shelves (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shelves_code ON shelves (code);

-- 6. جدول اقلام و کالاهای انبار (Items / Products)
CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(150) NOT NULL,
  brand VARCHAR(150) DEFAULT '',
  model VARCHAR(150) DEFAULT '',
  unit VARCHAR(50) NOT NULL DEFAULT 'عدد',
  description TEXT DEFAULT '',
  image_url TEXT,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  storage_location VARCHAR(255) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_code ON items (code);
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);

-- 7. جدول موجودی لحظه‌ای کالاها در قفسه‌ها (Inventory)
CREATE TABLE IF NOT EXISTS inventories (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  shelf_id VARCHAR(64) NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_item_wh_shelf UNIQUE (item_id, warehouse_id, shelf_id)
);

CREATE INDEX IF NOT EXISTS idx_inventories_item_id ON inventories (item_id);
CREATE INDEX IF NOT EXISTS idx_inventories_warehouse_id ON inventories (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventories_shelf_id ON inventories (shelf_id);

-- 8. جدول تراکنش‌های ورود، خروج و جابه‌جایی موجودی (Stock Transactions / Movements)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id VARCHAR(64) PRIMARY KEY,
  tracking_code VARCHAR(100),
  type VARCHAR(50) NOT NULL, -- 'STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT'
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  source_warehouse_id VARCHAR(64) REFERENCES warehouses(id) ON DELETE SET NULL,
  source_shelf_id VARCHAR(64) REFERENCES shelves(id) ON DELETE SET NULL,
  dest_warehouse_id VARCHAR(64) REFERENCES warehouses(id) ON DELETE SET NULL,
  dest_shelf_id VARCHAR(64) REFERENCES shelves(id) ON DELETE SET NULL,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  reference_no VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_tx_item ON stock_transactions (item_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_type ON stock_transactions (type);
CREATE INDEX IF NOT EXISTS idx_stock_tx_created_at ON stock_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_tx_user ON stock_transactions (user_id);

-- 9. جدول فایل‌های ضمیمه و کاتالوگ‌های فنی (Attachments)
CREATE TABLE IF NOT EXISTS attachments (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  uploaded_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_item_id ON attachments (item_id);

-- 10. جدول وقایع‌نگاری و ممیزی سامانه (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(64),
  details TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);

-- 11. جدول تنظیمات سیستمی (Settings)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. جدول درخواست‌های پرسنلی و تغییر شیفت (Requests)
CREATE TABLE IF NOT EXISTS requests (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(50) NOT NULL DEFAULT 'SHIFT_CHANGE',
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(200) NOT NULL,
  user_job_title VARCHAR(100) NOT NULL,
  user_personnel_code VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING_FOREMAN',
  target_date VARCHAR(50) NOT NULL,
  shift VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests (user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at DESC);

-- 13. جدول تایم‌لاین و گردش مراحل درخواست‌ها (Request Timelines)
CREATE TABLE IF NOT EXISTS request_timelines (
  id VARCHAR(64) PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(200) NOT NULL,
  job_title VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_timelines_req_id ON request_timelines (request_id);
CREATE INDEX IF NOT EXISTS idx_request_timelines_created_at ON request_timelines (created_at ASC);

-- 14. جدول ثبت گراف‌های روزانه تجهیزات اعلام حریق (Graphs)
CREATE TABLE IF NOT EXISTS graphs (
  id VARCHAR(64) PRIMARY KEY,
  registered_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  registered_by_name VARCHAR(200) NOT NULL,
  graph_date VARCHAR(50) NOT NULL,
  shift VARCHAR(50) NOT NULL,
  participant_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  participant_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  smoke_detector INTEGER NOT NULL DEFAULT 0 CHECK (smoke_detector >= 0),
  heat_detector INTEGER NOT NULL DEFAULT 0 CHECK (heat_detector >= 0),
  manual_call_point INTEGER NOT NULL DEFAULT 0 CHECK (manual_call_point >= 0),
  power_supply INTEGER NOT NULL DEFAULT 0 CHECK (power_supply >= 0),
  control_panel INTEGER NOT NULL DEFAULT 0 CHECK (control_panel >= 0),
  modules INTEGER NOT NULL DEFAULT 0 CHECK (modules >= 0),
  sounder INTEGER NOT NULL DEFAULT 0 CHECK (sounder >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graphs_date ON graphs (graph_date);
CREATE INDEX IF NOT EXISTS idx_graphs_shift ON graphs (shift);
CREATE INDEX IF NOT EXISTS idx_graphs_created_at ON graphs (created_at DESC);

-- 15. جدول پیام‌های اداری و عملیاتی (Messages)
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  sender_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name VARCHAR(200) NOT NULL,
  sender_job_title VARCHAR(100),
  recipient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name VARCHAR(200) NOT NULL,
  recipient_job_title VARCHAR(100),
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  attachment_filename VARCHAR(255),
  attachment_original_name VARCHAR(255),
  attachment_size BIGINT,
  attachment_mime VARCHAR(100),
  attachment_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages (is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
