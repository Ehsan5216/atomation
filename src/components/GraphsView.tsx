import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Search,
  Users,
  Flame,
  Radio,
  Zap,
  Bell,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { GraphItem, User } from '../types/index.js';
import { formatPersianDate } from '../utils/persian.js';

export const GraphsView: React.FC = () => {
  const [graphs, setGraphs] = useState<GraphItem[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [graphDate, setGraphDate] = useState('');
  const [shift, setShift] = useState('شیفت ۱ (صبح)');
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [manualPersonnelInput, setManualPersonnelInput] = useState('');

  // Device Counts
  const [smokeDetector, setSmokeDetector] = useState<number>(0);
  const [heatDetector, setHeatDetector] = useState<number>(0);
  const [manualCallPoint, setManualCallPoint] = useState<number>(0);
  const [powerSupply, setPowerSupply] = useState<number>(0);
  const [controlPanel, setControlPanel] = useState<number>(0);
  const [modules, setModules] = useState<number>(0);
  const [sounder, setSounder] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const fetchGraphs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/graphs', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('خطا در دریافت لیست گراف‌ها.');
      }

      const data = await res.json();
      setGraphs(data.graphs || []);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری اطلاعات.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {
      // Non-blocking if regular user
    }
  };

  useEffect(() => {
    fetchGraphs();
    fetchUsers();
  }, []);

  const handleCreateGraph = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!graphDate) {
      alert('لطفاً تاریخ مانور/گراف را وارد کنید.');
      return;
    }

    let finalParticipants = [...selectedPersonnel];
    if (manualPersonnelInput.trim()) {
      const extraNames = manualPersonnelInput
        .split(/[,،\n]/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      finalParticipants = Array.from(new Set([...finalParticipants, ...extraNames]));
    }

    if (finalParticipants.length === 0) {
      alert('لطفاً حداقل یک نفر پرسنل شرکت‌کننده در مانور یا گراف را مشخص نمایید.');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/graphs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          graphDate,
          shift,
          participantNames: finalParticipants,
          smokeDetector,
          heatDetector,
          manualCallPoint,
          powerSupply,
          controlPanel,
          modules,
          sounder,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ثبت گراف.');
      }

      setSuccessMessage('اطلاعات مانور/گراف اعلام حریق با موفقیت در سیستم مرکزی ثبت گردید.');
      setIsCreateModalOpen(false);
      // Reset form
      setGraphDate('');
      setSelectedPersonnel([]);
      setManualPersonnelInput('');
      setSmokeDetector(0);
      setHeatDetector(0);
      setManualCallPoint(0);
      setPowerSupply(0);
      setControlPanel(0);
      setModules(0);
      setSounder(0);
      setNotes('');
      fetchGraphs();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت اطلاعات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/graphs/export', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('خطا در دریافت فایل اکسل.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zobahan_graphs_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'خطا در خروجی اکسل.');
    } finally {
      setIsExporting(false);
    }
  };

  const togglePersonnelSelection = (name: string) => {
    if (selectedPersonnel.includes(name)) {
      setSelectedPersonnel(selectedPersonnel.filter((n) => n !== name));
    } else {
      setSelectedPersonnel([...selectedPersonnel, name]);
    }
  };

  // Metrics
  const totalManeuvers = graphs.length;
  const totalSmoke = graphs.reduce((acc, g) => acc + (Number(g.smokeDetector) || 0), 0);
  const totalHeat = graphs.reduce((acc, g) => acc + (Number(g.heatDetector) || 0), 0);
  const totalMCP = graphs.reduce((acc, g) => acc + (Number(g.manualCallPoint) || 0), 0);
  const totalPanels = graphs.reduce((acc, g) => acc + (Number(g.controlPanel) || 0), 0);
  const totalDevicesTested =
    totalSmoke +
    totalHeat +
    totalMCP +
    graphs.reduce(
      (acc, g) =>
        acc +
        (Number(g.powerSupply) || 0) +
        (Number(g.modules) || 0) +
        (Number(g.sounder) || 0),
      0
    ) +
    totalPanels;

  const filteredGraphs = graphs.filter((g) => {
    const matchesShift = shiftFilter === 'ALL' || g.shift === shiftFilter;
    const matchesSearch =
      g.graphDate.includes(searchTerm) ||
      g.shift.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.registeredByName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.participantNames.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (g.notes && g.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesShift && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">ثبت گراف و مانور اعلام حریق</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              مدیریت دوره‌ای تست، مانور و ثبت تعداد تجهیزات اعلام حریق ذوب‌آهن با خروجی رسمی اکسل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchGraphs}
            title="به‌روزرسانی"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
          <button
            id="btn-export-graphs-excel"
            onClick={handleExportExcel}
            disabled={isExporting || graphs.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isExporting ? 'در حال صدور...' : 'خروجی اکسل (.xlsx)'}</span>
          </button>
          <button
            id="btn-new-graph"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت گراف جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">تعداد کل مانورها</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-mono">{totalManeuvers}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">مجموع ادوات تست‌شده</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{totalDevicesTested}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">دتکتورهای دودی / حرارتی</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-orange-400 mt-2 font-mono">
            {totalSmoke + totalHeat}{' '}
            <span className="text-xs font-normal text-slate-400">({totalSmoke} دودی / {totalHeat} حرارتی)</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">شستی و پنل مرکزی</span>
            <Radio className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-2 font-mono">
            {totalMCP + totalPanels}{' '}
            <span className="text-xs font-normal text-slate-400">({totalMCP} شستی / {totalPanels} پنل)</span>
          </p>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Search & Shift Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در تاریخ، شیفت، پرسنل شرکت‌کننده یا توضیحات..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-orange-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-orange-500"
          >
            <option value="ALL">تمام شیفت‌ها</option>
            <option value="شیفت ۱ (صبح)">شیفت ۱ (صبح)</option>
            <option value="شیفت ۲ (عصر)">شیفت ۲ (عصر)</option>
            <option value="شیفت ۳ (شب)">شیفت ۳ (شب)</option>
            <option value="شیفت عمومی">شیفت عمومی</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">در حال بارگذاری اطلاعات گراف‌ها...</div>
        ) : filteredGraphs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <Activity className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p>اطلاعات گرافی با این فیلترها ثبت نشده است.</p>
            <p className="text-[11px] text-slate-500">برای ثبت اولین گراف مانور، روی «ثبت گراف جدید» کلیک کنید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-4">تاریخ مانور</th>
                  <th className="p-4">شیفت</th>
                  <th className="p-4">پرسنل شرکت‌کننده</th>
                  <th className="p-4 text-center">دتکتور دودی</th>
                  <th className="p-4 text-center">دتکتور حرارتی</th>
                  <th className="p-4 text-center">شستی</th>
                  <th className="p-4 text-center">منبع تغذیه</th>
                  <th className="p-4 text-center">پنل مرکزی</th>
                  <th className="p-4 text-center">ماژول</th>
                  <th className="p-4 text-center">آژیر</th>
                  <th className="p-4 text-center font-bold text-white">مجموع</th>
                  <th className="p-4">ثبت‌کننده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredGraphs.map((g) => {
                  const total =
                    (g.smokeDetector || 0) +
                    (g.heatDetector || 0) +
                    (g.manualCallPoint || 0) +
                    (g.powerSupply || 0) +
                    (g.controlPanel || 0) +
                    (g.modules || 0) +
                    (g.sounder || 0);

                  return (
                    <tr key={g.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-semibold text-white">{g.graphDate}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-orange-300 font-medium">
                          {g.shift}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {g.participantNames.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center font-mono">{g.smokeDetector}</td>
                      <td className="p-4 text-center font-mono">{g.heatDetector}</td>
                      <td className="p-4 text-center font-mono">{g.manualCallPoint}</td>
                      <td className="p-4 text-center font-mono">{g.powerSupply}</td>
                      <td className="p-4 text-center font-mono">{g.controlPanel}</td>
                      <td className="p-4 text-center font-mono">{g.modules}</td>
                      <td className="p-4 text-center font-mono">{g.sounder}</td>
                      <td className="p-4 text-center font-mono font-bold text-emerald-400 bg-emerald-500/5">
                        {total}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">{g.registeredByName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Graph Registration Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                <span>ثبت مانور / گراف اعلام حریق جدید</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGraph} className="space-y-4">
              {/* Date & Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">تاریخ انجام مانور یا گراف *</label>
                  <input
                    type="text"
                    required
                    value={graphDate}
                    onChange={(e) => setGraphDate(e.target.value)}
                    placeholder="مثال: ۱۴۰۴/۰۱/۱۵"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">شیفت کاری *</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-orange-500"
                  >
                    <option value="شیفت ۱ (صبح)">شیفت ۱ (صبح)</option>
                    <option value="شیفت ۲ (عصر)">شیفت ۲ (عصر)</option>
                    <option value="شیفت ۳ (شب)">شیفت ۳ (شب)</option>
                    <option value="شیفت عمومی">شیفت عمومی</option>
                  </select>
                </div>
              </div>

              {/* Participating Personnel Multi-Select */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center justify-between">
                  <span>پرسنل شرکت‌کننده در مانور / گراف *</span>
                  <span className="text-[10px] text-slate-400">
                    {selectedPersonnel.length} نفر انتخاب شده
                  </span>
                </label>

                {usersList.length > 0 && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-32 overflow-y-auto space-y-1.5 mb-2">
                    {usersList.map((u) => {
                      const isSelected = selectedPersonnel.includes(u.fullName);
                      return (
                        <label
                          key={u.id}
                          onClick={() => togglePersonnelSelection(u.fullName)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition text-xs ${
                            isSelected
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                              : 'hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 text-orange-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="font-semibold">{u.fullName}</span>
                          <span className="text-[10px] text-slate-400">({u.jobTitle})</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={manualPersonnelInput}
                  onChange={(e) => setManualPersonnelInput(e.target.value)}
                  placeholder="افزودن نام سایر همکاران حاضر (با کاما یا ویرگول جدا کنید)..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-orange-500"
                />
              </div>

              {/* Devices Tested Grid */}
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  تعداد تجهیزات و ادوات بررسی و تست‌شده:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">دتکتور دودی</label>
                    <input
                      type="number"
                      min={0}
                      value={smokeDetector}
                      onChange={(e) => setSmokeDetector(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">دتکتور حرارتی</label>
                    <input
                      type="number"
                      min={0}
                      value={heatDetector}
                      onChange={(e) => setHeatDetector(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">شستی اعلام حریق</label>
                    <input
                      type="number"
                      min={0}
                      value={manualCallPoint}
                      onChange={(e) => setManualCallPoint(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">منبع تغذیه (Power)</label>
                    <input
                      type="number"
                      min={0}
                      value={powerSupply}
                      onChange={(e) => setPowerSupply(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">پنل مرکزی</label>
                    <input
                      type="number"
                      min={0}
                      value={controlPanel}
                      onChange={(e) => setControlPanel(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">ماژول‌ها (I/O)</label>
                    <input
                      type="number"
                      min={0}
                      value={modules}
                      onChange={(e) => setModules(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">آژیر / فلاشر</label>
                    <input
                      type="number"
                      min={0}
                      value={sounder}
                      onChange={(e) => setSounder(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">مجموع تجهیزات</label>
                    <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-emerald-400 font-mono font-bold">
                      {smokeDetector +
                        heatDetector +
                        manualCallPoint +
                        powerSupply +
                        controlPanel +
                        modules +
                        sounder}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">توضیحات و گزارش فنی مانور</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="محل مانور، وضعیت تست‌ها، نواقص شناسایی شده و یادداشت‌های مهم..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-orange-500"
                />
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
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی گراف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
