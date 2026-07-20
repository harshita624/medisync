"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { createMedicalRecord, getDoctorPatients, getPatientRecordsForDoctor } from "@/lib/api";
import toast from "react-hot-toast";
import { ClipboardList, Plus } from "lucide-react";

const EMPTY = {
  patient: "",
  visitType: "consultation",
  visitDate: new Date().toISOString().slice(0, 10),
  chiefComplaint: "",
  diagnosis: "",
  symptoms: "",
  notes: "",
  medicine: "",
  dosage: "",
  frequency: "",
  duration: "",
  documentName: "",
  documentUrl: "",
  documentType: "other",
  followUpRequired: false,
  followUpDate: "",
};

export default function DoctorRecordsPage() {
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [docFile, setDocFile] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoctorPatients()
      .then(r => setPatients(r.data.patients || []))
      .catch(() => setPatients([]));
  }, []);

  async function selectPatient(id) {
    setForm(prev => ({ ...prev, patient: id }));
    if (!id) return setRecords([]);
    setLoadingRecords(true);
    try {
      const res = await getPatientRecordsForDoctor(id);
      setRecords(res.data.records || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Cannot load patient records");
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }

  function change(e) {
    const { name, value, type, checked, files } = e.target;
    if (type === "file") {
      setDocFile(files?.[0] || null);
      return;
    }
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.patient || !form.diagnosis.trim()) return toast.error("Patient and diagnosis are required");
    setSaving(true);
    try {
      const payload = {
        patient: form.patient,
        visitType: form.visitType,
        visitDate: form.visitDate,
        chiefComplaint: form.chiefComplaint,
        diagnosis: form.diagnosis,
        symptoms: form.symptoms.split(",").map(s => s.trim()).filter(Boolean),
        notes: form.notes,
        followUpRequired: form.followUpRequired,
        followUpDate: form.followUpDate || undefined,
        prescription: form.medicine ? [{
          medicine: form.medicine,
          dosage: form.dosage,
          frequency: form.frequency,
          duration: form.duration,
        }] : [],
        documents: form.documentUrl ? [{
          name: form.documentName || "Patient document",
          fileUrl: form.documentUrl,
          type: form.documentType || "other",
        }] : [],
      };
      let requestBody = payload;
      if (docFile) {
        const data = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (Array.isArray(value) || typeof value === "object") data.append(key, JSON.stringify(value));
          else if (value !== undefined && value !== null) data.append(key, value);
        });
        data.append("file", docFile);
        data.append("documentName", form.documentName || docFile.name);
        data.append("documentType", form.documentType || "other");
        requestBody = data;
      }
      await createMedicalRecord(requestBody);
      toast.success("Medical record added");
      const patientId = form.patient;
      setForm({ ...EMPTY, patient: patientId });
      setDocFile(null);
      const res = await getPatientRecordsForDoctor(patientId);
      setRecords(res.data.records || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="doctor">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="font-syne text-2xl font-bold text-slate-900">Medical Records</h1>
        <p className="text-slate-500 text-sm mt-1">Connected patients only. Appointments create access.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="med-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus size={18} className="text-emerald-600" />
            <h2 className="font-bold text-slate-900">Add Record</h2>
          </div>

          <select name="patient" value={form.patient} onChange={e => selectPatient(e.target.value)} required
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm">
            <option value="">Select connected patient</option>
            {patients.map(p => <option key={p._id} value={p._id}>{p.user?.name} - {p.patientId}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select name="visitType" value={form.visitType} onChange={change} className="px-4 py-3 border border-slate-200 rounded-xl text-sm">
              {["consultation", "follow-up", "emergency", "routine", "surgery", "teleconsult"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" name="visitDate" value={form.visitDate} onChange={change} className="px-4 py-3 border border-slate-200 rounded-xl text-sm" />
          </div>

          <input name="chiefComplaint" value={form.chiefComplaint} onChange={change} placeholder="Chief complaint" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm" />
          <input name="diagnosis" value={form.diagnosis} onChange={change} required placeholder="Diagnosis" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm" />
          <input name="symptoms" value={form.symptoms} onChange={change} placeholder="Symptoms, comma separated" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm" />

          <div className="bg-emerald-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-emerald-800">Prescription</p>
            <input name="medicine" value={form.medicine} onChange={change} placeholder="Medicine" className="w-full px-4 py-2.5 border border-emerald-200 rounded-lg text-sm bg-white" />
            <div className="grid grid-cols-3 gap-2">
              <input name="dosage" value={form.dosage} onChange={change} placeholder="Dosage" className="px-3 py-2.5 border border-emerald-200 rounded-lg text-xs bg-white" />
              <input name="frequency" value={form.frequency} onChange={change} placeholder="Frequency" className="px-3 py-2.5 border border-emerald-200 rounded-lg text-xs bg-white" />
              <input name="duration" value={form.duration} onChange={change} placeholder="Duration" className="px-3 py-2.5 border border-emerald-200 rounded-lg text-xs bg-white" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-blue-800">Patient Document</p>
            <input name="documentName" value={form.documentName} onChange={change} placeholder="Document name"
              className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm bg-white" />
            <input name="documentUrl" value={form.documentUrl} onChange={change} placeholder="Secure file link or report URL"
              className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm bg-white" />
            <input name="file" type="file" onChange={change}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,.csv,.xlsx"
              className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm bg-white" />
            {docFile && <p className="text-xs text-blue-700">Selected: {docFile.name}</p>}
            <select name="documentType" value={form.documentType} onChange={change}
              className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm bg-white">
              {["lab_report", "scan", "prescription", "discharge", "other"].map(t => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
          </div>

          <textarea name="notes" value={form.notes} onChange={change} rows={3} placeholder="Clinical notes" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none" />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="followUpRequired" checked={form.followUpRequired} onChange={change} className="accent-emerald-600" />
            Follow-up required
          </label>
          {form.followUpRequired && <input type="date" name="followUpDate" value={form.followUpDate} onChange={change} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm" />}

          <button disabled={saving}
            style={{ background: 'linear-gradient(135deg, var(--emerald), var(--teal-dark))' }}
            className="btn-press w-full py-3 text-white rounded-xl font-bold disabled:opacity-60 shadow-md">
            {saving ? "Saving..." : "Save Medical Record"}
          </button>
        </form>

        <div className="med-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList size={18} className="text-slate-500" />
            <h2 className="font-bold text-slate-900">Patient Records</h2>
          </div>
          {!form.patient ? (
            <p className="text-sm text-slate-400 text-center py-16">Select a patient</p>
          ) : loadingRecords ? (
            <p className="text-sm text-slate-400 text-center py-16">Loading records...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">No records yet</p>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto">
              {records.map(r => (
                <div key={r._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-sm text-slate-800">{r.diagnosis || "Visit"}</p>
                    <span className="text-xs text-slate-400">{new Date(r.visitDate).toLocaleDateString("en-IN")}</span>
                  </div>
                  {r.chiefComplaint && <p className="text-xs text-slate-500 mt-1">{r.chiefComplaint}</p>}
                  {r.prescription?.length > 0 && <p className="text-xs text-emerald-600 mt-2">{r.prescription[0].medicine} - {r.prescription[0].dosage}</p>}
                  {r.prescriptionWarnings?.llm_analysis?.overall_risk && (
                    <p className="text-xs text-red-600 mt-2">
                      Drug risk: {r.prescriptionWarnings.llm_analysis.overall_risk}
                    </p>
                  )}
                  {r.clinicalInsights?.risk_flags?.length > 0 && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                      <p className="text-xs font-bold text-amber-800">Clinical flags</p>
                      <p className="text-xs text-amber-700 mt-1">{r.clinicalInsights.risk_flags.slice(0, 2).join(" | ")}</p>
                    </div>
                  )}
                  {[...(r.documents || []), ...(r.labReports || [])].length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">{[...(r.documents || []), ...(r.labReports || [])].length} document(s) attached</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}