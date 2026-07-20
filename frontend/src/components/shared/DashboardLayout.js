"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import {
  Activity, Bell, Bot, Calendar, CheckCheck, ClipboardList,
  Clock, CreditCard, FileText, HeartPulse, LayoutDashboard,
  LogOut, Menu, Pill, QrCode, Scan, Shield, Siren,
  Stethoscope, User, Users, Video, X, ChevronRight, Settings,
  Package,
} from "lucide-react";

const NAV = {
  patient: [
    { href: "/patient/dashboard",    icon: LayoutDashboard, label: "Dashboard"      },
    { href: "/patient/appointments", icon: Calendar,        label: "Appointments"   },
     { href: "/patient/health-packages", icon: Package,        label: "Health Packages"   },
    { href: "/patient/vitals",       icon: Activity,        label: "Vitals"         },
    { href: "/patient/records",      icon: FileText,        label: "Records"        },
    { href: "/patient/medicines",    icon: Pill,            label: "Medicines"      },
    { href: "/patient/billing",      icon: CreditCard,      label: "Billing"        },
    { href: "/patient/insurance",    icon: Shield,          label: "Insurance"      },
    { href: "/patient/qr",           icon: QrCode,          label: "My QR"          },
    { href: "/patient/symptoms",     icon: Stethoscope,     label: "Symptoms"       },
    { href: "/patient/chat",         icon: Bot,             label: "AI Assistant"   },
    { href: "/patient/emergency",    icon: Siren,           label: "Emergency",     danger: true },
  ],
  doctor: [
    { href: "/doctor/dashboard",     icon: LayoutDashboard, label: "Dashboard"      },
    { href: "/doctor/patients",      icon: Users,           label: "Patients"       },
    { href: "/doctor/appointments",  icon: Calendar,        label: "Appointments"   },
    { href: "/doctor/consultations", icon: Video,           label: "Consultations"  },
    { href: "/doctor/records",       icon: ClipboardList,   label: "Add Record"     },
    { href: "/doctor/scan",          icon: Scan,            label: "Scan QR"        },
    { href: "/doctor/chat",          icon: Bot,             label: "Clinical AI"    },
    { href: "/doctor/availability",  icon: Clock,           label: "Schedule"       },
    { href: "/doctor/profile",       icon: User,            label: "My Profile"     },
  ],
  insurance: [
    { href: "/insurance/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/insurance/claims",    icon: ClipboardList,   label: "Claims"    },
    { href: "/insurance/policies",  icon: Shield,          label: "Policies"  },
  ],
  admin: [
    { href: "/admin/dashboard",  icon: LayoutDashboard, label: "Dashboard"  },
    { href: "/admin/users",      icon: Users,           label: "Users"      },
    { href: "/admin/monitoring", icon: Activity,        label: "Monitoring" },
    { href: "/admin/audit",      icon: FileText,        label: "Audit Logs" },
  ],
};

function NotifDropdown({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getNotifications({ limit: 20 }).then(r => setItems(r.data.notifications || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  const unread = items.filter(n => !n.isRead).length;
  const markOne = async id => { await markNotificationRead(id).catch(() => {}); setItems(p => p.map(n => n._id === id ? { ...n, isRead: true } : n)); };
  const markAll = async () => { await markAllNotificationsRead().catch(() => {}); setItems(p => p.map(n => ({ ...n, isRead: true }))); };

  return (
    <div className="absolute right-0 top-full mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ background: "var(--grad-primary)" }}>
        <span className="text-sm font-bold text-white">
          Notifications {unread > 0 && <span className="text-xs text-white/70 ml-1">({unread} unread)</span>}
        </span>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-white font-semibold flex items-center gap-1 hover:underline">
              <CheckCheck size={11} /> All read
            </button>
          )}
          <button onClick={onClose} className="text-white/80 hover:text-white p-0.5"><X size={14} /></button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
        {loading ? (
          <div className="py-8 flex justify-center"><div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center"><Bell size={24} className="text-slate-200 mx-auto mb-2" /><p className="text-sm text-slate-400">All caught up!</p></div>
        ) : items.map(n => (
          <div key={n._id} onClick={() => !n.isRead && markOne(n._id)}
            className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${n.isRead ? "hover:bg-slate-50" : "bg-teal-50/40 hover:bg-teal-50"}`}>
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.isRead ? "bg-slate-200" : "bg-teal-500"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${n.isRead ? "text-slate-500" : "text-slate-900"}`}>{n.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
            </div>
            {n.link && <Link href={n.link} onClick={onClose} className="text-teal-500 shrink-0 mt-1"><ChevronRight size={13} /></Link>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children, role: roleProp }) {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const router   = useRouter();
  const role     = roleProp || user?.role || "patient";
  const navItems = NAV[role] || [];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [badge,      setBadge]      = useState(0);
  const notifRef = useRef(null);

  const loadBadge = useCallback(async () => {
    try { const r = await getNotifications({ limit: 30 }); setBadge((r.data.notifications||[]).filter(n=>!n.isRead).length); } catch {}
  }, []);
  useEffect(() => { loadBadge(); const t = setInterval(loadBadge, 60000); return () => clearInterval(t); }, [loadBadge]);
  useEffect(() => {
    if (!notifOpen) return;
    const h = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [notifOpen]);
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const handleLogout  = () => { logout(); router.push("/login"); };
  const currentLabel  = navItems.find(n => pathname === n.href || pathname.startsWith(n.href+"/"))?.label ?? "Dana Shivam";

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl med-icon-bubble flex items-center justify-center shrink-0">
            <HeartPulse size={17} className="text-white" />
          </div>
          <span className="font-syne font-extrabold text-slate-900 text-[15px]">Dana Shivam</span>
        </Link>
      </div>

      {/* User card */}
      {user && (
        <div className="mx-3 mt-4 mb-3 p-3.5 rounded-2xl bg-gradient-to-br from-teal-50 to-sky-50 border border-teal-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-sm font-bold text-slate-600 shrink-0 overflow-hidden border border-teal-100">
              {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : user.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{role === "doctor" ? `Dr. ${user.name}` : user.name}</p>
              <p className="text-[10px] text-teal-600 capitalize font-semibold">{role}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href+"/");
          const Icon   = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all ${
                active ? "hb-active-nav" : item.danger ? "text-red-500 hover:bg-red-50" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}>
              <Icon size={16} className="shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 pt-3 border-t border-slate-100 space-y-0.5">
        {role === "patient" && (
          <Link href="/patient/profile"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all ${pathname === "/patient/profile" ? "hb-active-nav" : "text-slate-600 hover:bg-slate-50"}`}>
            <Settings size={16} /> My Profile
          </Link>
        )}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 fixed inset-y-0 left-0 z-30 border-r border-slate-100 shadow-sm">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-64 z-50 shadow-2xl">
            {SidebarContent}
            <button onClick={() => setDrawerOpen(false)} className="absolute top-5 right-3 p-1.5 rounded-xl bg-slate-100 text-slate-600">
              <X size={15} />
            </button>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">

        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 lg:px-6 h-16 flex items-center gap-3">
          <button onClick={() => setDrawerOpen(true)} className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-600">
            <Menu size={18} />
          </button>
          <p className="flex-1 text-sm font-bold text-slate-800 truncate">{currentLabel}</p>

          <div className="flex items-center gap-2">
            {role === "doctor" && (
              <Link href="/doctor/consultations"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-teal-400/30 hover:shadow-teal-400/50 transition-all"
                style={{ background: "var(--grad-primary)" }}>
                <Video size={12} /> <span className="hidden sm:inline">Consultations</span>
              </Link>
            )}
            <div ref={notifRef} className="relative">
              <button onClick={() => { setNotifOpen(v => !v); if (!notifOpen) setBadge(0); }}
                className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all">
                <Bell size={17} />
                {badge > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} />}
            </div>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 overflow-hidden border border-slate-200">
              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : user?.name?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-7 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}