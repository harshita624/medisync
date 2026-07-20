"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import toast from "react-hot-toast";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

const TYPE_COLORS = {
  appointment_scheduled: "bg-blue-100 text-blue-600",
  appointment_cancelled: "bg-red-100 text-red-600",
  record_added:          "bg-emerald-100 text-emerald-600",
  emergency_sos:         "bg-red-100 text-red-600",
  general:               "bg-slate-100 text-slate-500",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [marking,       setMarking]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getNotifications({ limit: 100 });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch { setNotifications([]); setUnreadCount(0); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function readOne(n) {
    if (n.isRead) return;
    await markNotificationRead(n._id).catch(() => {});
    setNotifications(p => p.map(x => x._id === n._id ? { ...x, isRead: true } : x));
    setUnreadCount(c => Math.max(0, c - 1));
  }

  async function readAll() {
    setMarking(true);
    try {
      await markAllNotificationsRead();
      setNotifications(p => p.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } finally { setMarking(false); }
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">{unreadCount} unread</p>
        </div>
        <button onClick={readAll} disabled={marking || unreadCount === 0}
          className="px-5 py-2.5 rounded-2xl text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-teal-400/25 transition-all"
          style={{ background: "var(--grad-primary)" }}>
          {marking ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />} Mark All Read
        </button>
      </div>

      {loading ? (
        <div className="med-card rounded-3xl p-10 text-center text-slate-400">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="med-card rounded-3xl p-16 text-center">
          <Bell size={44} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <a key={n._id} href={n.link || "#"} onClick={() => readOne(n)}
              className={`block med-card rounded-2xl p-5 transition-all hover:shadow-md ${!n.isRead ? "border-teal-200 bg-teal-50/20" : ""}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${TYPE_COLORS[n.type] || TYPE_COLORS.general}`}>
                  <Bell size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`font-bold text-sm ${n.isRead ? "text-slate-600" : "text-slate-900"}`}>{n.title}</p>
                    <span className="text-xs text-slate-400 shrink-0">{new Date(n.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                  <span className="inline-block text-xs text-slate-400 mt-2 capitalize">{n.type?.replace(/_/g," ")}</span>
                </div>
                {!n.isRead && <span className="w-2.5 h-2.5 bg-teal-500 rounded-full shrink-0 mt-1" />}
              </div>
            </a>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}