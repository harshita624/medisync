"use client";
import { useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { API } from "@/lib/api";
import toast from "react-hot-toast";
import {
  ClipboardCheck, HeartPulse, Droplet, Activity, Bone,
  Stethoscope, ScanLine, Sparkles, IndianRupee, ChevronDown,
  ChevronUp, Package, X, Calendar, Clock, ChevronLeft,
  ChevronRight, Loader2, CheckCircle, ArrowRight, Info,
} from "lucide-react";

const PACKAGES = [
  { title: "Basic Health Package",               price: 1500, icon: ClipboardCheck, color: "from-sky-400 to-blue-500",     tests: ["CBC","ESR","RBS","Urea","Creatinine","Lipid Profile","SGOT","SGPT","S. Bilirubin","ECG","X-Ray Chest"] },
  { title: "Healthy Heart Package",              price: 2300, icon: HeartPulse,     color: "from-rose-400 to-pink-500",    tests: ["ECG","ECHO","TMT","X-Ray Chest","RBS","Lipid Profile","Creatinine"] },
  { title: "Cardio Diabetic Package",            price: 2000, icon: Droplet,        color: "from-violet-400 to-purple-500",tests: ["Blood Sugar Fasting","Blood Sugar PP","Lipid Profile","HbA1c","2D Echo/TMT","ECG","X-Ray Chest","Urine Routine","Consultation"] },
  { title: "Cardiac & Whole Body Package",       price: 4000, icon: HeartPulse,     color: "from-red-400 to-rose-500",     tests: ["CBC","Random Blood Sugar","ECG","LFT","RFT","Lipid Profile","HbA1c","T3","T4","TSH","2D Echo/TMT","X-Ray Chest"] },
  { title: "Healthy Women Package",              price: 1800, icon: Sparkles,       color: "from-fuchsia-400 to-pink-500", tests: ["USG (Whole Abdomen)","CBC","Urine R/M","S. TSH","Blood Sugar (F)","Bilirubin","SGOT","SGPT","S. Creatinine","Pap Smear"] },
  { title: "Arthritis Package",                  price: 1100, icon: Bone,           color: "from-amber-400 to-orange-500", tests: ["CBC","ESR","Blood Sugar","Creatinine","CRP","Uric Acid","RA Factor","Calcium","X-Ray B/L Knee"] },
  { title: "Diabetic Health Check Up (Premium)", price: 5500, icon: Droplet,        color: "from-blue-400 to-cyan-500",    tests: ["CBC","ESR","Blood Glucose (R)","Lipid Profile","LFT","HbA1c","Vitamin D","T3","T4","TSH","Vitamin B12","ECG","USG Whole Abdomen"] },
  { title: "Cardiac and Vascular Check Up",      price: 5000, icon: Activity,       color: "from-teal-400 to-emerald-500", tests: ["CBC","ESR","Blood Glucose","Lipid Profile","SGOT","SGPT","Serum Urea","TSH","T3","T4","Urine Routine","X-Ray Chest","Echo Screening","Carotid Doppler"] },
  { title: "Premium Whole Body — Male",          price: 8300, icon: Stethoscope,    color: "from-emerald-400 to-green-500",tests: ["CBC","ESR","Blood Group & Rh","Blood Glucose","Vitamin B12","HbA1c","Lipid Profile","LFT","PSA","USG Whole Abdomen","ECG","X-Ray Chest","TMT","2D Echo"] },
  { title: "Premium Whole Body — Female",        price: 7500, icon: Stethoscope,    color: "from-cyan-400 to-teal-500",    tests: ["CBC","ESR","Blood Group & Rh","Blood Glucose","Vitamin B12","HbA1c","Lipid Profile","LFT","Pap Smear","USG Whole Abdomen","ECG","X-Ray Chest","TMT","2D Echo"] },
];

const VISIBLE = 6;

function getPackageSlots(dateStr) {
  if (!dateStr) return [];
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  if (day === 0) return [];

  const slots = [];
  const startHour = 7, startMin = 0, endHour = 11, endMin = 30;

  let cur = startHour * 60 + startMin;
  const fin = endHour * 60 + endMin;

  while (cur <= fin) {
    const h  = Math.floor(cur / 60);
    const m  = cur % 60;
    const nh = Math.floor((cur + 30) / 60);
    const nm = (cur + 30) % 60;
    slots.push({
      start: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
      end:   `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`,
    });
    cur += 30;
  }
  return slots;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function shiftDate(d, n) {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}
function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function isSunday(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDay() === 0;
}

// ── Package Booking Modal ─────────────────────────────────────────────────────
function PackageBookModal({ pkg, onClose, onBooked }) {
  const [date,    setDate]    = useState(() => {
    const t = todayStr();
    return isSunday(t) ? shiftDate(t, 1) : t;
  });
  const [selSlot, setSelSlot] = useState(null);
  const [booking, setBooking] = useState(false);

  const slots   = getPackageSlots(date);
  const sunday  = isSunday(date);

  function handleDateChange(newDate) {
    setDate(newDate);
    setSelSlot(null);
  }

  // ── THE FIX: calls the real dedicated backend route via the shared,
  // CORS-safe API client — no more doctor-fallback, no more raw axios ──
  async function confirm() {
    if (!selSlot) return toast.error('Please select a time slot');
    setBooking(true);
    try {
      await API.post('/patient/health-packages', {
        packageName:  pkg.title,
        packagePrice: pkg.price,
        date,
        timeSlot:     selSlot,
        tests:        pkg.tests,
      });
      toast.success(`${pkg.title} booked for ${fmtDate(date)} at ${selSlot.start}!`);
      onBooked();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Booking failed. Please call us at +91 91160 03461.');
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-syne font-bold text-lg text-slate-900">Book Health Package</h2>
            <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-xl bg-gradient-to-r ${pkg.color} text-white text-xs font-bold`}>
              <pkg.icon size={13} /> {pkg.title}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Fee bar */}
        <div className="px-6 py-3 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-teal-700">Package fee</p>
          <p className="font-syne font-extrabold text-teal-700 text-lg">₹{pkg.price.toLocaleString('en-IN')}</p>
        </div>

        <div className="p-6 space-y-5">

          {/* Tests included */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ScanLine size={11} /> Tests Included ({pkg.tests.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pkg.tests.map(t => (
                <span key={t} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Health packages are conducted <strong>Monday to Saturday, 7:00 AM – 12:00 PM</strong> at Dana Shivam Hospital.
              Please arrive 15 minutes early. Bring this booking confirmation.
            </p>
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Select Visit Date</label>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => { const prev = shiftDate(date, -1); if (prev >= todayStr()) handleDateChange(prev); }}
                disabled={date <= todayStr()}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 transition-all">
                <ChevronLeft size={16} />
              </button>
              <div className="flex-1">
                <input type="date" value={date} min={todayStr()}
                  onChange={e => handleDateChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                <p className={`text-xs mt-1 ${sunday ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                  {sunday ? '🚫 Closed on Sundays — please pick another day' : fmtDate(date)}
                </p>
              </div>
              <button type="button" onClick={() => handleDateChange(shiftDate(date, 1))}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Time slot picker */}
          {!sunday && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Select Time Slot
                <span className="text-xs font-normal text-slate-400 ml-1">(Morning sessions only)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {slots.map(s => (
                  <button key={s.start} type="button" onClick={() => setSelSlot(s)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                      selSlot?.start === s.start
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400'
                    }`}
                    style={selSlot?.start === s.start ? { background: 'var(--grad-primary)' } : {}}>
                    {s.start}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <Clock size={11} /> Slots are 30 minutes · Please come fasting for blood tests
              </p>
            </div>
          )}

          {/* Fee summary */}
          <div className="rounded-2xl border border-teal-200 p-4 bg-teal-50">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Total to pay</span>
              <span className="font-syne font-extrabold text-teal-700 text-xl">₹{pkg.price.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Payable at Dana Shivam Hospital billing counter on your visit day.</p>
          </div>

          {/* Confirm button */}
          <button onClick={confirm} disabled={booking || !selSlot || sunday}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2 transition-all shadow-lg"
            style={{ background: 'var(--grad-primary)' }}>
            {booking
              ? <><Loader2 size={16} className="animate-spin" /> Booking…</>
              : <><CheckCircle size={16} /> Confirm Package Booking</>}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Need help? Call <a href="tel:+919116003461" className="text-teal-600 font-bold">+91 91160 03461</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Package Card ──────────────────────────────────────────────────────────────
function PackageCard({ pkg, onBook }) {
  const [open, setOpen] = useState(false);
  const hasMore = pkg.tests.length > VISIBLE;
  const shown   = open ? pkg.tests : pkg.tests.slice(0, VISIBLE);

  return (
    <div className="bento p-5 flex flex-col card-hover">
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-4 shadow-sm`}>
        <pkg.icon size={20} className="text-white" />
      </div>
      <h3 className="font-bold text-slate-900 text-sm mb-3">{pkg.title}</h3>
      <div className="flex flex-wrap gap-1.5 mb-3 flex-1">
        {shown.map(t => (
          <span key={t} className="text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
        ))}
      </div>
      {hasMore && (
        <button onClick={() => setOpen(v => !v)}
          className="text-xs font-bold text-teal-600 hover:underline mb-3 flex items-center gap-1 self-start">
          {open ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> +{pkg.tests.length - VISIBLE} more</>}
        </button>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto gap-2">
        <div className="flex items-center gap-1 font-syne font-extrabold text-lg text-slate-900">
          <IndianRupee size={16} />{pkg.price.toLocaleString('en-IN')}
        </div>
        <button onClick={() => onBook(pkg)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-4 py-2 rounded-xl shadow-sm hover:scale-[1.03] transition-all"
          style={{ background: 'var(--grad-primary)' }}>
          Book <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HealthPackagesPage() {
  const [bookingPkg, setBookingPkg] = useState(null);
  const [booked,     setBooked]     = useState(false);

  function handleBooked() {
    setBooked(true);
    setTimeout(() => setBooked(false), 6000);
  }

  return (
    <DashboardLayout role="patient">
      <div className="mb-6">
        <h1 className="text-2xl font-syne font-bold text-slate-900">Health Packages</h1>
        <p className="text-slate-500 text-sm mt-1">Preventive check-up packages — Dana Shivam Heart & Super Speciality Hospital</p>
      </div>

      {/* Banner */}
      <div className="rounded-3xl p-5 mb-6 flex items-start gap-3 text-white" style={{ background: 'var(--grad-primary)' }}>
        <ScanLine size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm">Book directly — no separate appointment needed</p>
          <p className="text-white/80 text-xs mt-1 leading-relaxed">
            Pick a date and morning slot. All tests are done at Dana Shivam Hospital.
            Available <strong>Monday to Saturday, 7:00 AM – 12:00 PM</strong>.
          </p>
        </div>
      </div>

      {/* Success banner */}
      {booked && (
        <div className="mb-5 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle size={20} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold text-emerald-800">Package booked successfully!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              View it under{' '}
              <a href="/patient/billing" className="underline font-semibold">Billing</a>{' '}
              — a pending bill has been created for this booking.
              Please arrive 15 minutes early and come fasting if blood tests are included.
            </p>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PACKAGES.map(pkg => <PackageCard key={pkg.title} pkg={pkg} onBook={setBookingPkg} />)}
      </div>

      {/* Help footer */}
      <div className="med-card rounded-3xl p-5 mt-5">
        <div className="flex items-start gap-3">
          <Package size={20} className="text-slate-300 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-700 text-sm">Need help choosing the right package?</p>
            <p className="text-sm text-slate-500 mt-1">
              Ask our{' '}
              <a href="/patient/chat" className="text-teal-600 font-bold hover:underline">AI Assistant</a>
              {' '}for a recommendation based on your health profile, or call{' '}
              <a href="tel:+919116003461" className="text-teal-600 font-bold hover:underline">+91 91160 03461</a>.
            </p>
          </div>
        </div>
      </div>

      {bookingPkg && (
        <PackageBookModal
          pkg={bookingPkg}
          onClose={() => setBookingPkg(null)}
          onBooked={handleBooked}
        />
      )}
    </DashboardLayout>
  );
}