import { Router, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest, getClientIp } from '../auth.js';

const router = Router();

router.use(requireAuth);

// GET /api/graphs - List graphs
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, shift } = req.query as {
      startDate?: string;
      endDate?: string;
      shift?: string;
    };

    const graphs = await db.getGraphs({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      shift: shift || undefined,
    });

    res.json({ graphs });
  } catch (error: any) {
    console.error('Error fetching graphs:', error);
    res.status(500).json({ error: 'خطا در دریافت اطلاعات گراف‌ها.' });
  }
});

// POST /api/graphs - Register new graph
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      graphDate,
      shift,
      participantIds,
      participantNames,
      smokeDetector,
      heatDetector,
      manualCallPoint,
      powerSupply,
      controlPanel,
      modules,
      sounder,
      notes,
    } = req.body;

    if (!graphDate || !shift) {
      return res.status(400).json({ error: 'تاریخ مانور/گراف و شیفت کاری الزامی هستند.' });
    }

    if (!Array.isArray(participantNames) || participantNames.length === 0) {
      return res.status(400).json({ error: 'حداقل یک نفر پرسنل شرکت‌کننده باید انتخاب شود.' });
    }

    const user = req.user!;
    const fullUser = await db.getUserById(user.userId);

    const newGraph = await db.createGraph({
      registeredById: user.userId,
      registeredByName: fullUser?.fullName || user.username,
      graphDate,
      shift,
      participantIds: participantIds || [],
      participantNames: participantNames || [],
      smokeDetector: Number(smokeDetector) || 0,
      heatDetector: Number(heatDetector) || 0,
      manualCallPoint: Number(manualCallPoint) || 0,
      powerSupply: Number(powerSupply) || 0,
      controlPanel: Number(controlPanel) || 0,
      modules: Number(modules) || 0,
      sounder: Number(sounder) || 0,
      notes,
    });

    await db.logAudit({
      userId: user.userId,
      username: user.username,
      action: 'CREATE_GRAPH',
      entity: 'Graph',
      entityId: newGraph.id,
      details: `ثبت گراف اعلام حریق تاریخ ${graphDate} - شیفت ${shift} با شرکت ${participantNames.join('، ')}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ graph: newGraph });
  } catch (error: any) {
    console.error('Error creating graph:', error);
    res.status(400).json({ error: error.message || 'خطا در ثبت گراف.' });
  }
});

// GET /api/graphs/export - Export graphs to Excel
router.get('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, shift } = req.query as {
      startDate?: string;
      endDate?: string;
      shift?: string;
    };

    const graphs = await db.getGraphs({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      shift: shift || undefined,
    });

    const rows = graphs.map((g: any, index: number) => ({
      'ردیف': index + 1,
      'تاریخ مانور': g.graphDate,
      'شیفت': g.shift,
      'پرسنل شرکت‌کننده': Array.isArray(g.participantNames) ? g.participantNames.join(' - ') : '',
      'دتکتور دودی': g.smokeDetector,
      'دتکتور حرارتی': g.heatDetector,
      'شستی اعلام حریق': g.manualCallPoint,
      'منبع تغذیه (Power)': g.powerSupply,
      'پنل مرکزی اعلام حریق': g.controlPanel,
      'ماژول‌ها': g.modules,
      'آژیر/فلاشر': g.sounder,
      'مجموع تجهیزات تست‌شده': (g.smokeDetector || 0) + (g.heatDetector || 0) + (g.manualCallPoint || 0) + (g.powerSupply || 0) + (g.controlPanel || 0) + (g.modules || 0) + (g.sounder || 0),
      'ثبت‌کننده': g.registeredByName,
      'توضیحات': g.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش گراف اعلام حریق');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=zobahan_graphs_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting graphs:', error);
    res.status(500).json({ error: 'خطا در صدور گزارش اکسل گراف‌ها.' });
  }
});

export default router;
