"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getAdminUsers, updateAdminUserStatus } from "@/lib/api";
import toast from "react-hot-toast";
import { Search, ShieldCheck, UserX } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await getAdminUsers({ q, role });
      setUsers(res.data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function update(id, data) {
    try {
      await updateAdminUserStatus(id, data);
      toast.success("User updated");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-slate-500 text-sm mt-1">Verify doctors/insurance users and disable unsafe accounts.</p>
      </div>
      <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-5 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users..." className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm">
          <option value="">All roles</option>
          {["patient", "doctor", "insurance", "admin"].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={load} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold">Filter</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? <p className="p-6 text-sm text-slate-400">Loading...</p> : users.map(user => (
          <div key={user._id} className="p-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email} | {user.role}</p>
              <p className="text-xs mt-1">{user.isActive ? "Active" : "Disabled"} | {user.isVerified ? "Verified" : "Not verified"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => update(user._id, { isVerified: !user.isVerified })} className="px-3 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-bold flex items-center gap-1">
                <ShieldCheck size={14} /> {user.isVerified ? "Unverify" : "Verify"}
              </button>
              <button onClick={() => update(user._id, { isActive: !user.isActive })} className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-1">
                <UserX size={14} /> {user.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
