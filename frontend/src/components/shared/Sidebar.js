"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import toast from "react-hot-toast";
import {
  LayoutDashboard, FileText, Calendar, Shield, QrCode,Mic,Search,
  Bot, Users, Scan, LogOut, Activity, ClipboardList, UserCircle, Radar,
  Bell, CreditCard, Pill, Siren,
  Package
} from "lucide-react";

const navItems = {
  patient: [
    { href: "/patient/dashboard",    icon: LayoutDashboard, label: "Dashboard"    },
    { href: "/patient/records",      icon: FileText,        label: "Records & Documents"   },
    { href: "/patient/appointments", icon: Calendar,        label: "Appointments" },
    { href: "/patient/health-packages", icon: Package,        label: "Health Packages" },
    { href: "/patient/insurance",    icon: Shield,          label: "Insurance"    },
    { href: "/patient/billing",      icon: CreditCard,      label: "Bills & Payments" },
    { href: "/patient/medicines",    icon: Pill,            label: "Medicine Reminders" },
    { href: "/patient/qr",           icon: QrCode,          label: "QR Medical Packet"        },
    { href: "/patient/chat",         icon: Bot,             label: "AI Patient Assistant" },
    { href: "/patient/emergency",    icon: Siren,           label: "Emergency SOS" },
    { href: "/notifications",        icon: Bell,            label: "Notifications" },
    { href: "/patient/profile",      icon: UserCircle,      label: "My Profile"   },
{ icon: Activity, label: 'Vitals Tracker',     href: '/patient/vitals'   },
{ icon: Search,   label: 'Symptom Checker',    href: '/patient/symptoms' },
  ],
  doctor: [
    { href: "/doctor/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/doctor/patients",  icon: Users,           label: "Patients"  },
    { href: "/doctor/scan",      icon: Scan,            label: "Scan QR Packet"   },
    { href: "/doctor/records",   icon: FileText,        label: "Records"   },
    { href: "/doctor/chat", icon: Bot, label: "AI Doctor Assistant" },
    { href: "/notifications", icon: Bell, label: "Notifications" },
{ icon: Calendar, label: 'My Availability',   href: '/doctor/availability' },
  ],
  insurance: [
    { href: "/insurance/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/insurance/claims",    icon: ClipboardList,   label: "Claims"    },
    { href: "/insurance/policies",  icon: Shield,          label: "Policies"  },
    { href: "/notifications",       icon: Bell,            label: "Notifications" },
  ],
  admin: [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/users",     icon: Users,           label: "Users"     },
    { href: "/admin/monitoring", icon: Radar,           label: "Monitoring" },
    { href: "/notifications", icon: Bell, label: "Notifications" },
  ],
};

const roleColors = {
  patient:   { active: "bg-violet-600", shadow: "shadow-violet-200", dot: "bg-violet-500", text: "text-violet-600" },
  doctor:    { active: "bg-green-600",  shadow: "shadow-green-200",  dot: "bg-green-500",  text: "text-green-600"  },
  insurance: { active: "bg-purple-600", shadow: "shadow-purple-200", dot: "bg-purple-500", text: "text-purple-600" },
  admin:     { active: "bg-slate-800",  shadow: "shadow-slate-200", dot: "bg-slate-500",  text: "text-slate-600"  },
};

function SidebarContent({ onClose }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const items  = navItems[user?.role] || [];
  const colors = roleColors[user?.role] || roleColors.patient;

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    router.push("/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2 group" onClick={onClose}>
          <div className="w-8 h-8 hb-brand-mark rounded-lg flex items-center justify-center shadow-sm shadow-violet-200 group-hover:scale-105 transition-transform duration-200">
            <Activity size={16} className="text-white" />
          </div>
          <span className="font-extrabold text-lg text-slate-900">
            Dana<span className="text-violet-600"> Shivam</span>
          </span>
        </Link>
      </div>

      {/* User card */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 bg-white/70 rounded-2xl p-3 hover:bg-violet-50 transition-colors duration-200 border border-violet-100/70">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center font-bold text-violet-700 overflow-hidden text-sm shrink-0 animate-float-slow">
            {user?.avatar
              ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />
              : user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <div className={`ml-auto w-2 h-2 rounded-full shrink-0 ${colors.dot} animate-pulse`} />
        </div>
      </div>

      {/* Nav items — staggered */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item, i) => {
          const Icon   = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group animate-fade-in-left ${
                active
                  ? `hb-active-nav shadow-sm ${colors.shadow}`
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}>
              <Icon size={18} className={active ? "" : "group-hover:scale-110 transition-transform duration-200"} />
              {item.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all duration-200 group btn-press">
          <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          Logout
        </button>
      </div>
    </div>
  );
}
console.log("SIDEBAR FILE LOADED")

export default function Sidebar({ mobileOpen, onClose }) {
  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 hb-sidebar border-r h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 animate-fade-in-up" style={{ animationDuration: "0.2s" }} onClick={onClose} />
          <aside className="relative w-64 hb-sidebar h-full shadow-2xl z-10 animate-fade-in-left" style={{ animationDuration: "0.25s" }}>
            <SidebarContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}