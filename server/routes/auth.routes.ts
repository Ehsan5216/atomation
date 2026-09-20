import { Router, Response } from 'express';
import { db } from '../db.js';
import { comparePassword, generateToken, requireAuth, hashPassword, AuthenticatedRequest, getClientIp } from '../auth.js';

const router = Router();

// =======================================================
// LOGIN RATE LIMITING (حداکثر ۵ تلاش ناموفق در ۱۵ دقیقه)
// =======================================================
interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 دقیقه

function checkLoginRateLimit(key: string): { allowed: boolean; remainingMinutes?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };

  // بررسی قفل موقت
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingMs = record.lockedUntil - now;
    return { allowed: false, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }

  // انقضای پنجره زمانی قبلی
  if (now - record.firstAttemptAt > WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordLoginFailure(key: string) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    loginAttempts.set(key, { attempts: 1, firstAttemptAt: now });
  } else {
    record.attempts += 1;
    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + WINDOW_MS;
    }
  }
}

function resetLoginRateLimit(key: string) {
  loginAttempts.delete(key);
}

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    const clientIp = getClientIp(req);
    const rateLimitKey = `${clientIp}:${username.trim().toLowerCase()}`;

    // 1. بررسی محدودیت نرخ درخواست‌های ناموفق
    const rateStatus = checkLoginRateLimit(rateLimitKey);
    if (!rateStatus.allowed) {
      return res.status(429).json({
        error: `تعداد دفعات ورود ناموفق بیش از حد مجاز است. لطفاً ${rateStatus.remainingMinutes || 15} دقیقه دیگر مجدداً تلاش نمایید.`,
      });
    }

    const user = await db.getUserByUsername(username);
    if (!user) {
      recordLoginFailure(rateLimitKey);
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      recordLoginFailure(rateLimitKey);
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    // بازنشانی ریت لیمیت در صورت ورود موفق
    resetLoginRateLimit(rateLimitKey);

    await db.updateLastLogin(user.id);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      tokenVersion: user.tokenVersion || 1,
    });

    await db.logAudit({
      userId: user.id,
      username: user.username,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      details: `ورود موفق کاربر «${user.fullName}» (${user.username}) به سامانه`,
      ipAddress: clientIp,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tokenVersion: user.tokenVersion || 1,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطای سرور در فرآیند ورود. مجدداً تلاش نمایید.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد.' });
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت اطلاعات کاربر.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'کلمه عبور فعلی و جدید الزامی هستند.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'کلمه عبور جدید باید حداقل ۶ کاراکتر باشد.' });
    }

    const user = await db.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد.' });
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'کلمه عبور فعلی نادرست است.' });
    }

    await db.updateUser(user.id, { password: newPassword });

    await db.logAudit({
      userId: user.id,
      username: user.username,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: user.id,
      details: `تغییر رمز عبور توسط کاربر «${user.fullName}»`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: 'کلمه عبور با موفقیت تغییر یافت.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'خطا در تغییر کلمه عبور.' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.logAudit({
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user!.userId,
      details: `خروج کاربر «${req.user!.fullName}» از سامانه`,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: 'با موفقیت خارج شدید.' });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در خروج از سیستم.' });
  }
});

export default router;
