'use client';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { getVitals, addVitals, deleteVitals } from '@/lib/api';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Heart, Activity, Thermometer, Wind, Droplet, Plus, Trash2, TrendingUp, AlertTriangle, CheckCircle, Loader2, Zap } from 'lucide-react';

const VITALS = [
  { key:'heart_rate',        label:'Heart Rate',   unit:'bpm',   icon:Heart,       color:'#f43f5e', normal:[60,100],  placeholder:'72',  step:1,   min:30, max:220 },
  { key:'systolic',          label:'Systolic BP',  unit:'mmHg',  icon:Activity,    color:'#3b82f6', normal:[90,140],  placeholder:'120', step:1,   min:60, max:250 },
  { key:'diastolic',         label:'Diastolic BP', unit:'mmHg',  icon:Activity,    color:'#6366f1', normal:[60,90],   placeholder:'80',  step:1,   min:40, max:150 },
  { key:'temperature',       label:'Temperature',  unit:'°C',    icon:Thermometer, color:'#f59e0b', normal:[36.1,37.2],placeholder:'36.6',step:0.1,min:34, max:42  },
  { key:'oxygen_saturation', label:'SpO₂',         unit:'%',     icon:Wind,        color:'#10b981', normal:[95,100],  placeholder:'98',  step:0.5, min:70, max:100 },
  { key:'glucose',           label:'Blood Glucose',unit:'mg/dL', icon:Droplet,     color:'#8b5cf6', normal:[70,140],  placeholder:'90',  step:1,   min:20, max:600 },
];

const EMPTY = Object.fromEntries(VITALS.map(v => [v.key, '']));
const isAbnormal = (key, val) => { const d = VITALS.find(v => v.key === key); return d && val != null && !isNaN(val) && (val < d.normal[0] || val > d.normal[1]); };

function VitalTile({ def, value }) {
  const bad = isAbnormal(def.key, value);
  return (
    <div className={`bento p-4 transition-all ${bad ? 'border-red-200 bg-red-50/30' : 'hover:border-teal-100'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: def.color + '18' }}>
          <def.icon size={17} style={{ color: def.color }} />
        </div>
        {bad ? <AlertTriangle size={13} className="text-red-500" /> : <CheckCircle size={13} className="text-emerald-400" />}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">
        {value != null ? value : '—'}<span className="text-xs font-medium text-slate-400 ml-1">{def.unit}</span>
      </p>
      <p className="text-xs text-slate-500 mt-1">{def.label}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">Normal {def.normal[0]}–{def.normal[1]}</p>
    </div>
  );
}

function VitalChart({ def, data }) {
  const chartData = data.slice(-20).map(r => ({ date: new Date(r.recordedAt||r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}), value: r[def.key] })).filter(d => d.value != null);
  if (chartData.length < 2) return null;
  return (
    <div className="bento p-5">
      <div className="flex items-center gap-2 mb-4">
        <def.icon size={14} style={{ color: def.color }} />
        <p className="font-bold text-slate-900 text-sm">{def.label}</p>
        <span className="text-xs text-slate-400 ml-auto">Last {chartData.length} readings</span>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} />
          <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} width={34} />
          <Tooltip contentStyle={{ borderRadius:14, border:'1px solid #e2e8f0', fontSize:12 }} formatter={v => [`${v} ${def.unit}`, def.label]} />
          <ReferenceLine y={def.normal[0]} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={def.normal[1]} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
          <Line type="monotone" dataKey="value" stroke={def.color} strokeWidth={2} dot={{ r:3, fill:def.color }} activeDot={{ r:5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function VitalsPage() {
  const [records,  setRecords]  = useState([]);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [anomaly,  setAnomaly]  = useState(null);

  const latest = records[0] || {};

  const load = useCallback(async () => {
    try {
      const res  = await getVitals();
      const data = res.data.vitals || res.data.records || [];
      setRecords([...data.map(r => ({ ...r, heart_rate: r.heart_rate??r.heartRate, oxygen_saturation: r.oxygen_saturation??r.oxygenSaturation }))].sort((a,b) => new Date(b.recordedAt||b.createdAt) - new Date(a.recordedAt||a.createdAt)));
    } catch (err) { if (err.response?.status !== 404) toast.error('Could not load vitals'); setRecords([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    const payload = {}; let hasAny = false;
    for (const v of VITALS) { const n = parseFloat(form[v.key]); if (!isNaN(n)) { payload[v.key] = n; hasAny = true; } }
    if (!hasAny) return toast.error('Enter at least one value');
    setSaving(true);
    try {
      const res = await addVitals({ ...payload, recordedAt: new Date() });
      setAnomaly(res.data?.anomaly || null);
      if (res.data?.anomaly?.is_anomaly) toast.error('⚠️ Abnormal readings — please consult your doctor', { duration:6000 });
      else toast.success('Vitals saved');
      setForm(EMPTY); setShowForm(false); await load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save vitals'); }
    finally { setSaving(false); }
  }

  async function remove(id) { try { await deleteVitals(id); toast.success('Reading deleted'); await load(); } catch { toast.error('Could not delete'); } }

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-syne text-2xl font-bold text-slate-900">Vitals Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Log readings and watch your health trends</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="btn-press flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-bold shadow-lg shadow-teal-400/30 hover:shadow-teal-400/50 transition-all"
          style={{ background: "var(--grad-primary)" }}>
          <Plus size={16} /> Log Vitals
        </button>
      </div>

      {anomaly?.is_anomaly && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-3xl">
          <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700">Abnormal Readings Detected</p>
            <p className="text-sm text-red-600 mt-0.5">These readings are outside the normal range. Please consult your doctor.</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="med-card rounded-3xl p-6 mb-6">
          <h2 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
            <Zap size={17} className="text-teal-500" /> Log New Reading
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
            {VITALS.map(def => (
              <div key={def.key}>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{def.label} <span className="text-slate-400 font-normal">({def.unit})</span></label>
                <div className="relative">
                  <input type="number" value={form[def.key]} onChange={e => setForm(p => ({...p,[def.key]:e.target.value}))}
                    placeholder={def.placeholder} step={def.step} min={def.min} max={def.max}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                      form[def.key] && isAbnormal(def.key, parseFloat(form[def.key]))
                        ? 'border-red-300 focus:ring-red-300 bg-red-50' : 'border-slate-200 focus:ring-teal-400'
                    }`} />
                  {form[def.key] && isAbnormal(def.key, parseFloat(form[def.key])) && (
                    <AlertTriangle size={11} className="absolute right-2.5 top-3 text-red-500" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Normal: {def.normal[0]}–{def.normal[1]}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="btn-press flex-1 py-3 rounded-2xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
              style={{ background: "var(--grad-primary)" }}>
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save Reading'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {VITALS.map(v => <div key={v.key} className="bento h-28 animate-pulse" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="med-card rounded-3xl p-16 text-center">
          <Activity size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No vitals logged yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-5">Start tracking your health measurements</p>
          <button onClick={() => setShowForm(true)}
            className="btn-press px-5 py-2.5 rounded-2xl text-white text-sm font-bold shadow-lg"
            style={{ background: "var(--grad-primary)" }}>
            Log Your First Reading
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {VITALS.map(def => <VitalTile key={def.key} def={def} value={latest[def.key]} />)}
          </div>

          {records.length > 1 && (
            <div className="mb-6">
              <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp size={17} className="text-teal-500" /> Trends
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {VITALS.map(def => <VitalChart key={def.key} def={def} data={records} />)}
              </div>
            </div>
          )}

          <div className="med-card rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">History</h2>
              <span className="text-xs text-slate-400">{records.length} readings</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500">Date</th>
                    {VITALS.map(d => <th key={d.key} className="text-right px-3 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">{d.label}</th>)}
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 20).map((r, i) => (
                    <tr key={r._id||i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(r.recordedAt||r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                      </td>
                      {VITALS.map(def => {
                        const v = r[def.key]; const bad = v != null && isAbnormal(def.key, v);
                        return (
                          <td key={def.key} className="px-3 py-3 text-right whitespace-nowrap">
                            {v != null
                              ? <span className={`font-semibold ${bad ? 'text-red-600' : 'text-slate-700'}`}>{v}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => remove(r._id)} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}