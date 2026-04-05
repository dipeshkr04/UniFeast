import { useState, useEffect } from 'react';
import { adminAPI, orderAPI } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { HiOutlineUserGroup, HiOutlineCollection, HiOutlineCurrencyRupee, HiOutlineClipboardList } from 'react-icons/hi';
import toast from 'react-hot-toast';

const ROLE_COLORS = { student: '#3b82f6', kitchen: '#f59e0b', admin: '#10b981' };

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (tab === 'users') fetchUsers();
  }, [tab, userFilter]);

  const fetchData = async () => {
    try {
      const { data } = await adminAPI.getStats();
      setStats(data.data);
    } catch (err) {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const params = {};
      if (userFilter) params.role = userFilter;
      const { data } = await adminAPI.getUsers(params);
      setUsers(data.data);
    } catch (err) {
      toast.error('Failed to load users');
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await adminAPI.updateRole(userId, role);
      toast.success('Role updated');
      fetchUsers();
      fetchData();
    } catch (err) {
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
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const roleData = stats.usersByRole ? Object.entries(stats.usersByRole).map(([role, count]) => ({
    name: role.charAt(0).toUpperCase() + role.slice(1),
    value: count,
    color: ROLE_COLORS[role],
  })) : [];

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">⚙️ <span className="text-primary-400">Admin</span> Dashboard</h1>
        <p className="text-surface-400 mt-1">Manage UniFeast platform</p>
      </div>

      {/* Tab switches */}
      <div className="flex gap-2 mb-6">
        {['overview', 'users'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t ? 'tab-active' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
            id={`admin-tab-${t}`}
          >
            {t === 'overview' ? '📊 Overview' : '👥 Users'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Users', value: stats.totalUsers || 0, icon: <HiOutlineUserGroup className="w-6 h-6" />, color: 'text-blue-400' },
              { label: 'Menu Items', value: stats.totalMenuItems || 0, icon: <HiOutlineCollection className="w-6 h-6" />, color: 'text-purple-400' },
              { label: "Today's Orders", value: stats.todayOrders || 0, icon: <HiOutlineClipboardList className="w-6 h-6" />, color: 'text-amber-400' },
              { label: "Today's Revenue", value: `₹${stats.todayRevenue || 0}`, icon: <HiOutlineCurrencyRupee className="w-6 h-6" />, color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="glass-card-static p-5 text-center">
                <div className={`${s.color} flex justify-center mb-2`}>{s.icon}</div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-surface-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Popular Items */}
            <div className="glass-card-static p-5">
              <h3 className="text-sm font-semibold text-surface-400 mb-4 uppercase tracking-wider">Popular Items Today</h3>
              {stats.popularItems?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.popularItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis dataKey="_id" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#f1f5f9' }} />
                    <Bar dataKey="count" fill="#e06449" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-500 text-center py-8">No orders today</p>}
            </div>

            {/* Users by Role */}
            <div className="glass-card-static p-5">
              <h3 className="text-sm font-semibold text-surface-400 mb-4 uppercase tracking-wider">Users by Role</h3>
              {roleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={roleData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {roleData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-500 text-center py-8">No users</p>}
            </div>
          </div>
        </>
      ) : (
        /* Users Tab */
        <>
          <div className="flex gap-2 mb-4">
            {['', 'student', 'kitchen', 'admin'].map(r => (
              <button
                key={r}
                onClick={() => setUserFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${userFilter === r ? 'bg-primary-500 text-white' : 'bg-surface-800/50 text-surface-400'}`}
              >
                {r || 'All'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {users.map(u => (
              <div key={u._id} className="glass-card-static p-4 flex items-center justify-between" id={`user-${u._id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold">
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-surface-200">{u.name}</p>
                    <p className="text-xs text-surface-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                    className="input-field py-1 px-2 text-xs w-24"
                  >
                    <option value="student">Student</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={() => handleDeleteUser(u._id, u.name)} className="btn-danger py-1.5 px-3 text-xs">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

