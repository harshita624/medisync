'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { API } from '@/lib/api';
import {
  Activity, AlertTriangle, Bot, Calendar, ChevronDown, ChevronUp,
  ClipboardList, FileSearch, FileText, HeartPulse, Loader2, Menu,
  MessageSquare, Mic, MicOff, Paperclip, Pill, Plus, Search, Send,
  ShieldAlert, Sparkles, Stethoscope, Trash2, TrendingUp, User,
  Users, Volume2, VolumeX, X,
} from 'lucide-react';

// ── Role-specific quick prompts ──────────────────────────────────────────────
const PATIENT_PROMPTS = [
  { icon: Calendar,      text: 'Upcoming appointments',      prompt: 'What are my upcoming appointments?' },
  { icon: Activity,      text: 'Latest vitals summary',      prompt: 'Summarise my latest vitals' },
  { icon: Stethoscope,   text: 'Chest pain — which doctor?', prompt: 'Which Dana Shivam doctor should I see for chest pain?' },
  { icon: ClipboardList, text: 'Health packages',            prompt: 'Tell me about Dana Shivam health packages' },
  { icon: Pill,          text: 'Current medications',        prompt: 'What are my current medications?' },
];

const DOCTOR_PROMPTS = [
  { icon: ClipboardList, text: 'Full patient summary',      prompt: 'Give me a complete clinical summary of this patient including risk factors, vitals, medications, and recommended actions.' },
  { icon: FileText,      text: 'Draft SOAP note',           prompt: "Draft a structured SOAP note for today's consultation based on this patient's history and recent visit." },
  { icon: Stethoscope,   text: 'Differential diagnosis',    prompt: "Provide a differential diagnosis with ICD-10 codes based on this patient's symptoms and history." },
  { icon: ShieldAlert,   text: 'Prescription safety check', prompt: 'Check prescription safety: review all current medications for drug interactions, allergy conflicts, and contraindications.' },
  { icon: Activity,      text: 'Vitals analysis',           prompt: "Analyse this patient's latest vitals, flag any abnormalities, and recommend clinical actions." },
  { icon: TrendingUp,    text: 'Treatment progress',        prompt: "How is this patient's treatment progressing? Compare recent vitals and visits to identify trends." },
  { icon: FileSearch,    text: 'Interpret lab report',      prompt: 'Interpret the latest lab report: list abnormal values, their clinical significance, and suggested next steps.' },
  { icon: Calendar,      text: "Today's queue",             prompt: "Show my today's complete patient queue, appointment schedule, and waiting list status." },
  { icon: Users,         text: 'High risk patients',        prompt: 'Which of my patients are high risk or critical right now and need priority attention?' },
  { icon: HeartPulse,    text: 'Follow-up compliance',      prompt: 'Which patients have missed follow-ups or are not adhering to their treatment plans?' },
  { icon: FileText,      text: 'Discharge summary',         prompt: 'Generate a discharge summary and follow-up plan for this patient.' },
];

// ── Role-specific theme tokens (full literal class strings so Tailwind's
//    scanner picks them up regardless of dynamic assembly) ──────────────────
function getRoleTheme(role) {
  const isDoctor = role === 'doctor';
  return {
    isDoctor,
    grad: isDoctor
      ? 'linear-gradient(135deg, var(--emerald), var(--teal-dark))'
      : 'var(--grad-primary)',
    HeaderIcon: isDoctor ? Stethoscope : Bot,
    headerBg: isDoctor ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'med-icon-bubble',
    accentText: isDoctor ? 'text-emerald-600' : 'text-teal-600',
    accentTextDark: isDoctor ? 'text-emerald-700' : 'text-teal-700',
    accentBg: isDoctor ? 'bg-emerald-50' : 'bg-teal-50',
    accentBorder: isDoctor ? 'border-emerald-100' : 'border-teal-100',
    accentBorderStrong: isDoctor ? 'border-emerald-200' : 'border-teal-200',
    dotColor: isDoctor ? 'bg-emerald-400' : 'bg-teal-400',
    activeNavClasses: isDoctor ? 'bg-emerald-50 border border-emerald-200' : 'hb-active-nav',
    activeNavTextClasses: isDoctor ? 'text-emerald-700 font-semibold' : 'font-semibold',
    promptHoverClasses: isDoctor
      ? 'hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50'
      : 'hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50',
    micActiveBorder: 'border-red-300 bg-red-50 text-red-500',
    micIdleClasses: isDoctor
      ? 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-400'
      : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50 text-gray-400',
    ttsActiveClasses: isDoctor
      ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
      : 'border-teal-300 bg-teal-50 text-teal-600',
    ttsIdleClasses: 'border-gray-200 text-gray-400',
    focusClasses: isDoctor
      ? 'focus:ring-emerald-400 focus:border-emerald-400'
      : 'focus:ring-teal-400 focus:border-teal-400',
    typingDotClasses: isDoctor ? 'bg-emerald-400' : 'bg-teal-400',
    title: isDoctor ? 'Clinical Decision Support' : 'MediSync AI — Dana Shivam Hospital',
  };
}

// ── Patient lookup panel (doctor mode only) ──────────────────────────────────
function PatientLookup({ selectedPatient, onSelect, onClear }) {
  const [q,        setQ]        = useState('');
  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    API.get('/doctor/patients')
      .then(r => setPatients(r.data.patients || []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    p.user?.name?.toLowerCase().includes(q.toLowerCase()) ||
    p.patientId?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="border-t border-gray-100 shrink-0">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Users size={12} />
          Patient Context
          {selectedPatient && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1" />}
        </p>
        <div className="flex items-center gap-1">
          {selectedPatient && (
            <button onClick={e => { e.stopPropagation(); onClear(); }} className="text-gray-300 hover:text-red-400 p-0.5 rounded">
              <X size={12} />
            </button>
          )}
          {expanded ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {selectedPatient ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {selectedPatient.user?.name?.[0]?.toUpperCase() || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-800 truncate">{selectedPatient.user?.name}</p>
                  <p className="text-xs text-emerald-600">{selectedPatient.patientId}</p>
                </div>
                {selectedPatient.riskLevel && selectedPatient.riskLevel !== 'low' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedPatient.riskLevel === 'critical' ? 'bg-red-100 text-red-600' :
                    selectedPatient.riskLevel === 'high'     ? 'bg-orange-100 text-orange-600' :
                                                               'bg-amber-100 text-amber-600'
                  }`}>{selectedPatient.riskLevel}</span>
                )}
              </div>
              {selectedPatient.allergies?.length > 0 && (
                <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle size={10} /> Allergies: {selectedPatient.allergies.slice(0,3).join(', ')}
                </p>
              )}
              {selectedPatient.chronicConditions?.length > 0 && (
                <p className="text-[10px] text-slate-600 mt-0.5">Conditions: {selectedPatient.chronicConditions.slice(0,3).join(', ')}</p>
              )}
              <p className="text-[10px] text-emerald-600 mt-2">AI has full access to records, vitals, prescriptions, reports and documents.</p>
              <button onClick={onClear} className="mt-1 text-xs text-emerald-600 hover:text-red-500 font-semibold">Clear patient</button>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search patients…"
                  className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
              {loading ? (
                <div className="py-4 flex justify-center"><Loader2 size={14} className="animate-spin text-gray-300" /></div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filtered.map(p => (
                    <button
                      key={p._id}
                      onClick={() => onSelect(p)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{p.user?.name}</p>
                          <p className="text-xs text-gray-400">{p.patientId}</p>
                        </div>
                        {p.riskLevel && p.riskLevel !== 'low' && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            p.riskLevel === 'critical' ? 'bg-red-100 text-red-600' :
                            p.riskLevel === 'high'     ? 'bg-orange-100 text-orange-600' :
                                                         'bg-amber-100 text-amber-600'
                          }`}>{p.riskLevel}</span>
                        )}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">{q ? 'No patients match' : 'No connected patients yet'}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Message bubble (shared, role-aware) ──────────────────────────────────────
function ChatBubble({ msg, theme }) {
  const isUser  = msg.role === 'user';
  const content = (msg.content || '').trim();
  if (!content && !msg.fileName) return null;

  const renderContent = text =>
    text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={i} className="block leading-relaxed">
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
              : <span key={j}>{part}</span>
          )}
        </span>
      );
    });

  return (
    <div className={`flex gap-2 sm:gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
        isUser
          ? (theme.isDoctor ? 'bg-emerald-500' : 'bg-teal-500')
          : (theme.isDoctor ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'med-icon-bubble')
      }`}>
        {isUser ? <User size={13} className="text-white" /> : <Bot size={13} className="text-white" />}
      </div>
      <div className={`max-w-[85%] sm:max-w-[78%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {msg.fileName && (
          <span className={`text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
            isUser ? (theme.isDoctor ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700') : 'bg-slate-100 text-slate-600'
          }`}>
            <FileText size={10} /> {msg.fileName}
          </span>
        )}
        {content && (
          <div
            className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-sm ${
              isUser ? 'text-white rounded-tr-sm shadow-md' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
            }`}
            style={isUser ? { background: theme.grad } : {}}
          >
            {renderContent(content)}
          </div>
        )}
        {msg.createdAt && (
          <span className="text-[11px] text-gray-400 px-1">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT — used for both /patient/chat and /doctor/chat
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatAssistant({ role = 'patient' }) {
  const theme    = getRoleTheme(role);
  const isDoctor = theme.isDoctor;
  const searchParams = useSearchParams();

  const [sessions,        setSessions]        = useState([]);
  const [activeSession,   setActiveSession]   = useState(null);
  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState('');
  const [file,            setFile]            = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingChat,     setLoadingChat]     = useState(false);
  const [sending,         setSending]         = useState(false);
  const [isTyping,        setIsTyping]        = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null); // doctor-only
  const [isListening,     setIsListening]     = useState(false);
  const [voiceOk,         setVoiceOk]         = useState(false);
  const [transcript,      setTranscript]      = useState('');
  const [tts,             setTts]             = useState(false);
  const [speaking,        setSpeaking]        = useState(false);
  const [sidebarOpen,     setSidebarOpen]     = useState(false);

  const endRef         = useRef(null);
  const textareaRef    = useRef(null);
  const fileRef        = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef       = useRef(null);
  const sendingRef     = useRef(false);
  const sendMsgRef     = useRef(null);
  const sessionRef     = useRef(null);

  useEffect(() => { sessionRef.current = activeSession; }, [activeSession]);

  // ── Mount: load sessions + set up speech ────────────────────────────────
  useEffect(() => {
    fetchSessions();

    synthRef.current = window.speechSynthesis;
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceOk(true);
      const r = new SR();
      r.continuous = false; r.interimResults = true; r.lang = 'en-IN';
      r.onresult = e => {
        const txt = Array.from(e.results).map(x => x[0].transcript).join('');
        setTranscript(txt);
        if (e.results[e.results.length - 1].isFinal) {
          setTranscript(''); setIsListening(false);
          sendMsgRef.current?.(txt);
        }
      };
      r.onerror = () => { setIsListening(false); setTranscript(''); };
      r.onend   = () => setIsListening(false);
      recognitionRef.current = r;
    }
    return () => {
      synthRef.current?.cancel?.();
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []); // eslint-disable-line

  // ── Doctor mode: preselect patient from ?patientId= in URL ─────────────
  useEffect(() => {
    if (!isDoctor) return;
    const patientId = searchParams.get('patientId');
    if (!patientId || selectedPatient) return;
    API.get('/doctor/patients')
      .then(r => {
        const p = (r.data.patients || []).find(p => p._id === patientId || p.user?._id === patientId);
        if (p) setSelectedPatient(p);
      }).catch(() => {});
  }, [searchParams]); // eslint-disable-line

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, isTyping]);

  async function fetchSessions() {
    setLoadingSessions(true);
    try {
      const res  = await API.get('/chat/sessions');
      const list = res.data.sessions || [];
      setSessions(list);
      if (!isDoctor && list.length > 0) {
        // Patient mode auto-loads the most recent session; doctor mode waits for explicit selection
        loadSession(list[0]._id);
      }
    } catch (err) {
      console.error('Sessions fetch failed:', err.message);
      if (!isDoctor && err.response?.status === 404) {
        createSession();
      }
    } finally {
      setLoadingSessions(false);
    }
  }

  async function createSession() {
    const res  = await API.post('/chat/session', { role });
    const chat = res.data.chat;
    setSessions(prev => [chat, ...prev]);
    setActiveSession(chat);
    sessionRef.current = chat;
    setMessages([]);
    return chat;
  }

  async function newChat() {
    if (sending) return;
    setFile(null);
    setSidebarOpen(false);
    await createSession();
  }

  async function loadSession(id) {
    if (sendingRef.current) return;
    setLoadingChat(true);
    setFile(null);
    setSidebarOpen(false);
    try {
      const res = await API.get(`/chat/session/${id}`);
      setActiveSession(res.data.chat);
      sessionRef.current = res.data.chat;
      setMessages(res.data.chat.messages || []);
    } catch (err) {
      console.error('Could not load session:', err.message);
      setActiveSession(null);
      sessionRef.current = null;
      setMessages([]);
    } finally {
      setLoadingChat(false);
    }
  }

  async function deleteSession(e, id) {
    e.stopPropagation();
    await API.delete(`/chat/session/${id}`).catch(() => {});
    const updated = sessions.filter(s => s._id !== id);
    setSessions(updated);
    if (activeSession?._id === id) {
      setActiveSession(null);
      sessionRef.current = null;
      setMessages([]);
      if (!isDoctor && updated.length > 0) {
        loadSession(updated[0]._id);
      }
    }
  }

  function speakText(text) {
    if (!synthRef.current || !tts || !text) return;
    synthRef.current.cancel();
    const clean = text.replace(/[*_#`━•]/g,'').replace(/\n+/g,'. ').slice(0,400);
    const u     = new SpeechSynthesisUtterance(clean);
    u.rate = 0.9; u.pitch = 1.0; u.lang = 'en-IN';
    const voices  = synthRef.current.getVoices();
    const enVoice = voices.find(v=>v.lang==='en-IN') || voices.find(v=>v.lang.startsWith('en')&&v.localService) || voices.find(v=>v.lang.startsWith('en')) || voices[0];
    if (enVoice) u.voice = enVoice;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setTimeout(() => synthRef.current?.speak(u), 100);
  }

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); }
    else { setTranscript(''); try { recognitionRef.current.start(); setIsListening(true); } catch {} }
  }

  const sendMessage = useCallback(async (voiceText) => {
    const text    = typeof voiceText === 'string' ? voiceText.trim() : input.trim();
    const curFile = file;
    if ((!text && !curFile) || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setInput('');
    setFile(null);
    setTranscript('');
    setIsListening(false);
    if (textareaRef.current) textareaRef.current.style.height = '44px';

    let session = sessionRef.current;
    if (!session?._id) {
      try { session = await createSession(); }
      catch { sendingRef.current = false; setSending(false); return; }
    }

    setMessages(prev => [...prev, {
      role:      'user',
      content:   text || `📎 ${curFile?.name}`,
      fileName:  curFile?.name || null,
      createdAt: new Date(),
    }]);
    setIsTyping(true);

    try {
      const form = new FormData();
      if (text)    form.append('message',   text);
      form.append('role',      role);
      form.append('sessionId', session._id);
      if (isDoctor && selectedPatient?._id) form.append('patientId', selectedPatient._id);
      if (curFile) form.append('file', curFile);

      const res  = await API.post('/chat/message', form);
      const chat = res.data.chat;
      setActiveSession(chat);
      sessionRef.current = chat;
      setMessages(chat.messages || []);
      speakText(res.data.reply);
      setSessions(prev => {
        const exists = prev.find(s => s._id === session._id);
        return exists
          ? prev.map(s => s._id === session._id ? { ...s, title: chat.title || s.title, updatedAt: chat.updatedAt } : s)
          : [{ _id: chat._id, title: chat.title, updatedAt: chat.updatedAt }, ...prev];
      });
    } catch (err) {
      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   err.response?.data?.message || (isDoctor ? 'Clinical AI unavailable. Please try again.' : 'Sorry, something went wrong. Please try again.'),
        createdAt: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      setSending(false);
      sendingRef.current = false;
    }
  }, [input, file, selectedPatient, tts, role, isDoctor]); // eslint-disable-line

  useEffect(() => { sendMsgRef.current = sendMessage; }, [sendMessage]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const isEmpty    = messages.length === 0 && !loadingChat;
  const PROMPTS    = isDoctor ? DOCTOR_PROMPTS : PATIENT_PROMPTS;
  const HeaderIcon = theme.HeaderIcon;

  const SidebarContent = (
    <>
      <div className="p-4 text-white shrink-0" style={{ background: theme.grad }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <HeaderIcon size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">{isDoctor ? 'Clinical AI' : 'MediSync AI'}</p>
            <p className="text-white/80 text-xs">{isDoctor ? 'Patient-aware assistant' : 'Dana Shivam Hospital'}</p>
          </div>
        </div>
        <button
          onClick={newChat}
          disabled={sending}
          className="btn-press w-full flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-all"
        >
          <Plus size={14} /> {isDoctor ? 'New Session' : 'New Chat'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loadingSessions ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 px-3">No sessions yet.</p>
        ) : sessions.map(s => (
          <div
            key={s._id}
            onClick={() => loadSession(s._id)}
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-all ${
              activeSession?._id === s._id ? theme.activeNavClasses : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <MessageSquare size={12} className={activeSession?._id === s._id ? theme.accentText : 'text-gray-300'} />
            <span className={`text-xs flex-1 truncate ${activeSession?._id === s._id ? theme.activeNavTextClasses : 'text-gray-600'}`}>
              {s.title || 'New Chat'}
            </span>
            <button
              onClick={e => deleteSession(e, s._id)}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {isDoctor ? (
        <PatientLookup
          selectedPatient={selectedPatient}
          onSelect={p => { setSelectedPatient(p); setSidebarOpen(false); }}
          onClear={() => setSelectedPatient(null)}
        />
      ) : (
        <div className={`m-3 p-4 rounded-2xl ${theme.accentBg} border ${theme.accentBorder}`}>
          <p className={`text-xs font-bold ${theme.accentTextDark} mb-2 flex items-center gap-1.5`}>
            <HeartPulse size={12} /> Quick prompts
          </p>
          {PATIENT_PROMPTS.map(p => (
            <button
              key={p.text}
              onClick={() => !sendingRef.current && sendMessage(p.prompt)}
              className={`flex items-center gap-1.5 w-full text-left text-[11px] ${theme.accentTextDark} hover:opacity-80 py-1 hover:underline transition-colors truncate`}
            >
              <p.icon size={11} className="shrink-0" /> {p.text}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <DashboardLayout role={role}>
      {/* ── THE FIX: subtract the DashboardLayout main's own padding
           (p-4 = 2rem total vertical, lg:p-7 = 3.5rem total vertical)
           so this panel exactly fits the remaining viewport instead of
           overflowing and forcing the whole page — not just the message
           list — to scroll. This is what was breaking the layout on
           smaller / mobile screens. ── */}
      <div className="flex h-[calc(100dvh-64px-2rem)] lg:h-[calc(100dvh-64px-3.5rem)] bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 relative">

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl
          transform transition-transform duration-300 ease-in-out
          lg:static lg:w-64 lg:shadow-none lg:transform-none lg:flex lg:shrink-0 lg:border-r lg:border-gray-100
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700">Menu</p>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
          {SidebarContent}
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <div className="bg-white border-b border-gray-100 px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
            >
              <Menu size={16} />
            </button>

            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${theme.headerBg}`}>
              <HeaderIcon size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 text-sm truncate">
                {theme.title}
                {isDoctor && selectedPatient && (
                  <span className={`ml-1 sm:ml-2 font-normal ${theme.accentText}`}> — {selectedPatient.user?.name}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 truncate hidden sm:block">
                {isDoctor
                  ? (selectedPatient
                      ? `Patient data active · ${selectedPatient.riskLevel||'low'} risk · score: ${selectedPatient.healthScore??'—'}`
                      : 'Select a patient for context-aware clinical support')
                  : 'Online · Patient-aware'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setTts(v=>!v); synthRef.current?.cancel?.(); setSpeaking(false); }}
                className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all ${tts ? theme.ttsActiveClasses : theme.ttsIdleClasses}`}
              >
                {tts ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
              {voiceOk && (
                <button
                  onClick={toggleMic}
                  className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all ${isListening ? theme.micActiveBorder : theme.micIdleClasses}`}
                >
                  {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
              )}
              <span className={`w-2 h-2 rounded-full ${
                sending ? 'bg-amber-400 animate-pulse'
                : speaking ? 'bg-blue-400 animate-pulse'
                : (!isDoctor || selectedPatient) ? `${theme.dotColor} animate-pulse`
                : 'bg-gray-300'
              }`} />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 sm:py-5">
            {loadingChat ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className={`animate-spin ${theme.accentText}`} size={24} />
              </div>
            ) : isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-2">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-5 shadow-lg ${
                  isDoctor ? `${theme.headerBg} shadow-emerald-200/60` : 'med-icon-bubble animate-float-slow'
                }`}>
                  {isDoctor ? <Sparkles size={24} className="text-white" /> : <Bot size={28} className="text-white" />}
                </div>
                <h3 className="font-bold text-lg sm:text-xl text-gray-700 mb-2">
                  {isDoctor ? 'Clinical Decision Support AI' : 'MediSync AI'}
                </h3>
                <p className="text-xs sm:text-sm text-gray-400 mb-1 max-w-md leading-relaxed">
                  {isDoctor
                    ? (selectedPatient
                        ? `Patient data loaded for ${selectedPatient.user?.name}. Ask any clinical question or upload a file.`
                        : 'Select a patient from the sidebar, or ask general clinical questions.')
                    : 'Ask me about your health, Dana Shivam doctors, health packages, medications, or book appointments.'}
                </p>
                {isDoctor && <p className="text-xs text-gray-300 mb-5">Supports PDFs, images, lab reports, Word docs, and more</p>}
                {isListening && transcript && (
                  <div className={`w-full mb-4 px-4 py-2.5 rounded-xl border ${theme.accentBg} ${theme.accentBorderStrong}`}>
                    <p className={`${theme.accentText} text-xs italic`}>"{transcript}"</p>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">
                  {PROMPTS.map(p => (
                    <button
                      key={p.text}
                      onClick={() => !sendingRef.current && sendMessage(p.prompt)}
                      className={`btn-press flex items-center gap-2 px-3 py-2.5 bg-white border-2 border-gray-100 rounded-xl text-xs font-semibold text-gray-600 transition-all text-left ${theme.promptHoverClasses}`}
                    >
                      <p.icon size={13} className={`${theme.accentText} shrink-0`} />
                      <span className="truncate">{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => <ChatBubble key={i} msg={m} theme={theme} />)}
                {isTyping && (
                  <div className="flex gap-2 sm:gap-3 mb-4">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${theme.headerBg}`}>
                      <Bot size={13} className="text-white" />
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center h-4">
                        {[0,1,2].map(n => (
                          <span key={n} className={`w-1.5 h-1.5 rounded-full animate-bounce ${theme.typingDotClasses}`} style={{ animationDelay:`${n*150}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </>
            )}
          </div>

          {isListening && transcript && messages.length > 0 && (
            <div className={`mx-3 sm:mx-5 mb-2 px-4 py-2.5 rounded-xl border shrink-0 ${theme.accentBg} ${theme.accentBorderStrong}`}>
              <p className={`${theme.accentText} text-xs italic`}>"{transcript}"</p>
            </div>
          )}

          {file && (
            <div className="mx-3 sm:mx-5 mb-2 shrink-0">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl w-fit max-w-full border ${theme.accentBg} ${theme.accentBorderStrong}`}>
                <Paperclip size={13} className={`${theme.accentText} shrink-0`} />
                <span className={`${theme.accentTextDark} text-xs truncate max-w-[180px] sm:max-w-[250px] font-medium`}>{file.name}</span>
                <span className={`${theme.accentText} text-[10px] shrink-0`}>({(file.size/1024).toFixed(0)}KB)</span>
                <button onClick={() => setFile(null)} className={`${theme.accentText} hover:text-red-400 shrink-0 transition-colors`}>
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="bg-white border-t border-gray-100 p-3 sm:p-4 shrink-0">
            <div className="flex items-end gap-1.5 sm:gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border-2 border-gray-200 text-gray-400 disabled:opacity-40 transition-all ${theme.promptHoverClasses}`}
              >
                <Paperclip size={15} />
              </button>
              <input
                type="file"
                ref={fileRef}
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ''; }}
                accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.json,audio/*,video/*"
              />

              {voiceOk && (
                <button
                  onClick={toggleMic}
                  className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border-2 transition-all ${
                    isListening ? theme.micActiveBorder : theme.micIdleClasses
                  }`}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}

              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  placeholder={isDoctor
                    ? (selectedPatient ? `Ask about ${selectedPatient.user?.name}…` : 'Clinical query or attach a file…')
                    : 'Ask about your health, appointments, Dana Shivam doctors…'}
                  rows={1}
                  disabled={sending}
                  className={`w-full resize-none border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${theme.focusClasses} disabled:opacity-60 transition-colors`}
                  style={{ minHeight:'44px', maxHeight:'120px' }}
                />
              </div>

              <button
                onClick={() => sendMessage()}
                disabled={(!input.trim() && !file) || sending}
                style={(!input.trim() && !file) || sending ? {} : { background: theme.grad }}
                className={`btn-press shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all ${
                  (!input.trim() && !file) || sending
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-white shadow-md hover:opacity-90'
                }`}
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-300 mt-2 text-center">
              {isDoctor
                ? 'Supports images, PDFs, lab reports, Word docs, audio and more · Not a substitute for clinical judgment'
                : 'Supports images, PDFs, and documents · Uses your live health profile · Emergency: call 112'}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}