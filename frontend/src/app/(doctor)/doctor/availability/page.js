'use client';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { API } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Calendar, Check, ChevronLeft, ChevronRight,
  Clock, Info, Loader2, Save, X, AlertCircle,
} from 'lucide-react';

const DOC_GRAD = { background: 'linear-gradient(135deg, var(--emerald), var(--teal-dark))' };

// ── Generate 30-min slots from startH to endH ────────────────────────────────
function generateSlots(startH, endH) {
  const slots = [];
  for (let h = startH; h < endH; h++) {
    for (const m of [0, 30]) {
      if (h === endH - 1 && m === 30) break;
      const start = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const eh    = m === 30 ? h + 1 : h;
      const em    = m === 30 ? 0     : 30;
      const end   = `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
      slots.push({ start, end });
    }
  }
  return slots;
}

const MORNING   = generateSlots(8,  12);
const AFTERNOON = generateSlots(12, 17);
const EVENING   = generateSlots(17, 20);
const ALL_SLOTS = [...MORNING, ...AFTERNOON, ...EVENING];

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function displayDate(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function isToday(iso) { return iso === isoDate(new Date()); }
function isPast(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y,m-1,d,23,59,59);
  return dt < new Date();
}

export default function AvailabilityPage() {
  const [dateAvailability, setDateAvailability] = useState({}); // { 'YYYY-MM-DD': { isOff, slots: Set<start> } }
  const [selectedDate,     setSelectedDate]     = useState(isoDate(new Date()));
  const [viewMonth,        setViewMonth]         = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [saving,           setSaving]            = useState(false);
  const [loading,          setLoading]           = useState(true);
  const [dirty,            setDirty]             = useState(false);

  // Load existing availability
  useEffect(() => {
    API.get('/doctor/date-availability')
      .then(r => {
        const map = {};
        for (const entry of (r.data.dateAvailability || [])) {
          map[entry.date] = {
            isOff:  entry.isOff,
            active: new Set((entry.slots || []).filter(s => s.isActive).map(s => s.start)),
          };
        }
        setDateAvailability(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Current date state ───────────────────────────────────────────────────
  const currentEntry = dateAvailability[selectedDate] || { isOff: false, active: new Set() };
  const activeSlots  = currentEntry.active instanceof Set ? currentEntry.active : new Set(currentEntry.active || []);
  const isOff        = !!currentEntry.isOff;

  function updateEntry(updates) {
    setDateAvailability(prev => ({
      ...prev,
      [selectedDate]: {
        ...((prev[selectedDate]) || { isOff: false, active: new Set() }),
        ...updates,
      },
    }));
    setDirty(true);
  }

  function toggleSlot(slotStart) {
    if (isOff || isPast(selectedDate)) return;
    const next = new Set(activeSlots);
    if (next.has(slotStart)) next.delete(slotStart);
    else next.add(slotStart);
    updateEntry({ active: next });
  }

  function fillMorning()   { updateEntry({ active: new Set([...activeSlots, ...MORNING.map(s=>s.start)]) }); }
  function fillAfternoon() { updateEntry({ active: new Set([...activeSlots, ...AFTERNOON.map(s=>s.start)]) }); }
  function fillEvening()   { updateEntry({ active: new Set([...activeSlots, ...EVENING.map(s=>s.start)]) }); }
  function fillFullDay()   { updateEntry({ active: new Set(ALL_SLOTS.map(s=>s.start)) }); }
  function clearDay()      { updateEntry({ active: new Set() }); }
  function toggleOff()     { updateEntry({ isOff: !isOff, active: new Set() }); }

  // ── Save selected date ────────────────────────────────────────────────────
  async function saveDate() {
    if (isPast(selectedDate)) return toast.error('Cannot save past dates');
    setSaving(true);
    try {
      const entry = dateAvailability[selectedDate] || { isOff: false, active: new Set() };
      const active = entry.active instanceof Set ? entry.active : new Set(entry.active || []);
      const slots  = ALL_SLOTS
        .filter(s => active.has(s.start))
        .map(s => ({ start: s.start, end: s.end, isActive: true }));

      await API.put(`/doctor/date-availability/${selectedDate}`, {
        slots, isOff: !!entry.isOff,
      });
      toast.success(`Schedule saved for ${displayDate(selectedDate)}`);
      setDirty(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Calendar generation ───────────────────────────────────────────────────
  const { y: calY, m: calM } = viewMonth;
  const firstDay     = new Date(calY, calM, 1).getDay();
  const daysInMonth  = new Date(calY, calM + 1, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function prevMonth() { setViewMonth(p => p.m === 0 ? { y:p.y-1, m:11 } : { y:p.y, m:p.m-1 }); }
  function nextMonth() { setViewMonth(p => p.m === 11 ? { y:p.y+1, m:0  } : { y:p.y, m:p.m+1 }); }

  const totalActive = Object.values(dateAvailability)
    .reduce((sum, e) => sum + (e.isOff ? 0 : (e.active instanceof Set ? e.active.size : (e.active||[]).length)), 0);

  if (loading) return (
    <DashboardLayout role="doctor">
      <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-emerald-500" /></div>
    </DashboardLayout>
  );

  const SlotButton = ({ slot }) => {
    const on = activeSlots.has(slot.start);
    const locked = isPast(selectedDate) || isOff;
    return (
      <button onClick={() => toggleSlot(slot.start)} disabled={locked}
        className={`btn-press px-3 py-2 rounded-xl text-xs font-bold transition-all select-none ${
          locked      ? 'cursor-not-allowed opacity-40 bg-slate-100 text-slate-400' :
          on          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600' :
                        'bg-white border-2 border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
        }`}>
        {slot.start}
      </button>
    );
  };

  return (
    <DashboardLayout role="doctor">
      <div className="mb-5 flex items-start justify-between flex-wrap gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">Availability Schedule</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalActive} total active slots across {Object.keys(dateAvailability).filter(d => !dateAvailability[d]?.isOff && (dateAvailability[d]?.active?.size || 0) > 0).length} dates
          </p>
        </div>
        <button onClick={saveDate} disabled={saving || isPast(selectedDate)}
          style={dirty && !isPast(selectedDate) ? DOC_GRAD : {}}
          className={`btn-press flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            dirty && !isPast(selectedDate)
              ? 'text-white shadow-md shadow-emerald-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save {displayDate(selectedDate).split(',')[0]}
        </button>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">

        {/* ── Calendar ── */}
        <div className="med-card p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <ChevronLeft size={16} />
            </button>
            <p className="font-bold text-slate-900">{MONTHS[calM]} {calY}</p>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`blank-${i}`} />;
              const iso     = `${calY}-${String(calM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const entry   = dateAvailability[iso];
              const slotCnt = entry?.isOff ? 0 : (entry?.active instanceof Set ? entry.active.size : (entry?.active || []).length);
              const past    = isPast(iso);
              const today   = isToday(iso);
              const sel     = iso === selectedDate;
              const off     = !!entry?.isOff;

              return (
                <button key={iso} onClick={() => setSelectedDate(iso)}
                  className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all text-[11px] font-semibold ${
                    sel   ? 'bg-emerald-500 text-white shadow-sm' :
                    past  ? 'text-slate-300 cursor-not-allowed' :
                    off   ? 'bg-red-50 text-red-400 border border-red-100' :
                    today ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                    slotCnt > 0 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' :
                                  'text-slate-600 hover:bg-slate-50'
                  }`}>
                  {day}
                  {!past && slotCnt > 0 && !sel && (
                    <span className="text-[8px] font-bold text-emerald-600 leading-none">{slotCnt}</span>
                  )}
                  {off && !sel && <span className="text-[8px] text-red-400">off</span>}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            {[
              { color:'bg-emerald-100', label:'Has slots' },
              { color:'bg-red-50 border border-red-100', label:'Off' },
              { color:'bg-blue-50 border border-blue-200', label:'Today' },
              { color:'bg-slate-100', label:'Past / no slots' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${l.color}`} />
                <span className="text-[10px] text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Slot manager ── */}
        <div className="med-card p-6">
          {/* Date header */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Calendar size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{displayDate(selectedDate)}</p>
                <p className="text-sm text-slate-400">
                  {isOff ? '🔴 Marked as off' :
                   isPast(selectedDate) ? '⏰ Past date — read only' :
                   activeSlots.size > 0 ? `✅ ${activeSlots.size} slots open` :
                   'No slots set — patients cannot book this day'}
                </p>
              </div>
            </div>

            {!isPast(selectedDate) && (
              <div className="flex flex-wrap gap-2">
                {!isOff && (
                  <>
                    <button onClick={fillMorning}   className="btn-press px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">Morning</button>
                    <button onClick={fillAfternoon} className="btn-press px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">Afternoon</button>
                    <button onClick={fillEvening}   className="btn-press px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">Evening</button>
                    <button onClick={fillFullDay}   className="btn-press px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">Full Day</button>
                    <button onClick={clearDay}      className="btn-press px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl hover:border-red-300 hover:bg-red-50 hover:text-red-600">Clear</button>
                  </>
                )}
                <button onClick={toggleOff}
                  className={`btn-press px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    isOff ? 'bg-red-500 text-white border-red-500' : 'border-slate-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                  }`}>
                  {isOff ? '🔴 Day is Off' : 'Mark as Off'}
                </button>
              </div>
            )}
          </div>

          {isOff ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-red-50 rounded-2xl border border-red-100">
              <X size={36} className="text-red-300 mb-3" />
              <p className="font-bold text-red-500">This day is marked as off</p>
              <p className="text-sm text-red-400 mt-1">Patients cannot book appointments for this date</p>
              {!isPast(selectedDate) && (
                <button onClick={toggleOff} className="btn-press mt-4 px-4 py-2 bg-white border border-red-200 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50">
                  Re-enable this day
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Morning */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-2">
                  <Clock size={12} /> MORNING 8:00 – 12:00
                  <span className="text-emerald-500 font-normal normal-case">
                    ({MORNING.filter(s => activeSlots.has(s.start)).length}/{MORNING.length} selected)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {MORNING.map(slot => <SlotButton key={slot.start} slot={slot} />)}
                </div>
              </div>

              {/* Afternoon */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-2">
                  <Clock size={12} /> AFTERNOON 12:00 – 17:00
                  <span className="text-emerald-500 font-normal normal-case">
                    ({AFTERNOON.filter(s => activeSlots.has(s.start)).length}/{AFTERNOON.length} selected)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {AFTERNOON.map(slot => <SlotButton key={slot.start} slot={slot} />)}
                </div>
              </div>

              {/* Evening */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-2">
                  <Clock size={12} /> EVENING 17:00 – 20:00
                  <span className="text-emerald-500 font-normal normal-case">
                    ({EVENING.filter(s => activeSlots.has(s.start)).length}/{EVENING.length} selected)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {EVENING.map(slot => <SlotButton key={slot.start} slot={slot} />)}
                </div>
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <Info size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700">
                  <strong>Green slots</strong> are shown to patients when they book appointments.
                  Already-booked slots are automatically hidden from patients.
                  Click <strong>Save</strong> to publish changes for this date.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}