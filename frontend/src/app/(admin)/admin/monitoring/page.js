"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getAdminMonitoring } from "@/lib/api";
import { AlertTriangle, Bot, CalendarClock, ClipboardList, Shield } from "lucide-react";

function MetricGroup({ title, icon: Icon, rows, empty }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Icon size={17} /> {title}
      </h2>
      {rows?.length ? (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row._id || row.label} className="flex items-center justify-between gap-3 border-b border-slate-50 last:border-0 pb-3 last:pb-0">
              <span className="text-sm text-slate-600">{String(row._id || row.label).replaceAll("_", " ")}</span>
              <span className="text-sm font-bold text-slate-900">{row.count ?? row.amount ?? 0}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}

export default function AdminMonitoringPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminMonitoring()
      .then(res => setData(res.data || {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  const highRiskRows = (data?.highRiskPatients || []).map(patient => ({
    _id: `${patient.user?.name || patient.patientId} (${patient.riskLevel})`,
    count: patient.healthScore ?? 0,
  }));

  return (
    <DashboardLayout role="admin">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Platform Monitoring</h1>
        <p className="text-slate-500 text-sm mt-1">Live operational signals from audit logs, appointments, AI workflows, claims, and patient risk.</p>
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-56 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <MetricGroup title="AI Usage" icon={Bot} rows={data?.aiUsage} empty="No AI workflow activity recorded yet." />
          <MetricGroup title="Security Events" icon={Shield} rows={data?.securityEvents} empty="No security events recorded in the last 7 days." />
          <MetricGroup title="Appointment Flow" icon={CalendarClock} rows={data?.appointmentFlow} empty="No appointments recorded yet." />
          <MetricGroup title="Claim Flow" icon={ClipboardList} rows={data?.claimFlow} empty="No claims recorded yet." />
          <MetricGroup title="High Risk Patients" icon={AlertTriangle} rows={highRiskRows} empty="No high-risk patients currently flagged." />
        </div>
      )}
    </DashboardLayout>
  );
}
