"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getDashboardStats } from "@/lib/api";
import { ClipboardList, IndianRupee, Shield } from "lucide-react";

export default function InsuranceDashboardPage() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    getDashboardStats().then(r => setStats(r.data.stats || {})).catch(() => setStats({}));
  }, []);

  const cards = [
    { label: "Policies", value: stats.policies || 0, icon: Shield },
    { label: "Active Policies", value: stats.activePolicies || 0, icon: Shield },
    { label: "Claims", value: stats.claims || 0, icon: ClipboardList },
    { label: "Pending Claims", value: stats.pendingClaims || 0, icon: ClipboardList },
    { label: "Claimed Amount", value: `₹${(stats.claimedAmount || 0).toLocaleString("en-IN")}`, icon: IndianRupee },
    { label: "Approved Amount", value: `₹${(stats.approvedAmount || 0).toLocaleString("en-IN")}`, icon: IndianRupee },
  ];

  return (
    <DashboardLayout role="insurance">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Insurance Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Claims, coverage, and policy operations.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-4"><Icon size={20} /></div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
