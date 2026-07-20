"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getDoctorPatients, getPatientRecordsForDoctor } from "@/lib/api";
import { AlertCircle, Bot, Calendar, FileText, Heart, Search, User } from "lucide-react";

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    getDoctorPatients()
      .then(r => setPatients(r.data.patients || []))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  async function selectPatient(patient) {
    setSelected(patient);
    setLoadingRecords(true);
    try {
      const res = await getPatientRecordsForDoctor(patient._id);
      setRecords(res.data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }

  const filtered = patients.filter(p =>
    p.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.patientId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="doctor">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">My Patients</h1>
        <p className="text-slate-500 text-sm mt-1">Patients connected through scheduled, confirmed, or completed appointments</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl h-16 animate-pulse border border-slate-100" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="med-card p-8 text-center">
              <User size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No connected patients yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => (
                <button key={p._id} onClick={() => selectPatient(p)}
                  className={`btn-press w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selected?._id === p._id ? "border-emerald-400 bg-emerald-50" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center font-bold text-green-700 text-sm">
                    {p.user?.name?.[0]?.toUpperCase() || "P"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{p.user?.name}</p>
                    <p className="text-xs text-slate-400">{p.patientId}</p>
                  </div>
                  <span className="text-xs font-bold capitalize px-2 py-0.5 rounded-full bg-green-50 text-green-600">{p.riskLevel || "low"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <div className="med-card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center font-bold text-green-700 text-xl">
                    {selected.user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-syne font-bold text-slate-900 text-lg">{selected.user?.name}</h2>
                    <p className="text-slate-500 text-sm">{selected.user?.email}</p>
                    <p className="text-emerald-600 font-mono text-xs mt-1">{selected.patientId}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-3 py-1 rounded-full capitalize bg-green-50 text-green-600">{selected.riskLevel || "low"} risk</span>
                    {selected.healthScore && <p className="text-2xl font-bold text-slate-900 mt-2">{selected.healthScore}</p>}
                  </div>
                </div>

                <div className="mt-5">
                  <Link href={`/doctor/chat?patientId=${selected._id}`}
                    style={{ background: 'linear-gradient(135deg, var(--emerald), var(--teal-dark))' }}
                    className="btn-press inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md">
                    <Bot size={15} /> Open Clinical Assistant With This Patient
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    ["Blood Group", selected.bloodGroup || "-"],
                    ["Gender", selected.gender || "-"],
                    ["DOB", selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString("en-IN") : "-"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">{label}</p>
                      <p className="text-sm font-bold text-slate-800 capitalize">{value}</p>
                    </div>
                  ))}
                </div>

                {selected.allergies?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><AlertCircle size={12} /> Allergies</p>
                    <div className="flex flex-wrap gap-2">{selected.allergies.map(a => <span key={a} className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full">{a}</span>)}</div>
                  </div>
                )}
                {selected.chronicConditions?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Heart size={12} /> Conditions</p>
                    <div className="flex flex-wrap gap-2">{selected.chronicConditions.map(c => <span key={c} className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full">{c}</span>)}</div>
                  </div>
                )}
              </div>

              <div className="med-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileText size={17} /> Medical Records</h3>
                  <Calendar size={16} className="text-slate-400" />
                </div>
                {loadingRecords ? <p className="text-sm text-slate-400 text-center py-8">Loading records...</p> : records.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No records yet</p>
                ) : (
                  <div className="space-y-3">
                    {records.map(r => (
                      <div key={r._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-sm font-bold text-slate-800">{r.diagnosis || "Visit"}</p>
                        <p className="text-xs text-slate-400">{new Date(r.visitDate).toLocaleDateString("en-IN")} - {r.visitType}</p>
                        {r.notes && <p className="text-xs text-slate-500 mt-2">{r.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="med-card p-16 text-center">
              <User size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Select a patient to view details</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}