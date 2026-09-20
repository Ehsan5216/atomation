import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthTokenPayload, Role } from './types.js';
import { db } from './db.js';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('[FATAL] JWT_SECRET is not configured in environment variables.');
  }
  return secret;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

/**
 * Helper مرکزی جهت استخراج آدرس آی‌پی کلاینت در شبکه محلی (LAN) با بررسی TRUST_PROXY
 */
export function getClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const ip = forwarded.split(',')[0].trim().replace(/^::ffff:/, '');
      if (ip) return ip;
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      const ip = forwarded[0].trim().replace(/^::ffff:/, '');
      if (ip) return ip;
    }
  }
  const rawIp = req.socket?.remoteAddress || req.ip || '';
  const cleanIp = rawIp.replace(/^::ffff:/, '').trim();
  return cleanIp || '127.0.0.1';
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d',
  });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // اکیداً فقط Authorization: Bearer پذیرفته می‌شود (حذف کامل توکن از Query String)
  if (!token) {
    return res.status(401).json({ error: 'لطفاً ابتدا وارد سیستم شوید.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'نشست کاربری شما منقضی شده است. مجدداً وارد شوید.' });
  }

  // اعتبارسنجی زنده وضعیت کاربر و نسخه توکن (Session Invalidation) در پایگاه‌داده PostgreSQL
  try {
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'حساب کاربری یافت نشد یا از سیستم حذف شده است. نشست کاربری نامعتبر است.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ error: 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.' });
    }

    // اعتبارسنجی نسخه سشن/توکن
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ error: 'نشست کاربری شما باطل شده است. لطفاً مجدداً وارد شوید.' });
      }
    }
  } catch (err) {
    console.error('[Auth] Error verifying user status in requireAuth:', err);
    return res.status(401).json({ error: 'اعتبارسنجی نشست کاربری با خطا مواجه شد.' });
  }

  req.user = decoded;
  next();
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'عدم دسترسی. لطفاً وارد شوید.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'شما مجوز دسترسی به این بخش را ندارید.' });
    }
    next();
  };
}
