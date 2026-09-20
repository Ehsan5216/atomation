import React, { useState } from 'react';
import { Settings, Shield, KeyRound, CheckCircle2, AlertCircle, Server, Info, Globe, HardDrive, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { formatShamsiDate } from '../utils/persian.js';

export const SettingsView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Backend API URL configuration (for GitHub Pages connected to external backend)
  const [apiUrl, setApiUrl] = useState(api.getApiBaseUrl());
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false);
  const isLocalMode = api.isUsingLocalMode();

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    api.setApiBaseUrl(apiUrl);
    setApiSaveSuccess(true);
    setTimeout(() => setApiSaveSuccess(false), 3000);
    refreshUser();
  };

  const handleResetLocalDb = () => {
    if (window.confirm('آیا از بازنشانی داده‌های محلی مرورگر به نمونه اولیه مطمئن هستید؟')) {
      localStorage.removeItem('wms_client_database');
      localStorage.removeItem('wms_client_passwords');
      window.location.reload();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('تکرار رمز عبور جدید مطابقت ندارد.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (user) {
        await api.updateUser(user.id, { password: newPassword });
        setSuccess('کلمه عبور با موفقیت به‌روزرسانی شد.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'خطا در تغییر کلمه عبور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-400" />
          <span>تنظیمات حساب کاربری و اطلاعات سامانه</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          مدیریت امنیت کلمه عبور و مشاهده مشخصات پیکربندی سامانه انبارداری اعلام حریق
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change Password Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>تغییر کلمه عبور کاربری</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                کلمه عبور جدید <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                تکرار کلمه عبور جدید <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار کلمه عبور جدید"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-2"
            >
              {isLoading ? 'در حال ثبت تغییر...' : 'ذخیره کلمه عبور جدید'}
            </button>
          </form>
        </div>

        {/* Deployment & Environment Mode Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>پیکربندی بستر استقرار (Railway Full-Stack)</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full font-medium ${isLocalMode ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
              {isLocalMode ? 'حالت آفلاین (مرورگر)' : 'متصل به سرور متمرکز Railway'}
            </span>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-2">
            <div className="flex items-start gap-2 text-slate-300">
              <HardDrive className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-200">وضعیت ذخیره‌سازی داده‌ها:</p>
                <p className="text-slate-400 leading-relaxed">
                  {isLocalMode
                    ? 'سامانه در حالت آفلاین مرورگر فعال است.'
                    : 'سامانه در معماری یکپارچه Full-Stack روی سرور ابری Railway فعال است. کلیه درخواست‌های فرانت‌اند، ثبت کالاها، انبارها، کاربران و تراکنش‌ها به صورت لحظه‌ای با پایگاه‌داده PostgreSQL همگام شده و روی تمامی دستگاه‌ها (رایانه، موبایل، تبلت) مشترک است.'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveApiUrl} className="space-y-3 pt-1">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                آدرس اختصاصی سرور API (اختیاری):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="پیش‌فرض: همان دامنه سرویس Railway (یکپارچه)"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  dir="ltr"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-xl transition-colors"
                >
                  ذخیره
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                در حالت استاندارد Railway، فرانت‌اند و بک‌اند از یک دامنه واحد سرویس‌دهی می‌شوند و نیازی به وارد کردن آدرس نیست. تنها در صورتی که مایلید به یک سرور مجزا یا محیط آزمایشی متصل شوید این فیلد را تکمیل کنید.
              </p>
            </div>
            {apiSaveSuccess && (
              <div className="text-emerald-400 text-xs flex items-center gap-1.5 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>تنظیمات سرور با موفقیت ثبت گردید.</span>
              </div>
            )}
          </form>

          {isLocalMode && (
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">بازنشانی داده‌های نمونه:</span>
              <button
                type="button"
                onClick={handleResetLocalDb}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بازنشانی به دیتابیس پیش‌فرض</span>
              </button>
            </div>
          )}
        </div>

        {/* System Information Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
            <Server className="w-4 h-4 text-sky-400" />
            <span>مشخصات فنی و معماری نرم‌افزار</span>
          </div>

          <div className="space-y-2.5 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">نام نرم‌افزار:</span>
              <span className="font-bold text-slate-100">
                نرم‌افزار انبارداری واحد اعلام حریق ذوب‌آهن اصفهان
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">نام طراح و توسعه‌دهنده:</span>
              <span className="font-bold text-amber-400">دکتر احسان ابوالقاسمی</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">کاربر جاری:</span>
              <span className="font-mono text-slate-200">{user?.fullName} ({user?.username})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">سطح دسترسی:</span>
              <span className="font-bold text-slate-200">{user?.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">معماری همزمانی:</span>
              <span className="font-semibold text-emerald-400">AsyncMutex (Serial Atomic DB)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">موتور گزارش‌گیری:</span>
              <span className="font-mono text-slate-300">ExcelJS (True RTL xlsx)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">نوع کلاینت:</span>
              <span className="font-semibold text-sky-400">PWA (Progressive Web App)</span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              نکته معماری: کلیه تراکنش‌ها به صورت Server-Authoritative اجرا می‌شوند تا از بروز موجودی منفی یا تداخل همزمان کاربران انبار جلوگیری شود.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
