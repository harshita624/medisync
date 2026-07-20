'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import {
  getMyAppointments, getAllDoctors, cancelAppointment, getOpenSlots, bookSlot,
} from '@/lib/api';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Building2, Calendar, ChevronLeft, ChevronRight,
  Clock, Loader2, Phone, Plus, Search, Stethoscope, Video,
  X, CheckCircle, Bot, Package, IndianRupee, ChevronDown,
} from 'lucide-react';

/* ── Health packages data ── */
const HEALTH_PACKAGES = [
  { title: 'Basic Health Package',             price: 1500,  tests: ['CBC','ESR','RBS','Urea','Creatinine','Lipid Profile','SGOT','SGPT','S. Bilirubin','ECG','X-Ray Chest'] },
  { title: 'Healthy Heart Package',            price: 2300,  tests: ['ECG','ECHO','TMT','X-Ray Chest','RBS','Lipid Profile','Creatinine'] },
  { title: 'Cardio Diabetic Package',          price: 2000,  tests: ['Blood Sugar Fasting','Blood Sugar PP','Lipid Profile','HbA1c','2D Echo/TMT','ECG','X-Ray Chest','Urine Routine','Consultation'] },
  { title: 'Cardiac & Whole Body Package',     price: 4000,  tests: ['CBC','Random Blood Sugar','ECG','LFT','RFT','Lipid Profile','HbA1c','T3','T4','TSH','2D Echo/TMT','X-Ray Chest'] },
  { title: 'Healthy Women Package',            price: 1800,  tests: ['USG (Whole Abdomen)','CBC','Urine R/M','S.TSH','Blood Sugar (F)','Bilirubin','SGOT','SGPT','S.Creatinine','Pap Smear'] },
  { title: 'Arthritis Package',                price: 1100,  tests: ['CBC','ESR','Blood Sugar','Creatinine','CRP','Uric Acid','RA Factor','Calcium','X-Ray B/L Knee'] },
  { title: 'Diabetic Health Check Up (Premium)',price: 5500, tests: ['CBC','ESR','Blood Glucose (R)','Lipid Profile','LFT','HbA1c','Vitamin D','T3','T4','TSH','Vitamin B12','ECG','USG Whole Abdomen'] },
  { title: 'Cardiac and Vascular Check Up',    price: 5000,  tests: ['CBC','ESR','Blood Glucose','Lipid Profile','SGOT','SGPT','Serum Urea','TSH','T3','T4','Urine Routine','X-Ray Chest','Echo Screening','Carotid Doppler'] },
  { title: 'Premium Whole Body — Male',        price: 8300,  tests: ['CBC','ESR','Blood Group & Rh','Blood Glucose','Vitamin B12','HbA1c','Lipid Profile','LFT','PSA','USG Whole Abdomen','ECG','X-Ray Chest','TMT','2D Echo'] },
  { title: 'Premium Whole Body — Female',      price: 7500,  tests: ['CBC','ESR','Blood Group & Rh','Blood Glucose','Vitamin B12','HbA1c','Lipid Profile','LFT','Pap Smear','USG Whole Abdomen','ECG','X-Ray Chest','TMT','2D Echo'] },
];

function todayStr()    { return new Date().toISOString().slice(0, 10); }
function shiftDate(d, n) {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}
function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function toAPIDate(di) {
  if (!di) return todayStr();
  if (typeof di === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(di)) return di;
  const d = new Date(di);
  if (isNaN(d)) return todayStr();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── THE FIX: time-aware expiry check ─────────────────────────────────────────
   An appointment is expired when the appointment datetime (date + slot time)
   is in the past — not just when the date is in the past.
   Example: a 09:00 slot booked for today is expired at 10:00, but a 14:00
   slot for today is still upcoming at 10:00.
── */
function isExpired(apt) {
  if (!['scheduled', 'confirmed'].includes(apt.status)) return false;
  const aptDate = new Date(apt.appointmentDate);
  // Build full datetime using the slot start time if available
  if (apt.timeSlot?.start) {
    const [h, m] = apt.timeSlot.start.split(':').map(Number);
    aptDate.setHours(h, m, 0, 0);
  } else {
    // No time slot — treat as end of that day (23:59)
    aptDate.setHours(23, 59, 59, 0);
  }
  return aptDate < new Date();
}

const STATUS_COLORS = {
  scheduled:          'bg-blue-50 text-blue-600 border-blue-100',
  confirmed:          'bg-emerald-50 text-emerald-600 border-emerald-100',
  'in-consultation':  'bg-teal-50 text-teal-600 border-teal-100',
  completed:          'bg-slate-100 text-slate-500 border-slate-200',
  cancelled:          'bg-red-50 text-red-500 border-red-100',
  'no-show':          'bg-orange-50 text-orange-500 border-orange-100',
  expired:            'bg-amber-50 text-amber-600 border-amber-100',
};

const TYPE_ICONS = { 'in-person': Building2, video: Video, phone: Phone };

const SPECIALIZATIONS = [
  'All', 'Cardiologist', 'Cardiac Surgeon', 'Neurologist', 'Neurosurgeon',
  'Gastroenterologist', 'GI & Laparoscopic Surgeon', 'General Physician',
  'Diabetologist & Intensivist', 'Urologist', 'Plastic Surgeon',
  'Orthopedic Surgeon', 'ENT Specialist', 'Physiotherapist',
  'Nephrologist', 'Radiologist', 'Critical Care Specialist',
];

/* ── Symptom → specialist map ── */
const SYMPTOM_MAP = {
  'chest pain': 'Cardiologist', 'heart': 'Cardiologist', 'palpitation': 'Cardiologist',
  'angioplasty': 'Cardiologist', 'ecg': 'Cardiologist', 'echo': 'Cardiologist',
  'stroke': 'Neurologist', 'headache': 'Neurologist', 'migraine': 'Neurologist',
  'seizure': 'Neurologist', 'brain': 'Neurologist', 'epilepsy': 'Neurologist',
  'stomach': 'Gastroenterologist', 'liver': 'Gastroenterologist',
  'acidity': 'Gastroenterologist', 'jaundice': 'Gastroenterologist',
  'fever': 'General Physician', 'cold': 'General Physician', 'cough': 'General Physician',
  'diabetes': 'Diabetologist & Intensivist', 'thyroid': 'General Physician',
  'kidney': 'Urologist', 'urine': 'Urologist', 'prostate': 'Urologist',
  'burn': 'Plastic Surgeon', 'cosmetic': 'Plastic Surgeon',
  'bone': 'Orthopedic Surgeon', 'joint': 'Orthopedic Surgeon',
  'knee': 'Orthopedic Surgeon', 'spine': 'Orthopedic Surgeon',
  'fracture': 'Orthopedic Surgeon', 'back pain': 'Orthopedic Surgeon',
  'ear': 'ENT Specialist', 'nose': 'ENT Specialist', 'throat': 'ENT Specialist',
  'dialysis': 'Nephrologist', 'creatinine': 'Nephrologist',
  'mri': 'Radiologist', 'ct scan': 'Radiologist', 'x-ray': 'Radiologist',
  'icu': 'Critical Care Specialist', 'critical': 'Critical Care Specialist',
};

/* ══════════════════════════════ SUBCOMPONENTS ════════════════════════════════ */

function DoctorRecommendation({ doctors, onSelect }) {
  const [symptoms, setSymptoms] = useState('');
  const [matches,  setMatches]  = useState([]);
  const [searched, setSearched] = useState(false);

  function findDoctors() {
    if (!symptoms.trim()) return;
    const lower = symptoms.toLowerCase();
    let recommended = null;
    for (const [kw, sp] of Object.entries(SYMPTOM_MAP)) {
      if (lower.includes(kw)) { recommended = sp; break; }
    }
    const filtered = doctors.filter(d =>
      recommended ? d.specialization?.toLowerCase().includes(recommended.toLowerCase()) : true
    );
    setMatches(filtered.length > 0 ? filtered : doctors.slice(0, 3));
    setSearched(true);
  }

  return (
    <div className="bg-teal-50 border border-teal-100 rounded-3xl p-5 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Bot size={18} className="text-teal-600" />
        <p className="font-bold text-teal-800">Find the Right Specialist</p>
      </div>
      <p className="text-xs text-teal-600 mb-3">
        Describe your symptoms and we'll recommend the most suitable Dana Shivam specialist
      </p>
      <div className="flex gap-2">
        <input
          value={symptoms}
          onChange={e => setSymptoms(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && findDoctors()}
          placeholder="e.g. chest pain, headache, joint pain..."
          className="flex-1 px-4 py-2.5 border border-teal-200 rounded-xl text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button onClick={findDoctors}
          className="btn-press px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
          style={{ background: 'var(--grad-primary)' }}>
          <Search size={14} /> Find
        </button>
      </div>
      {searched && matches.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold text-teal-700">Recommended at Dana Shivam:</p>
          {matches.slice(0, 3).map(d => (
            <div key={d._id} onClick={() => onSelect(d)}
              className="card-hover flex items-center gap-3 p-3 bg-white border border-teal-200 rounded-xl
                cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-xl med-icon-bubble flex items-center justify-center
                font-bold text-white shrink-0">
                {d.user?.name?.[0]?.toUpperCase() || 'D'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">Dr. {d.user?.name}</p>
                <p className="text-xs text-slate-500">{d.specialization} · {d.hospital || 'Dana Shivam Hospital'}</p>
              </div>
              {d.consultationFee > 0 && (
                <span className="text-xs font-bold text-teal-600">₹{d.consultationFee}</span>
              )}
              <CheckCircle size={16} className="text-teal-500 shrink-0" />
            </div>
          ))}
        </div>
      )}
      {searched && matches.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">No doctors found. Try a general physician.</p>
      )}
    </div>
  );
}

/* ── Health Package selector (inside booking modal) ── */
function PackageSelector({ selected, onSelect }) {
  const [open,   setOpen]   = useState(false);
  const [expand, setExpand] = useState(null);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-all">
        <div className="flex items-center gap-2.5">
          <Package size={15} className="text-teal-600" />
          <span className="text-sm font-bold text-slate-700">
            {selected ? selected.title : 'Add a Health Package (optional)'}
          </span>
          {selected && (
            <span className="text-xs font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
              +₹{selected.price.toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected && (
            <button type="button" onClick={e => { e.stopPropagation(); onSelect(null); }}
              className="text-slate-400 hover:text-red-400 p-0.5 rounded">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="p-3 max-h-72 overflow-y-auto space-y-2 border-t border-slate-100">
          <p className="text-xs text-slate-400 px-1 mb-1">Dana Shivam Hospital Health Packages</p>
          {HEALTH_PACKAGES.map((pkg, i) => {
            const isSel = selected?.title === pkg.title;
            const isExp = expand === i;
            return (
              <div key={pkg.title}
                className={`rounded-xl border-2 transition-all ${isSel ? 'border-teal-400 bg-teal-50' : 'border-slate-100 bg-white hover:border-teal-200'}`}>
                <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => onSelect(isSel ? null : pkg)}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                    {isSel && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{pkg.title}</p>
                    <p className="text-xs text-slate-500">{pkg.tests.slice(0,3).join(', ')}{pkg.tests.length > 3 ? ` +${pkg.tests.length-3} more` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-teal-600">₹{pkg.price.toLocaleString('en-IN')}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setExpand(isExp ? null : i); }}
                      className="text-slate-400 hover:text-slate-600 p-0.5">
                      <ChevronDown size={12} className={`transition-transform ${isExp ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                {isExp && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                    {pkg.tests.map(t => (
                      <span key={t} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Book Modal ── */
function BookModal({ doctors, onClose, onBooked, preSelectedDoctor }) {
  const [step,        setStep]        = useState(preSelectedDoctor ? 2 : 1);
  const [doctorId,    setDoctorId]    = useState(preSelectedDoctor?._id || '');
  const [date,        setDate]        = useState(todayStr());
  const [slots,       setSlots]       = useState([]);
  const [loadSlots,   setLoadSlots]   = useState(false);
  const [selSlot,     setSelSlot]     = useState(null);
  const [type,        setType]        = useState('in-person');
  const [reason,      setReason]      = useState('');
  const [booking,     setBooking]     = useState(false);
  const [specFilter,  setSpecFilter]  = useState('All');
  const [search,      setSearch]      = useState('');
  const [slotMsg,     setSlotMsg]     = useState('');
  const [selPackage,  setSelPackage]  = useState(null);

  useEffect(() => {
    if (!doctorId || !date) { setSlots([]); return; }
    let active = true;
    setLoadSlots(true); setSelSlot(null); setSlotMsg('');
    getOpenSlots(doctorId, toAPIDate(date))
      .then(r => {
        if (!active) return;
        const available = r.data.slots || [];
        setSlots(available);
        if (!available.length) setSlotMsg(r.data.reason || 'No slots available on this date');
      })
      .catch(() => { if (!active) return; setSlots([]); setSlotMsg('Could not load slots. Please try again.'); })
      .finally(() => { if (active) setLoadSlots(false); });
    return () => { active = false; };
  }, [doctorId, date]);

  const chosenDoctor  = doctors.find(d => d._id === doctorId) || preSelectedDoctor;
  const consultFee    = chosenDoctor?.consultationFee || 0;
  const packageFee    = selPackage?.price || 0;
  const totalFee      = consultFee + packageFee;

  const filteredDoctors = doctors.filter(d => {
    const matchSpec   = specFilter === 'All' || d.specialization?.toLowerCase().includes(specFilter.toLowerCase());
    const matchSearch = !search || d.user?.name?.toLowerCase().includes(search.toLowerCase()) || d.specialization?.toLowerCase().includes(search.toLowerCase());
    return matchSpec && matchSearch;
  });

  async function confirm() {
    if (!selSlot || !reason.trim()) return toast.error('Select a slot and enter a reason');
    setBooking(true);
    try {
      await bookSlot({
        doctor:        doctorId,
        date:          toAPIDate(date),
        slotStart:     selSlot.start,
        slotEnd:       selSlot.end,
        type,
        reason:        selPackage ? `${reason} | Health Package: ${selPackage.title}` : reason,
        fee:           totalFee,
        healthPackage: selPackage ? { name: selPackage.title, price: selPackage.price } : null,
      });
      toast.success('Appointment booked!');
      onBooked(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally { setBooking(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-syne font-bold text-xl text-slate-900">Book Appointment</h2>
            <p className="text-xs text-slate-500 mt-0.5">Dana Shivam Heart & Super Speciality Hospital</p>
            <div className="flex items-center gap-1.5 mt-2">
              {[1,2,3].map(n => (
                <div key={n} className={`h-1.5 rounded-full transition-all ${step >= n ? 'w-8' : 'w-4 bg-slate-200'}`}
                  style={step >= n ? { width: '2rem', background: 'var(--grad-primary)' } : {}} />
              ))}
              <span className="text-xs text-slate-400 ml-1">Step {step} of 3</span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* STEP 1 — Choose doctor */}
          {step === 1 && (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-3 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search doctor or specialty"
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs
                      focus:outline-none focus:ring-2 focus:ring-teal-400" />
                </div>
                <select value={specFilter} onChange={e => setSpecFilter(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs
                    focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                  {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {filteredDoctors.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No doctors available</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {filteredDoctors.map(d => (
                    <div key={d._id} onClick={() => setDoctorId(d._id)}
                      className={`card-hover flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        doctorId === d._id ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-200'
                      }`}>
                      <div className="w-11 h-11 rounded-xl med-icon-bubble flex items-center justify-center
                        font-bold text-white shrink-0">
                        {d.user?.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm">Dr. {d.user?.name}</p>
                        <p className="text-xs text-slate-500">{d.specialization}</p>
                        <p className="text-xs text-slate-400">{d.hospital || 'Dana Shivam Hospital'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {d.consultationFee > 0 && (
                          <p className="text-xs font-bold text-teal-600">₹{d.consultationFee}</p>
                        )}
                        {d.hasUpcomingSlots ? (
                          <span className="text-xs text-emerald-600 flex items-center gap-1 justify-end">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Available
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">No slots</span>
                        )}
                        {doctorId === d._id && <CheckCircle size={16} className="text-teal-500 ml-auto mt-1" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button disabled={!doctorId} onClick={() => setStep(2)}
                className="btn-press w-full py-3 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-all"
                style={{ background: 'var(--grad-primary)' }}>
                Continue
              </button>
            </>
          )}

          {/* STEP 2 — Date & slot */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl med-icon-bubble flex items-center justify-center
                  font-bold text-white shrink-0">
                  {chosenDoctor?.user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-teal-900 text-sm">Dr. {chosenDoctor?.user?.name}</p>
                  <p className="text-xs text-teal-600">{chosenDoctor?.specialization}</p>
                </div>
                {consultFee > 0 && (
                  <span className="ml-auto text-sm font-bold text-teal-600">₹{consultFee}</span>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Date</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setDate(d => shiftDate(d, -1))} disabled={date <= todayStr()}
                    className="btn-press w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center
                      hover:bg-slate-50 disabled:opacity-30 transition-all">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex-1">
                    <input type="date" value={date} min={todayStr()} onChange={e => setDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm
                        focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    <p className="text-xs text-slate-400 mt-1">{fmtDate(date)}</p>
                  </div>
                  <button type="button" onClick={() => setDate(d => shiftDate(d, 1))}
                    className="btn-press w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center
                      hover:bg-slate-50 transition-all">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Available Slots {slots.length > 0 && <span className="text-xs text-teal-500 font-normal ml-1">{slots.length} open</span>}
                </label>
                {loadSlots ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 size={16} className="animate-spin text-teal-500" />
                    <span className="text-sm text-slate-500">Checking availability…</span>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="py-6 text-center bg-slate-50 rounded-xl border border-slate-200">
                    <Clock size={26} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-semibold">No slots on this date</p>
                    <p className="text-xs text-slate-400 mt-1">{slotMsg || 'Try a different date.'}</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
                    {slots.map(s => (
                      <button key={s.start} type="button" onClick={() => setSelSlot(s)}
                        className={`btn-press px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                          selSlot?.start === s.start
                            ? 'text-white border-transparent shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400'
                        }`}
                        style={selSlot?.start === s.start ? { background: 'var(--grad-primary)' } : {}}>
                        {s.start}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold
                    text-slate-600 hover:bg-slate-50 transition-all">
                  Back
                </button>
                <button type="button" disabled={!selSlot} onClick={() => setStep(3)}
                  className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
                  style={{ background: 'var(--grad-primary)' }}>
                  Continue
                </button>
              </div>
            </>
          )}

          {/* STEP 3 — Confirm + package */}
          {step === 3 && (
            <>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-sm">
                {[
                  ['Doctor',     `Dr. ${chosenDoctor?.user?.name || ''}`],
                  ['Specialty',  chosenDoctor?.specialization || ''],
                  ['Hospital',   chosenDoctor?.hospital || 'Dana Shivam Hospital'],
                  ['Date',       fmtDate(date)],
                  ['Time',       `${selSlot?.start || ''} to ${selSlot?.end || ''}`],
                  ['Consult Fee',consultFee > 0 ? `₹${consultFee}` : 'Free'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-bold text-slate-800">{value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Appointment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'in-person', Icon: Building2, label: 'In Person' },
                    { val: 'video',     Icon: Video,     label: 'Video'     },
                    { val: 'phone',     Icon: Phone,     label: 'Phone'     },
                  ].map(({ val, Icon, label }) => (
                    <button key={val} type="button" onClick={() => setType(val)}
                      className={`btn-press flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold
                        border-2 transition-all ${type === val
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-slate-200 text-slate-500 hover:border-teal-200'
                        }`}>
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Reason for Visit</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Describe your symptoms or reason for this appointment"
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm
                    focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Package size={14} className="text-teal-600" /> Health Package (optional)
                </label>
                <PackageSelector selected={selPackage} onSelect={setSelPackage} />
                {selPackage && (
                  <p className="text-xs text-teal-600 mt-2 px-1">
                    ✓ {selPackage.title} — tests will be done on the same day as your appointment
                  </p>
                )}
              </div>

              {/* Fee breakdown */}
              <div className={`rounded-xl border p-4 ${selPackage ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <IndianRupee size={12} /> Fee Breakdown
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Consultation fee</span>
                    <span className="font-semibold text-slate-700">
                      {consultFee > 0 ? `₹${consultFee.toLocaleString('en-IN')}` : 'Free'}
                    </span>
                  </div>
                  {selPackage && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{selPackage.title}</span>
                      <span className="font-semibold text-teal-700">₹{selPackage.price.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                    <span className="font-bold text-slate-800">Total</span>
                    <span className="font-extrabold text-teal-700 text-base">₹{totalFee.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Payment at hospital billing desk at time of visit.</p>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold
                    text-slate-600 hover:bg-slate-50 transition-all">
                  Back
                </button>
                <button type="button" onClick={confirm} disabled={booking || !reason.trim()}
                  className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40
                    flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'var(--grad-primary)' }}>
                  {booking
                    ? <><Loader2 size={16} className="animate-spin" /> Booking…</>
                    : <><Calendar size={16} /> Confirm Booking</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Cancel Modal ── */
function CancelModal({ apt, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      await cancelAppointment(apt._id);
      toast.success('Appointment cancelled');
      onDone(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel');
    } finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-center w-14 h-14 bg-red-50 rounded-2xl mx-auto mb-4">
          <AlertTriangle size={26} className="text-red-500" />
        </div>
        <h2 className="font-syne font-bold text-xl text-slate-900 text-center mb-2">Cancel Appointment?</h2>
        <p className="text-slate-500 text-sm text-center mb-6">
          Dr. {apt.doctor?.user?.name} on{' '}
          {new Date(apt.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {apt.timeSlot?.start ? ` at ${apt.timeSlot.start}` : ''}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">
            Keep It
          </button>
          <button onClick={go} disabled={loading}
            className="btn-press flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-60 transition-all">
            {loading ? 'Cancelling…' : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════ MAIN PAGE ════════════════════════════════ */

export default function AppointmentsPage() {
  const [appointments,   setAppointments]   = useState([]);
  const [doctors,        setDoctors]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState('upcoming');
  const [showBook,       setShowBook]       = useState(false);
  const [showRecommend,  setShowRecommend]  = useState(false);
  const [cancelTarget,   setCancelTarget]   = useState(null);
  const [preSelectedDoc, setPreSelectedDoc] = useState(null);

  const load = async () => {
    try {
      const [a, d] = await Promise.all([
        getMyAppointments().catch(() => ({ data: { appointments: [] } })),
        getAllDoctors().catch(() => ({ data: { doctors: [] } })),
      ]);
      setAppointments(a.data.appointments || []);
      setDoctors(d.data.doctors || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* ── THE FIX: use time-aware isExpired() instead of date-only check ── */
  const upcoming = appointments.filter(a => {
    if (['completed','cancelled','no-show'].includes(a.status)) return false;
    if (isExpired(a)) return false;
    return true;
  }).sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

  const past = appointments.filter(a => {
    if (['completed','cancelled','no-show'].includes(a.status)) return true;
    if (isExpired(a)) return true;
    return false;
  }).sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

  const displayed = tab === 'upcoming' ? upcoming : past;

  function openBookWithDoctor(doctor) {
    setPreSelectedDoc(doctor);
    setShowBook(true);
    setShowRecommend(false);
  }

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRecommend(v => !v)}
            className={`btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
              showRecommend ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-teal-300'
            }`}>
            <Bot size={15} /> Find Specialist
          </button>
          <button onClick={() => { setPreSelectedDoc(null); setShowBook(true); }}
            className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all"
            style={{ background: 'var(--grad-primary)' }}>
            <Plus size={15} /> Book Appointment
          </button>
        </div>
      </div>

      {showRecommend && <DoctorRecommendation doctors={doctors} onSelect={openBookWithDoctor} />}

      <div className="flex gap-2 mb-6">
        {['upcoming','past'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn-press px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
              tab === t ? 'text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300'
            }`}
            style={tab === t ? { background: 'var(--grad-primary)' } : {}}>
            {t} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="med-card rounded-2xl h-28 animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="med-card rounded-3xl p-16 text-center">
          <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-600 font-bold">No {tab} appointments</p>
          {tab === 'upcoming' && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button onClick={() => setShowRecommend(true)}
                className="btn-press px-4 py-2.5 border-2 border-teal-200 text-teal-700 text-sm font-bold rounded-xl hover:bg-teal-50 transition-all">
                <Bot size={14} className="inline mr-1.5" /> Find Specialist
              </button>
              <button onClick={() => setShowBook(true)}
                className="btn-press px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg"
                style={{ background: 'var(--grad-primary)' }}>
                Book Now
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((apt, i) => {
            const TypeIcon    = TYPE_ICONS[apt.type] || Building2;
            const expired     = isExpired(apt);
            const displayStatus = expired ? 'expired' : (apt.journeyStatus || apt.status);
            const canCancel   = !expired && ['scheduled','confirmed'].includes(apt.status);

            const reasonParts   = (apt.reason || '').split(' | Health Package: ');
            const displayReason = reasonParts[0];
            const packageInfo   = reasonParts[1];

            return (
              <div key={i} className="med-card card-hover rounded-2xl p-5 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                    <Stethoscope size={20} className="text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-bold text-slate-900">Dr. {apt.doctor?.user?.name || ''}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{apt.doctor?.specialization || ''}</p>
                        {apt.doctor?.hospital && (
                          <p className="text-xs text-slate-400 mt-0.5">{apt.doctor.hospital}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${
                          STATUS_COLORS[displayStatus] || 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {displayStatus.replace(/-/g,' ')}
                        </span>
                        {canCancel && (
                          <button onClick={() => setCancelTarget(apt)}
                            className="text-xs font-bold px-3 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-all">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(apt.appointmentDate).toLocaleDateString('en-IN', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      {apt.timeSlot?.start && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {apt.timeSlot.start}{apt.timeSlot.end ? ` to ${apt.timeSlot.end}` : ''}
                        </span>
                      )}
                      <span className="flex items-center gap-1 capitalize">
                        <TypeIcon size={11} /> {apt.type}
                      </span>
                      {apt.fee > 0 && (
                        <span className="font-semibold text-teal-600">₹{apt.fee.toLocaleString('en-IN')}</span>
                      )}
                    </div>

                    {displayReason && (
                      <p className="text-xs text-slate-500 mt-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                        {displayReason}
                      </p>
                    )}

                    {packageInfo && (
                      <div className="mt-2 flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                        <Package size={12} className="text-teal-600 shrink-0" />
                        <p className="text-xs font-semibold text-teal-700">Package: {packageInfo}</p>
                      </div>
                    )}

                    {apt.type === 'video' && apt.meetingLink &&
                      ['scheduled','confirmed','in-consultation'].includes(apt.status) && !expired && (
                      <button
                        onClick={() => window.open(apt.meetingLink, '_blank', 'noreferrer')}
                        className="btn-press inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl
                          bg-cyan-50 text-cyan-700 text-xs font-bold border border-cyan-100 hover:bg-cyan-100 transition-all">
                        <Video size={13} /> Join Video Consultation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showBook && (
        <BookModal
          doctors={doctors}
          preSelectedDoctor={preSelectedDoc}
          onClose={() => { setShowBook(false); setPreSelectedDoc(null); }}
          onBooked={load}
        />
      )}
      {cancelTarget && (
        <CancelModal
          apt={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={load}
        />
      )}
    </DashboardLayout>
  );
}