// ============================================================
// FILE: frontend/src/components/VoiceChat.js
// USAGE: imported by patient/doctor chat pages
// ============================================================
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Bot, User,
  Loader2, Sparkles, Radio, Send
} from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});
API.interceptors.request.use((cfg) => {
  const token = Cookies.get('token') || (typeof window !== 'undefined' && localStorage.getItem('token'));
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const ML = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000/api',
});

export default function VoiceChat({ role = 'patient', sessionId, patientContext = {} }) {
  const [isListening, setIsListening]   = useState(false);
  const [isSpeaking,  setIsSpeaking]    = useState(false);
  const [ttsEnabled,  setTtsEnabled]    = useState(true);
  const [transcript,  setTranscript]    = useState('');
  const [messages,    setMessages]      = useState([]);
  const [loading,     setLoading]       = useState(false);
  const [textInput,   setTextInput]     = useState('');
  const [voiceOk,     setVoiceOk]       = useState(false);
  const [pulse,       setPulse]         = useState(0);

  const recognitionRef = useRef(null);
  const synthRef       = useRef(null);
  const pulseTimer     = useRef(null);
  const messagesEnd    = useRef(null);
  const activeSession  = useRef(sessionId || null);

  // ── Init speech APIs ──────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceOk(true);
      const r = new SR();
      r.continuous     = false;
      r.interimResults = true;
      r.lang           = 'en-IN';

      r.onresult = (e) => {
        const text = Array.from(e.results).map(x => x[0].transcript).join('');
        setTranscript(text);
        if (e.results[e.results.length - 1].isFinal) {
          sendMessage(text);
        }
      };
      r.onerror = () => { setIsListening(false); stopPulse(); };
      r.onend   = () => { setIsListening(false); stopPulse(); };
      recognitionRef.current = r;
    }
    synthRef.current = window.speechSynthesis;
    // Pre-load voices
    window.speechSynthesis?.getVoices();
    return () => { stopPulse(); synthRef.current?.cancel(); };
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Pulse animation for mic ───────────────────────────────
  function startPulse() {
    pulseTimer.current = setInterval(() => {
      setPulse(Math.random());
    }, 120);
  }
  function stopPulse() {
    clearInterval(pulseTimer.current);
    setPulse(0);
  }

  // ── Toggle microphone ─────────────────────────────────────
  function toggleMic() {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      stopPulse();
    } else {
      synthRef.current?.cancel();
      setIsSpeaking(false);
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
        startPulse();
      } catch { /* already started */ }
    }
  }

  // ── TTS ───────────────────────────────────────────────────
  function speak(text) {
    if (!synthRef.current || !ttsEnabled) return;
    synthRef.current.cancel();
    const clean = text.replace(/[*_#`>]/g, '').replace(/\n+/g, '. ').slice(0, 500);
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate  = 0.9;
    utter.pitch = 1.0;

    // Pick a natural English voice
    const voices = synthRef.current.getVoices();
    const best   = voices.find(v => v.lang.startsWith('en') && /natural|google|microsoft/i.test(v.name))
                || voices.find(v => v.lang.startsWith('en'));
    if (best) utter.voice = best;

    utter.onstart = () => setIsSpeaking(true);
    utter.onend   = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utter);
  }

  // ── Core send ─────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = (text || textInput).trim();
    if (!msg || loading) return;

    setTranscript('');
    setTextInput('');
    setIsListening(false);
    stopPulse();
    setLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: msg, ts: Date.now() }]);

    try {
      let reply = '';
      if (false) {
        const mlRes = await ML.post('/chat/voice', {
          message: msg,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          voice_mode: true,
          patient_name:  patientContext.name    || 'Patient',
          patient_age:   patientContext.age     || null,
          blood_group:   patientContext.bloodGroup || 'Unknown',
          conditions:    patientContext.conditions  || [],
          medications:   patientContext.medications || [],
          recent_vitals: patientContext.vitals      || {},
        });
        reply = mlRes.data.voice_reply || mlRes.data.reply || '';
      } else {
        const form = new FormData();
        form.append('message', msg);
        form.append('role', role);
        if (activeSession.current) form.append('sessionId', activeSession.current);
        const mainRes = await API.post('/chat/message', form);
        reply = mainRes.data.reply || '';
        if (mainRes.data.chat?._id) activeSession.current = mainRes.data.chat._id;
      }

      if (!reply) throw new Error('Empty reply');

      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
      speak(reply);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I could not process that. Please try again.',
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, role, patientContext, textInput, ttsEnabled]);

  // ── Colour scheme by role ─────────────────────────────────
  const accent = role === 'doctor' ? 'from-emerald-500 to-teal-600' : 'from-violet-500 to-blue-600';
  const micActive = 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-400/40';
  const micIdle   = `bg-gradient-to-br ${accent} shadow-violet-400/30`;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-3xl overflow-hidden border border-slate-800/60 shadow-2xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow`}>
              <Bot size={17} className="text-white" />
            </div>
            {(isListening || isSpeaking || loading) && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">
              {role === 'doctor' ? 'Clinical Voice Assistant' : 'Health Voice Assistant'}
            </p>
            <p className="text-slate-500 text-xs">
              {isListening ? '🔴 Listening…' : isSpeaking ? '🔵 Speaking…' : loading ? '⚡ Thinking…' : 'Ready'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setTtsEnabled(v => !v); synthRef.current?.cancel(); setIsSpeaking(false); }}
          title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
          className={`p-2 rounded-xl border text-xs font-medium transition-all ${
            ttsEnabled
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
              : 'border-slate-700 bg-slate-800 text-slate-500'
          }`}
        >
          {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 select-none">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${accent} opacity-20 flex items-center justify-center mb-4`}>
              <Sparkles size={30} className="text-white" />
            </div>
            <p className="text-slate-400 font-semibold mb-1">
              {voiceOk ? 'Tap the mic or type to begin' : 'Type your question below'}
            </p>
            <p className="text-slate-600 text-xs max-w-xs leading-relaxed">
              {role === 'patient'
                ? 'Ask about symptoms, medications, appointments, or your health records.'
                : 'Ask for patient summaries, diagnosis suggestions, or prescription guidance.'}
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
              m.role === 'user'
                ? 'bg-blue-600'
                : `bg-gradient-to-br ${accent}`
            }`}>
              {m.role === 'user' ? <User size={13} className="text-white" /> : <Bot size={13} className="text-white" />}
            </div>
            <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${accent}`}>
              <Bot size={13} className="text-white" />
            </div>
            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 160}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* ── Live transcript preview ── */}
      {isListening && transcript && (
        <div className="mx-4 mb-1 px-3 py-2 bg-slate-800/70 border border-violet-500/20 rounded-xl">
          <p className="text-violet-300 text-xs italic">"{transcript}"</p>
        </div>
      )}

      {/* ── Mic orb ── */}
      <div className="px-5 pb-5 pt-3 border-t border-slate-800/60 bg-slate-900/40">
        <div className="flex items-center gap-3 mb-3">
          {/* Text fallback input */}
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Or type a message…"
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!textInput.trim() || loading}
            className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${accent} disabled:opacity-30 transition-all hover:scale-105 active:scale-95`}
          >
            <Send size={16} className="text-white" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-5">
          {/* Stop TTS */}
          {isSpeaking && (
            <button onClick={() => { synthRef.current?.cancel(); setIsSpeaking(false); }}
              className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 transition-all">
              <VolumeX size={16} />
            </button>
          )}

          {/* Main mic button */}
          <div className="relative">
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping scale-150" />
                <div className="absolute inset-0 rounded-2xl bg-red-500/10 animate-pulse scale-125" />
              </>
            )}
            <button
              onClick={toggleMic}
              disabled={!voiceOk || loading}
              className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl ${
                isListening ? micActive : micIdle
              } disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
            >
              {loading
                ? <Loader2 size={22} className="text-white animate-spin" />
                : isListening
                  ? <MicOff size={22} className="text-white" />
                  : <Mic size={22} className="text-white" />}
            </button>
          </div>

          <div className={`w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center`}>
            <Radio size={15} className={isListening ? 'text-red-400 animate-pulse' : isSpeaking ? 'text-blue-400 animate-pulse' : 'text-slate-600'} />
          </div>
        </div>

        <p className="text-center text-xs mt-3 text-slate-600">
          {!voiceOk
            ? 'Voice input requires Chrome or Edge'
            : isListening
              ? 'Listening — tap again to stop'
              : isSpeaking
                ? 'Speaking — tap speaker icon to stop'
                : 'Tap mic to speak  •  Enter to send text'}
        </p>
      </div>
    </div>
  );
}
