'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { getPatientProfile } from '@/lib/api';
import {
  QrCode, AlertTriangle, Copy, Check, Shield,
  HeartPulse, Pill, FileText, Wifi, ExternalLink,
} from 'lucide-react';

export default function PatientQRPage() {
  const [patient,       setPatient]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [copied,        setCopied]        = useState(false);
  const [baseUrl,       setBaseUrl]       = useState('');
  const [isMobileReady, setIsMobileReady] = useState(false);

  useEffect(() => {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url    = (envUrl || origin).replace(/\/$/, '');
    setBaseUrl(url);
    setIsMobileReady(!url.includes('localhost') && !url.includes('127.0.0.1'));
    getPatientProfile()
      .then(r => setPatient(r.data.patient))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const patientId = patient?.patientId || '';
  const isTunnel  = baseUrl.includes('ngrok') || baseUrl.includes('trycloudflare');

  const qrData = patientId
    ? `${baseUrl}/patient-card/${patientId}${isTunnel ? '?ngrok-skip-browser-warning=true' : ''}`
    : '';

  const qrImageUrl = qrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}&bgcolor=FFFFFF&color=168997&margin=2&format=png`
    : null;

  function copy() {
    if (!qrData) return;
    navigator.clipboard.writeText(qrData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">QR Medical Packet</h1>
        <p className="text-slate-500 text-sm mt-1">
          Show this to any doctor or nurse — they see your health card instantly, no login required
        </p>
      </div>

      {!loading && (
        isMobileReady ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <Wifi size={18} className="text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">QR is active — scannable from any phone</p>
              <p className="text-xs text-emerald-600 mt-0.5">Anyone who scans sees your health card — no app or login needed</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">QR currently only works on this device</p>
                <p className="text-xs text-amber-700 leading-relaxed mb-3">
                  To let doctors scan from their phones, set up a tunnel to make the app publicly accessible.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-amber-100 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-bold text-amber-800">Step 1</p>
                    <code className="text-[11px] text-amber-900 font-mono block bg-amber-200/60 rounded px-2 py-1">ngrok http 3000</code>
                    <p className="text-[11px] text-amber-700">Copy the https URL it gives you</p>
                  </div>
                  <div className="bg-amber-100 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-bold text-amber-800">Step 2 — .env.local</p>
                    <code className="text-[11px] text-amber-900 font-mono block bg-amber-200/60 rounded px-2 py-1 leading-relaxed">
                      NEXT_PUBLIC_APP_URL=https://xxx.ngrok-free.app{'\n'}
                      BACKEND_URL=http://localhost:5000
                    </code>
                    <p className="text-[11px] text-amber-600 font-semibold">Restart dev server after saving.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {loading ? (
        <div className="med-card rounded-2xl p-16 text-center">
          <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Generating your QR code…</p>
        </div>
      ) : !patient ? (
        <div className="med-card rounded-2xl p-16 text-center">
          <QrCode size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">Patient profile not found</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-start">

          <div className="med-card rounded-2xl p-7 flex flex-col items-center min-w-[300px]">
            {qrData && (
              <a href={qrData} target="_blank" rel="noreferrer"
                className="text-xs font-semibold mb-3 hover:underline flex items-center gap-1" style={{ color: '#168997' }}>
                <ExternalLink size={11} /> Preview your health card
              </a>
            )}
            <div className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm mb-5">
              {qrImageUrl
                ? <img src={qrImageUrl} alt="QR Code" width={220} height={220} className="rounded-xl" />
                : <div className="w-[220px] h-[220px] bg-slate-50 rounded-xl flex items-center justify-center"><QrCode size={60} className="text-slate-200" /></div>
              }
            </div>
            <p className="font-extrabold text-slate-900 text-xl">{patient.user?.name}</p>
            <p className="text-sm font-semibold mt-1 font-mono" style={{ color: '#168997' }}>{patient.patientId}</p>
            <button onClick={copy}
              className="btn-press mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-all">
              {copied ? <><Check size={13} className="text-emerald-500" /> Copied!</> : <><Copy size={13} /> Copy card link</>}
            </button>
            <div className="mt-4 flex items-start gap-2 bg-teal-50 rounded-xl p-3 w-full border border-teal-100">
              <Shield size={13} className="text-teal-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Scanning opens your health card — blood group, allergies, emergency contact visible without login.
                Full records require a doctor to sign in.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="med-card rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <HeartPulse size={12} /> What Your Health Card Shows
              </p>
              <div className="space-y-2.5">
                {[
                  { emoji:'🩸', label:'Blood Group',         value: patient.bloodGroup || 'Not set',                          ok: !!patient.bloodGroup && patient.bloodGroup !== 'Unknown' },
                  { emoji:'⚠️', label:'Allergies',           value: patient.allergies?.length ? patient.allergies.join(', ') : 'None recorded',    ok: true  },
                  { emoji:'❤️', label:'Chronic Conditions',  value: patient.chronicConditions?.length ? patient.chronicConditions.join(', ') : 'None', ok: true },
                  { emoji:'💊', label:'Medications',         value: patient.currentMedications?.length ? `${patient.currentMedications.length} listed` : 'None', ok: true },
                  { emoji:'📞', label:'Emergency Contact',   value: patient.emergencyContact?.name ? `${patient.emergencyContact.name} — ${patient.emergencyContact.phone}` : 'Not set', ok: !!patient.emergencyContact?.name },
                ].map(({ emoji, label, value, ok }) => (
                  <div key={label} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm shrink-0 mt-0.5">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400">{label}</p>
                      <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
                    </div>
                    {!ok && <span className="text-[10px] text-amber-500 font-semibold bg-amber-50 px-2 py-0.5 rounded-full shrink-0">Add this</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-4">
              <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                <Shield size={12} /> Private — Requires Doctor Login
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Full medical records','Lab reports','Vitals history','Appointments','Bills','Insurance claims'].map(item => (
                  <span key={item} className="text-[11px] bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-full">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}