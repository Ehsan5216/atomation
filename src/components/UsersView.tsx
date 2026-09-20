import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Shield, UserCheck, AlertCircle, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { User, Role } from '../types/index.js';
import { formatShamsiDate, getRoleBadge } from '../utils/persian.js';

export const UsersView: React.FC = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit / Create Modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('WAREHOUSE_USER');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'خطا در دریافت لیست کاربران.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setPassword('');
    setRole('WAREHOUSE_USER');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.fullName);
    setPassword('');
    setRole(user.role);
    setIsActive(user.isActive);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          fullName,
          role,
          isActive,
          password: password ? password : undefined,
        });
        setSuccessMessage(`مشخصات کاربر «${fullName}» با موفقیت به‌روزرسانی شد.`);
      } else {
        if (!password || password.length < 6) {
          throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
        }
        await api.createUser({
          username,
          fullName,
          password,
          role,
        });
        setSuccessMessage(`کاربر جدید «${fullName}» با موفقیت ایجاد شد.`);
      }
      setShowModal(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در ذخیره اطلاعات کاربر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateDelete = (user: User) => {
    setError(null);
    setSuccessMessage(null);
    if (user.id === currentUser?.id) {
      setError('امکان حذف حساب کاربری خودتان وجود ندارد.');
      return;
    }
    setDeleteConfirmUser(user);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmUser) return;
    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.deleteUser(deleteConfirmUser.id);
      setSuccessMessage(res.message || 'کاربر با موفقیت حذف شد.');
      setDeleteConfirmUser(null);
      await loadUsers();
    } catch (err: any) {
      const reason = err.message ? ` (${err.message})` : '';
      setError(`حذف کاربر انجام نشد.${reason}`);
      setDeleteConfirmUser(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-white">عدم دسترسی به بخش مدیریت کاربران</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          فقط کاربران با نقش مدیر سیستم (ADMIN) مجاز به مشاهده، تعریف، ویرایش و حذف کاربران هستند.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span>مدیریت کاربران و سطح دسترسی‌ها</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تعریف، ویرایش و حذف کاربران (مدیر سیستم ADMIN / انباردار WAREHOUSE_USER)
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>تعریف کاربر جدید</span>
        </button>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-800/70 text-slate-400 text-[11px] font-bold">
              <tr>
                <th className="p-3">نام و نام خانوادگی</th>
                <th className="p-3">نام کاربری</th>
                <th className="p-3">نقش و سطح دسترسی</th>
                <th className="p-3">وضعیت حساب</th>
                <th className="p-3">آخرین ورود</th>
                <th className="p-3">تاریخ ایجاد</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    در حال بارگذاری لیست کاربران...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    هیچ کاربری در سیستم یافت نشد.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleBadge = getRoleBadge(u.role);
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] text-amber-400 font-bold">
                          {u.fullName.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5">
                            {u.fullName}
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                شما
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{u.username}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadge.color}`}>
                          {roleBadge.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            u.isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {u.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {formatShamsiDate(u.lastLogin)}
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {formatShamsiDate(u.createdAt)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            title="ویرایش مشخصات"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleInitiateDelete(u)}
                            disabled={isSelf}
                            title={isSelf ? 'امکان حذف حساب کاربری خودتان وجود ندارد' : 'حذف کاربر'}
                            className={`p-1.5 rounded-lg transition ${
                              isSelf
                                ? 'text-slate-600 cursor-not-allowed opacity-40'
                                : 'text-rose-400 hover:text-rose-200 hover:bg-rose-500/20'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog: Delete User */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative text-xs">
            <button
              onClick={() => !isDeleting && setDeleteConfirmUser(null)}
              disabled={isDeleting}
              className="absolute top-4 left-4 text-slate-400 hover:text-white transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">تأیید حذف کاربر</h3>
                <p className="text-[11px] text-slate-400">این عملیات غیرقابل بازگشت است</p>
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-200 mb-4 leading-relaxed">
              آیا از حذف این کاربر مطمئن هستید؟
            </p>

            {/* User Details Preview */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">نام و نام خانوادگی:</span>
                <span className="font-bold text-slate-100">{deleteConfirmUser.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">نام کاربری:</span>
                <span className="font-mono font-bold text-amber-400">{deleteConfirmUser.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">نقش کاربری:</span>
                <span className="font-bold text-slate-200">
                  {deleteConfirmUser.role === 'ADMIN' ? 'مدیر سیستم (ADMIN)' : 'کاربر انبار (WAREHOUSE_USER)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">وضعیت:</span>
                <span className={deleteConfirmUser.isActive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {deleteConfirmUser.isActive ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
            </div>

            {deleteConfirmUser.role === 'ADMIN' && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  توجه: این کاربر دارای نقش مدیر سیستم (ADMIN) است. طبق قوانین امنیتی، سیستم اجازه حذف آخرین مدیر فعال را نخواهد داد.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition font-semibold disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-rose-900/30 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'در حال حذف...' : 'بله، کاربر حذف شود'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit User */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative text-xs">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-white mb-4">
              {editingUser ? 'ویرایش کاربر' : 'تعریف کاربر جدید'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام و نام خانوادگی <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: دکتر احسان ابوالقاسمی"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام کاربری (انگلیسی) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  placeholder="admin"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {editingUser ? 'کلمه عبور جدید (در صورت عدم تغییر خالی بگذارید)' : 'کلمه عبور *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">نقش کاربری</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="WAREHOUSE_USER">کاربر انبار (WAREHOUSE_USER) - ثبت ورود/خروج/گزارش</option>
                  <option value="ADMIN">مدیر ارشد (ADMIN) - دسترسی کامل + مدیریت کاربران و پشتیبان</option>
                </select>
              </div>

              {editingUser && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700"
                  />
                  <label htmlFor="is-active" className="text-slate-300 font-medium">
                    حساب کاربری فعال باشد
                  </label>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'ذخیره کاربر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

