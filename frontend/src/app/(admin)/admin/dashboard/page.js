"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getAdminDashboard, getAuditLogs } from "@/lib/api";
import { Calendar, ClipboardList, Shield, Stethoscope, Users, Activity, Bot, AlertTriangle } from "lucide-react";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAdminDashboard().catch(() => ({ data: { stats: {} } })),
      getAuditLogs({ limit: 8 }).catch(() => ({ data: { logs: [] } })),
    ]).then(([s, a]) => {
      setStats(s.data.stats || {});
      setLogs(a.data.logs || []);
    }).finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Users", value: stats?.users, icon: Users, color: "bg-slate-900 text-white" },
    { label: "Patients", value: stats?.patients, icon: Users, color: "bg-violet-50 text-violet-700" },
    { label: "Doctors", value: stats?.doctors, icon: Stethoscope, color: "bg-green-50 text-green-700" },
    { label: "Policies", value: stats?.policies, icon: Shield, color: "bg-blue-50 text-blue-700" },
    { label: "Open Claims", value: stats?.openClaims, icon: ClipboardList, color: "bg-amber-50 text-amber-700" },
    { label: "Upcoming Appointments", value: stats?.upcomingAppointments, icon: Calendar, color: "bg-cyan-50 text-cyan-700" },
    { label: "Pending Doctors", value: stats?.pendingDoctors, icon: Stethoscope, color: "bg-red-50 text-red-700" },
    { label: "Pending Insurance", value: stats?.pendingInsurance, icon: Shield, color: "bg-purple-50 text-purple-700" },
    { label: "AI Conversations", value: stats?.aiChatMessages, icon: Bot, color: "bg-indigo-50 text-indigo-700" },
    { label: "Abnormal Vitals", value: stats?.abnormalVitalsPatients, icon: AlertTriangle, color: "bg-rose-50 text-rose-700" },
    { label: "Clinical AI Records", value: stats?.recordsWithClinicalInsights, icon: Activity, color: "bg-emerald-50 text-emerald-700" },
    { label: "Disabled Users", value: stats?.disabledUsers, icon: Shield, color: "bg-slate-100 text-slate-700" },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Command Center</h1>
        <p className="text-slate-500 text-sm mt-1">Operational overview across users, care delivery, claims, and verification.</p>
      </div>
      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}</div>
      ) : (
        <div className="grid md:grid-cols-4 gap-4">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}><Icon size={20} /></div>
              <p className="text-2xl font-bold text-slate-900">{value ?? 0}</p>
              <p className="text-sm text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Activity size={17} /> Recent Audit Events</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">No audit activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log._id} className="flex items-start justify-between gap-4 border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="text-sm font-bold text-slate-800">{log.action}</p>
                  <p className="text-xs text-slate-500">{log.actor?.name || "System"} | {log.actorRole} | {log.targetType}</p>
                </div>
                <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
