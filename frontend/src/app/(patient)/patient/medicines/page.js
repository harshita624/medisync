"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import useAuthStore from "@/store/authStore";
import { createMedicineReminder, deleteMedicineReminder, getMedicineReminders, logMedicineReminder, updateMedicineReminder } from "@/lib/api";
import toast from "react-hot-toast";
import { Bell, BellRing, CheckCircle, Clock, Loader2, Pill, Plus, Trash2 } from "lucide-react";

const browserTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; }
  catch { return "Asia/Kolkata"; }
};
const emptyForm = {
  medicine: "", dosage: "", frequency: "once_daily", times: "08:00", daysOfWeek: [], instructions: "",
};
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


function zonedParts(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => (result[part.type] = part.value, result), {});
}

function zonedDateKey(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function scheduledDate(dateKey, time, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wantedWallClock = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = wantedWallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(timestamp), timeZone);
    const representedWallClock = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute),
    );
    timestamp += wantedWallClock - representedWallClock;
  }
  return new Date(timestamp);
}

function occurrenceKey(date, timeZone, fallbackTime) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}|${fallbackTime || `${parts.hour}:${parts.minute}`}`;
}

function logForDose(reminder, doseTime, dateKey) {
  const timeZone = reminder.timeZone || "Asia/Kolkata";
  return (reminder.adherenceLog || []).find(log => log.scheduledFor &&
    occurrenceKey(new Date(log.scheduledFor), timeZone, log.doseTime) === `${dateKey}|${doseTime}`);
}


export default function MedicinesPage() {
  const { user } = useAuthStore();
  const alarmPreferenceKey = user?._id ? `healthbridge-medicine-alarms:${user._id}` : "healthbridge-medicine-alarms";
  const [reminders, setReminders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState("unsupported");
  const [doseBusy, setDoseBusy] = useState("");
  const [now, setNow] = useState(() => new Date());
  const audioContextRef = useRef(null);

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

  useEffect(() => {
    setForm(current => ({ ...current, timeZone: browserTimeZone() }));
    load();
    const clock = window.setInterval(() => setNow(new Date()), 10000);
    if ("Notification" in window) setNotificationPermission(Notification.permission);
    setAlarmEnabled(localStorage.getItem(alarmPreferenceKey) === "enabled");
    return () => { window.clearInterval(clock); };
  }, [alarmPreferenceKey]);

  const active = useMemo(() => reminders.filter(reminder => reminder.isActive !== false), [reminders]);

  async function enableAlarms() {
    let permission = notificationPermission;
    if ("Notification" in window) {
      try {
        if (Notification.permission === "default") permission = await Notification.requestPermission();
        else permission = Notification.permission;
      } catch { permission = "denied"; }
      setNotificationPermission(permission);
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        audioContextRef.current ||= new AudioContextClass();
        window.__healthbridgeMedicineAudioContext = audioContextRef.current;
        await audioContextRef.current.resume();
      } catch {}
    }
    localStorage.setItem(alarmPreferenceKey, "enabled");
    setAlarmEnabled(true);
    window.dispatchEvent(new Event("healthbridge:medicine-reminders-updated"));
    toast.success(permission === "granted"
      ? "Medicine alarms enabled on this device"
      : "In-page medicine alarms enabled; allow browser notifications for pop-up alerts");
  }


  async function submit(event) {
    event.preventDefault();
    if (!form.medicine.trim()) return toast.error("Medicine name is required");
    const times = form.times.split(",").map(time => time.trim()).filter(Boolean);
    if (form.frequency === "weekly" && !form.daysOfWeek.length) return toast.error("Choose at least one weekday");
    setSaving(true);
    try {
      const res = await createMedicineReminder({ ...form, times, timeZone: browserTimeZone() });
      setReminders(res.data.reminders || []);
      window.dispatchEvent(new Event("healthbridge:medicine-reminders-updated"));
      setForm({ ...emptyForm, timeZone: browserTimeZone() });
      toast.success("Reminder added using your device timezone");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save reminder");
    } finally {
      setSaving(false);
    }
  }

  async function markDose(reminder, doseTime, status) {
    const zone = reminder.timeZone || "Asia/Kolkata";
    const today = zonedDateKey(new Date(), zone);
    const key = `${reminder._id}:${today}:${doseTime}`;
    setDoseBusy(key);
    try {
      const dueAt = scheduledDate(today, doseTime, zone);
      const res = await logMedicineReminder(reminder._id, {
        status, doseTime, scheduledFor: dueAt.toISOString(),
      });
      setReminders(res.data.reminders || []);
      window.dispatchEvent(new Event("healthbridge:medicine-reminders-updated"));
      window.dispatchEvent(new Event("healthbridge:notifications-updated"));
      toast.success(`${reminder.medicine} at ${doseTime} marked ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update this dose");
    } finally {
      setDoseBusy("");
    }
  }

  async function toggle(reminder) {
    try {
      const res = await updateMedicineReminder(reminder._id, { isActive: !reminder.isActive });
      setReminders(res.data.reminders || []);
      window.dispatchEvent(new Event("healthbridge:medicine-reminders-updated"));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update reminder");
    }
  }

  async function remove(reminder) {
    try {
      const res = await deleteMedicineReminder(reminder._id);
      setReminders(res.data.reminders || []);
      window.dispatchEvent(new Event("healthbridge:medicine-reminders-updated"));
      toast.success("Reminder deleted");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete reminder");
    }
  }

  const today = now;
  return (
    <DashboardLayout role="patient">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">Medicine Reminders</h1>
          <p className="text-slate-500 text-sm mt-1">Dose times follow each reminder’s saved timezone. Mark each scheduled dose to update today’s status.</p>
        </div>
        <button type="button" onClick={enableAlarms} className="btn-press inline-flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700 hover:bg-teal-100">
          {alarmEnabled ? <BellRing size={16} /> : <Bell size={16} />}
          {alarmEnabled ? "Alarms enabled" : "Enable alarms"}
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Alarms run while HealthBridge is open on this device. Allow browser notifications and keep the patient portal open for scheduled alerts.
        {notificationPermission === "denied" ? " Browser notifications are blocked; change this site’s permission in your browser settings." : ""}
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <form onSubmit={submit} className="med-card p-6 h-fit">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Plus size={17} className="text-teal-600" /> Add Reminder</h2>
          <div className="space-y-3">
            <input value={form.medicine} onChange={event => setForm({ ...form, medicine: event.target.value })} placeholder="Medicine name" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            <input value={form.dosage} onChange={event => setForm({ ...form, dosage: event.target.value })} placeholder="Dosage, e.g. 500mg" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            <select value={form.frequency} onChange={event => setForm({ ...form, frequency: event.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
              <option value="once_daily">Once daily</option><option value="twice_daily">Twice daily</option><option value="thrice_daily">Three times daily</option><option value="weekly">Weekly</option><option value="custom">Custom</option>
            </select>
            {form.frequency === "weekly" && (
              <fieldset className="rounded-xl border border-slate-200 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-600">Remind me on</legend>
                <div className="flex flex-wrap gap-2">
                  {weekdays.map((day, index) => (
                    <label key={day} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                      <input type="checkbox" checked={form.daysOfWeek.includes(index)} onChange={() => setForm({ ...form, daysOfWeek: form.daysOfWeek.includes(index) ? form.daysOfWeek.filter(value => value !== index) : [...form.daysOfWeek, index] })} />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <input type="text" value={form.times} onChange={event => setForm({ ...form, times: event.target.value })} placeholder="24-hour times, e.g. 08:00, 20:00" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            <p className="-mt-2 text-xs text-slate-400">Use 24-hour format; separate multiple doses with commas. Current timezone: {browserTimeZone()}.</p>
            <textarea value={form.instructions} onChange={event => setForm({ ...form, instructions: event.target.value })} placeholder="Instructions" rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
            <button disabled={saving} style={{ background: "var(--grad-primary)" }} className="btn-press w-full py-3 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-md">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Save Reminder
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {[["Active", active.length], ["Total", reminders.length], ["Logged doses", reminders.reduce((count, reminder) => count + (reminder.adherenceLog?.length || 0), 0)]].map(([label, value]) => (
              <div key={label} className="med-card p-5"><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-xs text-slate-400 mt-1">{label}</p></div>
            ))}
          </div>

          {loading ? <div className="med-card p-8 text-center text-slate-400">Loading reminders...</div> : reminders.length === 0 ? (
            <div className="med-card p-12 text-center"><Pill size={42} className="mx-auto text-slate-200 mb-3" /><p className="text-sm text-slate-500">No medicine reminders yet.</p></div>
          ) : reminders.map(reminder => {
            const zone = reminder.timeZone || "Asia/Kolkata";
            const dateKey = zonedDateKey(today, zone);
            const nowParts = zonedParts(today, zone);
            const currentTime = `${nowParts.hour}:${nowParts.minute}`;
            const weekdayIndex = weekdays.indexOf(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: zone }).format(today));
            const scheduledToday = reminder.frequency !== "weekly" || (reminder.daysOfWeek || []).includes(weekdayIndex);
            return (
              <div key={reminder._id} className="med-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900">{reminder.medicine}</p>
                    <p className="text-sm text-slate-500 mt-1">{[reminder.dosage, reminder.frequency?.replaceAll("_", " ")].filter(Boolean).join(" | ")}</p>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><Clock size={12} /> {zone} · {(reminder.times || []).join(", ") || "No time set"}</p>
                    {reminder.instructions && <p className="text-xs text-slate-500 mt-2">{reminder.instructions}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${reminder.isActive ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                    {reminder.isActive ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(reminder.times || []).map(doseTime => {
                    const entry = logForDose(reminder, doseTime, dateKey);
                    const due = scheduledToday && currentTime >= doseTime;
                    const busyKey = `${reminder._id}:${dateKey}:${doseTime}`;
                    return (
                      <div key={doseTime} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><Clock size={13} /> {doseTime}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${entry?.status === "taken" ? "bg-green-100 text-green-700" : entry?.status === "missed" ? "bg-amber-100 text-amber-700" : entry?.status === "skipped" ? "bg-slate-200 text-slate-600" : due ? "bg-blue-100 text-blue-700" : "bg-white text-slate-500"}`}>
                            {entry ? entry.status[0].toUpperCase() + entry.status.slice(1) : !scheduledToday ? "Not scheduled today" : due ? "Due" : "Upcoming"}
                          </span>
                        </div>
                        {entry ? (
                          <p className="mt-2 text-xs text-slate-500">Logged {entry.loggedAt ? new Date(entry.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "today"} · this recurring reminder remains active for future doses.</p>
                        ) : !scheduledToday ? (
                          <p className="mt-2 text-xs text-slate-500">Not scheduled for today.</p>
                        ) : (
                          <div className="mt-2 flex gap-2">
                            <button disabled={!!doseBusy || !reminder.isActive} onClick={() => markDose(reminder, doseTime, "taken")} className="btn-press inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 disabled:opacity-50">
                              {doseBusy === busyKey ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Taken
                            </button>
                            <button disabled={!!doseBusy || !due || !reminder.isActive} onClick={() => markDose(reminder, doseTime, "missed")} className="btn-press rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 disabled:opacity-50">Missed</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => toggle(reminder)} className="btn-press rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">{reminder.isActive ? "Pause" : "Resume"}</button>
                  <button onClick={() => remove(reminder)} className="btn-press inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600"><Trash2 size={13} /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
