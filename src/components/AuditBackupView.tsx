import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileCode,
  Server,
  ArrowRightLeft,
  Network,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../services/api.js';
import { AuditLog } from '../types/index.js';
import { formatShamsiDate } from '../utils/persian.js';

export const AuditBackupView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'AUDIT' | 'BACKUP'>('AUDIT');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs({ limit: 100 });
      setLogs(res.logs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const checkHealth = async () => {
    try {
      const health = await api.getHealthStatus();
      setServerHealth(health);
    } catch {
      setServerHealth(null);
    }
    try {
      const net = await api.getNetworkInfo();
      setNetworkInfo(net);
    } catch {
      setNetworkInfo(null);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  useEffect(() => {
    loadLogs();
    checkHealth();
  }, []);

  const handleDownloadBackup = async () => {
    try {
      setError(null);
      const backupData = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zobahan-fire-warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg('فایل پشتیبان کامل با موفقیت دانلود شد.');
    } catch (err: any) {
      setError(err.message || 'خطا در دریافت پشتیبان.');
    }
  };

  const handleMigrateLocalToServer = async () => {
    if (
      !confirm(
        'توجه: این عملیات تمامی اطلاعات ذخیره‌شده در مرورگر فعلی (انبارها، قفسه‌ها، کالاها، موجودی و تراکنش‌ها) را به پایگاه داده مرکزی سرور ارسال می‌کند تا در تمام سیستم‌ها و موبایل‌ها قابل دسترس باشد. قبل از انتقال، یک فایل پشتیبان امنیتی خودکار دانلود می‌شود. آیا ادامه می‌دهید؟'
      )
    ) {
      return;
    }

    setIsMigrating(true);
    setError(null);
    setSuccessMsg(null);
    setMigrationResult(null);

    try {
      // 1. Automatic safety backup download first
      await handleDownloadBackup();

      // 2. Send local data to remote server
      const res = await api.migrateLocalToServer();
      setMigrationResult(res);
      setSuccessMsg(
        `انتقال داده‌ها به پایگاه مرکزی با موفقیت انجام شد: ${res.importedItems} کالا، ${res.importedWarehouses} انبار، ${res.importedShelves} قفسه، ${res.importedInventories} موجودی و ${res.importedTransactions} تراکنش منتقل شدند.`
      );
      await loadLogs();
      await checkHealth();
    } catch (err: any) {
      setError(err.message || 'خطا در انتقال اطلاعات محلی به سرور مرکزی.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('هشدار بحرانی: با بازگردانی نسخه پشتیبان، اطلاعات فعلی بازنویسی خواهند شد. آیا مطمئن هستید؟')) {
      if (restoreFileRef.current) restoreFileRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      await api.restoreBackup(jsonData, 'CONFIRM_RESTORE');
      setSuccessMsg('نسخه پشتیبان با موفقیت بازگردانی شد. سیستم به‌روزرسانی شد.');
      await loadLogs();
    } catch (err: any) {
      setError(err.message || 'خطا در بازگردانی نسخه پشتیبان.');
    } finally {
      setIsRestoring(false);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>لاگ‌های امنیتی (Audit Logs) و پشتیبان‌گیری</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ثبت غیرقابل تغییر رویدادهای سیستم، ردیابی فعالیت‌ها و مدیریت نسخه‌های پشتیبان
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('AUDIT')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'AUDIT'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            دفتر ممیزی (Audit Log)
          </button>
          <button
            onClick={() => setActiveSubTab('BACKUP')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'BACKUP'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            پشتیبان‌گیری (Backup & Restore)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeSubTab === 'AUDIT' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">
              ۱۰۰ رکورد اخیر دفتر ممیزی امنیتی
            </span>
            <button
              onClick={loadLogs}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>به‌روزرسانی</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-800/70 text-slate-400 text-[11px] font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">کاربر</th>
                  <th className="p-3">عملیات</th>
                  <th className="p-3">جزئیات رویداد</th>
                  <th className="p-3">آدرس IP</th>
                  <th className="p-3">تاریخ و زمان شمسی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      در حال دریافت وقایع...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      رکوردی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  logs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-100">{log.username}</td>
                      <td className="p-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700 font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{log.details || '-'}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">{log.ipAddress}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {formatShamsiDate(log.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Server & Central Database Status Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">وضعیت اتصال به پایگاه داده مرکزی</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      serverHealth?.multiDeviceReady
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : (serverHealth?.status === 'ok' || serverHealth?.status === 'healthy')
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {serverHealth?.multiDeviceReady
                      ? 'پایگاه مرکزی PostgreSQL فعال (چندکاربره و چنددستگاهی)'
                      : (serverHealth?.status === 'ok' || serverHealth?.status === 'healthy')
                      ? 'سرور فعال (ذخیره‌سازی لوکال)'
                      : 'حالت مرورگر (Local IndexedDB)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {serverHealth?.multiDeviceReady
                    ? 'سامانه مستقیماً به پایگاه داده متمرکز PostgreSQL متصل است. هرگونه تغییر در تمامی سیستم‌ها و موبایل‌ها بلافاصله همگام‌سازی می‌شود.'
                    : 'سامانه در حالت مستقل محلی فعال است یا به دیتابیس فایل سرور متصل است.'}
                </p>
              </div>
            </div>

            <button
              onClick={checkHealth}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 self-end md:self-center"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>بررسی مجدد اتصال</span>
            </button>
          </div>

          {/* LAN & Network Info Card for Multi-device connectivity */}
          {networkInfo && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                    <Network className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">مشخصات شبکه محلی سرور (LAN / Workgroup)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      برای اتصال کلاینت‌ها، تبلت‌ها و رایانه‌های دیگر در شبکه، آدرس‌های زیر را در مرورگر وارد کنید:
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  Port: {networkInfo.port}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {networkInfo.serverUrls && networkInfo.serverUrls.length > 0 ? (
                  networkInfo.serverUrls.map((url: string, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] text-slate-400 block mb-0.5">آدرس اتصال شبکه (LAN URL)</span>
                        <code className="text-xs font-mono font-bold text-amber-300 ltr block truncate select-all">
                          {url}
                        </code>
                      </div>
                      <button
                        onClick={() => handleCopyUrl(url)}
                        title="کپی آدرس در کلیپ‌بورد"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
                      >
                        {copiedUrl === url ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] text-slate-400 block mb-0.5">آدرس لوکال (Localhost)</span>
                      <code className="text-xs font-mono font-bold text-amber-300 ltr block">
                        {networkInfo.localUrl || 'http://localhost:3000'}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Migration Report Banner if just performed */}
          {migrationResult && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>گزارش انتقال موفقیت‌آمیز اطلاعات محلی به سرور مرکزی:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                  <span className="text-xs text-slate-400 block">کالاها</span>
                  <span className="text-lg font-black text-white">{migrationResult.importedItems}</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                  <span className="text-xs text-slate-400 block">انبارها</span>
                  <span className="text-lg font-black text-white">{migrationResult.importedWarehouses}</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                  <span className="text-xs text-slate-400 block">قفسه‌ها</span>
                  <span className="text-lg font-black text-white">{migrationResult.importedShelves}</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                  <span className="text-xs text-slate-400 block">موجودی‌ها</span>
                  <span className="text-lg font-black text-white">{migrationResult.importedInventories}</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                  <span className="text-xs text-slate-400 block">تراکنش‌ها</span>
                  <span className="text-lg font-black text-white">{migrationResult.importedTransactions}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Box 1: Migrate Local to Central PostgreSQL */}
            <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">انتقال اطلاعات محلی به سرور مرکزی</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    انتقال خودکار کلیه کالاها، انبارها، قفسه‌ها و موجودی‌های ثبت‌شده در مرورگر فعلی (IndexedDB) به دیتابیس PostgreSQL سرور، به همراه دانلود خودکار نسخه پشتیبان پیش از انتقال.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  disabled={isMigrating}
                  onClick={handleMigrateLocalToServer}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowRightLeft className={`w-4 h-4 ${isMigrating ? 'animate-spin' : ''}`} />
                  <span>{isMigrating ? 'در حال ارسال به سرور...' : 'شروع انتقال داده‌های محلی به سرور'}</span>
                </button>
              </div>
            </div>

            {/* Box 2: Backup Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">پشتیبان‌گیری کامل از داده‌ها (Export)</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    دریافت فایل JSON از تمام جداول انبار، کالاها، قفسه‌ها، سوابق ورود و خروج، کاربران و دفتر ممیزی برای ذخیره ایمن آفلاین.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleDownloadBackup}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود نسخه پشتیبان کامل (JSON)</span>
                </button>
              </div>
            </div>

            {/* Box 3: Restore Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">بازگردانی نسخه پشتیبان (Restore)</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    آپلود فایل پشتیبان JSON قبلی جهت بازیابی کلیه اطلاعات در دیتابیس در صورت تعویض سرور یا بروز نقص.
                  </p>
                </div>
              </div>

              <input
                type="file"
                ref={restoreFileRef}
                onChange={handleRestoreFileSelected}
                accept=".json,application/json"
                className="hidden"
              />

              <div className="pt-2">
                <button
                  disabled={isRestoring}
                  onClick={() => restoreFileRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isRestoring ? 'در حال بازیابی...' : 'انتخاب و بازگردانی فایل پشتیبان'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
