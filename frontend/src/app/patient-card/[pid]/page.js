'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  HeartPulse, AlertTriangle, Phone, Shield, Activity,
  Pill, FileText, Stethoscope, ChevronRight, CheckCircle, ExternalLink,
} from 'lucide-react';

function getApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  return process.env.NEXT_PUBLIC_API_URL || `${window.location.origin}/api`;
}

function riskStyle(level) {
  if (level === 'critical') return 'bg-red-100 text-red-700 border-red-300';
  if (level === 'high')     return 'bg-orange-100 text-orange-700 border-orange-300';
  if (level === 'medium')   return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-teal-100 text-teal-700 border-teal-300';
}

export default function PatientCardPage() {
  const { pid }   = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!pid) return;
    fetch(`${getApiBase()}/public/patient/${pid}`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.patient); else setError(res.message || 'Not found'); })
      .catch(() => setError('Could not load patient card. Check your connection.'))
      .finally(() => setLoading(false));
  }, [pid]);

  // ── THE FIX: use the shared brand gradient instead of a one-off 3-stop mix ──
  const heroStyle = { background: 'var(--grad-primary)' };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={heroStyle}>
      <div className="text-center text-white">
        <div className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="font-syne font-semibold text-lg">Loading Patient Card…</p>
        <p className="text-teal-100 text-sm mt-1">Dana Shivam Hospital</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={heroStyle}>
      <div className="bg-white rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-red-600" />
        </div>
        <h2 className="font-syne font-bold text-xl text-slate-900 mb-2">Card Not Found</h2>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <Link href="/" style={{ background: 'var(--grad-primary)' }}
          className="btn-press inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-md">
          <HeartPulse size={16} /> Dana Shivam Hospital
        </Link>
      </div>
    </div>
  );

  const bmi = (data.height && data.weight)
    ? (data.weight / Math.pow(data.height / 100, 2)).toFixed(1)
    : null;

  const vitals = data.latestVital ? [
    data.latestVital.bloodPressure    ? `BP ${data.latestVital.bloodPressure}`        : null,
    data.latestVital.heartRate        ? `HR ${data.latestVital.heartRate} bpm`         : null,
    data.latestVital.oxygenSaturation ? `SpO₂ ${data.latestVital.oxygenSaturation}%`  : null,
    data.latestVital.temperature      ? `Temp ${data.latestVital.temperature}°C`       : null,
    data.latestVital.glucose          ? `Glucose ${data.latestVital.glucose} mg/dL`    : null,
  ].filter(Boolean) : [];

  return (
    <div className="min-h-screen py-6 px-4" style={heroStyle}>
      <div className="max-w-sm mx-auto space-y-4">

        {/* Hospital header */}
        <div className="text-center pt-2 pb-1">
          <div className="inline-flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <HeartPulse size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-syne font-extrabold text-white text-base leading-none">Dana Shivam</p>
              <p className="text-[10px] text-teal-100 leading-none mt-0.5 tracking-wider">HEART & SUPER SPECIALITY HOSPITAL</p>
            </div>
          </div>
          <p className="text-[11px] text-teal-100 italic">Spirit To Care, Skill To Heal</p>
        </div>

        {/* Patient card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

          <div className="px-5 py-4" style={{ background: 'var(--grad-primary)' }}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-2xl font-extrabold shrink-0 overflow-hidden">
                {data.avatar
                  ? <img src={data.avatar} alt="" className="w-full h-full object-cover" />
                  : data.name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-white text-xl leading-tight truncate">{data.name}</p>
                <p className="text-teal-100 text-xs font-mono mt-0.5">{data.patientId}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-teal-100">
                  {data.age    && <span>{data.age} yrs</span>}
                  {data.gender && <span className="capitalize">{data.gender}</span>}
                </div>
              </div>
              {data.bloodGroup && data.bloodGroup !== 'Unknown' && (
                <div className="bg-white rounded-xl px-3 py-2.5 text-center shrink-0 shadow-md">
                  <p className="text-2xl font-extrabold leading-none text-teal-600">{data.bloodGroup}</p>
                  <p className="text-[9px] text-teal-400 mt-1 font-bold tracking-wider">BLOOD</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">

            {data.allergies?.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  <p className="text-xs font-extrabold text-red-700 uppercase tracking-wider">⚠️ Allergies — Do Not Administer</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.allergies.map(a => (
                    <span key={a} className="text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[
                { label:'Height', value: data.height ? `${data.height} cm` : '—' },
                { label:'Weight', value: data.weight ? `${data.weight} kg` : '—' },
                { label:'BMI',    value: bmi || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-sm font-bold text-slate-800">{value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${riskStyle(data.riskLevel)}`}>
              <Shield size={18} />
              <div className="flex-1">
                <p className="text-sm font-extrabold capitalize">{data.riskLevel || 'Low'} Risk Level</p>
                {data.healthScore != null && <p className="text-xs text-slate-500">Health Score: {data.healthScore}/100</p>}
              </div>
              {data.healthScore != null && (
                <span className="text-2xl font-extrabold">{data.healthScore}<span className="text-xs text-slate-400 font-normal">/100</span></span>
              )}
            </div>

            {data.chronicConditions?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Chronic Conditions</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.chronicConditions.map(c => (
                    <span key={c} className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {data.currentMedications?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Pill size={10} /> Current Medications
                </p>
                <div className="space-y-1.5">
                  {data.currentMedications.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-teal-600" />
                      <p className="text-xs font-semibold text-slate-700">
                        {m.name}{m.dosage && ` — ${m.dosage}`}{m.frequency && ` (${m.frequency})`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── THE FIX: was cyan-*, now teal-* to match the rest of the app ── */}
            {vitals.length > 0 && (
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3.5">
                <p className="text-[10px] font-bold text-teal-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Activity size={10} /> Latest Vitals
                  {data.latestVital?.recordedAt && (
                    <span className="font-normal text-teal-400">
                      · {new Date(data.latestVital.recordedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {vitals.map((v, i) => <span key={i} className="text-xs font-semibold text-teal-700">{v}</span>)}
                </div>
              </div>
            )}

            {data.emergencyContact?.name && (
              <div className="bg-slate-900 rounded-2xl p-4 text-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Emergency Contact</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">{data.emergencyContact.name}</p>
                    {data.emergencyContact.relation && <p className="text-xs text-slate-400">{data.emergencyContact.relation}</p>}
                    {data.emergencyContact.phone && <p className="text-sm font-bold text-emerald-400 mt-0.5">{data.emergencyContact.phone}</p>}
                  </div>
                  {data.emergencyContact.phone && (
                    <a href={`tel:${data.emergencyContact.phone}`}
                      className="btn-press px-3 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 shrink-0">
                      📞 Call
                    </a>
                  )}
                </div>
              </div>
            )}

            {data.publicDocuments?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <FileText size={10} /> Shared Documents
                </p>
                <div className="space-y-2">
                  {data.publicDocuments.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{d.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{d.type?.replace('_',' ')}</p>
                      </div>
                      {d.fileUrl && (
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 p-2 text-teal-600 hover:text-teal-800">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope size={16} className="text-white/80" />
            <p className="text-white font-semibold text-sm">Healthcare Professional?</p>
          </div>
          <p className="text-teal-100 text-xs mb-3 leading-relaxed">
            Sign in to access complete medical records, lab reports, vitals history and prescriptions.
          </p>
          <Link href="/login"
            className="btn-press flex items-center justify-center gap-2 w-full py-3 bg-white font-bold rounded-xl text-sm hover:bg-teal-50 transition-all text-teal-600">
            Sign In for Full Medical Records <ChevronRight size={14} />
          </Link>
        </div>

        <div className="text-center pb-4">
          <p className="text-white font-bold text-sm">Dana Shivam Heart & Super Speciality Hospital</p>
          <a href="tel:+919116003461" className="text-emerald-300 text-sm font-bold block mt-1">📞 +91 91160 03461</a>
          <div className="flex items-center justify-center gap-1.5 text-white/40 text-[10px] mt-3">
            <CheckCircle size={10} />
            <span>Verified patient health card</span>
          </div>
          <p className="text-teal-100/60 text-[10px] mt-1">For emergencies call 112</p>
        </div>
      </div>
    </div>
  );
}