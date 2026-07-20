"use client";
import { useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { createPolicy } from "@/lib/api";
import toast from "react-hot-toast";

export default function InsurancePoliciesPage() {
  const [form, setForm] = useState({
    patientId: "", policyNumber: "", policyName: "", policyType: "health",
    coverageAmount: "", premiumAmount: "", premiumFrequency: "yearly",
    startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createPolicy({ ...form, coverageAmount: Number(form.coverageAmount), premiumAmount: Number(form.premiumAmount || 0) });
      toast.success("Policy created and linked");
      setForm({ ...form, patientId: "", policyNumber: "", policyName: "", coverageAmount: "", premiumAmount: "", endDate: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="insurance">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
        <p className="text-slate-500 text-sm mt-1">Create real patient-linked insurance policies.</p>
      </div>
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 border border-slate-100 grid md:grid-cols-2 gap-4">
        {[
          ["patientId", "Patient ID"],
          ["policyNumber", "Policy number"],
          ["policyName", "Policy name"],
          ["coverageAmount", "Coverage amount"],
          ["premiumAmount", "Premium amount"],
          ["endDate", "End date"],
        ].map(([key, label]) => (
          <input key={key} required={key !== "premiumAmount"} type={key.includes("Amount") ? "number" : key.includes("Date") ? "date" : "text"}
            value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
            placeholder={label} className="px-4 py-3 border border-slate-200 rounded-xl text-sm" />
        ))}
        <select value={form.policyType} onChange={e => setForm({ ...form, policyType: e.target.value })} className="px-4 py-3 border border-slate-200 rounded-xl text-sm">
          {["health","life","critical_illness","accident","dental","vision"].map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
        <select value={form.premiumFrequency} onChange={e => setForm({ ...form, premiumFrequency: e.target.value })} className="px-4 py-3 border border-slate-200 rounded-xl text-sm">
          {["monthly","quarterly","half-yearly","yearly"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button disabled={saving} className="md:col-span-2 py-3 bg-purple-600 text-white rounded-xl font-bold disabled:opacity-60">{saving ? "Saving..." : "Create Policy"}</button>
      </form>
    </DashboardLayout>
  );
}
