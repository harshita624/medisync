'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import Link from 'next/link';
import { API } from '@/lib/api';
import {
  Video, Clock, User, Calendar, Loader2,
  ExternalLink, CheckCircle, AlertCircle, Phone,
} from 'lucide-react';

const DOC_GRAD = { background: 'linear-gradient(135deg, var(--emerald), var(--teal-dark))' };

function statusBadge(status) {
  const map = {
    scheduled:  'bg-blue-50 text-blue-600 border-blue-100',
    confirmed:  'bg-emerald-50 text-emerald-600 border-emerald-100',
    completed:  'bg-slate-50 text-slate-500 border-slate-100',
    cancelled:  'bg-red-50 text-red-500 border-red-100',
  };
  return map[status] || 'bg-slate-50 text-slate-500 border-slate-100';
}

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function fmtTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}

export default function DoctorConsultationsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('upcoming'); // upcoming | today | past

  useEffect(() => {
    API.get('/doctor/appointments')
      .then(r => setAppointments(r.data.appointments || []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, []);

  // Only video and phone consultations
  const consultations = appointments.filter(a =>
    a.type === 'video' || a.type === 'phone'
  );

  const now   = new Date();
  const today = new Date(); today.setHours(0,0,0,0);
  const tmrw  = new Date(today); tmrw.setDate(tmrw.getDate() + 1);

  const todayList    = consultations.filter(a => new Date(a.appointmentDate) >= today && new Date(a.appointmentDate) < tmrw);
  const upcomingList = consultations.filter(a => new Date(a.appointmentDate) >= tmrw && ['scheduled','confirmed'].includes(a.status));
  const pastList     = consultations.filter(a => new Date(a.appointmentDate) < today || a.status === 'completed').slice(0,20);

  const displayed = tab === 'today' ? todayList : tab === 'upcoming' ? upcomingList : pastList;

  const isJoinable = (apt) => {
    if (apt.status === 'completed' || apt.status === 'cancelled') return false;
    if (apt.type !== 'video') return false;
    const aptTime = new Date(apt.appointmentDate);
    const diff    = (aptTime - now) / 60000; // minutes
    return diff <= 30 && diff >= -120; // joinable 30 min before and up to 2 hours after
  };

  return (
    <DashboardLayout role="doctor">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">Consultations</h1>
        <p className="text-slate-500 text-sm mt-1">Video and phone consultations with your patients</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Today",    count: todayList.length,    color: "bg-blue-50 border-blue-100 text-blue-700"    },
          { label: "Upcoming", count: upcomingList.length, color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
          { label: "Past",     count: pastList.length,     color: "bg-slate-50 border-slate-100 text-slate-700" },
        ].map(s => (
          <button key={s.label} onClick={() => setTab(s.label.toLowerCase())}
            className={`btn-press p-4 rounded-2xl border text-center transition-all cursor-pointer hover:shadow-sm ${
              tab === s.label.toLowerCase() ? s.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white border-slate-100'
            }`}>
            <p className={`text-2xl font-bold ${tab === s.label.toLowerCase() ? '' : 'text-slate-900'}`}>{s.count}</p>
            <p className={`text-xs font-medium mt-0.5 ${tab === s.label.toLowerCase() ? '' : 'text-slate-500'}`}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Consultation list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-emerald-400" /></div>
      ) : displayed.length === 0 ? (
        <div className="med-card p-16 text-center">
          <Video size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">No {tab} consultations</p>
          <p className="text-slate-400 text-sm mt-1">
            {tab === 'today'
              ? "No video or phone consultations scheduled for today."
              : tab === 'upcoming'
                ? "No upcoming consultations. Patients can book video appointments from their portal."
                : "No past consultation records."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(apt => {
            const joinable = isJoinable(apt);
            const patient  = apt.patient?.user;
            return (
              <div key={apt._id}
                className={`med-card card-hover p-5 flex items-center gap-4 transition-all ${
                  joinable ? 'border-emerald-200 shadow-sm shadow-emerald-50' : ''
                }`}>

                {/* Type icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  apt.type === 'video' ? 'bg-cyan-50 text-cyan-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {apt.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900">{patient?.name || 'Patient'}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${statusBadge(apt.status)}`}>
                      {apt.status}
                    </span>
                    {joinable && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={11} /> {fmt(apt.appointmentDate)}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={11} /> {fmtTime(apt.appointmentDate)}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{apt.type} consultation</span>
                  </div>
                  {apt.reason && <p className="text-xs text-slate-500 mt-1 truncate">Reason: {apt.reason}</p>}
                  {apt.meetingLink && !joinable && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <ExternalLink size={10} /> {apt.meetingLink}
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {apt.type === 'video' ? (
                    joinable ? (
                      <Link href={`/consultation/${apt.meetingId}`}
                        style={DOC_GRAD}
                        className="btn-press flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all shadow-md shadow-emerald-200">
                        <Video size={15} /> Join Now
                      </Link>
                    ) : apt.status !== 'completed' && apt.status !== 'cancelled' && apt.meetingId ? (
                      <Link href={`/consultation/${apt.meetingId}`}
                        className="btn-press flex items-center gap-2 px-4 py-2 bg-cyan-50 border border-cyan-200 text-cyan-700 text-sm font-semibold rounded-xl hover:bg-cyan-100 transition-all">
                        <ExternalLink size={13} /> Open Room
                      </Link>
                    ) : apt.status === 'completed' ? (
                      <span className="flex items-center gap-1.5 text-xs text-slate-400 px-3 py-2 bg-slate-50 rounded-xl">
                        <CheckCircle size={13} className="text-emerald-400" /> Completed
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 px-3 py-2 bg-slate-50 rounded-xl capitalize">{apt.status}</span>
                    )
                  ) : (
                    apt.status !== 'completed' && apt.status !== 'cancelled' ? (
                      <a href={`tel:${patient?.phone || ''}`}
                        className="btn-press flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold rounded-xl hover:bg-amber-100 transition-all">
                        <Phone size={13} /> Call Patient
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 px-3 py-2 bg-slate-50 rounded-xl capitalize">{apt.status}</span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}