import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest, getClientIp } from '../auth.js';

const router = Router();

// All user management routes require ADMIN role
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// GET /api/users
router.get('/', async (_req, res: Response) => {
  try {
    const users = await db.getUsers();
    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت لیست کاربران.' });
  }
});

// POST /api/users
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, fullName, firstName, lastName, personnelCode, jobTitle, warehouseRole, password, role } = req.body;
    if (!username || (!fullName && !firstName && !lastName) || !password || !role) {
      return res.status(400).json({ error: 'فیلدهای نام کاربری، نام، نام خانوادگی یا نام کامل، رمز عبور و نقش الزامی هستند.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
    }
    if (!['ADMIN', 'WAREHOUSE_USER', 'USER'].includes(role)) {
      return res.status(400).json({ error: 'نقش کاربری نامعتبر است.' });
    }

    const newUser = await db.createUser({
      username,
      fullName: fullName || [firstName, lastName].filter(Boolean).join(' '),
      firstName,
      lastName,
      personnelCode,
      jobTitle,
      warehouseRole,
      password,
      role,
    });

    await db.logAudit({
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: newUser.id,
      details: `ایجاد کاربر جدید «${newUser.fullName}» با نام کاربری ${newUser.username}، کد پرسنلی ${newUser.personnelCode || '-'} و سمت ${newUser.jobTitle || '-'}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ user: newUser });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ایجاد کاربر.' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, firstName, lastName, personnelCode, jobTitle, warehouseRole, role, isActive, password } = req.body;

    const updatedUser = await db.updateUser(id, {
      fullName,
      firstName,
      lastName,
      personnelCode,
      jobTitle,
      warehouseRole,
      role,
      isActive,
      password,
    });

    await db.logAudit({
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'EDIT_USER',
      entity: 'User',
      entityId: id,
      details: `ویرایش مشخصات یا وضعیت کاربر «${updatedUser.fullName}» (${updatedUser.username})`,
      ipAddress: getClientIp(req),
    });

    res.json({ user: updatedUser });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ویرایش کاربر.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.userId;

    // 1. بررسی عدم حذف خود ادمین
    if (id === currentUserId) {
      return res.status(400).json({ error: 'امکان حذف حساب کاربری خودتان وجود ندارد.' });
    }

    // 2. واکشی کاربر قبل از حذف جهت بررسی و ثبت جزییات در لاگ ممیزی
    const targetUser = await db.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد.' });
    }

    // 3. حذف کاربر به صورت تراکنشی از پایگاه‌داده
    const deletedUser = await db.deleteUser(id, currentUserId);

    // 4. ثبت رویداد در لاگ ممیزی سیستم (Audit Log)
    const clientIp = getClientIp(req);
    await db.logAudit({
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'USER_DELETE',
      entity: 'User',
      entityId: id,
      details: `حذف کاربر «${deletedUser.fullName}» (شناسه: ${id}، نام کاربری: ${deletedUser.username}، نقش: ${deletedUser.role}) توسط مدیر ارشد سیستم - نتیجه: موفق`,
      ipAddress: clientIp,
    });

    res.json({
      success: true,
      message: 'کاربر با موفقیت حذف شد.',
      deletedUser: {
        id: deletedUser.id,
        username: deletedUser.username,
        fullName: deletedUser.fullName,
        role: deletedUser.role,
      },
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(400).json({ error: error.message || 'حذف کاربر انجام نشد.' });
  }
});

export default router;
