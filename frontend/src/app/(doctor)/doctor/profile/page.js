'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { getDoctorProfile, updateDoctorProfile, updateProfile, changePassword } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import toast from 'react-hot-toast';
import {
  BadgeCheck, Building2, Eye, EyeOff, Globe, Loader2,
  Lock, Mail, Phone, Save, Stethoscope, User,
} from 'lucide-react';

const DOC_GRAD = { background: 'linear-gradient(135deg, var(--emerald), var(--teal-dark))' };

const SPECIALIZATIONS = [
  'General Physician','Cardiologist','Neurologist','Orthopedic Surgeon',
  'Pediatrician','Dermatologist','Psychiatrist','Gynecologist','Oncologist',
  'Radiologist','ENT Specialist','Ophthalmologist','Urologist','Endocrinologist',
  'Gastroenterologist','Pulmonologist','Surgeon','Anesthesiologist','Other',
];

const LANGUAGES = ['English','Hindi','Tamil','Telugu','Kannada','Malayalam','Bengali','Marathi','Gujarati','Punjabi'];

export default function DoctorProfilePage() {
  const { user, setUser } = useAuthStore();
  const [doctor,   setDoctor]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [tab,      setTab]      = useState('professional');
  const [showPw,   setShowPw]   = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const [personal, setPersonal] = useState({ name: '', phone: '' });
  const [professional, setPro]  = useState({
    specialization: '', hospital: '', department: '', licenseNumber: '',
    experience: '', bio: '', consultationFee: '', languages: [],
  });
  const [passwords, setPw]      = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    getDoctorProfile()
      .then(r => {
        const d = r.data.doctor;
        setDoctor(d);
        setPersonal({ name: d?.user?.name || user?.name || '', phone: d?.user?.phone || user?.phone || '' });
        setPro({
          specialization: d?.specialization || '',
          hospital:       d?.hospital       || '',
          department:     d?.department     || '',
          licenseNumber:  d?.licenseNumber  || '',
          experience:     d?.experience     || '',
          bio:            d?.bio            || '',
          consultationFee:d?.consultationFee|| '',
          languages:      d?.languages      || ['English'],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const savePersonal = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: personal.name, phone: personal.phone });
      const updated = { ...user, name: personal.name, phone: personal.phone };
      setUser(updated);
      toast.success('Personal info updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const saveProfessional = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateDoctorProfile({
        ...professional,
        experience:      Number(professional.experience)     || undefined,
        consultationFee: Number(professional.consultationFee)|| undefined,
      });
      setDoctor(res.data.doctor);
      toast.success('Professional info updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const savePw = async e => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return toast.error('Passwords do not match');
    if (passwords.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Password change failed'); }
    finally { setSaving(false); }
  };

  const toggleLang = lang => {
    setPro(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  if (loading) return (
    <DashboardLayout role="doctor">
      <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}</div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout role="doctor">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your professional information and account settings</p>
      </div>

      {/* Doctor Card */}
      <div className="med-card p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700 shrink-0">
          {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-2xl" alt="" /> : user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-slate-900 text-lg">Dr. {user?.name}</p>
          <p className="text-slate-500 text-sm">{user?.email}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-emerald-600 font-mono">{doctor?.doctorId}</span>
            {doctor?.isVerified
              ? <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1"><BadgeCheck size={11} /> Verified</span>
              : <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">Pending verification</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['professional', 'personal', 'security'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={tab === t ? DOC_GRAD : {}}
            className={`btn-press px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${tab === t ? 'text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Professional */}
      {tab === 'professional' && (
        <form onSubmit={saveProfessional} className="space-y-5 max-w-2xl">
          <div className="med-card p-6 space-y-4">
            <h2 className="font-bold text-slate-900">Professional Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specialization</label>
                <div className="relative">
                  <Stethoscope size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <select value={professional.specialization} onChange={e => setPro({...professional, specialization: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                    <option value="">Select specialization</option>
                    {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">License Number</label>
                <div className="relative">
                  <BadgeCheck size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input value={professional.licenseNumber} onChange={e => setPro({...professional, licenseNumber: e.target.value})}
                    placeholder="MCI-12345"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hospital / Clinic</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input value={professional.hospital} onChange={e => setPro({...professional, hospital: e.target.value})}
                    placeholder="AIIMS, Apollo, Private..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Department</label>
                <input value={professional.department} onChange={e => setPro({...professional, department: e.target.value})}
                  placeholder="Cardiology, Neurology..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Experience (years)</label>
                <input type="number" min="0" max="60" value={professional.experience} onChange={e => setPro({...professional, experience: e.target.value})}
                  placeholder="10"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Consultation Fee (₹)</label>
                <input type="number" min="0" value={professional.consultationFee} onChange={e => setPro({...professional, consultationFee: e.target.value})}
                  placeholder="500"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bio / About</label>
              <textarea value={professional.bio} onChange={e => setPro({...professional, bio: e.target.value})}
                placeholder="Brief description about your expertise, research, and patient care approach..."
                rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </div>
          </div>

          <div className="med-card p-6">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Globe size={17} /> Languages Spoken</h2>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(lang => (
                <button type="button" key={lang} onClick={() => toggleLang(lang)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    professional.languages.includes(lang)
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-emerald-300'
                  }`}>{lang}</button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving}
            style={DOC_GRAD}
            className="btn-press flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-60 transition-all shadow-md">
            <Save size={15} /> {saving ? 'Saving…' : 'Save Professional Info'}
          </button>
        </form>
      )}

      {/* Personal */}
      {tab === 'personal' && (
        <form onSubmit={savePersonal} className="med-card p-6 max-w-lg space-y-4">
          <h2 className="font-bold text-slate-900">Personal Information</h2>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input value={personal.name} onChange={e => setPersonal({...personal, name: e.target.value})} required
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input value={user?.email || ''} disabled
                className="w-full pl-10 pr-4 py-3 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input type="tel" value={personal.phone} onChange={e => setPersonal({...personal, phone: e.target.value})}
                placeholder="+91 XXXXX XXXXX"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            style={DOC_GRAD}
            className="btn-press flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-60 shadow-md">
            <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      )}

      {/* Security */}
      {tab === 'security' && (
        <form onSubmit={savePw} className="med-card p-6 max-w-lg space-y-4">
          <h2 className="font-bold text-slate-900">Change Password</h2>
          {[
            { label: 'Current Password', key: 'currentPassword', show: showPw,  toggle: () => setShowPw(!showPw)  },
            { label: 'New Password',     key: 'newPassword',     show: showNew, toggle: () => setShowNew(!showNew) },
            { label: 'Confirm Password', key: 'confirmPassword', show: showNew, toggle: () => setShowNew(!showNew) },
          ].map(({ label, key, show, toggle }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input type={show ? 'text' : 'password'} required
                  value={passwords[key]} onChange={e => setPw({...passwords, [key]: e.target.value})}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <button type="button" onClick={toggle} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving}
            style={DOC_GRAD}
            className="btn-press flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-60 shadow-md">
            <Save size={15} /> {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </DashboardLayout>
  );
}