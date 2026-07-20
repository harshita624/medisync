'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { getPatientProfile, updatePatientProfile, updateProfile, changePassword } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Lock, Eye, EyeOff, Save, Heart, AlertCircle, Activity, Ruler, Scale } from 'lucide-react';

const bloodGroups = ["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"];
const genderOpts  = ["male","female","other","prefer_not_to_say"];
const commonAllergies  = ["Penicillin","Aspirin","Sulfa drugs","Ibuprofen","Latex","Peanuts","Shellfish","Dairy","Eggs","Gluten"];
const commonConditions = ["Diabetes","Hypertension","Asthma","Heart disease","Thyroid disorder","Arthritis","Depression","Anxiety","Cancer","COPD","Kidney disease"];

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading,  setLoading] = useState(true);
  const [saving,   setSaving]  = useState(false);
  const [tab,      setTab]     = useState("personal");
  const [showOld,  setShowOld] = useState(false);
  const [showNew,  setShowNew] = useState(false);

  const [personal, setPersonal] = useState({ name:"", phone:"" });
  const [medical,  setMedical]  = useState({
    dateOfBirth:"", gender:"", bloodGroup:"",
    height:"", weight:"",
    allergies:[], chronicConditions:[],
    emergencyContact: { name:"", phone:"", relation:"" },
  });
  const [passwords, setPasswords] = useState({ oldPassword:"", newPassword:"", confirmPassword:"" });

  useEffect(() => {
    getPatientProfile()
      .then(r => {
        const p = r.data.patient;
        setProfile(p);
        setPersonal({ name: p?.user?.name || user?.name || "", phone: p?.user?.phone || user?.phone || "" });
        setMedical({
          dateOfBirth:       p?.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
          gender:            p?.gender      || "",
          bloodGroup:        p?.bloodGroup  || "",
          height:            p?.height      ? String(p.height) : "",
          weight:            p?.weight      ? String(p.weight) : "",
          allergies:         p?.allergies         || [],
          chronicConditions: p?.chronicConditions || [],
          emergencyContact:  p?.emergencyContact  || { name:"", phone:"", relation:"" },
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const savePersonal = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: personal.name, phone: personal.phone });
      const updated = { ...user, name: personal.name, phone: personal.phone };
      setUser(updated);
      const Cookies = (await import("js-cookie")).default;
      Cookies.set("user", JSON.stringify(updated), { expires: 7 });
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally { setSaving(false); }
  };

  const saveMedical = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        allergies: medical.allergies,
        chronicConditions: medical.chronicConditions,
        emergencyContact: medical.emergencyContact,
      };
      if (medical.dateOfBirth) payload.dateOfBirth = medical.dateOfBirth;
      if (medical.gender)      payload.gender      = medical.gender;
      if (medical.bloodGroup)  payload.bloodGroup  = medical.bloodGroup;

     const h = parseFloat(medical.height);
const w = parseFloat(medical.weight);
if (!isNaN(h) && h > 0) payload.height = h;
if (!isNaN(w) && w > 0) payload.weight = w;

      const res = await updatePatientProfile(payload);
      const p   = res.data.patient;
      setProfile(p);

      // Re-sync from server response so UI always reflects what's actually saved
      setMedical(prev => ({
        ...prev,
        height: p?.height != null ? String(p.height) : prev.height,
        weight: p?.weight != null ? String(p.weight) : prev.weight,
        gender:            p?.gender      || prev.gender,
        bloodGroup:        p?.bloodGroup  || prev.bloodGroup,
        allergies:         p?.allergies         || prev.allergies,
        chronicConditions: p?.chronicConditions || prev.chronicConditions,
        emergencyContact:  p?.emergencyContact  || prev.emergencyContact,
      }));

      toast.success("Medical info updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally { setSaving(false); }
  };

  const savePassword = async e => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return toast.error("Passwords do not match");
    if (passwords.newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    setSaving(true);
    try {
      await changePassword({ currentPassword: passwords.oldPassword, newPassword: passwords.newPassword });
      toast.success("Password changed!");
      setPasswords({ oldPassword:"", newPassword:"", confirmPassword:"" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Password change failed");
    } finally { setSaving(false); }
  };

  const toggleItem = (field, item) => {
    setMedical(prev => ({
      ...prev,
      [field]: prev[field].includes(item) ? prev[field].filter(x => x !== item) : [...prev[field], item],
    }));
  };

  const bmi = (medical.height && medical.weight)
    ? (Number(medical.weight) / Math.pow(Number(medical.height) / 100, 2)).toFixed(1)
    : null;

  if (loading) return (
    <DashboardLayout role="patient">
      <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-slate-100" />)}</div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your personal and medical information</p>
      </div>

      {/* Avatar + health summary — teal/green identity card */}
      <div className="med-card rounded-2xl p-6 mb-6 flex items-center gap-5 flex-wrap">
        <div className="w-16 h-16 rounded-2xl med-icon-bubble flex items-center justify-center text-2xl font-extrabold overflow-hidden shrink-0">
          {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-lg">{user?.name}</p>
          <p className="text-slate-500 text-sm">{user?.email}</p>
          <p className="text-xs text-teal-600 font-mono mt-1">{profile?.patientId}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {profile?.healthScore != null && (
            <div className="text-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-lg font-bold text-emerald-700">{profile.healthScore}/100</p>
              <p className="text-[10px] text-emerald-500">Health Score</p>
            </div>
          )}
          {profile?.riskLevel && (
            <div className={`text-center px-4 py-2 rounded-xl border ${
              profile.riskLevel === 'low'      ? 'bg-teal-50 border-teal-100' :
              profile.riskLevel === 'high'     ? 'bg-orange-50 border-orange-100' :
              profile.riskLevel === 'critical' ? 'bg-red-50 border-red-100' :
                                                 'bg-amber-50 border-amber-100'
            }`}>
              <p className={`text-sm font-bold capitalize ${
                profile.riskLevel === 'low'      ? 'text-teal-700' :
                profile.riskLevel === 'high'     ? 'text-orange-700' :
                profile.riskLevel === 'critical' ? 'text-red-700' :
                                                   'text-amber-700'
              }`}>{profile.riskLevel}</p>
              <p className="text-[10px] text-slate-400">Risk Level</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["personal","medical","security"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={"btn-press px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize " +
              (tab === t ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-teal-300")}>
            {t}
          </button>
        ))}
      </div>

      {/* Personal */}
      {tab === "personal" && (
        <form onSubmit={savePersonal} className="med-card rounded-2xl p-6 max-w-lg space-y-5">
          <h2 className="font-bold text-slate-900">Personal Information</h2>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={personal.name} onChange={e => setPersonal({...personal, name: e.target.value})} required
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" value={user?.email || ""} disabled
                className="w-full pl-10 pr-4 py-3 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="tel" value={personal.phone} onChange={e => setPersonal({...personal, phone: e.target.value})}
                placeholder="+91 XXXXX XXXXX"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="btn-press flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-all">
            <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}

      {/* Medical */}
      {tab === "medical" && (
        <form onSubmit={saveMedical} className="space-y-5 max-w-2xl">
          <div className="med-card rounded-2xl p-6 space-y-5">
            <h2 className="font-bold text-slate-900">Medical Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Birth</label>
                <input type="date" value={medical.dateOfBirth}
                  onChange={e => setMedical({...medical, dateOfBirth: e.target.value})}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                <select value={medical.gender} onChange={e => setMedical({...medical, gender: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white capitalize">
                  <option value="">Select gender</option>
                  {genderOpts.map(g => <option key={g} value={g} className="capitalize">{g.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Blood Group</label>
                <select value={medical.bloodGroup} onChange={e => setMedical({...medical, bloodGroup: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                  <option value="">Select blood group</option>
                  {bloodGroups.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Ruler size={13} className="text-slate-400" /> Height (cm)
                </label>
                <input type="number" value={medical.height}
                  onChange={e => setMedical({...medical, height: e.target.value})}
                  placeholder="e.g. 165" min="50" max="250"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Scale size={13} className="text-slate-400" /> Weight (kg)
                </label>
                <input type="number" value={medical.weight}
                  onChange={e => setMedical({...medical, weight: e.target.value})}
                  placeholder="e.g. 65" min="10" max="300"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>

              {bmi && (
                <div className="col-span-2">
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    Number(bmi) < 18.5 ? 'bg-blue-50 border-blue-100' :
                    Number(bmi) < 25   ? 'bg-teal-50 border-teal-100' :
                    Number(bmi) < 30   ? 'bg-amber-50 border-amber-100' :
                                         'bg-red-50 border-red-100'
                  }`}>
                    <p className="text-sm text-slate-600">BMI: <strong>{bmi}</strong></p>
                    <p className={`text-xs font-semibold ${
                      Number(bmi) < 18.5 ? 'text-blue-600' :
                      Number(bmi) < 25   ? 'text-teal-600' :
                      Number(bmi) < 30   ? 'text-amber-600' :
                                           'text-red-600'
                    }`}>
                      {Number(bmi) < 18.5 ? 'Underweight' : Number(bmi) < 25 ? 'Healthy weight' : Number(bmi) < 30 ? 'Overweight' : 'Obese'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="med-card rounded-2xl p-6">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="text-red-500" /> Allergies
            </h2>
            <div className="flex flex-wrap gap-2">
              {commonAllergies.map(a => (
                <button type="button" key={a} onClick={() => toggleItem("allergies", a)}
                  className={"text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition-all " +
                    (medical.allergies.includes(a) ? "bg-red-500 border-red-500 text-white" : "border-slate-200 text-slate-600 hover:border-red-300")}>
                  {a}
                </button>
              ))}
            </div>
            {medical.allergies.length > 0 && (
              <p className="text-xs text-slate-400 mt-3">{medical.allergies.length} selected: {medical.allergies.join(", ")}</p>
            )}
          </div>

          <div className="med-card rounded-2xl p-6">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Heart size={16} className="text-teal-500" /> Chronic Conditions
            </h2>
            <div className="flex flex-wrap gap-2">
              {commonConditions.map(c => (
                <button type="button" key={c} onClick={() => toggleItem("chronicConditions", c)}
                  className={"text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition-all " +
                    (medical.chronicConditions.includes(c) ? "bg-teal-500 border-teal-500 text-white" : "border-slate-200 text-slate-600 hover:border-teal-300")}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="med-card rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-slate-900">Emergency Contact</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Name</label>
                <input type="text" value={medical.emergencyContact.name}
                  onChange={e => setMedical({...medical, emergencyContact: {...medical.emergencyContact, name: e.target.value}})}
                  placeholder="Full name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Relation</label>
                <input type="text" value={medical.emergencyContact.relation}
                  onChange={e => setMedical({...medical, emergencyContact: {...medical.emergencyContact, relation: e.target.value}})}
                  placeholder="e.g. Parent, Spouse"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                <input type="tel" value={medical.emergencyContact.phone}
                  onChange={e => setMedical({...medical, emergencyContact: {...medical.emergencyContact, phone: e.target.value}})}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="btn-press flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-all">
            <Save size={15} /> {saving ? "Saving..." : "Save Medical Info"}
          </button>
        </form>
      )}

      {/* Security */}
      {tab === "security" && (
        <form onSubmit={savePassword} className="med-card rounded-2xl p-6 max-w-lg space-y-5">
          <h2 className="font-bold text-slate-900">Change Password</h2>
          {[
            { label:"Current Password", key:"oldPassword", show: showOld, toggle: () => setShowOld(!showOld) },
            { label:"New Password",     key:"newPassword", show: showNew, toggle: () => setShowNew(!showNew) },
            { label:"Confirm New Password", key:"confirmPassword", show: showNew, toggle: () => setShowNew(!showNew) },
          ].map(({ label, key, show, toggle }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={show ? "text" : "password"} required
                  value={passwords[key]} onChange={e => setPasswords({...passwords, [key]: e.target.value})}
                  placeholder="••••••••" minLength={key !== "oldPassword" ? 8 : 1}
                  className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                <button type="button" onClick={toggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="btn-press flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-all">
            <Save size={15} /> {saving ? "Updating..." : "Update Password"}
          </button>
        </form>
      )}
    </DashboardLayout>
  );
}