import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Warehouse as WarehouseIcon,
  Layers,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  FileSpreadsheet,
  Users,
  ShieldAlert,
  Database,
  Settings,
  X,
  CalendarClock,
  Activity,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export type NavView =
  | 'dashboard'
  | 'requests'
  | 'graphs'
  | 'messages'
  | 'warehouses'
  | 'items'
  | 'inventory'
  | 'stock-in'
  | 'stock-out'
  | 'transfer'
  | 'reports'
  | 'users'
  | 'audit'
  | 'backup'
  | 'settings';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpen,
  onClose,
}) => {
  const { isAdmin } = useAuth();
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  useEffect(() => {
    const checkUnread = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/messages/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadMessagesCount(data.count || 0);
        }
      } catch {
        // Non-blocking
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const automationItems: { id: NavView; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'داشبورد جامع', icon: LayoutDashboard },
    { id: 'requests', label: 'درخواست‌های شیفت', icon: CalendarClock },
    { id: 'graphs', label: 'ثبت مانور و گراف', icon: Activity },
    { id: 'messages', label: 'کارتابل و مکاتبات', icon: Mail, badge: unreadMessagesCount },
  ];

  const warehouseItems: { id: NavView; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'items', label: 'کاتالوگ و کالاها', icon: Package },
    { id: 'inventory', label: 'موجودی مکان‌محور', icon: Layers },
    { id: 'stock-in', label: 'ورود کالا (رسید)', icon: ArrowDownToLine },
    { id: 'stock-out', label: 'خروج کالا (حواله)', icon: ArrowUpFromLine },
    { id: 'transfer', label: 'انتقال انبار / قفسه', icon: ArrowLeftRight },
    { id: 'warehouses', label: 'انبارها و قفسه‌ها', icon: WarehouseIcon },
    { id: 'reports', label: 'گزارش‌ها و خروجی اکسل', icon: FileSpreadsheet },
  ];

  const adminItems: { id: NavView; label: string; icon: React.FC<{ className?: string }>; adminOnly?: boolean }[] = [
    { id: 'users', label: 'مدیریت کاربران و پرسنل', icon: Users, adminOnly: true },
    { id: 'audit', label: 'ممیزی و وقایع سیستم', icon: ShieldAlert, adminOnly: true },
    { id: 'backup', label: 'پشتیبان‌گیری و بازیابی', icon: Database, adminOnly: true },
    { id: 'settings', label: 'تنظیمات و مشخصات سرور', icon: Settings },
  ];

  const handleItemClick = (id: NavView) => {
    onSelectView(id);
    onClose();
  };

  const renderNavGroup = (
    title: string,
    items: { id: NavView; label: string; icon: React.FC<{ className?: string }>; badge?: number; adminOnly?: boolean }[]
  ) => {
    const visibleItems = items.filter((item) => !item.adminOnly || isAdmin);
    if (visibleItems.length === 0) return null;

    return (
      <div className="space-y-1 pt-2">
        <div className="px-3 py-1 text-[11px] font-bold text-slate-400 tracking-wider">
          {title}
        </div>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition text-right cursor-pointer ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-amber-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {Boolean(item.badge && item.badge > 0) && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 right-0 z-50 h-screen w-64 bg-slate-900 border-l border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
          <span className="font-bold text-sm text-slate-200">منوی اتوماسیون اعلام حریق</span>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {renderNavGroup('عملیات و اتوماسیون اعلام حریق', automationItems)}
          {renderNavGroup('مدیریت انبارداری و کالا', warehouseItems)}
          {renderNavGroup('مدیریت، ممیزی و امنیت', adminItems)}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-center space-y-1">
          <div className="text-[11px] text-amber-400 font-bold tracking-wide">
            طراح : دکتر احسان ابوالقاسمی
          </div>
          <div className="text-[11px] font-semibold text-slate-300">
            واحد اعلام حریق ذوب‌آهن اصفهان
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            نسخه استاندارد اتوماسیون ۳.۰.۰
          </div>
        </div>
      </aside>
    </>
  );
};
