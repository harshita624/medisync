'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/shared/DashboardLayout';
import useAuthStore from '@/store/authStore';
import { getDoctorAppointments, getDoctorPatients, getDoctorProfile, updateDoctorAppointmentStatus, API } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, Bot, Calendar, CheckCircle,
  ChevronRight, Clock, ClipboardList, Loader2, MessageSquare,
  QrCode, Stethoscope, TrendingUp, User, Users, Video, XCircle,
  Bed, FlaskConical, Package, HeartPulse, RefreshCw,
} from 'lucide-react';

const DOC_GRAD = { background: 'linear-gradient(135deg, var(--emerald), var(--teal-dark))' };

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const cls = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red:    'bg-red-50 text-red-500',
    teal:   'bg-teal-50 text-teal-600',
  };
  return (
    <div className="med-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls[color]}`}>
          <Icon size={18} className="text-current" />
        </div>
        {sub && <span className="text-xs text-slate-400 font-medium">{sub}</span>}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── Journey Status Badge ──────────────────────────────────────────────────────
function JourneyBadge({ status }) {
  const map = {
    waiting:          'bg-blue-50 text-blue-600',
    'in-consultation':'bg-green-50 text-green-600',
    lab:              'bg-purple-50 text-purple-600',
    pharmacy:         'bg-orange-50 text-orange-600',
    billing:          'bg-yellow-50 text-yellow-700',
    discharge:        'bg-slate-100 text-slate-500',
    completed:        'bg-slate-100 text-slate-500',
    confirmed:        'bg-emerald-50 text-emerald-600',
    scheduled:        'bg-blue-50 text-blue-500',
    cancelled:        'bg-red-50 text-red-500',
    'no-show':        'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize whitespace-nowrap ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {(status || 'unknown').replace(/-/g, ' ')}
    </span>
  );
}

// ── Resource Card ─────────────────────────────────────────────────────────────
function ResourceCard({ icon: Icon, label, value, description, status, color = 'blue' }) {
  const cls = {
    available: 'border-green-200 bg-green-50',
    busy:      'border-amber-200 bg-amber-50',
    limited:   'border-orange-200 bg-orange-50',
    critical:  'border-red-200 bg-red-50',
    moderate:  'border-yellow-200 bg-yellow-50',
  };
  const statusColor = {
    available: 'text-green-600',
    busy:      'text-amber-600',
    limited:   'text-orange-600',
    critical:  'text-red-600',
    moderate:  'text-yellow-600',
  };
  const iconCls = {
    blue:   'bg-blue-100 text-blue-600',
    green:  'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className={`p-4 rounded-2xl border-2 transition-all ${cls[status] || 'border-slate-100 bg-white'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconCls[color] || 'bg-slate-100 text-slate-600'}`}>
          <Icon size={16} className="text-current" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className={`text-xs font-semibold capitalize ${statusColor[status] || 'text-slate-500'}`}>{status}</p>
        </div>
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const [doctor,       setDoctor]       = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [resources,    setResources]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [updating,     setUpdating]     = useState(null); // appointment id being updated

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [d, a, p, r] = await Promise.all([
        getDoctorProfile().catch(() => ({ data: { doctor: null } })),
        getDoctorAppointments().catch(() => ({ data: { appointments: [] } })),
        getDoctorPatients().catch(() => ({ data: { patients: [] } })),
        API.get('/doctor/resources').catch(() => ({ data: { resources: null } })),
      ]);
      setDoctor(d.data.doctor);
      setAppointments(a.data.appointments || []);
      setPatients(p.data.patients || []);
      setResources(r.data.resources || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadData();
    // Refresh queue every 2 minutes
    const interval = setInterval(() => loadData(true), 120000);
    return () => clearInterval(interval);
  }, [user, loadData]);

  async function changeStatus(id, status) {
    setUpdating(id);
    try {
      await updateDoctorAppointmentStatus(id, { status });
      toast.success(`Appointment marked ${status}`);
      await loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update appointment');
    } finally {
      setUpdating(null);
    }
  }

  async function updateJourney(id, journeyStatus) {
    setUpdating(id);
    try {
      await API.patch(`/doctor/appointments/${id}/journey`, { journeyStatus });
      toast.success(`Status: ${journeyStatus.replace(/-/g, ' ')}`);
      await loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update status');
    } finally {
      setUpdating(null);
    }
  }

  // Today's appointments
  const today       = new Date().toDateString();
  const todayApts   = appointments.filter(a => new Date(a.appointmentDate).toDateString() === today)
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  const pending     = todayApts.filter(a => ['scheduled','confirmed'].includes(a.status));
  const completed   = todayApts.filter(a => a.status === 'completed');
  const highRisk    = patients.filter(p => ['high','critical'].includes(p.riskLevel));

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <DashboardLayout role="doctor">

      {/* Header */}
      <div className="mb-7 flex items-start justify-between flex-wrap gap-3 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">
            Good {greeting}, Dr. {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {todayApts.length > 0
              ? `${pending.length} waiting · ${completed.length} done · ${todayApts.length} total today`
              : 'No appointments today'}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="btn-press flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-28 animate-pulse border border-slate-100" />)}
        </div>
      ) : (
        <>
          {/* ── Today's Stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            <StatCard icon={Users}        label="Patients Today"      value={todayApts.length}  color="blue"   sub="Today"   />
            <StatCard icon={Clock}        label="Waiting / Scheduled" value={pending.length}    color="amber"  sub="Queue"   />
            <StatCard icon={CheckCircle}  label="Completed"           value={completed.length}  color="green"  sub="Done"    />
            <StatCard icon={AlertTriangle}label="High Risk Patients"  value={highRisk.length}   color="red"    sub="Monitor" />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── Left: Today's Queue ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Today's Queue with Journey Tracking */}
              <div className="med-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">Today's Patient Queue</h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-blue-400 rounded-full" />
                      <span className="text-xs text-slate-400">Waiting</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-green-400 rounded-full" />
                      <span className="text-xs text-slate-400">Confirmed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-slate-300 rounded-full" />
                      <span className="text-xs text-slate-400">Done</span>
                    </div>
                  </div>
                </div>

                {todayApts.length === 0 ? (
                  <div className="text-center py-10">
                    <Calendar size={36} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No appointments today</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {todayApts.map((apt, queueNum) => {
                      const patient = apt.patient;
                      const name    = patient?.user?.name || 'Patient';
                      const isActive= ['scheduled','confirmed'].includes(apt.status);
                      const isUpdating = updating === apt._id;
                      const position = queueNum + 1;

                      return (
                        <div key={apt._id} className={`rounded-xl border-2 p-4 transition-all ${
                          apt.journeyStatus === 'in-consultation' ? 'border-green-300 bg-green-50' :
                          isActive ? 'border-slate-200 bg-white hover:border-teal-200' :
                          'border-slate-100 bg-slate-50 opacity-70'
                        }`}>
                          <div className="flex items-start gap-3">
                            {/* Queue number */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                              apt.journeyStatus === 'in-consultation' ? 'bg-green-500 text-white' :
                              isActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {apt.status === 'completed' ? <CheckCircle size={15} /> : position}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {apt.timeSlot?.start || new Date(apt.appointmentDate).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                                    {' · '}{apt.reason || 'Consultation'}
                                    {' · '}<span className="capitalize">{apt.type}</span>
                                  </p>
                                </div>
                                <JourneyBadge status={apt.journeyStatus || apt.status} />
                              </div>

                              {/* Risk + allergies mini badges */}
                              {patient && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {patient.riskLevel && patient.riskLevel !== 'low' && (
                                    <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-semibold border border-red-100">
                                      {patient.riskLevel} risk
                                    </span>
                                  )}
                                  {patient.allergies?.length > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-semibold border border-amber-100">
                                      ⚠ {patient.allergies.slice(0, 2).join(', ')}
                                    </span>
                                  )}
                                  {patient.chronicConditions?.length > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-semibold border border-purple-100">
                                      {patient.chronicConditions[0]}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Action buttons */}
                              {isActive && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {apt.status !== 'confirmed' && (
                                    <button onClick={() => changeStatus(apt._id, 'confirmed')}
                                      disabled={isUpdating}
                                      className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-40">
                                      ✓ Confirm
                                    </button>
                                  )}
                                  {apt.journeyStatus !== 'in-consultation' && (
                                    <button onClick={() => updateJourney(apt._id, 'in-consultation')}
                                      disabled={isUpdating}
                                      className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-all disabled:opacity-40">
                                      🩺 Start
                                    </button>
                                  )}
                                  <button onClick={() => updateJourney(apt._id, 'lab')}
                                    disabled={isUpdating}
                                    className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100 transition-all disabled:opacity-40">
                                    🔬 Lab
                                  </button>
                                  <button onClick={() => updateJourney(apt._id, 'pharmacy')}
                                    disabled={isUpdating}
                                    className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-orange-50 text-orange-700 rounded-lg border border-orange-200 hover:bg-orange-100 transition-all disabled:opacity-40">
                                    💊 Pharmacy
                                  </button>
                                  <button onClick={() => changeStatus(apt._id, 'completed')}
                                    disabled={isUpdating}
                                    className="btn-press px-2.5 py-1.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-200 transition-all disabled:opacity-40">
                                    ✓ Done
                                  </button>
                                  {apt.type === 'video' && apt.meetingLink && (
                                    <a href={apt.meetingLink} target="_blank" rel="noreferrer"
                                      className="px-2.5 py-1.5 text-[10px] font-bold bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200 hover:bg-cyan-100 transition-all flex items-center gap-1">
                                      <Video size={10} /> Join
                                    </a>
                                  )}
                                  <Link href={`/doctor/chat?patientId=${patient?._id}`}
                                    className="px-2.5 py-1.5 text-[10px] font-bold bg-teal-50 text-teal-700 rounded-lg border border-teal-200 hover:bg-teal-100 transition-all flex items-center gap-1">
                                    <Bot size={10} /> AI
                                  </Link>
                                </div>
                              )}

                              {isUpdating && (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Loader2 size={12} className="animate-spin text-teal-500" />
                                  <span className="text-xs text-slate-400">Updating…</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Patients */}
              <div className="med-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">Connected Patients</h2>
                  <Link href="/doctor/patients" className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                    View all <ChevronRight size={12} />
                  </Link>
                </div>
                {patients.length === 0 ? (
                  <div className="text-center py-8">
                    <Users size={32} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No connected patients yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {patients.slice(0, 6).map((p, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center font-bold text-green-700 text-sm shrink-0">
                          {p.user?.name?.[0]?.toUpperCase() || 'P'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{p.user?.name}</p>
                          <p className="text-xs text-slate-400">{p.patientId}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.healthScore && (
                            <span className="text-xs font-mono text-slate-400">{p.healthScore}</span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            p.riskLevel === 'critical' ? 'bg-red-100 text-red-600' :
                            p.riskLevel === 'high'     ? 'bg-orange-100 text-orange-600' :
                            p.riskLevel === 'medium'   ? 'bg-amber-100 text-amber-600' :
                            'bg-green-100 text-green-600'
                          }`}>{p.riskLevel || 'low'}</span>
                          <Link href={`/doctor/chat?patientId=${p._id}`}
                            className="p-1 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 transition-all">
                            <Bot size={12} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right Column ── */}
            <div className="space-y-5">

              {/* Quick Actions */}
              <div className="med-card p-5">
                <h2 className="font-bold text-slate-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  {[
                    { icon: Bot,          label: 'Clinical AI Assistant', href: '/doctor/chat',         cls: 'bg-emerald-50 text-emerald-600' },
                    { icon: QrCode,       label: 'Scan Patient QR',       href: '/doctor/scan',         cls: 'bg-blue-50 text-blue-600'       },
                    { icon: ClipboardList,label: 'Add Medical Record',    href: '/doctor/records',      cls: 'bg-green-50 text-green-600'     },
                    { icon: Users,        label: 'All Patients',          href: '/doctor/patients',     cls: 'bg-purple-50 text-purple-600'   },
                    { icon: Clock,        label: 'Manage Availability',   href: '/doctor/availability', cls: 'bg-orange-50 text-orange-600'   },
                  ].map(a => (
                    <Link key={a.label} href={a.href}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-200">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.cls}`}>
                        <a.icon size={16} className="text-current" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{a.label}</span>
                      <ChevronRight size={14} className="text-slate-300 ml-auto" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Hospital Resources */}
              {resources && (
                <div className="med-card p-5">
                  <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Bed size={16} className="text-slate-400" /> Hospital Resources
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    <ResourceCard
                      icon={Stethoscope}
                      label="OPD"
                      value={`${resources.opd?.value || 0} patients`}
                      description={resources.opd?.description || 'Today'}
                      status={resources.opd?.status || 'available'}
                      color="blue"
                    />
                    <ResourceCard
                      icon={Bed}
                      label="Beds"
                      value={`${resources.beds?.available || 0} free`}
                      description={`${resources.beds?.occupied || 0}/${resources.beds?.total || 100} occupied`}
                      status={resources.beds?.status || 'available'}
                      color="green"
                    />
                    <ResourceCard
                      icon={HeartPulse}
                      label="ICU"
                      value={`${resources.icu?.available || 0} free`}
                      description={`${resources.icu?.occupied || 0}/${resources.icu?.total || 20} occupied`}
                      status={resources.icu?.status || 'available'}
                      color="purple"
                    />
                    <ResourceCard
                      icon={FlaskConical}
                      label="Laboratory"
                      value={`${resources.lab?.pendingReports || 0} pending`}
                      description={resources.lab?.turnaroundTime || '2-4 hrs'}
                      status={resources.lab?.status || 'available'}
                      color="orange"
                    />
                  </div>

                  {resources.highRiskPatients > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                        <AlertTriangle size={12} /> {resources.highRiskPatients} high-risk patients need attention
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Doctor Profile Card */}
              <div className="rounded-2xl p-5 text-white shadow-lg" style={DOC_GRAD}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center font-bold text-xl">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-syne font-bold">Dr. {user?.name}</p>
                    <p className="text-emerald-100 text-xs capitalize">
                      {doctor?.specialization || 'General Physician'}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {[
                    ['License',    doctor?.licenseNumber || '—'],
                    ['Hospital',   doctor?.hospital     || '—'],
                    ['Experience', doctor?.experience ? `${doctor.experience} years` : '—'],
                    ['Fee',        doctor?.consultationFee ? `₹${doctor.consultationFee}` : '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-emerald-200">{label}</span>
                      <span className="font-medium truncate ml-4">{val}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                  <span className="text-emerald-200 text-xs">
                    {doctor?.isAvailable ? 'Available for appointments' : 'Currently unavailable'}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}