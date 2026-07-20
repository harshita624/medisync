"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/shared/DashboardLayout";
import useAuthStore from "@/store/authStore";
import {
  getPatientProfile, getMyAppointments, getMyClaims,
  getPatientDocuments, getVitals,
} from "@/lib/api";
import {
  Activity, AlertCircle, AlertTriangle, Bot, Calendar,
  CheckCircle, ClipboardList, FileText, Heart, HeartPulse,
  Pill, QrCode, Shield, Stethoscope, TrendingUp, Clock,
  Siren, Video, ChevronRight,
} from "lucide-react";

function HealthRing({ score }) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const fill = ((score || 0) / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Good"    : score >= 40 ? "Fair"    : "Low";
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg width="128" height="128" className="absolute inset-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{score ?? "—"}</span>
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, iconCls, valueCls = "text-slate-900" }) {
  return (
    <div className="med-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconCls}`}>
          <Icon size={19} className="text-current" />
        </div>
        <span className="text-xs font-semibold text-slate-400">{sub}</span>
      </div>
      <p className={`text-2xl font-bold ${valueCls}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function VitalsAlert({ vitals }) {
  if (!vitals || !Object.keys(vitals).length) return null;
  const alerts = [];
  if (vitals.systolic >= 140 || vitals.diastolic >= 90)
    alerts.push({ msg: "BP " + vitals.systolic + "/" + vitals.diastolic + " is HIGH", sev: "red" });
  if (vitals.oxygenSaturation && vitals.oxygenSaturation < 94)
    alerts.push({ msg: "SpO2 " + vitals.oxygenSaturation + "% is CRITICALLY LOW", sev: "red" });
  if (vitals.temperature && vitals.temperature >= 38)
    alerts.push({ msg: "Temperature " + vitals.temperature + " °C — Fever", sev: "amber" });
  if (vitals.glucose && vitals.glucose > 180)
    alerts.push({ msg: "Glucose " + vitals.glucose + " mg/dL is HIGH", sev: "amber" });
  if (!alerts.length) return null;
  return (
    <div className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4">
      <p className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
        <AlertTriangle size={15} /> Vitals Alert — Review with your doctor
      </p>
      <div className="space-y-1">
        {alerts.map((a, i) => (
          <p key={i} className={"text-xs font-semibold " + (a.sev === "red" ? "text-red-600" : "text-amber-600")}>
            {a.msg}
          </p>
        ))}
      </div>
      <Link href="/patient/vitals" className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline mt-2">
        Open Vitals Tracker <ChevronRight size={12} />
      </Link>
    </div>
  );
}

export default function PatientDashboard() {
  const { user }       = useAuthStore();
  const [profile,      setProfile]      = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [claims,       setClaims]       = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [vitals,       setVitals]       = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPatientProfile().catch(() => ({ data: { patient: null } })),
      getMyAppointments().catch(() => ({ data: { appointments: [] } })),
      getMyClaims().catch(() => ({ data: { claims: [] } })),
      getPatientDocuments().catch(() => ({ data: { documents: [] } })),
      getVitals().catch(() => ({ data: { vitals: [] } })),
    ]).then(([p, a, c, d, v]) => {
      setProfile(p.data.patient);
      setAppointments(a.data.appointments || []);
      setClaims(c.data.claims || []);
      setDocuments(d.data.documents || []);
      setVitals(v.data.vitals || []);
    }).finally(() => setLoading(false));
  }, [user]);

  const now = new Date();

  const upcomingApts = appointments
    .filter(a => {
      const aptDate = new Date(a.appointmentDate);
      return aptDate >= now && ["scheduled", "confirmed", "in-consultation"].includes(a.status);
    })
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

  const nextApt = upcomingApts[0] || null;

  function getQueuePosition(apt) {
    if (!apt) return null;
    const aptDay = new Date(apt.appointmentDate);
    aptDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(aptDay);
    nextDay.setDate(nextDay.getDate() + 1);
    const doctorId = String(apt.doctor?._id || apt.doctor);
    const todayApts = appointments
      .filter(a => {
        const d = new Date(a.appointmentDate);
        return d >= aptDay &&
               d < nextDay &&
               String(a.doctor?._id || a.doctor) === doctorId &&
               ["scheduled", "confirmed"].includes(a.status);
      })
      .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
    const idx = todayApts.findIndex(a => String(a._id) === String(apt._id));
    return idx >= 0 ? idx + 1 : null;
  }

  const isToday     = nextApt ? new Date(nextApt.appointmentDate).toDateString() === now.toDateString() : false;
  const queuePos    = isToday ? getQueuePosition(nextApt) : null;
  const waitMinutes = queuePos ? (queuePos - 1) * 15 : 0;

  const pendingClaims = claims.filter(c => ["submitted", "under_review"].includes(c.status));
  const aiSummaryDocs = documents.filter(d => d.aiSummary);
  const latestVitals  = vitals[0] || {};

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const statusColor = {
    scheduled:          "bg-blue-50 text-blue-600 border-blue-100",
    confirmed:          "bg-green-50 text-green-600 border-green-100",
    "in-consultation":  "bg-teal-50 text-teal-600 border-teal-100",
    completed:          "bg-slate-100 text-slate-500 border-slate-200",
    cancelled:          "bg-red-50 text-red-500 border-red-100",
  };

  return (
    <DashboardLayout role="patient">
      <div className="mb-7 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">
          Good {greeting}, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {nextApt
            ? "Next appointment: " +
              new Date(nextApt.appointmentDate).toLocaleDateString("en-IN", {
                weekday: "short", day: "numeric", month: "short",
              }) +
              " with Dr. " + (nextApt.doctor?.user?.name || "Doctor")
            : "Your health summary for today"}
        </p>
      </div>

      <VitalsAlert vitals={latestVitals} />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl h-28 animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            <StatCard icon={Calendar}      label="Upcoming Appointments" value={upcomingApts.length}            sub="Active"    iconCls="bg-blue-100 text-blue-600"      />
            <StatCard icon={Activity}      label="Vitals Logged"         value={vitals.length}                  sub="Readings"  iconCls="bg-green-100 text-green-600"    />
            <StatCard icon={Shield}        label="Active Policies"       value={profile?.policies?.length || 0} sub="Insurance" iconCls="bg-purple-100 text-purple-600"  />
            <StatCard icon={ClipboardList} label="Pending Claims"        value={pendingClaims.length}           sub="In review" iconCls="bg-amber-100 text-amber-600"    />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── Left column ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Next appointment banner */}
              {nextApt && (
                <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: "var(--grad-primary)" }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-teal-100 text-xs font-semibold uppercase tracking-wide">Next Appointment</p>
                      <h3 className="font-syne text-lg font-bold mt-0.5">Dr. {nextApt.doctor?.user?.name || "—"}</h3>
                      <p className="text-teal-100 text-sm mt-0.5">{nextApt.doctor?.specialization || "—"}</p>
                    </div>
                    {isToday && queuePos && (
                      <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                        <p className="text-white/70 text-xs">Queue</p>
                        <p className="text-2xl font-bold">#{queuePos}</p>
                        <p className="text-white/70 text-xs">~{waitMinutes}min</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {new Date(nextApt.appointmentDate).toLocaleString("en-IN", {
                        weekday: "short", day: "numeric", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {nextApt.timeSlot?.start && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} /> {nextApt.timeSlot.start}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold capitalize bg-white/20">
                      {nextApt.status} · {nextApt.type}
                    </span>
                  </div>
                  {nextApt.type === "video" && nextApt.meetingLink && (
                    <a
                      href={nextApt.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-press inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-all"
                    >
                      <Video size={14} /> Join Video Consultation
                    </a>
                  )}
                </div>
              )}

              {/* Appointments list */}
              <div className="med-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">Appointments</h2>
                  <Link href="/patient/appointments" className="text-xs text-teal-600 font-semibold hover:underline flex items-center gap-1">
                    View all <ChevronRight size={12} />
                  </Link>
                </div>
                {upcomingApts.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar size={36} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No upcoming appointments</p>
                    <Link href="/patient/appointments"
                      className="btn-press inline-block mt-3 px-4 py-2 bg-teal-500 text-white text-xs font-bold rounded-xl hover:bg-teal-600 transition-all">
                      Book Appointment
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingApts.slice(0, 4).map((apt, i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                        <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                          <Stethoscope size={17} className="text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            Dr. {apt.doctor?.user?.name || "—"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(apt.appointmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {apt.timeSlot?.start ? " at " + apt.timeSlot.start : ""}
                            {" · " + apt.type}
                          </p>
                        </div>
                        <span className={"text-xs font-semibold px-2 py-0.5 rounded-full capitalize border " + (statusColor[apt.status] || "bg-slate-100 text-slate-500 border-slate-200")}>
                          {apt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="med-card p-5">
                <h2 className="font-bold text-slate-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Bot,         label: "AI Assistant",  href: "/patient/chat",         cls: "bg-teal-50 text-teal-600 hover:bg-teal-100"      },
                    { icon: Calendar,    label: "Book Apt",      href: "/patient/appointments", cls: "bg-blue-50 text-blue-600 hover:bg-blue-100"       },
                    { icon: QrCode,      label: "My QR",         href: "/patient/qr",           cls: "bg-purple-50 text-purple-600 hover:bg-purple-100" },
                    { icon: Stethoscope, label: "Symptom Check", href: "/patient/symptoms",     cls: "bg-green-50 text-green-600 hover:bg-green-100"    },
                    { icon: Activity,    label: "Log Vitals",    href: "/patient/vitals",       cls: "bg-orange-50 text-orange-600 hover:bg-orange-100" },
                    { icon: Pill,        label: "Medicines",     href: "/patient/medicines",    cls: "bg-pink-50 text-pink-600 hover:bg-pink-100"       },
                    { icon: Shield,      label: "Insurance",     href: "/patient/insurance",    cls: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" },
                    { icon: Siren,       label: "Emergency",     href: "/patient/emergency",    cls: "bg-red-50 text-red-500 hover:bg-red-100"          },
                  ].map(({ icon: Icon, label, href, cls }) => (
                    <Link key={label} href={href}
                      className={"card-hover flex flex-col items-center gap-2 p-3 rounded-xl border border-transparent transition-all " + cls}>
                      <Icon size={20} />
                      <span className="text-xs font-semibold">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* AI report summaries */}
              {aiSummaryDocs.length > 0 && (
                <div className="med-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                      <FileText size={17} className="text-teal-500" /> AI Report Summaries
                    </h2>
                    <Link href="/patient/records" className="text-xs text-teal-600 font-semibold hover:underline">
                      View all
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    {aiSummaryDocs.slice(0, 3).map(d => (
                      <div key={d._id} className="p-3.5 bg-teal-50 border border-teal-100 rounded-xl">
                        <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                        <p className="text-xs text-teal-700 mt-1 leading-relaxed">{d.aiSummary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right column ── */}
            <div className="space-y-5">

              {/* Health score */}
              <div className="med-card p-5">
                <h2 className="font-bold text-slate-900 mb-4 text-center">Health Score</h2>
                <HealthRing score={profile?.healthScore} />
                {profile?.healthScore == null && (
                  <p className="text-xs text-slate-400 text-center mt-3 leading-relaxed">
                    Log vitals to get your ML-powered health score.
                  </p>
                )}
                <div className="mt-4 space-y-2">
                  {[
                    {
                      label: "Risk Level",
                      value: profile?.riskLevel || "—",
                      cls:   profile?.riskLevel === "low"    ? "text-green-600" :
                             profile?.riskLevel === "medium" ? "text-amber-600" : "text-red-600",
                    },
                    { label: "Blood Group", value: profile?.bloodGroup || "—",                    cls: "text-slate-700" },
                    { label: "Conditions",  value: profile?.chronicConditions?.length || 0,        cls: "text-slate-700" },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
                      <span className="text-slate-500">{r.label}</span>
                      <span className={"font-semibold capitalize " + r.cls}>{r.value}</span>
                    </div>
                  ))}
                </div>
                {profile?.riskLevel && profile.riskLevel !== "low" && (
                  <div className="mt-3 flex gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Risk is elevated. Book a consultation or review your vitals.
                    </p>
                  </div>
                )}
                <Link href="/patient/vitals"
                  className="btn-press mt-3 w-full flex items-center justify-center gap-2 py-2 bg-teal-50 text-teal-700 rounded-xl text-xs font-semibold hover:bg-teal-100 transition-all">
                  <Activity size={13} /> View Vitals Tracker
                </Link>
              </div>

              {/* Latest vitals */}
              {Object.keys(latestVitals).length > 0 && (
                <div className="med-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                      <HeartPulse size={16} className="text-red-400" /> Latest Vitals
                    </h2>
                    <Link href="/patient/vitals" className="text-xs text-teal-600 hover:underline">Update</Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label:  "Blood Pressure",
                        value:  latestVitals.bloodPressure ||
                                (latestVitals.systolic ? latestVitals.systolic + "/" + latestVitals.diastolic : null),
                        normal: v => { const [s, d] = (v || "").split("/"); return Number(s) < 140 && Number(d) < 90; },
                      },
                      {
                        label:  "Heart Rate",
                        value:  latestVitals.heartRate ? latestVitals.heartRate + " bpm" : null,
                        normal: v => Number(v) >= 60 && Number(v) <= 100,
                      },
                      {
                        label:  "Temperature",
                        value:  latestVitals.temperature ? latestVitals.temperature + " °C" : null,
                        normal: v => Number(v) < 38,
                      },
                      {
                        label:  "SpO2",
                        value:  latestVitals.oxygenSaturation ? latestVitals.oxygenSaturation + "%" : null,
                        normal: v => Number(v) >= 95,
                      },
                      {
                        label:  "Glucose",
                        value:  latestVitals.glucose ? latestVitals.glucose + " mg/dL" : null,
                        normal: v => Number(v) < 180,
                      },
                      {
                        label:  "BMI",
                        value:  latestVitals.bmi ? String(latestVitals.bmi) : null,
                        normal: v => Number(v) >= 18.5 && Number(v) <= 24.9,
                      },
                    ].filter(v => v.value).map(v => {
                      const isGood = v.normal ? v.normal(v.value) : true;
                      return (
                        <div key={v.label} className={"rounded-xl p-3 border " + (isGood ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                          <p className="text-xs text-slate-400">{v.label}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <p className={"text-sm font-bold " + (isGood ? "text-green-700" : "text-red-600")}>{v.value}</p>
                            {!isGood && <AlertTriangle size={11} className="text-red-500" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current medications */}
              {profile?.currentMedications?.length > 0 && (
                <div className="med-card p-5">
                  <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Pill size={16} className="text-green-500" /> Current Medications
                  </h2>
                  <div className="space-y-2">
                    {profile.currentMedications.slice(0, 4).map((m, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-100 rounded-xl">
                        <CheckCircle size={13} className="text-green-500 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{m.name}</p>
                          <p className="text-xs text-green-700">
                            {[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/patient/medicines"
                    className="mt-3 block text-xs text-center text-teal-600 font-semibold hover:underline">
                    Manage all reminders
                  </Link>
                </div>
              )}

              {/* Patient ID card */}
              <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: "linear-gradient(145deg, var(--teal-dark), var(--cyan))" }}>
                <p className="text-teal-100 text-xs font-bold uppercase tracking-wider mb-2">Patient ID</p>
                <p className="font-syne font-bold text-xl">{profile?.patientId || "—"}</p>
                <p className="text-teal-100 text-xs mt-1 truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                  <span className="text-teal-100 text-xs">Active patient</span>
                </div>
                <Link href="/patient/qr"
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-all">
                  <QrCode size={12} /> View My QR Code
                </Link>
              </div>

            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}