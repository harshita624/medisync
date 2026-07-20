"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import { loginUser as login } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Activity, Mail, Lock, Eye, EyeOff, ArrowRight,
  Chrome, User, Stethoscope, Building2
} from "lucide-react";

const ROLES = [
  { value: "patient",   icon: User,        label: "Patient",   accent: "bg-blue-600",   light: "bg-blue-50",   border: "border-blue-600",   text: "text-blue-700",   ring: "focus:ring-blue-500"   },
  { value: "doctor",    icon: Stethoscope, label: "Doctor",    accent: "bg-green-600",  light: "bg-green-50",  border: "border-green-600",  text: "text-green-700",  ring: "focus:ring-green-500"  },
  { value: "insurance", icon: Building2,   label: "Insurance", accent: "bg-purple-600", light: "bg-purple-50", border: "border-purple-600", text: "text-purple-700", ring: "focus:ring-purple-500" },
];

const GRADIENT = {
  patient:   "from-slate-900 via-blue-950 to-slate-900",
  doctor:    "from-slate-900 via-green-950 to-slate-900",
  insurance: "from-slate-900 via-purple-950 to-slate-900",
};

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState("patient");
  const [form,    setForm]    = useState({ email: "", password: "" });
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const cfg = ROLES.find(r => r.value === selectedRole);
  const gradient = GRADIENT[selectedRole];

  // ✅ FIXED: use res.data directly — backend sendToken already returns { token, user }
  // No need to call getMe() separately; that was causing a 401 loop because
  // the token wasn't in storage yet when getMe fired.
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form);
      const { token, user } = res.data;

      // ✅ setAuth first — stores token in localStorage + cookie before any navigation
      setAuth(user, token);

      toast.success("Welcome back!");

      // ✅ Always redirect using the role returned by the DB, not the UI selector
      router.push("/" + user.role + "/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    const backend = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
    window.location.href = `${backend}/api/auth/google?role=${selectedRole}`;
  };

  return (
    <div className={"min-h-screen bg-gradient-to-br " + gradient + " flex items-center justify-center p-4 transition-all duration-500"}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl text-white">Health<span className="text-blue-400">Bridge</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">
            Sign in as {cfg.label}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">

          {/* Role Switcher */}
          <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
            {ROLES.map(({ value, icon: Icon, label, text }) => (
              <button key={value} onClick={() => setSelectedRole(value)}
                className={"flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all " +
                  (selectedRole === value
                    ? "bg-white shadow-sm " + text
                    : "text-slate-500 hover:text-slate-700")}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Role description */}
          <div className={"flex items-center gap-2 px-3 py-2.5 rounded-xl mb-5 " + cfg.light}>
            <cfg.icon size={14} className={cfg.text} />
            <p className={"text-xs font-medium " + cfg.text}>
              {selectedRole === "patient" && "Access your health records, appointments and insurance"}
              {selectedRole === "doctor" && "Manage your patients, appointments and medical records"}
              {selectedRole === "insurance" && "Process claims, manage policies and verify patients"}
            </p>
          </div>

          {/* Google */}
          <button onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-all mb-5">
            <Chrome size={18} className="text-blue-500" />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">or with email</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent " + cfg.ring} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={show ? "text" : "password"} required value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className={"w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent " + cfg.ring} />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className={"w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-semibold transition-all disabled:opacity-60 mt-1 " +
                cfg.accent + " hover:opacity-90"}>
              {loading ? "Signing in..." : <> Sign In <ArrowRight size={16} /> </>}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            No account?{" "}
            <Link href="/register" className="text-blue-600 font-semibold hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
