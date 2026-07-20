"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getMyPolicies, getMyClaims, submitClaim } from "@/lib/api";
import toast from "react-hot-toast";
import { Shield, ClipboardList, CheckCircle, Clock, X, Plus, Upload, ChevronDown, ChevronUp, Building2 } from "lucide-react";

const DANA_SHIVAM = "Dana Shivam Heart & Super Speciality Hospital";

const INSURANCE_PARTNERS = [
  { name: "Bajaj Allianz General Insurance",  type: "General"  },
  { name: "HDFC Ergo General Insurance",      type: "General"  },
  { name: "Star Health Insurance Co.",         type: "Health"   },
  { name: "Chola MS General Insurance",       type: "General"  },
  { name: "Cigna TTK Health Insurance",       type: "Health"   },
  { name: "Universal Sompo General Insurance",type: "General"  },
  { name: "Mediassist India TPA",             type: "TPA (Corporate Only)" },
  { name: "Heritage Health TPA",              type: "TPA (Corporate Only)" },
  { name: "Bhamashah Swasthya Bima Yojana",  type: "Government" },
  { name: "ICICI Lombard",                    type: "General"  },
  { name: "DHS General Insurance",           type: "General"  },
  { name: "Liberty General Insurance",        type: "General"  },
  { name: "L & T General Insurance",         type: "General"  },
  { name: "Safeway Insurance",               type: "Health"   },
  { name: "Health India",                    type: "Health"   },
  { name: "Amul Dairy",                      type: "Corporate" },
];

const claimStatusColors = {
  draft:              "bg-slate-100 text-slate-500 border-slate-200",
  submitted:          "bg-blue-50 text-blue-600 border-blue-100",
  under_review:       "bg-yellow-50 text-yellow-600 border-yellow-100",
  approved:           "bg-green-50 text-green-600 border-green-100",
  partially_approved: "bg-teal-50 text-teal-600 border-teal-100",
  rejected:           "bg-red-50 text-red-600 border-red-100",
  paid:               "bg-emerald-50 text-emerald-700 border-emerald-100",
  closed:             "bg-slate-100 text-slate-500 border-slate-200",
};

const claimTypes = [
  "hospitalization","outpatient","pharmacy","lab_test",
  "surgery","emergency","maternity","dental","vision","other",
];

function ClaimModal({ policies, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    policy:"", type:"hospitalization", amount:"", description:"",
    hospitalName: DANA_SHIVAM,   // ← default to Dana Shivam
    treatmentDate:"",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.policy || !form.amount || !form.description) return toast.error("Fill all required fields");
    setLoading(true);
    try {
      await submitClaim({
        policy:        form.policy,
        claimType:     form.type,
        claimAmount:   Number(form.amount),
        description:   form.description,
        hospitalName:  form.hospitalName,
        treatmentDate: form.treatmentDate,
      });
      toast.success("Claim submitted successfully!");
      onSubmitted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-syne font-bold text-xl text-slate-900">File a Claim</h2>
            <p className="text-slate-500 text-sm mt-0.5">Dana Shivam Heart & Super Speciality Hospital</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Insurance Policy *</label>
            <select value={form.policy} onChange={e => setForm({...form, policy: e.target.value})} required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
              <option value="">Select a policy</option>
              {policies.filter(p => p.status === "active").map(p => (
                <option key={p._id} value={p._id}>
                  {p.policyName || p.policyNumber} — ₹{p.remainingCoverage?.toLocaleString("en-IN")} remaining
                </option>
              ))}
            </select>
            {policies.filter(p => p.status === "active").length === 0 && (
              <p className="text-xs text-red-400 mt-1">No active policies found</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Claim Type *</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white capitalize">
              {claimTypes.map(t => <option key={t} value={t} className="capitalize">{t.replace(/_/g," ")}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Claim Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                placeholder="0" min="1" required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Treatment Date</label>
              <input type="date" value={form.treatmentDate} onChange={e => setForm({...form, treatmentDate: e.target.value})}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hospital / Clinic Name</label>
            <input type="text" value={form.hospitalName} onChange={e => setForm({...form, hospitalName: e.target.value})}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description of Treatment *</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} required
              placeholder="Describe the treatment, procedure, or reason for claim..."
              rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
          </div>

          <button type="submit" disabled={loading}
            style={{ background: "var(--grad-primary)" }}
            className="btn-press w-full py-3.5 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md">
            {loading ? "Submitting..." : <><Upload size={16} /> Submit Claim</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function ClaimCard({ claim }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="med-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div>
            <p className="font-bold text-slate-900">{claim.claimNumber}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{claim.claimType?.replace(/_/g," ")}</p>
            {claim.hospitalName && <p className="text-xs text-slate-400 mt-0.5">{claim.hospitalName}</p>}
          </div>
          <span className={"text-xs font-semibold px-2.5 py-1 rounded-full border capitalize " +
            (claimStatusColors[claim.status] || "bg-slate-100 text-slate-500 border-slate-200")}>
            {claim.status?.replace(/_/g," ")}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Claimed</p>
            <p className="font-bold text-slate-800">₹{claim.claimAmount?.toLocaleString("en-IN")}</p>
          </div>
          {claim.approvedAmount > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Approved</p>
              <p className="font-bold text-green-600">₹{claim.approvedAmount?.toLocaleString("en-IN")}</p>
            </div>
          )}
          <div className="ml-auto">
            <p className="text-xs text-slate-400 mb-0.5">Filed on</p>
            <p className="text-xs font-medium text-slate-600">{new Date(claim.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
        {claim.timeline?.length > 0 && (
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-teal-600 font-semibold mt-3 hover:underline">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Hide" : "Show"} timeline
          </button>
        )}
      </div>
      {expanded && claim.timeline?.length > 0 && (
        <div className="px-5 pb-5 border-t border-slate-50 pt-4">
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200" />
            {claim.timeline.map((t, i) => (
              <div key={i} className="relative mb-3 last:mb-0">
                <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white" />
                <p className="text-xs font-semibold text-slate-700 capitalize">{t.status?.replace(/_/g," ")}</p>
                <p className="text-xs text-slate-400">{new Date(t.updatedAt).toLocaleDateString("en-IN")}</p>
                {t.note && <p className="text-xs text-slate-500 mt-0.5">{t.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsurancePage() {
  const [policies,  setPolicies]  = useState([]);
  const [claims,    setClaims]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState("policies");
  const [showClaim, setShowClaim] = useState(false);

  const load = async () => {
    try {
      const [p, c] = await Promise.all([
        getMyPolicies().catch(() => ({ data: { policies: [] } })),
        getMyClaims().catch(() => ({ data: { claims: [] } })),
      ]);
      setPolicies(p.data.policies || []);
      setClaims(c.data.claims || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">Insurance</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your policies and claims</p>
        </div>
        <button onClick={() => setShowClaim(true)}
          style={{ background: "var(--grad-primary)" }}
          className="btn-press flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-md">
          <Plus size={16} /> File a Claim
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Shield,        label:"Active Policies", value: policies.filter(p => p.status === "active").length },
          { icon: ClipboardList, label:"Total Claims",    value: claims.length },
          { icon: CheckCircle,   label:"Approved",        value: claims.filter(c => ["approved","paid"].includes(c.status)).length },
          { icon: Clock,         label:"Pending Review",  value: claims.filter(c => ["submitted","under_review"].includes(c.status)).length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="med-card p-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
              <Icon size={18} className="text-teal-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["policies","claims","partners"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={tab === t ? { background: "var(--grad-primary)" } : {}}
            className={"btn-press px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize " +
              (tab === t ? "text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-teal-300")}>
            {t === "partners" ? "Insurance Partners" : t + (t === "policies" ? ` (${policies.length})` : t === "claims" ? ` (${claims.length})` : "")}
          </button>
        ))}
      </div>

      {/* Insurance Partners tab */}
      {tab === "partners" && (
        <div className="med-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
              <Building2 size={18} className="text-teal-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Accepted Insurance Partners</h2>
              <p className="text-xs text-slate-500 mt-0.5">Dana Shivam Hospital accepts cashless treatment under these insurance companies</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INSURANCE_PARTNERS.map(p => (
              <div key={p.name} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-teal-200 transition-all">
                <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                  <Shield size={15} className="text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{p.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.type}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>For cashless treatment:</strong> Inform the billing desk at Dana Shivam that you have insurance coverage.
              Bring your insurance card and a valid photo ID. For TPA and corporate plans, please contact your HR or insurance coordinator.
              Call <strong>+91 91160 03461</strong> for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Policies tab */}
      {tab === "policies" && (
        loading ? (
          <div className="space-y-4">{[1,2].map(i => <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-slate-100" />)}</div>
        ) : policies.length === 0 ? (
          <div className="med-card p-16 text-center">
            <Shield size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-600 font-medium">No policies found</p>
            <p className="text-slate-400 text-sm mt-1">Contact your insurance provider to link policies</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {policies.map((p, i) => (
              <div key={i} className="med-card card-hover p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="font-bold text-slate-900">{p.policyName || p.policyNumber}</p>
                    <p className="text-xs text-slate-500 mt-1 capitalize">{p.policyType?.replace(/_/g," ")}</p>
                  </div>
                  <span className={"text-xs font-semibold px-2.5 py-1 rounded-full capitalize " +
                    (p.status === "active" ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500")}>
                    {p.status}
                  </span>
                </div>
                <div className="space-y-2.5 mb-5">
                  {[
                    { label:"Coverage",   value:"₹" + (p.coverageAmount?.toLocaleString("en-IN") || "—")    },
                    { label:"Remaining",  value:"₹" + (p.remainingCoverage?.toLocaleString("en-IN") || "—") },
                    { label:"Premium",    value:"₹" + (p.premiumAmount?.toLocaleString("en-IN") || "—") + (p.premiumFrequency ? " / " + p.premiumFrequency : "") },
                    { label:"Valid Till", value: p.endDate ? new Date(p.endDate).toLocaleDateString("en-IN") : "—" },
                  ].map(f => (
                    <div key={f.label} className="flex justify-between text-sm">
                      <span className="text-slate-400">{f.label}</span>
                      <span className="font-semibold text-slate-700">{f.value}</span>
                    </div>
                  ))}
                </div>
                {p.coverageAmount > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span>Coverage used</span>
                      <span>{Math.min(100, Math.round(((p.coverageAmount - (p.remainingCoverage ?? p.coverageAmount)) / p.coverageAmount) * 100))}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: Math.min(100, Math.round(((p.coverageAmount - (p.remainingCoverage ?? p.coverageAmount)) / p.coverageAmount) * 100)) + "%", background: "var(--grad-primary)" }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Claims tab */}
      {tab === "claims" && (
        loading ? (
          <div className="space-y-4">{[1,2].map(i => <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-slate-100" />)}</div>
        ) : claims.length === 0 ? (
          <div className="med-card p-16 text-center">
            <ClipboardList size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-600 font-medium">No claims filed yet</p>
            <button onClick={() => setShowClaim(true)}
              style={{ background: "var(--grad-primary)" }}
              className="btn-press mt-4 px-5 py-2.5 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-md">
              File Your First Claim
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((c, i) => <ClaimCard key={i} claim={c} />)}
          </div>
        )
      )}

      {showClaim && <ClaimModal policies={policies} onClose={() => setShowClaim(false)} onSubmitted={load} />}
    </DashboardLayout>
  );
}