import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Send,
  Inbox,
  Paperclip,
  CheckCheck,
  Check,
  Search,
  Plus,
  RefreshCw,
  File,
  Download,
  AlertCircle,
  ShieldCheck,
  Clock,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { MessageItem, User as UserType } from '../types/index.js';
import { formatPersianDate } from '../utils/persian.js';

export const MessagesView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'all'>('inbox');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Users for recipient selection
  const [usersList, setUsersList] = useState<UserType[]>([]);

  // Modals
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Compose State
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/messages/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch {
      // Non-blocking
    }
  };

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/messages?box=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('خطا در دریافت پیام‌ها.');
      }

      const data = await res.json();
      setMessages(data.messages || []);
      fetchUnreadCount();
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری پیام‌ها.');
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
        // Exclude current user from recipient candidates
        setUsersList((data.users || []).filter((u: UserType) => u.id !== user?.id));
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [activeTab]);

  useEffect(() => {
    fetchUsers();
    fetchUnreadCount();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !subject.trim() || !body.trim()) {
      alert('لطفاً گیرنده، موضوع و متن پیام را تکمیل فرمایید.');
      return;
    }

    try {
      setIsSending(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('recipientId', recipientId);
      formData.append('subject', subject.trim());
      formData.append('body', body.trim());
      if (attachmentFile) {
        formData.append('attachment', attachmentFile);
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ارسال پیام.');
      }

      setSuccessMessage('پیام با موفقیت ارسال شد و در کارتابل گیرنده ثبت گردید.');
      setIsComposeModalOpen(false);
      setRecipientId('');
      setSubject('');
      setBody('');
      setAttachmentFile(null);
      fetchMessages();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'خطا در ارسال پیام.');
    } finally {
      setIsSending(false);
    }
  };

  const openMessage = async (msg: MessageItem) => {
    setSelectedMessage(msg);
    setIsViewModalOpen(true);

    // If current user is recipient and message is unread, mark as read
    if (msg.recipientId === user?.id && !msg.isRead) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`/api/messages/${msg.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, isRead: true, readAt: new Date().toISOString() } : m))
        );
        fetchUnreadCount();
      } catch {
        // Non-blocking
      }
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredMessages = messages.filter((m) => {
    const term = searchTerm.toLowerCase();
    return (
      m.subject.toLowerCase().includes(term) ||
      m.body.toLowerCase().includes(term) ||
      m.senderName.toLowerCase().includes(term) ||
      m.recipientName.toLowerCase().includes(term) ||
      (m.attachmentOriginalName && m.attachmentOriginalName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">کارتابل و مکاتبات اداری اعلام حریق</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  {unreadCount} جدید
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              مکاتبات درون‌سازمانی، دستورالعمل‌ها و ارسال گزارش‌ها با پیوست فایل تا ۱۰۰ مگابایت
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchMessages()}
            title="به‌روزرسانی"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            id="btn-compose-message"
            onClick={() => setIsComposeModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs transition shadow-lg shadow-blue-900/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ارسال پیام جدید</span>
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
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

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>صندوق ورودی (Inbox)</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'sent'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>ارسال شده‌ها (Sent)</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>تمام پیام‌ها (نظارت ادمین)</span>
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در موضوع، متن، فرستنده یا پیوست..."
            className="w-full pl-4 pr-10 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">در حال بارگذاری پیام‌ها...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <Mail className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p>هیچ پیامی در این پوشه یافت نشد.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredMessages.map((msg) => {
              const isUnread = activeTab === 'inbox' && !msg.isRead;
              return (
                <div
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`p-4 flex items-center justify-between gap-4 hover:bg-slate-800/60 transition cursor-pointer ${
                    isUnread ? 'bg-blue-500/5 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Read / Unread Indicator */}
                    <div className="shrink-0">
                      {activeTab === 'sent' ? (
                        msg.isRead ? (
                          <span title="توسط گیرنده خوانده شده است">
                            <CheckCheck className="w-4 h-4 text-blue-400" />
                          </span>
                        ) : (
                          <span title="ارسال شده، هنوز خوانده نشده">
                            <Check className="w-4 h-4 text-slate-500" />
                          </span>
                        )
                      ) : isUnread ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-transparent border border-slate-600 block"></span>
                      )}
                    </div>

                    {/* Sender / Recipient */}
                    <div className="w-36 sm:w-48 truncate shrink-0">
                      <p className="text-xs text-white truncate">
                        {activeTab === 'sent' ? `به: ${msg.recipientName}` : msg.senderName}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {activeTab === 'sent' ? msg.recipientJobTitle : msg.senderJobTitle}
                      </p>
                    </div>

                    {/* Subject & snippet */}
                    <div className="min-w-0 flex-1 truncate">
                      <span className={`text-xs ${isUnread ? 'text-white font-bold' : 'text-slate-200'}`}>
                        {msg.subject}
                      </span>
                      <span className="text-slate-400 text-xs mr-2 truncate hidden md:inline">
                        — {msg.body.substring(0, 70)}...
                      </span>
                    </div>

                    {/* Attachment Icon */}
                    {msg.attachmentFilename && (
                      <div
                        className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 shrink-0"
                        title={msg.attachmentOriginalName || 'فایل پیوست'}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span className="hidden sm:inline">{formatFileSize(msg.attachmentSize)}</span>
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-[11px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
                    {formatPersianDate(msg.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose Message Modal */}
      {isComposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-100 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                <span>ارسال پیام جدید و مکاتبه اداری</span>
              </h3>
              <button
                onClick={() => setIsComposeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4">
              {/* Recipient */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">گیرنده پیام *</label>
                <select
                  required
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">-- انتخاب پرسنل گیرنده --</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} — {u.jobTitle} {u.personnelCode ? `(کد: ${u.personnelCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">موضوع پیام *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="موضوع نامه یا پیام اداری..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">متن پیام *</label>
                <textarea
                  required
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="متن کامل پیام اداری یا دستورالعمل..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Attachment (up to 100MB) */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                    پیوست سند یا فایل (تا سقف ۱۰۰ مگابایت)
                  </span>
                  <span className="text-[10px] text-slate-400">PDF، اسناد آفیس، تصاویر، اکسل، ZIP</span>
                </label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-950/60"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        if (file.size > 100 * 1024 * 1024) {
                          alert('حجم فایل نمی‌تواند بیشتر از ۱۰۰ مگابایت باشد.');
                          return;
                        }
                        setAttachmentFile(file);
                      }
                    }}
                  />
                  {attachmentFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                      <File className="w-5 h-5" />
                      <span className="font-semibold">{attachmentFile.name}</span>
                      <span className="text-slate-400">({formatFileSize(attachmentFile.size)})</span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setAttachmentFile(null);
                        }}
                        className="text-rose-400 hover:text-rose-300 ml-2"
                      >
                        حذف
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-400 space-y-1">
                      <Paperclip className="w-6 h-6 mx-auto text-slate-500" />
                      <p className="text-xs">کلیک کنید یا فایل را به اینجا بکشید</p>
                      <p className="text-[10px] text-slate-500">حداکثر حجم مجاز: ۱۰۰ مگابایت</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  قانون حراستی سامانه: پیام‌ها و مکاتبات پس از ارسال، قابل ویرایش یا دستکاری نمی‌باشند و سوابق آن‌ها به عنوان سند اداری در پایگاه‌داده نگهداری می‌شود.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsComposeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  {isSending ? 'در حال ارسال...' : 'ارسال پیام'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Message Modal */}
      {isViewModalOpen && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-100 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>{selectedMessage.subject}</span>
              </h3>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Sender & Recipient Details */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">فرستنده:</span>
                <span className="text-white font-semibold">
                  {selectedMessage.senderName} ({selectedMessage.senderJobTitle || 'پرسنل'})
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">گیرنده:</span>
                <span className="text-white font-semibold">
                  {selectedMessage.recipientName} ({selectedMessage.recipientJobTitle || 'پرسنل'})
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">تاریخ ارسال:</span>
                <span className="text-slate-300 font-mono">
                  {formatPersianDate(selectedMessage.createdAt)}
                </span>
              </div>
              {selectedMessage.readAt && (
                <div className="flex justify-between items-center text-[11px] text-blue-400">
                  <span>زمان مشاهده گیرنده:</span>
                  <span className="font-mono">{formatPersianDate(selectedMessage.readAt)}</span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 leading-relaxed whitespace-pre-wrap min-h-28">
              {selectedMessage.body}
            </div>

            {/* Attachment */}
            {selectedMessage.attachmentUrl && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <File className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="font-semibold text-white">
                      {selectedMessage.attachmentOriginalName || 'فایل پیوست'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      حجم: {formatFileSize(selectedMessage.attachmentSize)}
                    </p>
                  </div>
                </div>

                <a
                  href={selectedMessage.attachmentUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود پیوست</span>
                </a>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-[11px] text-slate-500">
              <span>سامانه مکاتبات امن واحد اعلام حریق ذوب‌آهن</span>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
