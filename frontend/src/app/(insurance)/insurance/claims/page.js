"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getInsuranceClaims, processClaim } from "@/lib/api";
import toast from "react-hot-toast";

export default function InsuranceClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState("");

  async function load() {
    const res = await getInsuranceClaims(status ? { status } : {});
    setClaims(res.data.claims || []);
  }

  useEffect(() => { load().catch(() => setClaims([])); }, []);

  async function update(id, nextStatus, amount) {
    try {
      await processClaim(id, { status: nextStatus, approvedAmount: amount });
      toast.success("Claim updated");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  }

  return (
    <DashboardLayout role="insurance">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Claims</h1>
          <p className="text-slate-500 text-sm mt-1">Review, approve, reject, and pay patient claims.</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm">
            <option value="">All</option>
            {["submitted","under_review","approved","partially_approved","rejected","paid"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button onClick={load} className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold">Filter</button>
        </div>
      </div>
      <div className="space-y-4">
        {claims.map(claim => (
          <div key={claim._id} className="bg-white rounded-2xl p-5 border border-slate-100">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-bold text-slate-900">{claim.claimNumber}</p>
                <p className="text-xs text-slate-500">{claim.patient?.user?.name} | {claim.claimType?.replace("_", " ")}</p>
                <p className="text-sm text-slate-600 mt-2">{claim.description}</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">{claim.status?.replace("_", " ")}</span>
            </div>
            <div className="flex items-center gap-5 mt-4 text-sm">
              <p>Claimed: <b>₹{claim.claimAmount?.toLocaleString("en-IN")}</b></p>
              <p>Approved: <b>₹{(claim.approvedAmount || 0).toLocaleString("en-IN")}</b></p>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              <button onClick={() => update(claim._id, "under_review", claim.approvedAmount || 0)} className="px-3 py-2 bg-yellow-50 text-yellow-700 rounded-xl text-xs font-bold">Review</button>
              <button onClick={() => update(claim._id, "approved", claim.claimAmount)} className="px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold">Approve Full</button>
              <button onClick={() => update(claim._id, "paid", claim.approvedAmount || claim.claimAmount)} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold">Mark Paid</button>
              <button onClick={() => update(claim._id, "rejected", 0)} className="px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-bold">Reject</button>
            </div>
          </div>
        ))}
        {!claims.length && <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center text-slate-400">No claims found</div>}
      </div>
    </DashboardLayout>
  );
}
