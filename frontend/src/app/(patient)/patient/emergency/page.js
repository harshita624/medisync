"use client";
import { useEffect, useState, useRef } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getPatientProfile, getSosEvents, triggerSos, updatePatientProfile } from "@/lib/api";
import toast from "react-hot-toast";
import {
  AlertTriangle, CheckCircle, Loader2, MapPin, Phone,
  Save, Siren, UserRound, X, Clock, ShieldAlert, Users, Bell, Info,
} from "lucide-react";

const SOS_COOLDOWN_MS = 5 * 60 * 1000;

export default function EmergencyPage() {
  const [profile, setProfile] = useState(null);
  const [events,  setEvents]  = useState([]);
  const [contact, setContact] = useState({ name: "", phone: "", relation: "" });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [lastSosAt, setLastSosAt] = useState(null);
  const countdownRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        getPatientProfile().catch(() => ({ data: { patient: null } })),
        getSosEvents().catch(() => ({ data: { events: [] } })),
      ]);
      setProfile(p.data.patient);
      setContact(p.data.patient?.emergencyContact || { name: "", phone: "", relation: "" });
      setEvents(s.data.events || []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const stored = localStorage.getItem("hb_sos_last");
    if (stored) {
      const last = Number(stored);
      if (Date.now() - last < SOS_COOLDOWN_MS) setLastSosAt(last);
    }
    return () => clearInterval(countdownRef.current);
  }, []);

  const remainingCooldown = lastSosAt
    ? Math.max(0, Math.ceil((SOS_COOLDOWN_MS - (Date.now() - lastSosAt)) / 1000))
    : 0;

  function startConfirm() {
    if (remainingCooldown > 0) {
      toast.error(`Please wait ${Math.ceil(remainingCooldown / 60)} minute(s) before sending another SOS.`);
      return;
    }
    setShowConfirm(true);
    setCountdown(5);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { clearInterval(countdownRef.current); return 0; } return prev - 1; });
    }, 1000);
  }

  function cancelConfirm() {
    clearInterval(countdownRef.current);
    setShowConfirm(false);
    setCountdown(0);
  }

  function getLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function sendSos() {
    cancelConfirm();
    setSending(true);
    try {
      const location = await getLocation();
      const res = await triggerSos({ message: "Emergency SOS triggered from patient app", location });
      setEvents(res.data.events || []);
      const now = Date.now();
      setLastSosAt(now);
      localStorage.setItem("hb_sos_last", String(now));
      toast.success("🚨 SOS alert sent successfully", { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send SOS — please call 112 directly");
    } finally { setSending(false); }
  }

  async function saveContact(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updatePatientProfile({ emergencyContact: contact });
      setProfile(res.data.patient);
      toast.success("Emergency contact saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save contact");
    } finally { setSaving(false); }
  }

  const recipients = [
    profile?.emergencyContact?.name
      ? `${profile.emergencyContact.name} (${profile.emergencyContact.relation || "Contact"}) — ${profile.emergencyContact.phone || "no phone"}`
      : null,
    "Dana Shivam Hospital administrators",
    "All connected doctors",
  ].filter(Boolean);

  const canSendSos = remainingCooldown === 0 && !sending;

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">Emergency SOS</h1>
        <p className="text-slate-500 text-sm mt-1">For life-threatening emergencies — always call 112 first</p>
      </div>

      <div className="mb-6 flex items-center gap-4 p-4 bg-red-600 text-white rounded-2xl shadow-lg">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          <Phone size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-lg">Medical Emergency?</p>
          <p className="text-red-100 text-sm">Call 112 immediately — do not wait</p>
        </div>
        <a href="tel:112" className="btn-press px-5 py-2.5 bg-white text-red-600 font-bold rounded-xl text-sm hover:bg-red-50 transition-all whitespace-nowrap">
          📞 Call 112
        </a>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <div className="space-y-4">

          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Siren size={26} className="text-red-600" />
              <div>
                <h2 className="font-syne font-bold text-red-800">Hospital Emergency Alert</h2>
                <p className="text-xs text-red-600 mt-0.5">Notifies your contacts and Dana Shivam team</p>
              </div>
            </div>

            <div className="mb-4 bg-white rounded-xl p-4 border border-red-100">
              <p className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                <Bell size={12} /> Who will be notified
              </p>
              <ul className="space-y-1.5">
                {recipients.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle size={12} className="text-teal-500 shrink-0" /> {r}
                  </li>
                ))}
              </ul>
              {!profile?.emergencyContact?.phone && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Info size={12} /> Add an emergency contact below for personal notification
                </p>
              )}
            </div>

            {remainingCooldown > 0 && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Clock size={14} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">
                  Next SOS available in <strong>{Math.ceil(remainingCooldown / 60)}m {remainingCooldown % 60}s</strong>
                </p>
              </div>
            )}

            <button onClick={startConfirm} disabled={!canSendSos}
              className="btn-press w-full py-4 bg-red-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200">
              {sending ? <><Loader2 size={20} className="animate-spin" /> Sending alert…</> : <><Siren size={20} /> Send Emergency Alert</>}
            </button>
            <p className="text-xs text-slate-400 text-center mt-3">Use only for genuine emergencies. False SOS has a 5-minute cooldown.</p>
          </div>

          <form onSubmit={saveContact} className="med-card p-6">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserRound size={17} className="text-teal-600" /> Emergency Contact
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Name</label>
                <input value={contact.name || ""} onChange={e => setContact({ ...contact, name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <input value={contact.phone || ""} onChange={e => setContact({ ...contact, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX" type="tel"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Relation</label>
                <input value={contact.relation || ""} onChange={e => setContact({ ...contact, relation: e.target.value })}
                  placeholder="e.g. Spouse, Parent, Sibling"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <button disabled={saving}
                className="btn-press w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save Contact
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">

          <div className="med-card p-6">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldAlert size={17} className="text-red-500" /> Emergency Medical Snapshot
            </h2>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ["Blood group",       profile?.bloodGroup || "Unknown"],
                  ["Risk level",        profile?.riskLevel  || "low"],
                  ["Health score",      profile?.healthScore != null ? `${profile.healthScore}/100` : "Not calculated"],
                  ["Allergies",         profile?.allergies?.join(", ")         || "None recorded"],
                  ["Conditions",        profile?.chronicConditions?.join(", ") || "None recorded"],
                  ["Emergency phone",   profile?.emergencyContact?.phone       || "Not recorded"],
                  ["Emergency contact", profile?.emergencyContact?.name ? `${profile.emergencyContact.name} (${profile.emergencyContact.relation || "—"})` : "Not recorded"],
                  ["Patient ID",        profile?.patientId || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
                    <p className="text-xs text-teal-400">{label}</p>
                    <p className="text-sm font-bold text-slate-800 mt-1 capitalize">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="med-card p-6">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock size={17} className="text-teal-600" /> SOS History
            </h2>
            {events.length === 0 ? (
              <p className="text-sm text-slate-400">No SOS events recorded.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {[...events].reverse().map((event, i) => (
                  <div key={event._id || i} className="p-4 bg-red-50 border border-red-100 rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-red-800">{event.message || "SOS triggered"}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        event.status === "closed" ? "bg-slate-100 text-slate-500" :
                        event.status === "acknowledged" ? "bg-teal-50 text-teal-600" :
                        "bg-red-100 text-red-600"
                      }`}>{event.status}</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1">{new Date(event.triggeredAt).toLocaleString("en-IN")}</p>
                    {event.location?.latitude && (
                      <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                        <MapPin size={12} />
                        {event.location.address || `${event.location.latitude.toFixed(5)}, ${event.location.longitude.toFixed(5)}`}
                      </p>
                    )}
                    {event.notifiedContacts?.length > 0 && (
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <Users size={12} /> Notified: {event.notifiedContacts.map(c => c.name || c.phone).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mx-auto mb-5">
              <Siren size={30} className="text-red-600" />
            </div>
            <h2 className="font-syne text-xl font-bold text-slate-900 text-center mb-2">Confirm Emergency Alert</h2>
            <p className="text-slate-500 text-sm text-center mb-5 leading-relaxed">This will immediately notify:</p>
            <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-5">
              <ul className="space-y-2">
                {recipients.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-red-800">
                    <Bell size={14} className="text-red-500 shrink-0" /> {r}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-slate-400 text-center mb-5">
              ⚠️ Only use for genuine emergencies. For immediate danger, call <a href="tel:112" className="text-red-600 font-bold">112</a> directly.
            </p>
            <div className="flex gap-3">
              <button onClick={cancelConfirm}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <X size={16} /> Cancel
              </button>
              <button onClick={sendSos} disabled={sending}
                className="btn-press flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {sending ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Siren size={16} /> Send SOS{countdown > 0 ? ` (${countdown}s)` : ""}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}