"use client";
import Link from "next/link";
import { User, Stethoscope, ArrowRight, Check } from "lucide-react";

const portals = [
  {
    icon: User,
    title: "Patient Portal",
    subtitle: "Your complete health companion",
    color: "from-sky-400 to-blue-500",
    bgClass: "bg-surface-blue",
    features: [
      "View medical records & lab reports",
      "Book appointments online",
      "Generate QR health card",
      "Track bills & health packages",
    ],
    href: "/register", cta: "Register as Patient",
    featured: false,
  },
  {
    icon: Stethoscope,
    title: "Doctor Portal",
    subtitle: "Clinical tools for better outcomes",
    color: "from-teal-400 to-cyan-500",
    bgClass: "",
    features: [
      "Scan patient QR instantly",
      "Manage appointments & queue",
      "Write prescriptions & records",
      "Clinical AI decision support",
    ],
    href: "/register", cta: "Register as Doctor",
    featured: true,
  },
];

export default function Portals() {
  return (
    <section id="portals" className="py-24 bg-surface-soft">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="med-pill mb-5">Portals</span>
          <h2 className="font-syne text-slate-900 text-4xl md:text-5xl font-extrabold tracking-tight mt-4">
            Built for patients <span className="text-grad">and doctors.</span>
          </h2>
          <p className="text-slate-500 mt-4 max-w-lg mx-auto">
            One platform, two powerful portals — connecting every step of the care journey.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {portals.map(({ icon: Icon, title, subtitle, color, features, href, cta, featured }) => (
            <div key={title}
              className={`relative rounded-3xl p-8 overflow-hidden card-hover ${
                featured
                  ? "text-white shadow-xl"
                  : "bg-white border border-slate-100 shadow-sm"
              }`}
              style={featured ? { background: "var(--grad-primary)" } : {}}>

              {featured && <div className="mesh-dark animate-mesh opacity-50" />}

              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
                  featured ? "bg-white/20" : `bg-gradient-to-br ${color}`
                }`}>
                  <Icon size={22} className="text-white" />
                </div>

                <h3 className={`font-syne text-2xl font-extrabold mb-1 ${featured ? "text-white" : "text-slate-900"}`}>{title}</h3>
                <p className={`text-sm mb-6 ${featured ? "text-white/70" : "text-slate-500"}`}>{subtitle}</p>

                <ul className="space-y-3 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        featured ? "bg-white/25" : "bg-teal-100"
                      }`}>
                        <Check size={12} className={featured ? "text-white" : "text-teal-600"} />
                      </div>
                      <span className={featured ? "text-white/90" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href={href}
                  className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold transition-all ${
                    featured
                      ? "bg-white text-slate-900 hover:bg-teal-50"
                      : "text-white shadow-lg shadow-teal-400/35 hover:shadow-teal-400/55 hover:scale-[1.01]"
                  }`}
                  style={featured ? {} : { background: "var(--grad-primary)" }}>
                  {cta} <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}