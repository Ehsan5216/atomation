import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest, getClientIp } from '../auth.js';

const router = Router();

router.use(requireAuth);

// GET /api/requests - List requests
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, type } = req.query as { status?: string; type?: string };

    const isAdmin = user.role === 'ADMIN';
    const isApprover = isAdmin || user.jobTitle?.includes('سرپرست') || user.jobTitle?.includes('مهندس') || user.jobTitle?.includes('فورمن');

    // If regular user and not an approver, only see own requests
    const filterUserId = isApprover ? undefined : user.userId;

    const requests = await db.getRequests({
      userId: filterUserId,
      status: status || undefined,
      type: type || undefined,
    });

    res.json({ requests });
  } catch (error: any) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'خطا در دریافت لیست درخواست‌ها.' });
  }
});

// GET /api/requests/:id - Get request details with timeline
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const request = await db.getRequestById(id);

    if (!request) {
      return res.status(404).json({ error: 'درخواست مورد نظر یافت نشد.' });
    }

    const user = req.user!;
    const isAdmin = user.role === 'ADMIN';
    const isApprover = isAdmin || user.jobTitle?.includes('سرپرست') || user.jobTitle?.includes('مهندس') || user.jobTitle?.includes('فورمن');

    if (!isApprover && request.userId !== user.userId) {
      return res.status(403).json({ error: 'شما مجاز به مشاهده این درخواست نیستید.' });
    }

    res.json({ request });
  } catch (error: any) {
    console.error('Error fetching request by id:', error);
    res.status(500).json({ error: 'خطا در دریافت جزئیات درخواست.' });
  }
});

// POST /api/requests - Create new shift change request
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetDate, shift, reason, type } = req.body;

    if (!targetDate || !shift) {
      return res.status(400).json({ error: 'تاریخ مورد نظر و شیفت الزامی هستند.' });
    }

    const user = req.user!;

    // Fetch full user record to ensure accurate full name and job title
    const fullUser = await db.getUserById(user.userId);

    const newRequest = await db.createRequest({
      type: type || 'SHIFT_CHANGE',
      userId: user.userId,
      userName: fullUser?.fullName || user.username,
      userJobTitle: fullUser?.jobTitle || 'پرسنل اعلام حریق',
      userPersonnelCode: fullUser?.personnelCode || undefined,
      targetDate,
      shift,
      reason,
    });

    await db.logAudit({
      userId: user.userId,
      username: user.username,
      action: 'CREATE_REQUEST',
      entity: 'Request',
      entityId: newRequest.id,
      details: `ثبت درخواست جا‌به‌جایی شیفت برای تاریخ ${targetDate} - شیفت ${shift}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ request: newRequest });
  } catch (error: any) {
    console.error('Error creating request:', error);
    res.status(400).json({ error: error.message || 'خطا در ثبت درخواست.' });
  }
});

// POST /api/requests/:id/action - Process action on request (Foreman, Engineer, Cancel)
router.post('/:id/action', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'نوع اقدام الزامی است.' });
    }

    const user = req.user!;
    const fullUser = await db.getUserById(user.userId);
    const jobTitle = fullUser?.jobTitle || 'پرسنل';
    const role = user.role;

    // Authorization checks for actions
    if (action === 'FOREMAN_APPROVE' || action === 'FOREMAN_REJECT') {
      const isForemanOrAdmin = role === 'ADMIN' || jobTitle.includes('سرپرست') || jobTitle.includes('فورمن');
      if (!isForemanOrAdmin) {
        return res.status(403).json({ error: 'فقط سرپرست شیفت (فورمن) یا مدیر سیستم مجاز به اقدام در این مرحله هستند.' });
      }
    } else if (action === 'ENGINEER_APPROVE' || action === 'ENGINEER_REJECT') {
      const isEngineerOrAdmin = role === 'ADMIN' || jobTitle.includes('مهندس');
      if (!isEngineerOrAdmin) {
        return res.status(403).json({ error: 'فقط مهندس شیفت یا مدیر سیستم مجاز به اقدام در این مرحله هستند.' });
      }
    }

    const updated = await db.processRequestAction(
      id,
      {
        id: user.userId,
        fullName: fullUser?.fullName || user.username,
        jobTitle,
        role,
      },
      action,
      notes
    );

    await db.logAudit({
      userId: user.userId,
      username: user.username,
      action: `REQUEST_${action}`,
      entity: 'Request',
      entityId: id,
      details: `اقدام «${action}» بر روی درخواست جا‌به‌جایی شیفت ${id} - وضعیت جدید: ${updated.status}`,
      ipAddress: getClientIp(req),
    });

    res.json({ request: updated });
  } catch (error: any) {
    console.error('Error processing request action:', error);
    res.status(400).json({ error: error.message || 'خطا در اعمال اقدام بر روی درخواست.' });
  }
});

export default router;
