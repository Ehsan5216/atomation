import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest, getClientIp } from '../auth.js';
import { upload } from '../storage.js';

const router = Router();

router.use(requireAuth);

// GET /api/messages/unread-count - Get unread count for current user
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const count = await db.getUnreadMessagesCount(user.userId);
    res.json({ count });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'خطا در دریافت تعداد پیام‌های خوانده نشده.' });
  }
});

// GET /api/messages - List messages (inbox / sent / all)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { box } = req.query as { box?: 'inbox' | 'sent' | 'all' };

    let messages = [];
    if (box === 'all' && user.role === 'ADMIN') {
      messages = await db.getAllMessages();
    } else if (box === 'sent') {
      messages = await db.getSentMessages(user.userId);
    } else {
      // Default to inbox
      messages = await db.getInboxMessages(user.userId);
    }

    res.json({ messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'خطا در دریافت پیام‌ها.' });
  }
});

// GET /api/messages/:id - Get single message
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const message = await db.getMessageById(id);

    if (!message) {
      return res.status(404).json({ error: 'پیام مورد نظر یافت نشد.' });
    }

    const user = req.user!;
    const isAdmin = user.role === 'ADMIN';
    const isParty = message.senderId === user.userId || message.recipientId === user.userId;

    if (!isAdmin && !isParty) {
      return res.status(403).json({ error: 'شما مجاز به مشاهده این پیام نیستید.' });
    }

    // Auto mark as read if current user is recipient
    if (message.recipientId === user.userId && !message.isRead) {
      await db.markMessageAsRead(id, user.userId);
      message.isRead = true;
      message.readAt = new Date().toISOString();
    }

    res.json({ message });
  } catch (error: any) {
    console.error('Error fetching message by id:', error);
    res.status(500).json({ error: 'خطا در دریافت جزئیات پیام.' });
  }
});

// POST /api/messages - Send a new message (with optional file up to 100MB)
router.post('/', upload.single('attachment'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipientId, subject, body } = req.body;

    if (!recipientId || !subject || !body) {
      return res.status(400).json({ error: 'گیرنده، موضوع و متن پیام الزامی هستند.' });
    }

    const recipient = await db.getUserById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'کاربر گیرنده یافت نشد.' });
    }

    const sender = req.user!;
    const fullSender = await db.getUserById(sender.userId);

    const file = req.file;
    const attachmentFilename = file ? file.filename : null;
    const attachmentOriginalName = file ? Buffer.from(file.originalname, 'latin1').toString('utf8') : null;
    const attachmentSize = file ? file.size : null;
    const attachmentMime = file ? file.mimetype : null;
    const attachmentUrl = file ? `/api/attachments/download/${file.filename}` : null;

    const newMessage = await db.createMessage({
      senderId: sender.userId,
      senderName: fullSender?.fullName || sender.username,
      senderJobTitle: fullSender?.jobTitle || 'پرسنل اعلام حریق',
      recipientId: recipient.id,
      recipientName: recipient.fullName || recipient.username,
      recipientJobTitle: recipient.jobTitle || 'پرسنل اعلام حریق',
      subject: subject.trim(),
      body: body.trim(),
      attachmentFilename,
      attachmentOriginalName,
      attachmentSize,
      attachmentMime,
      attachmentUrl,
    });

    await db.logAudit({
      userId: sender.userId,
      username: sender.username,
      action: 'SEND_MESSAGE',
      entity: 'Message',
      entityId: newMessage.id,
      details: `ارسال پیام اداری به «${recipient.fullName}» با موضوع: «${subject.trim()}»${file ? ` (پیوست: ${file.originalname})` : ''}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ message: newMessage });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(400).json({ error: error.message || 'خطا در ارسال پیام.' });
  }
});

// PUT /api/messages/:id/read - Mark message as read
router.put('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    await db.markMessageAsRead(id, user.userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    res.status(400).json({ error: 'خطا در ثبت وضعیت خوانده شده پیام.' });
  }
});

// Explicit rejection for message editing (strictly forbidden as per business rules)
router.put('/:id', async (_req: AuthenticatedRequest, res: Response) => {
  return res.status(403).json({
    error: 'طبق مقررات حراستی و اداری سامانه، امکان ویرایش یا دستکاری پیام‌ها پس از ارسال وجود ندارد.',
  });
});

export default router;
