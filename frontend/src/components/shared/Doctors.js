"use client";
import { useEffect, useRef, useState } from "react";
import { Award, GraduationCap, Stethoscope } from "lucide-react";

const featuredDoctor = {
  photo: null, initials: "SG",
  name: "Dr. Sunil Kumar Garssa",
  role: "Director & Senior Consultant Cardiology",
  qualifications: "MD, DM (Cardiology) — SGPGI Lucknow · FACC · FESC · FSCAI",
  bio: [
    "A renowned interventional cardiologist from Jaipur with an MBBS from SMS Medical College, MD from RNT Medical College, and DM in Cardiology from SGPGI Lucknow. Fellow of the American College of Cardiology, European Society of Cardiology, and SCAI.",
    "Expert in radial-route angioplasty, complex bifurcation procedures, congenital heart disease interventions, and biventricular pacemaker (CRT/CRT-D) implantation.",
  ],
  highlights: [
    "Featured in Forbes Magazine (2021) — \"Leaders by Example\"",
    "Young Entrepreneur in Cardiology award (JMA, 2017)",
    "Business Leader of Rajasthan (2019)",
  ],
};

const doctors = [
  { photo: null, initials:"ST", color:"from-pink-400 to-rose-500",   name:"Dr. Shalini Tomar Garssa", role:"Non-Interventional Cardiologist", qualifications:"MBBS, PGDHHM"              },
  { photo: null, initials:"RG", color:"from-violet-400 to-purple-500",name:"Dr. Rajvir Singh Garssa",  role:"Brain & Spine Surgery",           qualifications:"MS, M.Ch (AIIMS)"          },
  { photo: null, initials:"SD", color:"from-amber-400 to-orange-500", name:"Dr. Subhash Doot",         role:"Gastroenterologist",               qualifications:"MD, DM (Gastro)"           },
  { photo: null, initials:"CS", color:"from-sky-400 to-blue-500",     name:"Dr. C.P. Suthar",          role:"Diabetologist & Intensivist",      qualifications:"MD (Medicine), FCCS (USA)" },
];

function Avatar({ photo, initials, color, size }) {
  const s = size === "lg"
    ? "w-full max-w-[200px] aspect-square text-4xl mx-auto lg:mx-0"
    : "w-14 h-14 text-base shrink-0";
  if (photo) {
    return <div className={`${s} rounded-3xl overflow-hidden shadow-lg ring-4 ring-white`}><img src={photo} alt={initials} className="w-full h-full object-cover" /></div>;
  }
  return (
    <div className={`${s} rounded-3xl bg-gradient-to-br ${color || "from-teal-400 to-cyan-500"} flex items-center justify-center font-syne font-extrabold text-white shadow-lg`}>
      {initials}
    </div>
  );
}

export default function Doctors() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="doctors" ref={ref} className="py-24 bg-surface-soft">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="med-pill mb-5">Our Team</span>
          <h2 className="font-syne text-slate-900 text-4xl md:text-5xl font-extrabold tracking-tight mt-4">
            Our key <span className="text-grad">doctors.</span>
          </h2>
          <p className="text-slate-500 mt-4 max-w-lg mx-auto">
            Backed by state-of-the-art equipment and decades of combined experience.
          </p>
        </div>

        {/* Featured */}
        <div className="med-card rounded-3xl p-7 lg:p-10 grid lg:grid-cols-[220px_1fr] gap-8 items-start mb-6 card-hover">
          <div>
            <Avatar photo={featuredDoctor.photo} initials={featuredDoctor.initials} color="from-teal-400 to-cyan-500" size="lg" />
            <div className="mt-5 text-center lg:text-left">
              <h3 className="font-syne font-extrabold text-slate-900">{featuredDoctor.name}</h3>
              <p className="text-sm font-semibold mt-1 text-grad">{featuredDoctor.role}</p>
              <p className="text-xs text-slate-400 mt-1.5">{featuredDoctor.qualifications}</p>
            </div>
          </div>
          <div>
            {featuredDoctor.bio.map((p, i) => <p key={i} className="text-sm text-slate-600 leading-relaxed mb-3">{p}</p>)}
            <div className="mt-4 space-y-2.5">
              {featuredDoctor.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Award size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  {h}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Others */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {doctors.map((d, i) => (
            <div key={d.name} className="med-card card-hover rounded-3xl p-5 text-center"
              style={{ opacity: inView ? 1 : 0, transition: `opacity 0.5s ease ${i * 0.08}s` }}>
              <Avatar photo={d.photo} initials={d.initials} color={d.color} size="md" />
              <div className="mt-4">
                <h3 className="font-bold text-slate-900 text-sm">{d.name}</h3>
                <p className="text-xs font-semibold mt-1 text-grad">{d.role}</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-slate-400">
                  <GraduationCap size={11} />
                  <span className="text-[11px]">{d.qualifications}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}