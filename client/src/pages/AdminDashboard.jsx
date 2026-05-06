/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { HiOutlineUserGroup, HiOutlineCollection, HiOutlineCurrencyRupee, HiOutlineClipboardList } from 'react-icons/hi';
import toast from 'react-hot-toast';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

const ROLE_COLORS = { student: '#3b82f6', kitchen: '#f59e0b', admin: '#10b981' };

export default function AdminDashboard({ mode = 'analytics' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isUsersMode = mode === 'users';
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [userFilter, setUserFilter] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data } = await adminAPI.getStats();
      setStats(data.data);
    } catch (err) {
      // Silently fail — stats are supplementary, don't block the UI
      console.warn('Stats fetch failed:', err.message);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const params = {};
      if (userFilter) params.role = userFilter;
      const { data } = await adminAPI.getUsers(params);
      setUsers(data.data);
    } catch {
      toast.error('Failed to load users');
    }
  }, [userFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isUsersMode && isAdmin) fetchUsers();
  }, [isUsersMode, isAdmin, fetchUsers]);

  const handleRoleChange = async (userId, role) => {
    try {
      await adminAPI.updateRole(userId, role);
      toast.success('Role updated');
      fetchUsers();
      fetchData();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted');
      fetchUsers();
      fetchData();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const roleData = stats.usersByRole ? Object.entries(stats.usersByRole).map(([role, count]) => ({
    name: role.charAt(0).toUpperCase() + role.slice(1),
    value: count,
    color: ROLE_COLORS[role],
  })) : [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-[clamp(22px,5vw,32px)] font-semibold leading-tight tracking-normal text-white drop-shadow-2xl">
            {isUsersMode ? 'User ' : 'System '}<span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-primary-500">{isUsersMode ? 'Directory.' : 'Analytics.'}</span>
          </h1>
          <p className="text-surface-400 font-bold uppercase tracking-widest text-xs mt-3 bg-white/5 inline-block py-1.5 px-3 rounded-md border border-white/5">
            {isUsersMode ? 'Administrator User Management' : 'Administrator Analytics Console'}
          </p>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {!isUsersMode ? (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Accounts', value: stats.totalUsers || 0, icon: <HiOutlineUserGroup className="w-8 h-8" />, color: 'from-blue-600/20 to-blue-900/20 border-blue-500/30 text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' },
                { label: 'Menu Catalog', value: stats.totalMenuItems || 0, icon: <HiOutlineCollection className="w-8 h-8" />, color: 'from-purple-600/20 to-purple-900/20 border-purple-500/30 text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]' },
                { label: "Today's Volume", value: stats.todayOrders || 0, icon: <HiOutlineClipboardList className="w-8 h-8" />, color: 'from-amber-600/20 to-amber-900/20 border-amber-500/30 text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]' },
                { label: "Today's Gross", value: `₹${stats.todayRevenue || 0}`, icon: <HiOutlineCurrencyRupee className="w-8 h-8" />, color: 'from-primary-600/20 to-primary-900/20 border-primary-500/30 text-primary-400 drop-shadow-[0_0_15px_rgba(255,71,20,0.5)]' },
              ].map((s, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                  key={s.label} className={`glass-card bg-gradient-to-br ${s.color} border shadow-xl flex flex-col items-center justify-center p-8 relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-20">{s.icon}</div>
                  <div className="z-10 flex flex-col items-center text-center">
                    <p className="text-4xl font-black drop-shadow-md mb-2">{s.value}</p>
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-white/70">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Popular Items Chart */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} delay={0.4} className="glass-card bg-[#09090b]/80 border-surface-800 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center border border-white/5"><span className="text-xl">🔥</span></div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Popularity Index</h3>
                </div>
                {stats.popularItems?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stats.popularItems} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="_id" type="category" tick={{ fill: '#e4e4e7', fontSize: 11, fontWeight: 'bold' }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                      <Bar dataKey="count" fill="#ff4714" radius={[0, 8, 8, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="flex flex-col items-center justify-center h-[280px] text-surface-500">
                     <span className="text-4xl mb-3 grayscale opacity-30">📊</span>
                     <p className="font-bold">Insufficient Data</p>
                   </div>
                )}
              </motion.div>

              {/* Users by Role Chart */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} delay={0.4} className="glass-card bg-[#09090b]/80 border-surface-800 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center border border-white/5"><span className="text-xl">👥</span></div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Demographics</h3>
                </div>
                {roleData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={roleData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                        {roleData.map((entry, i) => <Cell key={i} fill={entry.color} style={{ filter: `drop-shadow(0px 0px 8px ${entry.color}40)` }}/>)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} itemStyle={{ fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="flex flex-col items-center justify-center h-[280px] text-surface-500">
                     <span className="text-4xl mb-3 grayscale opacity-30">🥧</span>
                     <p className="font-bold">Insufficient Data</p>
                   </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            
            <div className="flex gap-2 mb-8 overflow-x-auto pb-3 scrollbar-none">
              {['', 'student', 'kitchen', 'admin'].map((r, i) => (
                <button
                  key={i}
                  onClick={() => setUserFilter(r)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[44px] whitespace-nowrap
                    ${userFilter === r ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-[#18181b] text-surface-400 hover:text-white border border-surface-800'}`}
                >
                  {r || 'All Accounts'}
                </button>
              ))}
            </div>

            <div className="glass-card bg-[#09090b]/40 border-surface-800 p-0 overflow-hidden table-responsive">
              <div className="min-w-[600px]">
               <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-surface-900 border-b border-white/5 text-xs font-black uppercase tracking-[0.2em] text-surface-500">
                 <div className="col-span-5 md:col-span-6">Identity</div>
                 <div className="col-span-4 md:col-span-3">System Role</div>
                 <div className="col-span-3 text-right">Actions</div>
               </div>

              <div className="divide-y divide-white/5">
                {users.map(u => (
                  <div key={u._id} className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-5 md:col-span-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-white/10 flex items-center justify-center text-primary-400 font-black text-lg shadow-inner shrink-0 hidden md:flex">
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white text-[14px] md:text-base truncate">{u.name}</p>
                        <p className="text-xs text-surface-500 font-medium truncate mt-0.5">{u.email}</p>
                      </div>
                    </div>
                    <div className="col-span-4 md:col-span-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="input-field py-2.5 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer bg-[#121214]"
                      >
                        <option value="student">STUDENT</option>
                        <option value="kitchen">KITCHEN</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <button 
                        onClick={() => handleDeleteUser(u._id, u.name)} 
                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 border border-red-500/20 text-xs font-bold transition-colors min-h-[44px]"
                      >
                        REVOKE
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                   <div className="py-16 text-center text-surface-500 font-bold">No users match this filter.</div>
                )}
              </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
