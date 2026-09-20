import 'dotenv/config';

// Clean up relative __dirname injected by tsx to prevent createRequire('.') crash in Node 22 ESM
if (typeof (globalThis as any).__dirname === 'string' && (globalThis as any).__dirname === '.') {
  delete (globalThis as any).__dirname;
}

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { db, isPostgres } from './server/db.js';
import { getFilePath } from './server/storage.js';
import { requireAuth } from './server/auth.js';

// Route handlers
import authRoutes from './server/routes/auth.routes.js';
import usersRoutes from './server/routes/users.routes.js';
import warehousesRoutes from './server/routes/warehouses.routes.js';
import itemsRoutes from './server/routes/items.routes.js';
import stockRoutes from './server/routes/stock.routes.js';
import inventoryRoutes from './server/routes/inventory.routes.js';
import reportsRoutes from './server/routes/reports.routes.js';
import auditRoutes from './server/routes/audit.routes.js';
import backupRoutes from './server/routes/backup.routes.js';
import requestsRoutes from './server/routes/requests.routes.js';
import graphsRoutes from './server/routes/graphs.routes.js';
import messagesRoutes from './server/routes/messages.routes.js';

// Port 3000 is strictly required by the AI Studio reverse proxy infrastructure
const PORT = 3000;

function getLanIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

async function startServer() {
  console.log('[Server] Checking PostgreSQL connectivity...');
  // 1. PostgreSQL Database Initialization & Verification
  try {
    if (typeof (db as any).init === 'function') {
      await (db as any).init();
    }
    const pingTest = await (db as any).ping();
    console.log(`[Server] PostgreSQL Database connected & verified in ${pingTest.latencyMs}ms.`);
  } catch (dbErr: any) {
    console.error('================================================================');
    console.error('[Server] Warning: Initial PostgreSQL connection check encountered an error:');
    console.error('[Server] Error details:', dbErr.message || dbErr);
    console.error('[Server] Server will continue running so Vite and status endpoints remain accessible.');
    console.error('================================================================');
  }

  const app = express();
  const server = http.createServer(app);

  // Trust proxy for accurate LAN and proxy IP resolution if TRUST_PROXY is set
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  }

  // 2. CORS configuration (LAN & Workgroup friendly, restrictive security)
  const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS;
  const configuredOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((o) => o.trim().toLowerCase())
    : null;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile PWA, curl, server-to-server)
        if (!origin) return callback(null, true);

        // If explicitly configured in .env
        if (configuredOrigins) {
          if (configuredOrigins.includes('*') || configuredOrigins.includes(origin.toLowerCase())) {
            return callback(null, true);
          }
        }

        // Allow localhost, loopback, and standard private LAN IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
        const isLanOrLocal =
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i.test(
            origin
          );

        if (isLanOrLocal) {
          return callback(null, true);
        }

        // Allow same host
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Basic security headers & body parsers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 3. Health Check Endpoints with LIVE Database Ping
  const healthCheckHandler = async (_req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      // Live database query ping
      const pingRes = await (db as any).ping();
      const latencyMs = Date.now() - startTime;
      const warehouses = await db.getWarehouses();

      res.json({
        status: 'ok',
        server: 'online',
        database: {
          status: 'connected',
          engine: 'PostgreSQL Central Database',
          latencyMs,
          livePingOk: pingRes.ok,
        },
        timestamp: new Date().toISOString(),
        service: 'سامانه اتوماسیون اداری و عملیاتی واحد اعلام حریق ذوب‌آهن اصفهان',
        appName: 'اتوماسیون اعلام حریق ذوب‌آهن',
        version: '3.0.0',
        designer: 'دکتر احسان ابوالقاسمی',
        multiDeviceReady: true,
        warehousesCount: warehouses.length,
        uptime: process.uptime(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'error',
        server: 'online',
        database: {
          status: 'disconnected',
          engine: 'PostgreSQL',
          error: err.message || 'Database query ping failed',
        },
        timestamp: new Date().toISOString(),
        service: 'سامانه اتوماسیون اداری و عملیاتی واحد اعلام حریق ذوب‌آهن اصفهان',
        appName: 'اتوماسیون اعلام حریق ذوب‌آهن',
        version: '3.0.0',
        designer: 'دکتر احسان ابوالقاسمی',
        uptime: process.uptime(),
      });
    }
  };

  app.get('/health', healthCheckHandler);
  app.get('/api/health', healthCheckHandler);

  // 4. Network & LAN Info Endpoint (for easy LAN client connection)
  const networkInfoHandler = async (_req: Request, res: Response) => {
    try {
      let dbConnected = false;
      let dbLatencyMs = 0;
      try {
        const pingRes = await (db as any).ping();
        dbConnected = true;
        dbLatencyMs = pingRes.latencyMs;
      } catch {
        dbConnected = false;
      }

      const lanIps = getLanIpAddresses();
      res.json({
        hostname: os.hostname(),
        port: PORT,
        lanIps,
        primaryLanIp: lanIps[0] || '127.0.0.1',
        serverUrls: lanIps.map((ip) => `http://${ip}:${PORT}`),
        localUrl: `http://localhost:${PORT}`,
        databaseConnected: dbConnected,
        databaseLatencyMs: dbLatencyMs,
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        platform: os.platform(),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'خطا در استخراج مشخصات شبکه سرور.' });
    }
  };

  app.get('/api/network-info', networkInfoHandler);
  app.get('/api/system/network', networkInfoHandler);

  // 5. Protected Static file serving for PDF Catalogs and Uploads (Authenticated & Path-Traversal safe)
  app.get(['/api/files/:filename', '/api/attachments/download/:filename'], requireAuth, (req: Request, res: Response) => {
    const filename = req.params.filename;
    const fullPath = getFilePath(filename);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'فایل مورد نظر یافت نشد یا دسترسی به آن محدود است.' });
    }
    res.sendFile(fullPath);
  });

  // 6. Mount REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/warehouses', warehousesRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/requests', requestsRoutes);
  app.use('/api/graphs', graphsRoutes);
  app.use('/api/messages', messagesRoutes);

  // 7. Vite Middleware for Development / Static serving for Production
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'مسیر API مورد نظر یافت نشد.' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message || 'خطای غیرمنتظره در سرور رخ داده است.' });
  });

  server.listen(PORT, '0.0.0.0', () => {
    const lanIps = getLanIpAddresses();
    console.log(`[Automation] =================================================`);
    console.log(`[Automation] Zob Ahan Fire Alarm Automation Server running on port ${PORT}`);
    console.log(`[Automation] Local URL: http://localhost:${PORT}`);
    lanIps.forEach((ip) => {
      console.log(`[Automation] LAN URL:   http://${ip}:${PORT}`);
    });
    console.log(`[Automation] مدیریت اتوماسیون و ارتباطات - واحد اعلام حریق ذوب‌آهن اصفهان`);
    console.log(`[Automation] طراح و معمار سیستم: دکتر احسان ابوالقاسمی`);
    console.log(`[Automation] =================================================`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
