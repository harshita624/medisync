"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import { registerUser as register, getMe } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Activity, User, Stethoscope, Building2, Mail, Lock,
  Eye, EyeOff, ArrowRight, Chrome, ChevronLeft,
  BadgeCheck, Hospital, Phone, FileText
} from "lucide-react";

const ROLES = [
  {
    value: "patient",
    icon: User,
    title: "Patient",
    desc: "Access health records, book appointments, manage insurance",
    color: "blue",
    accent: "bg-blue-600",
    light: "bg-blue-50",
    border: "border-blue-600",
    text: "text-blue-700",
    ring: "focus:ring-blue-500",
  },
  {
    value: "doctor",
    icon: Stethoscope,
    title: "Doctor",
    desc: "Manage patients, appointments, prescriptions and records",
    color: "green",
    accent: "bg-green-600",
    light: "bg-green-50",
    border: "border-green-600",
    text: "text-green-700",
    ring: "focus:ring-green-500",
  },
  {
    value: "insurance",
    icon: Building2,
    title: "Insurance",
    desc: "Process claims, manage policies and verify patients",
    color: "purple",
    accent: "bg-purple-600",
    light: "bg-purple-50",
    border: "border-purple-600",
    text: "text-purple-700",
    ring: "focus:ring-purple-500",
  },
];

const GRADIENT = {
  patient:   "from-slate-900 via-blue-950 to-slate-900",
  doctor:    "from-slate-900 via-green-950 to-slate-900",
  insurance: "from-slate-900 via-purple-950 to-slate-900",
  default:   "from-slate-900 via-blue-950 to-slate-900",
};

export default function RegisterPage() {
  const [step,    setStep]    = useState(1);
  const [role,    setRole]    = useState("");
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState({
    name: "", email: "", password: "",
    // doctor fields
    specialization: "", licenseNumber: "", hospital: "", phone: "",
    // insurance fields
    companyName: "", insuranceLicense: "",
  });
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const cfg = ROLES.find(r => r.value === role) || ROLES[0];
  const gradient = GRADIENT[role] || GRADIENT.default;

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

 const handleGoogle = () => {
  if (!role) return toast.error("Select a role first");
  const backend = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
  window.location.href = `${backend}/api/auth/google?role=${role}`;
};

  const handleSubmit = async e => {
    e.preventDefault();
    if (!role) return toast.error("Please select a role");

    // Validation
    if (role === "doctor") {
      if (!form.specialization) return toast.error("Specialization is required");
      if (!form.licenseNumber) return toast.error("License number is required");
    }
    if (role === "insurance") {
      if (!form.companyName) return toast.error("Company name is required");
      if (!form.insuranceLicense) return toast.error("Insurance license is required");
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role,
        ...(role === "doctor" && {
          specialization: form.specialization,
          licenseNumber: form.licenseNumber,
          hospital: form.hospital,
          phone: form.phone,
        }),
        ...(role === "insurance" && {
          companyName: form.companyName,
          insuranceLicense: form.insuranceLicense,
          phone: form.phone,
        }),
      };

      const res = await register(payload);
const { token, user } = res.data;
setAuth(user, token);
toast.success("Account created!");
router.push("/" + user.role + "/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (ring = "focus:ring-blue-500") =>
    "w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 " + ring;

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
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">
            {role ? 'Registering as ' + role.charAt(0).toUpperCase() + role.slice(1) : 'Join HealthBridge'}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(s => (
              <div key={s} className={"h-1.5 flex-1 rounded-full transition-all duration-300 " +
                (s <= step ? (role ? cfg.accent : "bg-blue-600") : "bg-slate-100")} />
            ))}
          </div>

          {/* ── STEP 1 — Role Selection ── */}
          {step === 1 && (
            <>
              <h2 className="font-bold text-slate-900 mb-1">Choose your role</h2>
              <p className="text-slate-500 text-sm mb-6">How will you use HealthBridge?</p>

              <div className="space-y-3 mb-6">
                {ROLES.map(({ value, icon: Icon, title, desc, accent, light, border, text }) => (
                  <button key={value} onClick={() => setRole(value)}
                    className={"w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left " +
                      (role === value ? border + " " + light : "border-slate-200 hover:border-slate-300")}>
                    <div className={"w-10 h-10 rounded-xl flex items-center justify-center shrink-0 " +
                      (role === value ? accent : "bg-slate-100")}>
                      <Icon size={18} className={role === value ? "text-white" : "text-slate-500"} />
                    </div>
                    <div className="flex-1">
                      <p className={"text-sm font-bold " + (role === value ? text : "text-slate-900")}>{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                    {role === value && (
                      <div className={"w-5 h-5 rounded-full flex items-center justify-center " + accent}>
                        <BadgeCheck size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => { if (!role) return toast.error("Select a role first"); setStep(2); }}
                disabled={!role}
                className={"w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-semibold transition-all disabled:opacity-50 " +
                  (role ? cfg.accent + " hover:opacity-90" : "bg-blue-600 hover:bg-blue-700")}>
                Continue <ArrowRight size={16} />
              </button>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">or</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <button onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-all">
                <Chrome size={18} className="text-blue-500" /> Continue with Google
              </button>
            </>
          )}

          {/* ── STEP 2 — Details Form ── */}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors">
                <ChevronLeft size={16} /> Back
              </button>

              {/* Role badge */}
              <div className={"inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 " + cfg.light + " " + cfg.text}>
                <cfg.icon size={12} />
                Registering as {cfg.title}
              </div>

              <h2 className="font-bold text-slate-900 mb-1">Your details</h2>
              <p className="text-slate-500 text-sm mb-5">
                {role === "doctor" && "We need your professional information to verify your account."}
                {role === "insurance" && "We need your company information to verify your account."}
                {role === "patient" && "Just a few details to get you started."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* ── Common Fields ── */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input name="name" type="text" required value={form.name} onChange={handleChange}
                      placeholder={role === "doctor" ? "Dr. John Smith" : role === "insurance" ? "Jane Cooper" : "Your full name"}
                      className={inputClass(cfg.ring)} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input name="email" type="email" required value={form.email} onChange={handleChange}
                      placeholder="you@example.com"
                      className={inputClass(cfg.ring)} />
                  </div>
                </div>

                {/* ── Doctor Specific Fields ── */}
                {role === "doctor" && (
                  <>
                    <div className={"p-4 rounded-2xl space-y-3 " + cfg.light}>
                      <p className={"text-xs font-bold uppercase tracking-wide " + cfg.text}>
                        Professional Information
                      </p>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specialization *</label>
                        <div className="relative">
                          <Stethoscope size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select name="specialization" required value={form.specialization} onChange={handleChange}
                            className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 " + cfg.ring}>
                            <option value="">Select specialization</option>
                            {[
                              "General Physician", "Cardiologist", "Neurologist", "Orthopedic",
                              "Pediatrician", "Dermatologist", "Psychiatrist", "Gynecologist",
                              "Oncologist", "Radiologist", "Surgeon", "ENT Specialist",
                              "Ophthalmologist", "Urologist", "Endocrinologist", "Other"
                            ].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">License Number *</label>
                        <div className="relative">
                          <BadgeCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input name="licenseNumber" type="text" required value={form.licenseNumber} onChange={handleChange}
                            placeholder="e.g. MCI-12345"
                            className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 " + cfg.ring} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hospital / Clinic</label>
                        <div className="relative">
                          <Hospital size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input name="hospital" type="text" value={form.hospital} onChange={handleChange}
                            placeholder="AIIMS, Apollo, Private Practice..."
                            className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 " + cfg.ring} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                            placeholder="+91 98765 43210"
                            className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 " + cfg.ring} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Insurance Specific Fields ── */}
                {role === "insurance" && (
                  <div className={"p-4 rounded-2xl space-y-3 " + cfg.light}>
                    <p className={"text-xs font-bold uppercase tracking-wide " + cfg.text}>
                      Company Information
                    </p>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name *</label>
                      <div className="relative">
                        <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input name="companyName" type="text" required value={form.companyName} onChange={handleChange}
                          placeholder="e.g. LIC, Star Health, HDFC Ergo"
                          className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 " + cfg.ring} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Insurance License *</label>
                      <div className="relative">
                        <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input name="insuranceLicense" type="text" required value={form.insuranceLicense} onChange={handleChange}
                          placeholder="IRDAI License Number"
                          className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 " + cfg.ring} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                          placeholder="+91 98765 43210"
                          className={"w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 " + cfg.ring} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Password (always last) ── */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input name="password" type={show ? "text" : "password"} required
                      value={form.password} onChange={handleChange}
                      placeholder="Min 8 characters" minLength={8}
                      className={"w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 " + cfg.ring} />
                    <button type="button" onClick={() => setShow(!show)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Doctor notice */}
                {role === "doctor" && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                    <BadgeCheck size={14} className="text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-yellow-700">
                      Your account will be reviewed and verified before full access is granted. You can still log in immediately.
                    </p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className={"w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-semibold transition-all disabled:opacity-60 mt-1 " +
                    cfg.accent + " hover:opacity-90"}>
                  {loading ? "Creating account..." : <> Create Account <ArrowRight size={16} /> </>}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
