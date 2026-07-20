'use client';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { getDoctorAppointments, updateDoctorAppointmentStatus, API } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Calendar, Check, CheckCircle, ChevronDown, Clock,
  FlaskConical, Loader2, Phone, RefreshCw, Video,
  XCircle, Bot, User, AlertTriangle, Building2,
} from 'lucide-react';

const DOC_GRAD = { background: 'linear-gradient(135deg, var(--emerald), var(--teal-dark))' };

const STATUS_COLORS = {
  scheduled:        'bg-blue-50 text-blue-700 border-blue-200',
  confirmed:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed:        'bg-slate-100 text-slate-500 border-slate-200',
  cancelled:        'bg-red-50 text-red-500 border-red-200',
  'no-show':        'bg-orange-50 text-orange-500 border-orange-200',
  'in-consultation':'bg-teal-50 text-teal-700 border-teal-200',
};

const JOURNEY_LABELS = {
  waiting:          { label: 'Waiting',        color: 'bg-blue-100 text-blue-700'    },
  'in-consultation':{ label: 'In Consultation', color: 'bg-green-100 text-green-700'  },
  lab:              { label: 'Lab',             color: 'bg-purple-100 text-purple-700' },
  pharmacy:         { label: 'Pharmacy',        color: 'bg-orange-100 text-orange-700' },
  billing:          { label: 'Billing',         color: 'bg-yellow-100 text-yellow-700' },
  discharge:        { label: 'Discharged',      color: 'bg-slate-100 text-slate-600'  },
};

function dateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function todayKey() { return dateKey(new Date()); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [updating,     setUpdating]     = useState(null);
  const [tab,          setTab]          = useState('today');
  const [expandedId,   setExpandedId]   = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getDoctorAppointments();
      setAppointments(res.data.appointments || []);
    } catch { toast.error('Failed to load appointments'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 90000); // auto-refresh every 90s
    return () => clearInterval(t);
  }, [load]);

  async function changeStatus(id, status) {
    setUpdating(id + status);
    try {
      await updateDoctorAppointmentStatus(id, { status });
      toast.success(`Marked ${status}`);
      await load(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setUpdating(null); }
  }

  async function updateJourney(id, journeyStatus) {
    setUpdating(id + journeyStatus);
    try {
      await API.patch(`/doctor/appointments/${id}/journey`, { journeyStatus });
      toast.success(JOURNEY_LABELS[journeyStatus]?.label || journeyStatus);
      await load(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setUpdating(null); }
  }

  const today    = todayKey();
  const todayApts= appointments.filter(a => dateKey(a.appointmentDate) === today).sort((a,b)=>new Date(a.appointmentDate)-new Date(b.appointmentDate));
  const upcoming = appointments.filter(a => dateKey(a.appointmentDate)  > today && ['scheduled','confirmed'].includes(a.status)).sort((a,b)=>new Date(a.appointmentDate)-new Date(b.appointmentDate));
  const past     = appointments.filter(a => dateKey(a.appointmentDate)  < today || ['completed','cancelled','no-show'].includes(a.status)).sort((a,b)=>new Date(b.appointmentDate)-new Date(a.appointmentDate));

  const displayed = tab === 'today' ? todayApts : tab === 'upcoming' ? upcoming : past;

  const todayStats = {
    total:    todayApts.length,
    waiting:  todayApts.filter(a=>['scheduled','confirmed'].includes(a.status)).length,
    done:     todayApts.filter(a=>a.status==='completed').length,
    inRoom:   todayApts.filter(a=>a.journeyStatus==='in-consultation').length,
  };

  return (
    <DashboardLayout role="doctor">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">
            Today: {todayStats.total} total · {todayStats.waiting} waiting · {todayStats.done} done
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="btn-press flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Today Total',    value: todayStats.total,  color: 'text-slate-700',   bg: 'bg-slate-50'   },
          { label: 'Waiting',        value: todayStats.waiting, color: 'text-blue-700',    bg: 'bg-blue-50'    },
          { label: 'In Consultation',value: todayStats.inRoom,  color: 'text-teal-700',    bg: 'bg-teal-50'    },
          { label: 'Completed',      value: todayStats.done,    color: 'text-emerald-700', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-white`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'today',    label: `Today (${todayApts.length})`    },
          { key: 'upcoming', label: `Upcoming (${upcoming.length})`  },
          { key: 'past',     label: `Past (${past.length})`          },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={tab === t.key ? DOC_GRAD : {}}
            className={`btn-press px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t.key
                ? 'text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="med-card p-16 text-center">
          <Calendar size={44} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No {tab} appointments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((apt) => {
            const patient     = apt.patient;
            const isActive    = ['scheduled','confirmed'].includes(apt.status);
            const isExpanded  = expandedId === apt._id;
            const isUpdating  = String(updating || '').startsWith(apt._id);
            const journey     = JOURNEY_LABELS[apt.journeyStatus];

            return (
              <div key={apt._id} className={`med-card border-2 transition-all ${
                apt.journeyStatus === 'in-consultation' ? 'border-teal-300' : isActive ? 'border-slate-200 hover:border-emerald-200' : 'border-slate-100 opacity-80'
              }`}>
                {/* Main row */}
                <div className="p-4 flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 shrink-0 text-sm">
                    {patient?.user?.name?.[0]?.toUpperCase() || 'P'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-bold text-slate-800">{patient?.user?.name || 'Patient'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(apt.appointmentDate).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                          {apt.timeSlot?.start && ` · ${apt.timeSlot.start}`}
                          {' · '}<span className="capitalize">{apt.type}</span>
                        </p>
                        {tab !== 'today' && (
                          <p className="text-xs text-slate-400 mt-0.5">{fmtDate(apt.appointmentDate)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {journey && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${journey.color}`}>
                            {journey.label}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[apt.status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {apt.status.replace(/-/g,' ')}
                        </span>
                        {/* Risk badge */}
                        {patient?.riskLevel && patient.riskLevel !== 'low' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${patient.riskLevel === 'high' || patient.riskLevel === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                            {patient.riskLevel} risk
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reason */}
                    {apt.reason && (
                      <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 line-clamp-1">
                        {apt.reason}
                      </p>
                    )}

                    {/* Allergy warning */}
                    {patient?.allergies?.length > 0 && (
                      <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle size={10} /> Allergies: {patient.allergies.slice(0,3).join(', ')}
                      </p>
                    )}

                    {/* Action buttons */}
                    {isActive && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {apt.status === 'scheduled' && (
                          <button onClick={() => changeStatus(apt._id, 'confirmed')}
                            disabled={isUpdating}
                            className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 flex items-center gap-1">
                            <Check size={10} /> Confirm
                          </button>
                        )}
                        {apt.journeyStatus !== 'in-consultation' && (
                          <button onClick={() => updateJourney(apt._id, 'in-consultation')}
                            disabled={isUpdating}
                            className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-40 flex items-center gap-1">
                            🩺 Start
                          </button>
                        )}
                        <button onClick={() => updateJourney(apt._id, 'lab')}
                          disabled={isUpdating}
                          className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-40 flex items-center gap-1">
                          <FlaskConical size={10} /> Lab
                        </button>
                        <button onClick={() => updateJourney(apt._id, 'pharmacy')}
                          disabled={isUpdating}
                          className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-40">
                          💊 Pharmacy
                        </button>
                        <button onClick={() => changeStatus(apt._id, 'completed')}
                          disabled={isUpdating}
                          className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-40 flex items-center gap-1">
                          <CheckCircle size={10} /> Done
                        </button>
                        {apt.type === 'video' && apt.meetingLink && (
                          <a href={apt.meetingLink} target="_blank" rel="noreferrer"
                            className="px-2.5 py-1.5 text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg hover:bg-cyan-100 flex items-center gap-1">
                            <Video size={10} /> Join
                          </a>
                        )}
                        {apt.type === 'phone' && (
                          <a href={`tel:${patient?.user?.phone}`}
                            className="px-2.5 py-1.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 flex items-center gap-1">
                            <Phone size={10} /> Call
                          </a>
                        )}
                        <Link href={`/doctor/chat?patientId=${patient?._id}`}
                          className="px-2.5 py-1.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                          <Bot size={10} /> AI
                        </Link>
                        <button onClick={() => changeStatus(apt._id, 'cancelled')}
                          disabled={isUpdating}
                          className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 flex items-center gap-1">
                          <XCircle size={10} /> Cancel
                        </button>
                      </div>
                    )}

                    {isUpdating && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Loader2 size={11} className="animate-spin text-emerald-500" />
                        <span className="text-xs text-slate-400">Updating…</span>
                      </div>
                    )}
                  </div>

                  {/* Expand toggle for past/details */}
                  <button onClick={() => setExpandedId(isExpanded ? null : apt._id)}
                    className="p-1 text-slate-400 hover:text-slate-600 shrink-0 mt-1">
                    <ChevronDown size={15} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 rounded-b-2xl">
                    <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600">
                      <div><span className="font-semibold text-slate-700">Patient ID: </span>{patient?.patientId || '—'}</div>
                      <div><span className="font-semibold text-slate-700">Contact: </span>{patient?.user?.phone || '—'}</div>
                      <div><span className="font-semibold text-slate-700">Blood: </span>{patient?.bloodGroup || '—'}</div>
                      {apt.meetingId && <div className="sm:col-span-3"><span className="font-semibold text-slate-700">Meeting ID: </span><code className="bg-white px-2 py-0.5 rounded border border-slate-200">{apt.meetingId}</code></div>}
                      {apt.notes && <div className="sm:col-span-3"><span className="font-semibold text-slate-700">Notes: </span>{apt.notes}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}