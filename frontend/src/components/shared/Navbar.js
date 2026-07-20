"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import { HeartPulse, ChevronDown, Menu, X, Sparkles } from "lucide-react";

const links = [
  { label: "Home",         href: "/"          },
  { label: "Specialities", href: "/#features" },
  { label: "Our Doctors",  href: "/#doctors"  },
];

const INSURANCE = [
  "Bajaj Allianz General Insurance","HDFC Ergo General Insurance","Star Health Insurance",
  "Chola MS General Insurance","Cigna TTK Health Insurance","Universal Sompo General Insurance",
  "ICICI Lombard","Liberty General Insurance","Health India","Amul Dairy",
];

export default function Navbar() {
  const [scrolled, setScrolled]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [insOpen, setInsOpen]         = useState(false);
  const { user, logout }              = useAuthStore();
  const router                        = useRouter();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    h(); return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    if (!insOpen) return;
    const h = e => { if (!e.target.closest("#ins-dd")) setInsOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [insOpen]);

  const handleLogout  = () => { logout(); router.push("/"); };
  const dashHref      = user ? `/${user.role}/dashboard` : "/login";

  const navBase = scrolled
    ? "bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-100"
    : "bg-white/0";

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${navBase}`}>
      <div className="max-w-7xl mx-auto px-5 h-18 flex items-center justify-between py-3.5">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl med-icon-bubble flex items-center justify-center
            group-hover:scale-105 transition-transform shrink-0">
            <HeartPulse size={18} className="text-white" />
          </div>
          <div className="leading-none">
            <p className={`font-syne font-extrabold text-[15px] ${scrolled ? "text-slate-900" : "text-white"}`}>
              Dana Shivam
            </p>
            <p className={`text-[9px] font-semibold tracking-widest uppercase ${scrolled ? "text-slate-400" : "text-white/60"}`}>
              Heart &amp; Super Speciality
            </p>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-sm">
          {links.map(({ label, href }) => (
            <a key={label} href={href}
              className="text-sm font-semibold text-slate-600 hover:text-teal-600 px-4 py-2 rounded-xl hover:bg-teal-50 transition-all">
              {label}
            </a>
          ))}
          <div id="ins-dd" className="relative">
            <button onClick={() => setInsOpen(v => !v)}
              className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-teal-600 px-4 py-2 rounded-xl hover:bg-teal-50 transition-all">
              Insurance
              <ChevronDown size={13} className={`transition-transform duration-200 ${insOpen ? "rotate-180" : ""}`} />
            </button>
            {insOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 max-h-72 overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 mb-1">
                  Accepted Partners
                </p>
                {INSURANCE.map(p => (
                  <div key={p} className="px-3 py-2 text-xs text-slate-600 hover:bg-teal-50 hover:text-teal-700 rounded-xl transition-colors cursor-default">
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link href={dashHref}
                className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${
                  scrolled ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/15"
                }`}>
                Dashboard
              </Link>
              <button onClick={handleLogout}
                className="text-sm font-bold px-5 py-2.5 rounded-xl text-white shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:scale-[1.02] transition-all"
                style={{ background: "var(--grad-primary)" }}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login"
                className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${
                  scrolled ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/15"
                }`}>
                Sign In
              </Link>
              <Link href="/register"
                className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl text-white shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:scale-[1.02] transition-all"
                style={{ background: "var(--grad-primary)" }}>
                <Sparkles size={13} /> Book Appointment
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className={`md:hidden p-2.5 rounded-xl ${scrolled ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/15"} transition-all`}
          onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileOpen ? "max-h-screen" : "max-h-0"}`}>
        <div className="bg-white border-t border-slate-100 px-5 py-5 space-y-1">
          {links.map(({ label, href }) => (
            <a key={label} href={href} onClick={() => setMobileOpen(false)}
              className="block text-sm font-bold text-slate-700 py-2.5 px-3 rounded-xl hover:bg-teal-50 hover:text-teal-700 transition-all">
              {label}
            </a>
          ))}
          <div>
            <button onClick={() => setInsOpen(v => !v)}
              className="flex items-center justify-between w-full text-sm font-bold text-slate-700 py-2.5 px-3 rounded-xl hover:bg-teal-50 transition-all">
              Insurance Partners
              <ChevronDown size={13} className={`transition-transform ${insOpen ? "rotate-180" : ""}`} />
            </button>
            {insOpen && (
              <div className="pl-3 mt-1 max-h-36 overflow-y-auto space-y-0.5">
                {INSURANCE.map(p => (
                  <p key={p} className="text-xs text-slate-500 py-1 px-2">{p}</p>
                ))}
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <>
                <Link href={dashHref} onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold text-center py-3 border-2 border-slate-200 rounded-xl text-slate-700">
                  Dashboard
                </Link>
                <button onClick={handleLogout}
                  className="text-sm font-bold py-3 rounded-xl text-white" style={{ background: "var(--grad-primary)" }}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold text-center py-3 border-2 border-slate-200 rounded-xl text-slate-700">
                  Sign In
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold text-center py-3 rounded-xl text-white" style={{ background: "var(--grad-primary)" }}>
                  Book Appointment
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}