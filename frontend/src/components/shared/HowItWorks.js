"use client";
import { useEffect, useRef, useState } from "react";
import { UserPlus, QrCode, Stethoscope, ShieldCheck } from "lucide-react";

const steps = [
  { icon: UserPlus,    color: "from-sky-400 to-blue-500",     title: "Create Your Account",  desc: "Sign up as a patient and verify your identity securely in minutes." },
  { icon: QrCode,      color: "from-teal-400 to-cyan-500",    title: "Generate Your QR",     desc: "Get a unique health card linked to your complete medical profile."    },
  { icon: Stethoscope, color: "from-violet-400 to-purple-500",title: "Visit a Specialist",   desc: "Doctors scan your QR for instant access to your full history."        },
  { icon: ShieldCheck, color: "from-emerald-400 to-green-500",title: "Track Your Care",      desc: "Records, prescriptions, and follow-ups all in one secure place."      },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="med-pill mb-5">How It Works</span>
          <h2 className="font-syne text-slate-900 text-4xl md:text-5xl font-extrabold tracking-tight mt-4">
            Four steps to <span className="text-grad">better care.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-5">
          {steps.map(({ icon: Icon, color, title, desc }, i) => (
            <div key={title} className="relative"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(16px)",
                transition: `all 0.55s ease ${i * 0.1}s`,
              }}>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px z-0" style={{ width: "calc(100% - 60px)", left: "60px" }}>
                  <div className="h-full w-full" style={{ background: "linear-gradient(90deg, rgba(14,165,233,0.3), rgba(14,165,233,0.05))" }} />
                </div>
              )}
              <div className="relative z-10 bento p-6 hover:shadow-md transition-all group">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon size={24} className="text-white" />
                </div>
                <span className="text-xs font-bold text-slate-300 absolute top-5 right-5 font-syne">{`0${i + 1}`}</span>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}