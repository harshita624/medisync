'use client';
import { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import axios from 'axios';
import Cookies from 'js-cookie';
import {
  Search, AlertTriangle, CheckCircle, Clock, Activity,
  ChevronDown, ChevronUp, Mic, MicOff, Loader2, Info, ArrowLeft, Sparkles,
} from 'lucide-react';

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api', withCredentials: true });
API.interceptors.request.use(cfg => {
  const t = Cookies.get('token') || (typeof window !== 'undefined' && localStorage.getItem('token'));
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
const ML = axios.create({ baseURL: process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000/api' });

const URGENCY = {
  emergency: { icon: AlertTriangle, label: "Emergency — Call 112 NOW",        bg: "bg-red-50 border-red-200",    dot: "bg-red-500",    text: "text-red-700"    },
  urgent:    { icon: Clock,         label: "Urgent — See a doctor today",      bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500", text: "text-orange-700" },
  routine:   { icon: CheckCircle,   label: "Routine — Schedule an appointment", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700" },
};

function localResult(payload) {
  const t = (payload.symptoms || '').toLowerCase();
  const isEm = ['chest pain',"can't breathe",'unconscious','seizure','stroke','severe bleeding'].some(x => t.includes(x));
  const isUr = !isEm && ['fever','vomit','blood','dizzy','infection','severe pain'].some(x => t.includes(x));
  const urgency = isEm ? 'emergency' : isUr ? 'urgent' : 'routine';
  const conditions = [];
  if (t.includes('headache')) conditions.push({ condition:'Tension headache / migraine', probability:'medium', description:'Headache may relate to stress, dehydration, eye strain, or migraine. Severe sudden headache needs urgent care.' });
  if (t.includes('fever'))    conditions.push({ condition:'Viral fever / acute infection', probability:'medium', description:'Fever should be assessed if high, persistent, or associated with rash or breathing trouble.' });
  if (!conditions.length) conditions.push({ condition: isEm ? 'Emergency warning pattern' : 'Symptom pattern requiring review', probability: isEm ? 'high' : isUr ? 'medium' : 'low', description:'Add more details for a more specific assessment.' });
  return { analysis: { urgency_level:urgency, urgency_reason:'Based on symptom analysis.', recommended_specialist: isEm?'Emergency physician':'General physician', see_doctor_within: isEm?'immediately':isUr?'24 hours':'1 week', possible_conditions:conditions, red_flags:['Chest pain','Difficulty breathing','Confusion','Severe bleeding'], home_care:['Rest','Stay hydrated','Monitor temperature','Seek care if symptoms worsen'] }, extracted_entities:{} };
}

function ConditionCard({ cond, idx }) {
  const [open, setOpen] = useState(idx === 0);
  const probColor = { high: 'bg-red-100 text-red-700 border-red-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', low: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return (
    <div className="bento overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <span className="font-bold text-slate-900 text-sm">{cond.condition}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${probColor[cond.probability] || probColor.low}`}>
            {cond.probability} likelihood
          </span>
          {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-600 border-t border-slate-100 pt-3 leading-relaxed">
          {cond.description || 'No description available.'}
        </div>
      )}
    </div>
  );
}

export default function SymptomCheckerPage() {
  const [symptoms,  setSymptoms]  = useState('');
  const [duration,  setDuration]  = useState('not specified');
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const [profile,   setProfile]   = useState(null);
  const recognitionRef = useRef(null);
  const voiceSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    API.get('/patient/profile').then(r => setProfile(r.data.patient)).catch(() => {});
  }, []);

  function toggleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = 'en-IN'; r.interimResults = false; r.continuous = false;
    r.onresult = e => setSymptoms(p => p ? `${p}, ${e.results[0][0].transcript}` : e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start(); recognitionRef.current = r; setListening(true);
  }

  async function check(e) {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setLoading(true); setResult(null);
    const payload = { symptoms: symptoms.trim(), age: profile?.age || null, gender: profile?.gender || 'not specified', duration, medical_history: profile?.chronicConditions || [] };
    try {
      const res = await ML.post('/symptom/check', payload, { timeout: 15000 });
      setResult(res.data);
    } catch {
      try {
        const res2 = await ML.post('/symptom/quick', { symptoms: payload.symptoms, age: payload.age }, { timeout: 5000 });
        setResult({ analysis: { urgency_level: res2.data.urgency||'routine', urgency_reason: res2.data.reason||'', recommended_specialist: res2.data.specialist||'', see_doctor_within: res2.data.see_doctor_within||'', possible_conditions: res2.data.conditions||[], red_flags:[], home_care: res2.data.home_care||[] }, extracted_entities:{} });
      } catch { setResult(localResult(payload)); }
    } finally { setLoading(false); }
  }

  const analysis  = result?.analysis || {};
  const urgencyCfg = URGENCY[analysis.urgency_level] || URGENCY.routine;
  const UIcon      = urgencyCfg.icon;

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">Symptom Checker</h1>
        <p className="text-slate-500 text-sm mt-1">Describe your symptoms — AI analyses and suggests next steps</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        {!result && (
          <form onSubmit={check} className="med-card rounded-3xl p-7 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl med-icon-bubble flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900">AI Symptom Analysis</p>
                <p className="text-xs text-slate-400">Powered by clinical decision support</p>
              </div>
            </div>

            {profile && (
              <div className="flex items-start gap-2.5 p-3.5 bg-teal-50 border border-teal-100 rounded-2xl">
                <Info size={14} className="text-teal-500 mt-0.5 shrink-0" />
                <p className="text-xs text-teal-700 leading-relaxed">
                  <strong>Profile context:</strong> Age {profile.age||'—'}, Blood group {profile.bloodGroup||'—'}, Conditions: {profile.chronicConditions?.join(', ')||'none'}.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Describe your symptoms <span className="text-red-400">*</span></label>
              <div className="relative">
                <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={4} required
                  placeholder="e.g. I have had a fever of 38°C since yesterday, along with a headache and sore throat…"
                  className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none transition-all" />
                {voiceSupported && (
                  <button type="button" onClick={toggleVoice}
                    className={`absolute right-3 top-3 p-2 rounded-xl transition-all ${listening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-teal-100 hover:text-teal-600'}`}>
                    {listening ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>
                )}
              </div>
              {listening && (
                <p className="text-xs text-red-500 mt-1 animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Recording… speak now
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">How long have you had these symptoms?</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                <option value="not specified">Not sure</option>
                <option value="a few hours">A few hours</option>
                <option value="since yesterday">Since yesterday</option>
                <option value="2-3 days">2–3 days</option>
                <option value="about a week">About a week</option>
                <option value="more than a week">More than a week</option>
                <option value="over a month">Over a month</option>
              </select>
            </div>

            <button type="submit" disabled={loading || !symptoms.trim()}
              className="btn-press w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-teal-400/30"
              style={{ background: "var(--grad-primary)" }}>
              {loading ? <><Loader2 size={18} className="animate-spin" /> Analysing…</> : <><Search size={18} /> Check Symptoms</>}
            </button>
            <p className="text-xs text-slate-400 text-center">For emergencies call <strong className="text-red-500">112</strong> immediately. Not a replacement for professional advice.</p>
          </form>
        )}

        {result && (
          <div className="space-y-5">
            <button onClick={() => setResult(null)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors">
              <ArrowLeft size={16} /> Check different symptoms
            </button>

            {analysis.urgency_level && (
              <div className={`flex items-center gap-4 p-5 rounded-3xl border-2 ${urgencyCfg.bg}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${urgencyCfg.dot}`}>
                  <UIcon size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-base ${urgencyCfg.text}`}>{urgencyCfg.label}</p>
                  {analysis.urgency_reason && <p className="text-sm text-slate-600 mt-0.5">{analysis.urgency_reason}</p>}
                </div>
                {analysis.urgency_level === 'emergency' && (
                  <a href="tel:112" className="btn-press shrink-0 px-5 py-2.5 bg-red-600 text-white rounded-2xl text-sm font-bold hover:bg-red-700 shadow-lg">📞 112</a>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                analysis.recommended_specialist && { label:"See a", value:analysis.recommended_specialist },
                analysis.see_doctor_within && { label:"Timeline", value:analysis.see_doctor_within },
                result.extracted_entities?.symptoms?.length > 0 && { label:"Detected", value:`${result.extracted_entities.symptoms.length} symptoms` },
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} className="med-card rounded-2xl p-4">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">{label}</p>
                  <p className="font-bold text-slate-900 text-sm capitalize">{value}</p>
                </div>
              ))}
            </div>

            {analysis.possible_conditions?.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Activity size={16} className="text-teal-500" /> Possible Conditions</h3>
                <div className="space-y-2">{analysis.possible_conditions.map((c, i) => <ConditionCard key={i} cond={c} idx={i} />)}</div>
              </div>
            )}

            {analysis.red_flags?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-3xl p-5">
                <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2"><AlertTriangle size={15} /> Seek Care Immediately If You Also Have</h3>
                <ul className="space-y-2">
                  {analysis.red_flags.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.home_care?.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5">
                <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2"><CheckCircle size={15} /> Home Care While You Wait</h3>
                <ul className="space-y-2">
                  {analysis.home_care.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl p-4 leading-relaxed">
              <strong>Medical Disclaimer:</strong> This AI analysis is for informational purposes only and does not constitute medical advice, diagnosis, or treatment.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setResult(null)}
                className="flex-1 py-3 border-2 border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">
                Check Again
              </button>
              <a href="/patient/appointments"
                className="flex-1 py-3 rounded-2xl font-bold text-sm text-center text-white shadow-lg shadow-teal-400/30"
                style={{ background: "var(--grad-primary)" }}>
                Book Appointment →
              </a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}