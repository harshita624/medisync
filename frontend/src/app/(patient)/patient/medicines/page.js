"use client";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { createMedicineReminder, deleteMedicineReminder, getMedicineReminders, logMedicineReminder, updateMedicineReminder } from "@/lib/api";
import toast from "react-hot-toast";
import { Bell, CheckCircle, Clock, Loader2, Pill, Plus, Trash2 } from "lucide-react";

const emptyForm = {
  medicine: "",
  dosage: "",
  frequency: "once_daily",
  times: "08:00",
  instructions: "",
};

export default function MedicinesPage() {
  const [reminders, setReminders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getMedicineReminders();
      setReminders(res.data.reminders || []);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const active = useMemo(() => reminders.filter(r => r.isActive !== false), [reminders]);

  async function submit(e) {
    e.preventDefault();
    if (!form.medicine.trim()) return toast.error("Medicine name is required");
    setSaving(true);
    try {
      const payload = {
        ...form,
        times: form.times.split(",").map(t => t.trim()).filter(Boolean),
      };
      const res = await createMedicineReminder(payload);
      setReminders(res.data.reminders || []);
      setForm(emptyForm);
      toast.success("Reminder added");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save reminder");
    } finally {
      setSaving(false);
    }
  }

  async function mark(reminder, status) {
    const res = await logMedicineReminder(reminder._id, { status, scheduledFor: new Date() });
    setReminders(res.data.reminders || []);
    toast.success(`${reminder.medicine} marked ${status}`);
  }

  async function toggle(reminder) {
    const res = await updateMedicineReminder(reminder._id, { isActive: !reminder.isActive });
    setReminders(res.data.reminders || []);
  }

  async function remove(reminder) {
    const res = await deleteMedicineReminder(reminder._id);
    setReminders(res.data.reminders || []);
    toast.success("Reminder deleted");
  }

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">Medicine Reminders</h1>
        <p className="text-slate-500 text-sm mt-1">Track prescriptions, dose timings, and adherence.</p>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <form onSubmit={submit} className="med-card p-6 h-fit">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Plus size={17} className="text-teal-600" /> Add Reminder</h2>
          <div className="space-y-3">
            <input value={form.medicine} onChange={e => setForm({ ...form, medicine: e.target.value })} placeholder="Medicine name" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            <input value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })} placeholder="Dosage, e.g. 500mg" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
              <option value="once_daily">Once daily</option>
              <option value="twice_daily">Twice daily</option>
              <option value="thrice_daily">Thrice daily</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom</option>
            </select>
            <input value={form.times} onChange={e => setForm({ ...form, times: e.target.value })} placeholder="Times, comma separated, e.g. 08:00, 20:00" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Instructions" rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
            <button disabled={saving} style={{ background: "var(--grad-primary)" }}
              className="btn-press w-full py-3 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-md">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Save Reminder
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              ["Active", active.length],
              ["Total", reminders.length],
              ["Logged", reminders.reduce((n, r) => n + (r.adherenceLog?.length || 0), 0)],
            ].map(([label, value]) => (
              <div key={label} className="med-card p-5">
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="med-card p-8 text-center text-slate-400">Loading reminders...</div>
          ) : reminders.length === 0 ? (
            <div className="med-card p-12 text-center">
              <Pill size={42} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-500">No medicine reminders yet.</p>
            </div>
          ) : reminders.map(reminder => (
            <div key={reminder._id} className="med-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">{reminder.medicine}</p>
                  <p className="text-sm text-slate-500 mt-1">{[reminder.dosage, reminder.frequency?.replace("_", " ")].filter(Boolean).join(" | ")}</p>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock size={12} /> {(reminder.times || []).join(", ") || "No time set"}</p>
                  {reminder.instructions && <p className="text-xs text-slate-500 mt-2">{reminder.instructions}</p>}
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${reminder.isActive ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                  {reminder.isActive ? "Active" : "Paused"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button onClick={() => mark(reminder, "taken")} className="btn-press px-3 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-bold flex items-center gap-1"><CheckCircle size={13} /> Taken</button>
                <button onClick={() => mark(reminder, "missed")} className="btn-press px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold">Missed</button>
                <button onClick={() => toggle(reminder)} className="btn-press px-3 py-2 rounded-xl bg-slate-50 text-slate-700 text-xs font-bold">{reminder.isActive ? "Pause" : "Resume"}</button>
                <button onClick={() => remove(reminder)} className="btn-press ml-auto px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1"><Trash2 size={13} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}