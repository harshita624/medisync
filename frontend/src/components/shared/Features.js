"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  HeartPulse, Brain, Stethoscope, Activity, Syringe, Droplet,
  Sparkles, Bone, Ear, Dumbbell, BedDouble, ScanLine, Microscope, ArrowUpRight,
} from "lucide-react";

const specialities = [
  { icon: HeartPulse,  title: "Cardiology",                slug: "cardiology",        color: "from-rose-400 to-pink-500",    featured: true  },
  { icon: Brain,       title: "Neurology & Neurosurgery",  slug: "neurology",         color: "from-violet-400 to-purple-500"                  },
  { icon: Stethoscope, title: "Gastroenterology",          slug: "gastroenterology",  color: "from-amber-400 to-orange-500"                   },
  { icon: Activity,    title: "MD Physician & ICU",        slug: "md-physician-icu",  color: "from-sky-400 to-blue-500",     featured: true  },
  { icon: Syringe,     title: "Cardiac Surgeries",         slug: "cardiac-surgeries", color: "from-red-400 to-rose-500"                       },
  { icon: Droplet,     title: "Urology",                   slug: "urology",           color: "from-cyan-400 to-teal-500"                      },
  { icon: Sparkles,    title: "Plastic Surgery",           slug: "plastic-surgery",   color: "from-fuchsia-400 to-pink-500"                   },
  { icon: Bone,        title: "Orthopedics",               slug: "orthopedics",       color: "from-emerald-400 to-green-500"                  },
  { icon: Ear,         title: "ENT",                       slug: "ent",               color: "from-indigo-400 to-blue-500"                    },
  { icon: Dumbbell,    title: "Physiotherapy",             slug: "physiotherapy",     color: "from-lime-400 to-emerald-500"                   },
  { icon: Droplet,     title: "Nephrology & Dialysis",     slug: "dialysis",          color: "from-blue-400 to-cyan-500"                      },
  { icon: BedDouble,   title: "Critical Care Unit",        slug: "critical-care",     color: "from-orange-400 to-red-500",   featured: true  },
  { icon: ScanLine,    title: "Radiology",                 slug: "radiology",         color: "from-teal-400 to-cyan-500"                      },
  { icon: Microscope,  title: "GI & Laparoscopic Surgery", slug: "gi-laparoscopic",  color: "from-purple-400 to-violet-500"                  },
];

export default function Features() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="med-pill mb-5">Our Services</span>
          <h2 className="font-syne text-slate-900 text-4xl md:text-5xl font-extrabold tracking-tight mt-4">
            Speciality care, all <span className="text-grad">under one roof.</span>
          </h2>
          <p className="text-slate-500 mt-4 max-w-xl mx-auto">
            Fourteen departments, experienced specialists, and state-of-the-art equipment — built around your complete care journey.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {specialities.map((s, i) => (
            <Link key={s.title} href={`/specialities/${s.slug}`}
              className={`group relative bento p-5 flex flex-col items-start gap-3 overflow-hidden
                ${s.featured ? "sm:col-span-2 md:col-span-1" : ""}
              `}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(14px)",
                transition: `opacity 0.5s ease ${i * 0.04}s, transform 0.5s ease ${i * 0.04}s`,
              }}>

              {/* Color blob in corner — subtle */}
              <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${s.color} opacity-10 group-hover:opacity-20 transition-opacity`} />

              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm shrink-0`}>
                <s.icon size={20} className="text-white" />
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-teal-700 transition-colors">
                  {s.title}
                </h3>
              </div>

              <ArrowUpRight size={15} className="text-slate-300 group-hover:text-teal-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}