'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axios from 'axios';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff,
  MessageSquare, Users, Wifi, WifiOff, Loader2,
  AlertCircle, ArrowLeft, Clock, Shield,
} from 'lucide-react';

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api' });
API.interceptors.request.use(cfg => {
  const t = Cookies.get('token') || (typeof window !== 'undefined' && localStorage.getItem('token'));
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export default function ConsultationPage() {
  const { meetingId } = useParams();
  const router        = useRouter();

  const jitsiContainer = useRef(null);
  const jitsiApi       = useRef(null);

  const [appointment, setAppointment] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [jitsiLoaded, setJitsiLoaded] = useState(false);
  const [audioMuted,  setAudioMuted]  = useState(false);
  const [videoMuted,  setVideoMuted]  = useState(false);
  const [participants, setParticipants] = useState(1);

  // ── Load appointment data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!meetingId) return;
    API.get(`/appointments/meeting/${meetingId}`)
      .then(r => setAppointment(r.data.appointment))
      .catch(() => {
        // Appointment not found in DB, but room is still accessible via Jitsi
        setAppointment({ meetingId });
      })
      .finally(() => setLoading(false));
  }, [meetingId]);

  // ── Load and initialise Jitsi Meet ────────────────────────────────────────
  useEffect(() => {
    if (loading || !jitsiContainer.current) return;

    // Clean up any previous instance
    if (jitsiApi.current) {
      try { jitsiApi.current.dispose(); } catch {}
      jitsiApi.current = null;
    }

    const displayName = appointment?.patient?.user?.name
      || appointment?.doctor?.user?.name
      || 'HealthBridge User';

    const roomName = meetingId; // e.g. "HB-1EB87B29" or "HealthBridge-XXXXXXXX"

    const loadJitsi = () => {
      if (!window.JitsiMeetExternalAPI) {
        setError('Video service could not load. Please refresh the page.');
        return;
      }

      try {
        const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName,
          width:      '100%',
          height:     '100%',
          parentNode: jitsiContainer.current,
          configOverwrite: {
            startWithAudioMuted:    false,
            startWithVideoMuted:    false,
            disableDeepLinking:     true,
            enableWelcomePage:      false,
            enableClosePage:        false,
            prejoinPageEnabled:     false,
            disableInviteFunctions: true,
            analytics:              { disabled: true },
            p2p:                    { enabled: true },
            defaultLanguage:        'en',
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK:        false,
            SHOW_BRAND_WATERMARK:        false,
            SHOW_POWERED_BY:             false,
            DISPLAY_WELCOME_PAGE_CONTENT:false,
            APP_NAME:                    'HealthBridge',
            NATIVE_APP_NAME:             'HealthBridge',
            DEFAULT_REMOTE_DISPLAY_NAME: 'HealthBridge User',
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions',
              'desktop', 'chat', 'raisehand',
              'tileview', 'select-background', 'stats', 'hangup',
            ],
            SETTINGS_SECTIONS: ['devices', 'language'],
            MOBILE_APP_PROMO: false,
          },
          userInfo: { displayName },
        });

        // Events
        api.on('audioMuteStatusChanged',  e => setAudioMuted(e.muted));
        api.on('videoMuteStatusChanged',  e => setVideoMuted(e.muted));
        api.on('participantJoined',       () => setParticipants(p => p + 1));
        api.on('participantLeft',         () => setParticipants(p => Math.max(1, p - 1)));
        api.on('readyToClose',            () => router.back());

        jitsiApi.current = api;
        setJitsiLoaded(true);
      } catch (err) {
        setError(`Could not start video call: ${err.message}`);
      }
    };

    // Check if Jitsi script is already loaded
    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      // Remove any stale script tags
      const existing = document.getElementById('jitsi-script');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.id    = 'jitsi-script';
      script.src   = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = loadJitsi;
      script.onerror = () => setError('Could not load video service. Check your internet connection.');
      document.body.appendChild(script);
    }

    return () => {
      if (jitsiApi.current) {
        try { jitsiApi.current.dispose(); } catch {}
        jitsiApi.current = null;
      }
    };
  }, [loading, meetingId, appointment]); // eslint-disable-line

  // ── Controls ──────────────────────────────────────────────────────────────
  function toggleAudio() {
    jitsiApi.current?.executeCommand('toggleAudio');
  }
  function toggleVideo() {
    jitsiApi.current?.executeCommand('toggleVideo');
  }
  function hangUp() {
    jitsiApi.current?.executeCommand('hangup');
    setTimeout(() => router.back(), 500);
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4">
        <Loader2 size={40} className="animate-spin text-emerald-400" />
        <p className="text-lg font-semibold">Setting up consultation room…</p>
        <p className="text-gray-400 text-sm">Room: {meetingId}</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-6 px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-gray-400 text-sm max-w-sm">{error}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors">
            Retry
          </button>
          <button onClick={() => router.back()}
            className="px-5 py-2.5 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const doctorName  = appointment?.doctor?.user?.name;
  const patientName = appointment?.patient?.user?.name;
  const aptDate     = appointment?.appointmentDate
    ? new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })
    : null;

  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-white font-bold text-sm">HealthBridge Consultation</p>
            <p className="text-gray-400 text-xs flex items-center gap-2">
              <span>Room: {meetingId}</span>
              {aptDate && <span>· {aptDate}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Participants */}
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Users size={14} />
            <span>{participants}</span>
          </div>

          {/* Connection indicator */}
          <div className={`flex items-center gap-1.5 text-xs ${jitsiLoaded ? 'text-emerald-400' : 'text-amber-400'}`}>
            {jitsiLoaded ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="hidden sm:block">{jitsiLoaded ? 'Connected' : 'Connecting…'}</span>
          </div>

          {/* Secure badge */}
          <div className="flex items-center gap-1 text-xs text-gray-500 hidden sm:flex">
            <Shield size={12} />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>

      {/* ── Patient / Doctor info bar ── */}
      {(doctorName || patientName) && (
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/60 border-b border-gray-700/50 text-xs text-gray-400 shrink-0">
          {doctorName  && <span>👨‍⚕️ Dr. {doctorName}</span>}
          {patientName && <span>🏥 {patientName}</span>}
          {appointment?.type && <span>📋 {appointment.type} consultation</span>}
        </div>
      )}

      {/* ── Jitsi Meet IFrame ── */}
      <div className="flex-1 relative overflow-hidden">
        {!jitsiLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Video size={36} className="text-emerald-400 animate-pulse" />
            </div>
            <p className="text-white font-semibold">Joining video call…</p>
            <p className="text-gray-400 text-sm text-center max-w-xs">
              Allow camera and microphone access when prompted by your browser.
            </p>
            <div className="flex gap-2 mt-2">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay:`${i*150}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={jitsiContainer} className="w-full h-full" />
      </div>

      {/* ── Bottom controls ── */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-gray-800 border-t border-gray-700 shrink-0">
        {/* Mute audio */}
        <button onClick={toggleAudio}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            audioMuted ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50' : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={audioMuted ? 'Unmute' : 'Mute'}>
          {audioMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Hang up */}
        <button onClick={hangUp}
          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
          title="End call">
          <PhoneOff size={22} />
        </button>

        {/* Mute video */}
        <button onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            videoMuted ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50' : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={videoMuted ? 'Start video' : 'Stop video'}>
          {videoMuted ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
      </div>

      {/* ── Footer info ── */}
      <div className="px-4 py-1.5 bg-gray-900 text-center shrink-0">
        <p className="text-gray-600 text-[10px]">
          Powered by Jitsi Meet · End-to-end encrypted · Room: {meetingId}
        </p>
      </div>
    </div>
  );
}