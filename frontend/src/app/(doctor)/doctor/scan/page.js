'use client';
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/shared/DashboardLayout';
import Link from "next/link";
import { API } from '@/lib/api';
import {
  QrCode, Camera, CameraOff, Search, User, FileText, Activity,
  Loader2, AlertCircle, CheckCircle, X, Shield, HeartPulse,
  Pill, ExternalLink, ScanLine, Bot, RefreshCw,
} from 'lucide-react';

export default function ScanQRPage() {
  const searchParams = useSearchParams();

  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const detectorRef  = useRef(null);
  const scanLoop     = useRef(null);
  const videoMounted = useRef(false);

  const [step,       setStep]       = useState('idle');
  const [pidInput,   setPidInput]   = useState('');
  const [cameraOn,   setCameraOn]   = useState(false);
  const [cameraErr,  setCameraErr]  = useState('');
  const [packet,     setPacket]     = useState(null);
  const [error,      setError]      = useState('');
  const [activeTab,  setActiveTab]  = useState('overview');

  /* ── Auto-load if URL has ?pid= ── */
  useEffect(() => {
    const pid = searchParams.get('pid');
    if (pid) { setPidInput(pid); fetchPatient(pid); }
  }, [searchParams]); // eslint-disable-line

  /* ── Fetch patient packet ── */
  const fetchPatient = useCallback(async (raw) => {
    let pid = (raw || '').trim();
    try { const u = new URL(pid); pid = u.searchParams.get('pid') || pid; } catch {}
    if (!pid) { setError('Please enter a valid Patient ID.'); return; }
    setStep('loading'); setError(''); setPacket(null);
    try {
      const res = await API.get(`/doctor/scan-patient?pid=${encodeURIComponent(pid)}`);
      setPacket(res.data);
      setStep('result');
      setActiveTab('overview');
    } catch (err) {
      setError(err.response?.data?.message || `Patient "${pid}" not found.`);
      setStep('error');
    }
  }, []);

  /* ── Attach stream to video element once mounted ── */
  const attachStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  /* ── Start camera ── */
  const startCamera = useCallback(async () => {
    setCameraErr('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraErr('Camera not supported in this browser. Use Chrome or Edge.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      // Attach immediately if video element already exists
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setCameraOn(true);

      // Start scanning loop if BarcodeDetector is available
      if ('BarcodeDetector' in window) {
        try {
          detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          scanLoop.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2 || !streamRef.current) return;
            try {
              const codes = await detectorRef.current.detect(videoRef.current);
              if (codes.length > 0) {
                const raw = codes[0].rawValue;
                stopCamera();
                setPidInput(raw);
                fetchPatient(raw);
              }
            } catch {}
          }, 600);
        } catch {}
      } else {
        setCameraErr('Auto-scan not supported in this browser. Camera is live — copy the QR link and paste it below instead.');
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraErr('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraErr('No camera found on this device.');
      } else {
        setCameraErr(`Camera error: ${err.message}`);
      }
    }
  }, [fetchPatient]);

  /* ── Stop camera ── */
  const stopCamera = useCallback(() => {
    clearInterval(scanLoop.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  /* ── When video element mounts while stream is already running ── */
  const videoCallbackRef = useCallback(node => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => () => stopCamera(), [stopCamera]);

  function reset() {
    stopCamera();
    setPacket(null);
    setPidInput('');
    setError('');
    setStep('idle');
  }

  /* ── Helper ── */
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const pat = packet?.patient;

  /* ═══════════════════════════════════════════════════ RENDER ══════════════ */
  return (
    <DashboardLayout role="doctor">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-syne font-bold text-slate-900">Scan Patient QR</h1>
        <p className="text-slate-500 text-sm mt-1">
          Scan a patient's QR code or paste the link to access their full medical packet instantly
        </p>
      </div>

      {/* ── INPUT STEP ── */}
      {(step === 'idle' || step === 'error') && (
        <div className="grid lg:grid-cols-2 gap-5 mb-6">

          {/* Manual / paste entry */}
          <div className="med-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl med-icon-bubble flex items-center justify-center shrink-0">
                <QrCode size={20} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Enter Patient ID or Paste QR Link</p>
                <p className="text-xs text-slate-400 mt-0.5">Type the ID or paste the full scanned URL</p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                value={pidInput}
                onChange={e => setPidInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchPatient(pidInput)}
                placeholder="PAT-XXXXXXXX  or  https://….ngrok-free.app/doctor/scan?pid=PAT-…"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm font-mono
                  focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                  placeholder:font-sans placeholder:text-slate-400"
              />
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-2xl">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <button
                onClick={() => fetchPatient(pidInput)}
                disabled={!pidInput.trim()}
                className="btn-press w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                  text-sm font-bold text-white disabled:opacity-40 shadow-lg transition-all"
                style={{ background: 'var(--grad-primary)' }}>
                <Search size={16} /> Open Patient Packet
              </button>
            </div>
          </div>

          {/* Camera */}
          <div className="med-card rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-cyan-100 flex items-center justify-center shrink-0">
                <Camera size={20} className="text-cyan-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Scan with Camera</p>
                <p className="text-xs text-slate-400 mt-0.5">Works in Chrome / Edge (BarcodeDetector API)</p>
              </div>
            </div>

            {/* Video container — always rendered so the ref is stable */}
            <div className="relative flex-1 min-h-[220px] bg-slate-900 rounded-2xl overflow-hidden mb-4">
              {/* The video element is always in the DOM */}
              <video
                ref={videoCallbackRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ display: cameraOn ? 'block' : 'none' }}
              />

              {/* Overlay when camera is OFF */}
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                    <CameraOff size={30} className="text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400 font-semibold">Camera is off</p>
                  <p className="text-xs text-slate-500 text-center max-w-[200px]">
                    Click Start Camera to scan a patient QR code
                  </p>
                </div>
              )}

              {/* Scanning overlay when camera is ON */}
              {cameraOn && (
                <>
                  {/* Corner brackets */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-44 h-44">
                      <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
                      <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
                      <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
                      <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />
                      {/* Scanning line */}
                      <div className="absolute left-2 right-2 top-0 h-0.5 bg-teal-400 shadow-lg shadow-teal-400/80"
                        style={{ animation: 'scanLine 2s ease-in-out infinite' }} />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-xs text-teal-300 font-bold bg-black/40 px-3 py-1 rounded-full">
                      🟢 Camera live — point at QR code
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Scan line animation */}
            <style jsx>{`
              @keyframes scanLine {
                0%   { top: 0;    opacity: 1; }
                50%  { top: calc(100% - 2px); opacity: 0.6; }
                100% { top: 0;    opacity: 1; }
              }
            `}</style>

            {cameraErr && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">{cameraErr}</p>
              </div>
            )}

            <button
              onClick={cameraOn ? stopCamera : startCamera}
              className={`btn-press w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                text-sm font-bold transition-all ${cameraOn
                  ? 'bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100'
                  : 'text-white shadow-lg'
                }`}
              style={cameraOn ? {} : { background: 'var(--grad-primary)' }}>
              {cameraOn
                ? <><CameraOff size={16} /> Stop Camera</>
                : <><Camera size={16} /> Start Camera</>
              }
            </button>

            <p className="text-[11px] text-slate-400 text-center mt-2">
              Auto-scan requires Chrome or Edge. On other browsers, paste the QR link manually.
            </p>
          </div>
        </div>
      )}

      {/* ── LOADING STEP ── */}
      {step === 'loading' && (
        <div className="med-card rounded-3xl p-20 text-center">
          <div className="w-16 h-16 rounded-2xl med-icon-bubble flex items-center justify-center mx-auto mb-4">
            <Loader2 size={28} className="animate-spin text-white" />
          </div>
          <p className="font-bold text-slate-900">Loading patient medical packet…</p>
          <p className="text-slate-400 text-sm mt-1">Fetching records, vitals, and documents</p>
        </div>
      )}

      {/* ── RESULT STEP ── */}
      {step === 'result' && pat && (
        <div className="space-y-5">

          {/* Patient header */}
          <div className="med-card rounded-3xl p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl med-icon-bubble flex items-center
                justify-center text-white text-xl font-extrabold shadow-md shrink-0 overflow-hidden">
                {pat.user?.avatar
                  ? <img src={pat.user.avatar} alt="" className="w-full h-full object-cover" />
                  : pat.user?.name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-syne font-extrabold text-slate-900 text-lg">{pat.user?.name}</h2>
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 border border-teal-100
                    px-2 py-0.5 rounded-full font-mono">
                    {pat.patientId}
                  </span>
                  {pat.riskLevel && pat.riskLevel !== 'low' && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      pat.riskLevel === 'critical' ? 'bg-red-100 text-red-600' :
                      pat.riskLevel === 'high'     ? 'bg-orange-100 text-orange-600' :
                                                     'bg-amber-100 text-amber-600'
                    }`}>{pat.riskLevel} risk</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                  {pat.age        && <span>{pat.age} yrs</span>}
                  {pat.gender     && <span className="capitalize">{pat.gender}</span>}
                  {pat.bloodGroup && <span className="font-bold text-red-600">Blood: {pat.bloodGroup}</span>}
                  {pat.user?.phone && <span>📞 {pat.user.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/doctor/chat?patientId=${pat._id}`}
                className="btn-press flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: 'var(--grad-primary)' }}>
                <Bot size={13} /> Open in AI
              </Link>
              <button onClick={reset}
                className="btn-press px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600
                  hover:bg-slate-200 transition-all flex items-center gap-1.5">
                <RefreshCw size={13} /> New Scan
              </button>
            </div>
          </div>

          {/* Allergies alert */}
          {pat.allergies?.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-extrabold text-red-700 uppercase tracking-wider mb-2">
                  ⚠️ Allergies — Do Not Administer
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pat.allergies.map(a => (
                    <span key={a} className="text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="med-card rounded-3xl overflow-hidden">
            <div className="flex border-b border-slate-100 overflow-x-auto">
              {[
                { key: 'overview',  label: 'Overview',  icon: User      },
                { key: 'records',   label: 'Records',   icon: FileText  },
                { key: 'vitals',    label: 'Vitals',    icon: Activity  },
                { key: 'documents', label: 'Documents', icon: ScanLine  },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`btn-press flex items-center gap-2 px-5 py-3.5 text-sm font-bold whitespace-nowrap
                    border-b-2 transition-all ${activeTab === tab.key
                      ? 'border-teal-500 text-teal-700 bg-teal-50/30'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}>
                  <tab.icon size={14} /> {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">

              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Age',          value: pat.age ? `${pat.age} yrs` : '—'              },
                      { label: 'Gender',       value: pat.gender || '—'                              },
                      { label: 'Blood Group',  value: pat.bloodGroup || '—'                          },
                      { label: 'Height',       value: pat.height ? `${pat.height} cm` : '—'         },
                      { label: 'Weight',       value: pat.weight ? `${pat.weight} kg` : '—'         },
                      { label: 'Health Score', value: pat.healthScore != null ? `${pat.healthScore}/100` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                        <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                        <p className="text-sm font-bold text-slate-800 capitalize">{value}</p>
                      </div>
                    ))}
                  </div>

                  {pat.currentMedications?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Pill size={11} /> Current Medications
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pat.currentMedications.map((m, i) => (
                          <span key={i} className="text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-1 rounded-full">
                            {m.name}{m.dosage && ` — ${m.dosage}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {pat.chronicConditions?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Chronic Conditions</p>
                      <div className="flex flex-wrap gap-2">
                        {pat.chronicConditions.map(c => (
                          <span key={c} className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {pat.emergencyContact?.name && (
                    <div className="bg-slate-900 rounded-2xl p-4 text-white">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Emergency Contact</p>
                      <p className="font-bold">{pat.emergencyContact.name}</p>
                      <p className="text-xs text-slate-400">{pat.emergencyContact.relation}</p>
                      <p className="text-sm font-bold text-emerald-400 mt-1">{pat.emergencyContact.phone}</p>
                    </div>
                  )}
                </div>
              )}

              {/* RECORDS */}
              {activeTab === 'records' && (
                <div className="space-y-3">
                  {!packet?.records?.length ? (
                    <div className="text-center py-10">
                      <FileText size={40} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-400 text-sm">No medical records yet</p>
                    </div>
                  ) : packet.records.map((r, i) => (
                    <div key={i} className="bento p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-slate-900 text-sm">{r.diagnosis || r.chiefComplaint || 'Consultation'}</p>
                        <span className="text-xs text-slate-400">{fmtDate(r.visitDate)}</span>
                      </div>
                      {r.symptoms?.length > 0 && (
                        <p className="text-xs text-slate-500 mb-2">Symptoms: {r.symptoms.join(', ')}</p>
                      )}
                      {r.prescription?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {r.prescription.map((p, pi) => (
                            <span key={pi} className="text-[11px] bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full">
                              {p.medicine}{p.dosage && ` ${p.dosage}`}
                            </span>
                          ))}
                        </div>
                      )}
                      {r.notes && (
                        <p className="text-xs text-slate-500 mt-2 italic line-clamp-2">"{r.notes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* VITALS */}
              {activeTab === 'vitals' && (
                <div>
                  {!packet?.vitals?.length ? (
                    <div className="text-center py-10">
                      <Activity size={40} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-400 text-sm">No vitals recorded yet</p>
                    </div>
                  ) : (() => {
                    const lv = [...packet.vitals].sort((a, b) =>
                      new Date(b.recordedAt) - new Date(a.recordedAt))[0];
                    return (
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                          Latest — {fmtDate(lv.recordedAt)}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'Blood Pressure', value: lv.bloodPressure || (lv.systolic ? `${lv.systolic}/${lv.diastolic}` : null) },
                            { label: 'Heart Rate',     value: lv.heartRate     ? `${lv.heartRate} bpm` : null },
                            { label: 'Temperature',   value: lv.temperature   ? `${lv.temperature}°C`  : null },
                            { label: 'SpO₂',           value: lv.oxygenSaturation ? `${lv.oxygenSaturation}%` : null },
                            { label: 'Glucose',        value: lv.glucose       ? `${lv.glucose} mg/dL` : null },
                            { label: 'BMI',            value: lv.bmi           ? String(lv.bmi)        : null },
                          ].filter(v => v.value).map(({ label, value }) => (
                            <div key={label} className="bg-teal-50 rounded-2xl px-3 py-2.5 text-center border border-teal-100">
                              <p className="text-[10px] text-teal-400">{label}</p>
                              <p className="text-sm font-bold text-teal-700 mt-0.5">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* DOCUMENTS */}
              {activeTab === 'documents' && (
                <div className="space-y-3">
                  {!packet?.documents?.length ? (
                    <div className="text-center py-10">
                      <ScanLine size={40} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-400 text-sm">No documents uploaded</p>
                    </div>
                  ) : packet.documents.map((d, i) => (
                    <div key={i} className="bento px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{d.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{d.type?.replace('_', ' ')} · {d.visibility}</p>
                        {d.aiSummary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.aiSummary}</p>}
                      </div>
                      {d.fileUrl && (
                        <a href={d.fileUrl} target="_blank" rel="noreferrer"
                          className="p-2 text-teal-500 hover:text-teal-700 shrink-0 transition-colors">
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pb-2">
            <Shield size={12} className="text-emerald-400" />
            Patient packet accessed via authenticated QR scan · Audit logged
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}