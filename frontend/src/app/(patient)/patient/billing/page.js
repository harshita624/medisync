'use client';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { API } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  CreditCard, CheckCircle, Clock, IndianRupee,
  Loader2, Receipt, RefreshCw, AlertTriangle,
} from 'lucide-react';

const STATUS_STYLE = {
  paid:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
};

export default function BillingPage() {
  const [bills,      setBills]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying,     setPaying]     = useState(null);
  const [error,      setError]      = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const r = await API.get('/patient/bills');
      const data =
        r.data?.bills ||
        r.data?.data?.bills ||
        (Array.isArray(r.data) ? r.data : []);
      setBills(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setBills([]);
      } else {
        setError('Could not load bills. Please try refreshing.');
        console.error('[BILLING]', err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 60000);
    return () => clearInterval(interval);
  }, [load]);

  async function pay(id) {
    setPaying(id);
    try {
      await API.post(`/patient/bills/${id}/pay`, { paymentMethod: 'online' });
      toast.success('Payment recorded successfully!');
      await load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(null);
    }
  }

  const getAmount = b => b.totalAmount || b.amount || 0;

  const total   = bills.reduce((s, b) => s + getAmount(b), 0);
  const pending = bills.filter(b => b.status === 'pending').reduce((s, b) => s + getAmount(b), 0);
  const paid    = bills.filter(b => b.status === 'paid').reduce((s, b) => s + getAmount(b), 0);

  return (
    <DashboardLayout role="patient">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-syne font-bold text-slate-900">Bills &amp; Payments</h1>
          <p className="text-slate-500 text-sm mt-1">Your Dana Shivam Hospital billing history</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-slate-200 text-slate-600 hover:border-teal-300 disabled:opacity-50 transition-all">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: IndianRupee, label: 'Total Billed', value: `₹${total.toLocaleString('en-IN')}`,   color: 'from-sky-400 to-blue-500'      },
          { icon: Clock,       label: 'Pending',      value: `₹${pending.toLocaleString('en-IN')}`, color: 'from-amber-400 to-orange-500'  },
          { icon: CheckCircle, label: 'Paid',         value: `₹${paid.toLocaleString('en-IN')}`,    color: 'from-emerald-400 to-green-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bento p-5">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
              <Icon size={20} className="text-white" />
            </div>
            <p className="text-xl font-syne font-extrabold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl mb-5">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => load()} className="text-xs font-bold text-red-600 hover:underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="med-card rounded-3xl p-10 text-center">
          <Loader2 size={24} className="animate-spin text-teal-400 mx-auto" />
          <p className="text-slate-400 text-sm mt-3">Loading your bills…</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="med-card rounded-3xl p-16 text-center">
          <Receipt size={44} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-semibold">No bills yet</p>
          <p className="text-slate-400 text-sm mt-1">Bills appear here after hospital visits and appointments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map(b => {
            const amount = getAmount(b);
            return (
              <div key={b._id} className="med-card rounded-2xl p-5 flex items-center gap-4 flex-wrap hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                  <CreditCard size={18} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{b.description || b.billNumber || 'Medical Bill'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(b.billDate || b.date || b.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {b.billNumber && ` · ${b.billNumber}`}
                  </p>
                  {b.paidAt && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Paid on {new Date(b.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {b.items?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {b.items.map((item, i) => (
                        <span key={i} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                          {item.description} — ₹{item.amount?.toLocaleString('en-IN')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_STYLE[b.status] || STATUS_STYLE.pending}`}>
                    {b.status}
                  </span>
                  <p className="font-syne font-extrabold text-slate-900 text-lg">
                    ₹{amount.toLocaleString('en-IN')}
                  </p>
                  {b.status === 'pending' && (
                    <button onClick={() => pay(b._id)} disabled={paying === b._id}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-60 flex items-center gap-1.5 transition-all"
                      style={{ background: 'var(--grad-primary)' }}>
                      {paying === b._id
                        ? <><Loader2 size={13} className="animate-spin" /> Paying…</>
                        : 'Pay Now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}