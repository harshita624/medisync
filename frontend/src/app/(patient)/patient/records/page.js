"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { addPatientDocument, deletePatientDocument, getMedicalHistory, getPatientDocuments } from "@/lib/api";
import { Search, FileText, Pill, ChevronRight, Calendar, User, AlertCircle, StickyNote, ExternalLink, Upload, Loader2, CheckCircle, X } from "lucide-react";

const typeColors = {
  consultation: "bg-teal-50 text-teal-600 border-teal-100",
  "follow-up":  "bg-purple-50 text-purple-600 border-purple-100",
  emergency:    "bg-red-50 text-red-600 border-red-100",
  routine:      "bg-green-50 text-green-600 border-green-100",
  surgery:      "bg-orange-50 text-orange-600 border-orange-100",
  teleconsult:  "bg-cyan-50 text-cyan-600 border-cyan-100",
};

function RecordDetail({ record }) {
  return (
    <div className="med-card rounded-2xl p-6 sticky top-6 space-y-5">
      <div className="flex items-start justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="font-syne font-bold text-slate-900 text-lg">{record.diagnosis || "Visit Details"}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {new Date(record.visitDate).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}
          </p>
        </div>
        <span className={"text-xs font-semibold px-3 py-1 rounded-full border capitalize " + (typeColors[record.visitType] || "bg-slate-50 text-slate-600 border-slate-100")}>
          {record.visitType}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: User,        label: "Doctor",     value: `Dr. ${record.doctor?.user?.name || "—"}` },
          { icon: AlertCircle, label: "Complaint",  value: record.chiefComplaint || "—" },
          { icon: Calendar,    label: "Follow Up",  value: record.followUpRequired ? (record.followUpDate ? new Date(record.followUpDate).toLocaleDateString("en-IN") : "Yes") : "Not required" },
          { icon: FileText,    label: "Visit Type", value: record.visitType || "—" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-teal-50/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-teal-400 mb-1"><Icon size={12} /> {label}</div>
            <p className="text-sm font-semibold text-slate-800 capitalize">{value}</p>
          </div>
        ))}
      </div>

      {record.symptoms?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Symptoms</p>
          <div className="flex flex-wrap gap-2">
            {record.symptoms.map((s, i) => (
              <span key={i} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      {record.prescription?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Prescription</p>
          <div className="space-y-2">
            {record.prescription.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <Pill size={16} className="text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{p.medicine}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {p.dosage    && <p className="text-xs text-slate-500"><span className="text-slate-400">Dose:</span> {p.dosage}</p>}
                    {p.frequency && <p className="text-xs text-slate-500"><span className="text-slate-400">Frequency:</span> {p.frequency}</p>}
                    {p.duration  && <p className="text-xs text-slate-500"><span className="text-slate-400">Duration:</span> {p.duration}</p>}
                  </div>
                  {p.instructions && <p className="text-xs text-green-600 mt-1.5">{p.instructions}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.notes && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <StickyNote size={12} /> Doctor Notes
          </p>
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 leading-relaxed">{record.notes}</p>
        </div>
      )}

      {[...(record.documents || []), ...(record.labReports || [])].length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <FileText size={12} /> Documents
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {[...(record.documents || []), ...(record.labReports || [])].map((doc, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between gap-3 text-sm text-slate-700 hover:text-teal-700">
                  <span className="truncate font-semibold">{doc.name || "Document"}</span>
                  <ExternalLink size={14} className="text-slate-400 shrink-0" />
                </a>
                {doc.aiSummary && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{doc.aiSummary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecordsPage() {
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(null);
  const [filter,    setFilter]    = useState("all");
  const [documents, setDocuments] = useState([]);
  const [docForm,   setDocForm]   = useState({ name: "", fileUrl: "", type: "other", visibility: "secure", notes: "" });
  const [docFile,   setDocFile]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    getMedicalHistory()
      .then(r => { const recs = r.data.records || []; setRecords(recs); if (recs.length) setSelected(recs[0]); })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
    getPatientDocuments().then(r => setDocuments(r.data.documents || [])).catch(() => setDocuments([]));
  }, []);

  async function saveDocument(e) {
    e.preventDefault();
    if (!docForm.name.trim()) { setSaveMsg({ type:'error', text:'Please enter a document name.' }); return; }
    if (!docForm.fileUrl.trim() && !docFile) { setSaveMsg({ type:'error', text:'Please upload a file or provide a URL.' }); return; }
    setSaving(true); setSaveMsg(null);
    try {
      const body = new FormData();
      Object.entries(docForm).forEach(([k, v]) => { if (v !== '') body.append(k, v); });
      if (docFile) body.append("file", docFile);
      const res = await addPatientDocument(body);
      setDocuments(res.data.documents || []);
      setDocForm({ name: "", fileUrl: "", type: "other", visibility: "secure", notes: "" });
      setDocFile(null);
      setSaveMsg({ type:'success', text:'Document uploaded successfully!' });
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveMsg({ type:'error', text: err.response?.data?.message || err.message || 'Upload failed.' });
    } finally { setSaving(false); }
  }

  async function removeDocument(id) {
    try {
      const res = await deletePatientDocument(id);
      setDocuments(res.data.documents || []);
      setConfirmDeleteId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not remove document.');
      setConfirmDeleteId(null);
    }
  }

  const types    = ["all", ...new Set(records.map(r => r.visitType).filter(Boolean))];
  const filtered = records.filter(r => {
    const matchSearch = r.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
      r.doctor?.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.chiefComplaint?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || r.visitType === filter;
    return matchSearch && matchFilter;
  });

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">Medical Records</h1>
          <p className="text-slate-500 text-sm mt-1">{records.length} records in your history</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..."
            className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 w-60" />
        </div>
      </div>

      <div className="med-card rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-1">Patient Document Vault</h2>
        <p className="text-sm text-slate-500 mb-4">Upload reports, prescriptions, scans. Secure documents visible only to doctors after QR scan.</p>

        {saveMsg && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl mb-4 text-sm font-medium ${
            saveMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {saveMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {saveMsg.text}
          </div>
        )}

        <form onSubmit={saveDocument} className="grid lg:grid-cols-5 gap-3 mb-4">
          <input value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} placeholder="Document name *"
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          <div className="lg:col-span-2">
            <label className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm cursor-pointer hover:border-teal-300 transition-colors">
              <Upload size={14} className="text-slate-400 shrink-0" />
              <span className="text-slate-500 truncate">{docFile ? docFile.name : "Choose file to upload"}</span>
              <input type="file" className="hidden"
                onChange={e => { setDocFile(e.target.files?.[0] || null); e.target.value = ''; }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" />
            </label>
          </div>
          <input value={docForm.fileUrl} onChange={e => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="Or paste secure file URL"
            className="lg:col-span-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          <select value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value })}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            {["lab_report", "scan", "prescription", "discharge", "insurance", "id", "other"].map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
          </select>
          <select value={docForm.visibility} onChange={e => setDocForm({ ...docForm, visibility: e.target.value })}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="secure">Secure (doctor-only)</option>
            <option value="public">Public (in QR packet)</option>
          </select>
          <button type="submit" disabled={saving}
            style={{ background: "var(--grad-primary)" }}
            className="btn-press lg:col-span-5 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-all shadow-md">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><Upload size={15} /> Add Document To QR Vault</>}
          </button>
        </form>

        {documents.length > 0 && (
          <div className="grid md:grid-cols-2 gap-3">
            {documents.map(d => (
              <div key={d._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate">{d.name}</p>
                  <p className="text-xs text-slate-400 capitalize mt-0.5">{d.type?.replace(/_/g, " ")} · {d.visibility}</p>
                  {d.fileUrl && (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-600 font-bold mt-2 hover:underline">
                      <ExternalLink size={11} /> Open file
                    </a>
                  )}
                  {d.aiSummary && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{d.aiSummary}</p>}
                </div>
                {confirmDeleteId === d._id ? (
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="text-[11px] text-slate-500 text-right">Remove this document?</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100">Keep</button>
                      <button onClick={() => removeDocument(d._id)} className="text-[11px] px-2 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(d._id)} className="shrink-0 p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={"btn-press px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize " +
              (filter === t ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-teal-300")}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-slate-100" />)}</div>
          <div className="lg:col-span-2 bg-white rounded-2xl h-96 animate-pulse border border-slate-100" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="med-card rounded-2xl p-16 text-center">
          <FileText size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">No records found</p>
          <p className="text-slate-400 text-sm mt-1">Your medical history will appear here after doctor visits</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {filtered.map((r, i) => (
              <div key={i} onClick={() => setSelected(r)}
                className={"card-hover bg-white rounded-2xl p-4 border-2 cursor-pointer transition-all hover:shadow-sm " +
                  (selected?._id === r._id ? "border-teal-500" : "border-slate-100 hover:border-slate-200")}>
                <div className="flex items-center justify-between mb-2">
                  <span className={"text-xs font-semibold px-2 py-0.5 rounded-full capitalize " +
                    (typeColors[r.visitType]?.split(" ").slice(0,2).join(" ") || "bg-slate-100 text-slate-600")}>
                    {r.visitType || "visit"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(r.visitDate).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate">{r.diagnosis || "No diagnosis"}</p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <User size={11} /> Dr. {r.doctor?.user?.name || "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2">
            {selected ? <RecordDetail record={selected} /> : (
              <div className="med-card rounded-2xl p-16 text-center">
                <ChevronRight size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm">Select a record to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}