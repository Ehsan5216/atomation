import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  UserCheck,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { RequestItem, RequestTimelineItem } from '../types/index.js';
import { formatPersianDate } from '../utils/persian.js';

export const RequestsView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // New Request Form
  const [targetDate, setTargetDate] = useState('');
  const [shift, setShift] = useState('شیفت A');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action (Approve / Reject) state
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const isForeman = isAdmin || user?.jobTitle?.includes('سرپرست') || user?.jobTitle?.includes('فورمن');
  const isEngineer = isAdmin || user?.jobTitle?.includes('مهندس');

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/requests', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('خطا در دریافت لیست درخواست‌ها.');
      }

      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری اطلاعات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) {
      alert('لطفاً تاریخ مورد نظر را وارد کنید.');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetDate,
          shift,
          reason,
          type: 'SHIFT_CHANGE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ثبت درخواست.');
      }

      setSuccessMessage('درخواست جا‌به‌جایی شیفت با موفقیت ثبت شد و در صف تایید سرپرست شیفت قرار گرفت.');
      setIsCreateModalOpen(false);
      setTargetDate('');
      setReason('');
      fetchRequests();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت درخواست.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: string) => {
    try {
      setIsProcessingAction(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/requests/${requestId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          notes: actionNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در انجام اقدام.');
      }

      setSuccessMessage('اقدام با موفقیت اعمال و در گردش‌کار سامانه ثبت گردید.');
      setActionNotes('');
      setIsDetailModalOpen(false);
      setSelectedRequest(null);
      fetchRequests();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت اقدام.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const openDetails = async (reqItem: RequestItem) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/requests/${reqItem.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(data.request);
      } else {
        setSelectedRequest(reqItem);
      }
    } catch {
      setSelectedRequest(reqItem);
    }
    setActionNotes('');
    setIsDetailModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_FOREMAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            در انتظار تایید سرپرست (فورمن)
          </span>
        );
      case 'PENDING_ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <UserCheck className="w-3.5 h-3.5" />
            تایید فورمن - در انتظار مهندس
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تایید نهایی شده
          </span>
        );
      case 'REJECTED_BY_FOREMAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            رد شده توسط سرپرست
          </span>
        );
      case 'REJECTED_BY_ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            رد شده توسط مهندس شیفت
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Ban className="w-3.5 h-3.5" />
            انصراف کاربر
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesSearch =
      r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.shift.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.targetDate.includes(searchTerm) ||
      (r.reason && r.reason.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">درخواست‌های جا‌به‌جایی شیفت</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                گردش کار رسمی تغییر شیفت پرسنل واحد اعلام حریق با تایید دو مرحله‌ای سرپرست و مهندس
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRequests}
            title="به‌روزرسانی"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            id="btn-new-shift-request"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت درخواست جا‌به‌جایی</span>
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در متقاضی، شیفت، تاریخ یا دلیل..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> وضعیت:
          </span>
          {[
            { id: 'ALL', label: 'همه' },
            { id: 'PENDING_FOREMAN', label: 'در انتظار سرپرست' },
            { id: 'PENDING_ENGINEER', label: 'در انتظار مهندس' },
            { id: 'APPROVED', label: 'تایید شده' },
            { id: 'REJECTED_BY_FOREMAN', label: 'رد سرپرست' },
            { id: 'REJECTED_BY_ENGINEER', label: 'رد مهندس' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">در حال بارگذاری درخواست‌ها...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <CalendarClock className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p>درخواستی با مشخصات فوق یافت نشد.</p>
            <p className="text-[11px] text-slate-500">برای ایجاد اولین درخواست، از دکمه «ثبت درخواست جا‌به‌جایی» استفاده کنید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-4">شناسه</th>
                  <th className="p-4">متقاضی / سمت</th>
                  <th className="p-4">تاریخ هدف</th>
                  <th className="p-4">شیفت کاری</th>
                  <th className="p-4">علت درخواست</th>
                  <th className="p-4">وضعیت گردش‌کار</th>
                  <th className="p-4">تاریخ ثبت</th>
                  <th className="p-4 text-center">اقدامات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredRequests.map((reqItem) => (
                  <tr key={reqItem.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono text-[11px] text-amber-400">
                      #{reqItem.id.substring(0, 8)}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-white">{reqItem.userName}</div>
                      <div className="text-[10px] text-slate-400">
                        {reqItem.userJobTitle} {reqItem.userPersonnelCode ? `(کد: ${reqItem.userPersonnelCode})` : ''}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-200">
                      {reqItem.targetDate}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-semibold text-amber-300">
                        {reqItem.shift}
                      </span>
                    </td>
                    <td className="p-4 max-w-xs truncate text-slate-400" title={reqItem.reason || ''}>
                      {reqItem.reason || '—'}
                    </td>
                    <td className="p-4">{getStatusBadge(reqItem.status)}</td>
                    <td className="p-4 text-slate-400 font-mono text-[11px]">
                      {formatPersianDate(reqItem.createdAt)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => openDetails(reqItem)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>گردش‌کار و اقدام</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-400" />
                <span>ثبت درخواست جدید جا‌به‌جایی شیفت</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">تاریخ مورد نظر برای تغییر شیفت *</label>
                <input
                  type="text"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  placeholder="مثال: ۱۴۰۴/۰۱/۱۵ یا 2026/04/05"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">شیفت کاری مورد نظر *</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                >
                  <option value="شیفت A (صبح)">شیفت A (صبح)</option>
                  <option value="شیفت B (عصر)">شیفت B (عصر)</option>
                  <option value="شیفت C (شب)">شیفت C (شب)</option>
                  <option value="شیفت D (استراحت/تعویض)">شیفت D (استراحت/تعویض)</option>
                  <option value="شیفت عمومی اعلام حریق">شیفت عمومی اعلام حریق</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">علت و توضیحات درخواست</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="توضیح کوتاه درباره علت جا‌به‌جایی یا هماهنگی با همکار جایگزین..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">مراحل گردش کار:</p>
                <p>۱. پس از ثبت، درخواست به سرپرست شیفت (فورمن) ارجاع می‌شود.</p>
                <p>۲. پس از تایید فورمن، مهندس شیفت تایید نهایی را ثبت می‌نماید.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'ثبت و ارسال درخواست'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details & Workflow Timeline Modal */}
      {isDetailModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>جزئیات درخواست جا‌به‌جایی شیفت</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">شناسه: {selectedRequest.id}</p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Request Summary Card */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[11px]">نام متقاضی:</span>
                <p className="font-semibold text-white mt-0.5">{selectedRequest.userName}</p>
                <p className="text-[10px] text-slate-400">{selectedRequest.userJobTitle}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">وضعیت فعلی:</span>
                <div className="mt-0.5">{getStatusBadge(selectedRequest.status)}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">تاریخ هدف:</span>
                <p className="font-semibold text-amber-300 mt-0.5">{selectedRequest.targetDate}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">شیفت درخواستی:</span>
                <p className="font-semibold text-white mt-0.5">{selectedRequest.shift}</p>
              </div>
              {selectedRequest.reason && (
                <div className="col-span-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-[11px]">علت و توضیحات:</span>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">{selectedRequest.reason}</p>
                </div>
              )}
            </div>

            {/* Visual Workflow Timeline */}
            <div>
              <h4 className="font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>تایم‌لاین و تاریخچه مراحل اقدام</span>
              </h4>

              <div className="relative pl-2 pr-4 border-r-2 border-slate-800 space-y-4 mr-2">
                {selectedRequest.timeline && selectedRequest.timeline.length > 0 ? (
                  selectedRequest.timeline.map((item, idx) => (
                    <div key={item.id || idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -right-[23px] top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-amber-400"></span>
                      <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{item.userName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatPersianDate(item.createdAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-400 font-medium">
                          {item.jobTitle} - اقدام: {item.action}
                        </div>
                        {item.notes && (
                          <p className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-lg mt-1 border border-slate-800">
                            یادداشت: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-[11px]">تاریخچه‌ای ثبت نشده است.</p>
                )}
              </div>
            </div>

            {/* Action Section (For Foreman, Engineer, or Applicant) */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              {/* If Pending Foreman and user has foreman or admin role */}
              {selectedRequest.status === 'PENDING_FOREMAN' && isForeman && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-2.5">
                  <div className="font-bold text-amber-300">مرحله تایید سرپرست شیفت (فورمن)</div>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="توضیحات یا ملاحظات سرپرست (اختیاری)..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleRequestAction(selectedRequest.id, 'FOREMAN_REJECT')}
                      disabled={isProcessingAction}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                    >
                      رد درخواست
                    </button>
                    <button
                      onClick={() => handleRequestAction(selectedRequest.id, 'FOREMAN_APPROVE')}
                      disabled={isProcessingAction}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      تایید و ارسال به مهندس
                    </button>
                  </div>
                </div>
              )}

              {/* If Pending Engineer and user has engineer or admin role */}
              {selectedRequest.status === 'PENDING_ENGINEER' && isEngineer && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl space-y-2.5">
                  <div className="font-bold text-blue-300">مرحله تایید نهایی مهندس شیفت</div>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="ملاحظات مهندس شیفت (اختیاری)..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleRequestAction(selectedRequest.id, 'ENGINEER_REJECT')}
                      disabled={isProcessingAction}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                    >
                      رد نهایی
                    </button>
                    <button
                      onClick={() => handleRequestAction(selectedRequest.id, 'ENGINEER_APPROVE')}
                      disabled={isProcessingAction}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      تایید نهایی و ابلاغ شیفت
                    </button>
                  </div>
                </div>
              )}

              {/* User Cancel Option */}
              {(selectedRequest.status === 'PENDING_FOREMAN' || selectedRequest.status === 'PENDING_ENGINEER') &&
                (selectedRequest.userId === user?.id || isAdmin) && (
                  <div className="flex justify-start">
                    <button
                      onClick={() => handleRequestAction(selectedRequest.id, 'CANCEL')}
                      disabled={isProcessingAction}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 text-[11px] font-medium"
                    >
                      انصراف از درخواست
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
