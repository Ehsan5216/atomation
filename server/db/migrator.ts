import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function runMigrations(pool: Pool): Promise<void> {
  console.log('[PostgreSQL] Starting database migration & schema verification...');
  
  const client = await pool.connect();
  try {
    // 1. Read schema.sql
    const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
    let sqlContent: string;
    if (fs.existsSync(schemaPath)) {
      sqlContent = fs.readFileSync(schemaPath, 'utf-8');
    } else {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    // Execute schema DDL inside a transaction
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS personnel_code VARCHAR(50);');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);');
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100) DEFAULT 'تکنسین اعلام حریق';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS warehouse_role VARCHAR(50) NOT NULL DEFAULT 'WAREHOUSE_USER';");

    // Ensure admin user has warehouse_role WAREHOUSE_ADMIN and appropriate job title
    await client.query(`
      UPDATE users 
      SET warehouse_role = 'WAREHOUSE_ADMIN',
          job_title = CASE WHEN job_title IS NULL OR job_title = 'تکنسین اعلام حریق' THEN 'مدیر ارشد سیستم' ELSE job_title END
      WHERE role = 'ADMIN';
    `);

    // Populate first_name and last_name from full_name if empty
    await client.query(`
      UPDATE users
      SET first_name = split_part(full_name, ' ', 1),
          last_name = CASE 
            WHEN position(' ' in full_name) > 0 THEN substr(full_name, length(split_part(full_name, ' ', 1)) + 2)
            ELSE ''
          END
      WHERE (first_name IS NULL OR first_name = '') AND full_name IS NOT NULL;
    `);

    await client.query('COMMIT');
    console.log('[PostgreSQL] Schema DDL applied successfully.');

    // 2. Ensure initial Admin and Operator users exist if users table is empty
    const usersCountResult = await client.query('SELECT COUNT(*) as count FROM users');
    const usersCount = parseInt(usersCountResult.rows[0].count, 10);

    if (usersCount === 0) {
      console.log('[PostgreSQL] Users table is empty. Seeding initial administrative accounts...');
      
      const salt = await bcrypt.genSalt(10);
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || 'Ehsan1984*#';
      const adminFullName = process.env.ADMIN_FULLNAME || 'دکتر احسان ابوالقاسمی';
      const adminPasswordHash = await bcrypt.hash(adminPassword, salt);

      const operatorUsername = 'operator';
      const operatorPassword = 'Operator123*#';
      const operatorPasswordHash = await bcrypt.hash(operatorPassword, salt);

      const adminId = 'usr-admin-01';
      const operatorId = 'usr-operator-01';
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO users (id, username, full_name, password_hash, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, 'ADMIN', true, $5),
                ($6, $7, $8, $9, 'WAREHOUSE_USER', true, $5)
         ON CONFLICT (username) DO NOTHING`,
        [
          adminId,
          adminUsername,
          adminFullName,
          adminPasswordHash,
          now,
          operatorId,
          operatorUsername,
          'کارشناس انبار اعلام حریق',
          operatorPasswordHash,
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'SYSTEM_INIT', 'System', 'SYSTEM', 'راه‌اندازی اولیه پایگاه داده مرکزی PostgreSQL', '127.0.0.1', $4)`,
        [crypto.randomUUID(), adminId, adminUsername, now]
      );

      console.log(`[PostgreSQL] Initial users seeded: "${adminUsername}" (Admin) and "${operatorUsername}" (Operator).`);
    } else {
      console.log(`[PostgreSQL] Database already contains ${usersCount} users.`);
    }

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[PostgreSQL] Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
