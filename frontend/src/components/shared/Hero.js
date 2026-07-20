"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, HeartPulse, ShieldCheck, Sparkles, Star } from "lucide-react";

function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick  = now => {
          const p = Math.min((now - start) / duration, 1);
          setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return [value, ref];
}

function Stat({ value, suffix, label, delay }) {
  const [count, ref] = useCountUp(value);
  return (
    <div ref={ref} className="text-center" style={{ animationDelay: delay }}>
      <p className="font-syne text-3xl font-extrabold text-slate-900 tabular-nums">
        {count}{suffix}
      </p>
      <p className="text-slate-500 text-xs mt-1 font-medium">{label}</p>
    </div>
  );
}

const heroServices = [
  { emoji: "🔍", title: "Find a Doctor",       desc: "Choose from 14+ specialists across departments" },
  { emoji: "📅", title: "Book Appointment",    desc: "Live slots, instant confirmation, reminders"     },
  { emoji: "💊", title: "Health Packages",     desc: "Preventive check-ups from ₹1,100 onwards"       },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-0">
      {/* Light mesh gradient — not dark */}
      <div className="absolute inset-0 dot-grid opacity-40" />
      <div className="mesh-light animate-mesh" />

      {/* Decorative ring */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full border border-teal-100 opacity-60" />
      <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full border border-sky-100 opacity-80" />

      <div className="relative max-w-7xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-12 gap-8 items-center pt-4">

          {/* Copy — 6 cols */}
          <div className="lg:col-span-6 animate-fade-in-up">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-7 border border-teal-100 bg-teal-50 shadow-sm">
              <Star size={12} className="text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-teal-700">Dana Shivam Hospital · Jaipur · Est. 1999</span>
            </div>

            <h1 className="font-syne text-slate-900 text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.06] tracking-tight text-balance">
              Cardiac care that
              <br />
              <span className="text-grad">moves with you.</span>
            </h1>

            <p className="text-slate-500 text-lg mt-6 max-w-md leading-relaxed">
              Fifteen speciality departments, AI-assisted records, and a connected care
              platform — built around the patients of Jaipur.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-9">
              <Link href="/register"
                className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-bold text-white
                  shadow-lg shadow-teal-400/35 hover:shadow-teal-400/55 hover:scale-[1.02] transition-all"
                style={{ background: "var(--grad-primary)" }}>
                Book Appointment <ArrowRight size={16} />
              </Link>
              <Link href="/login"
                className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-bold text-slate-700
                  border-2 border-slate-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-all">
                Patient Login
              </Link>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-6 mt-11 pt-9 border-t border-slate-100">
              <Stat value={25}  suffix="+"  label="Years of care"    delay="0s"    />
              <Stat value={15}  suffix=""   label="Specialities"     delay="0.1s"  />
              <Stat value={50}  suffix="k+" label="Patients treated" delay="0.2s"  />
            </div>
          </div>

          {/* Visual bento — 6 cols */}
          <div className="lg:col-span-6 animate-fade-in-right">
            <div className="grid grid-cols-2 gap-4">

              {/* Main image */}
              <div className="col-span-2 rounded-3xl overflow-hidden relative h-60 shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=85"
                  alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="text-white text-xs font-bold bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    Cardiology &amp; Super Speciality
                  </span>
                </div>
              </div>

              {/* Health score card */}
              <div className="med-card rounded-3xl p-5 animate-float-slow">
                <div className="w-10 h-10 rounded-2xl med-icon-bubble flex items-center justify-center mb-3 shrink-0">
                  <HeartPulse size={18} className="text-white" />
                </div>
                <p className="font-bold text-slate-900 text-sm">Health Score</p>
                <p className="text-slate-400 text-xs mt-0.5">AI-powered insights</p>
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-4/5 rounded-full" style={{ background: "var(--grad-primary)" }} />
                </div>
                <p className="text-xs font-bold text-teal-600 mt-2">87/100 · Good</p>
              </div>

              {/* Secure card */}
              <div className="med-card rounded-3xl p-5 animate-float-card float-delay-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3 shrink-0">
                  <ShieldCheck size={18} className="text-emerald-600" />
                </div>
                <p className="font-bold text-slate-900 text-sm">Secure Records</p>
                <p className="text-slate-400 text-xs mt-0.5">Role-based access control</p>
                <div className="mt-3 flex gap-1">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i < 3 ? "bg-emerald-400" : "bg-slate-100"}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Service strip */}
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {heroServices.map(({ emoji, title, desc }, i) => (
            <div key={title}
              className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-teal-100 hover:shadow-sm transition-all"
              style={{ animationDelay: `${i * 0.08}s` }}>
              <span className="text-2xl shrink-0 mt-0.5">{emoji}</span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}