/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { HiOutlineUserGroup, HiOutlineCollection, HiOutlineCurrencyRupee, HiOutlineClipboardList } from 'react-icons/hi';
import { FaFileCsv, FaFileExcel, FaFilePdf } from 'react-icons/fa';
import toast from 'react-hot-toast';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

const rangeOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const formatCurrency = (value = 0) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const formatNumber = (value = 0) => Number(value || 0).toLocaleString('en-IN');
const chartColors = ['#ff4714', '#3b82f6', '#10b981', '#f59e0b', '#a1a1aa', '#71717a'];

function normalizeStudentAnalyticsRow(student = {}) {
  const fallbackId = student.userId ? `USER-${String(student.userId).slice(-6).toUpperCase()}` : '';
  const btId = student.btId || student.displayLabel || fallbackId;
  const name = student.name || student.email || btId || fallbackId;

  return {
    ...student,
    name,
    btId,
    displayLabel: student.displayLabel || btId || name,
  };
}

function getDefaultStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function getDefaultEndDate() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function htmlEscape(value) {
  const text = value == null ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyFilename(value) {
  return String(value || 'analytics')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'analytics';
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function rowsToHtmlRows(rows) {
  return rows.map((row, index) => {
    const cellTag = index === 0 ? 'th' : 'td';
    return `<tr>${row.map((cell) => `<${cellTag}>${htmlEscape(cell)}</${cellTag}>`).join('')}</tr>`;
  }).join('');
}

function exportRowsAsCsv(rows, filename) {
  downloadBlob(rowsToCsv(rows), `${slugifyFilename(filename)}.csv`, 'text/csv;charset=utf-8');
}

function exportRowsAsExcel(rows, filename) {
  const html = `<html><head><meta charset="utf-8" /></head><body><table>${rowsToHtmlRows(rows)}</table></body></html>`;
  downloadBlob(html, `${slugifyFilename(filename)}.xls`, 'application/vnd.ms-excel');
}

function printRowsAsPdf(rows, title) {
  const win = window.open('', '_blank');
  if (!win) {
    toast.error('Allow popups to print this analytics PDF');
    return;
  }
  win.document.write(`
    <html>
      <head>
        <title>${htmlEscape(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 20px; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f4f4f4; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${htmlEscape(title)}</h1>
        <table>${rowsToHtmlRows(rows)}</table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function AnalyticsExportIcons({ rows, filename, title }) {
  if (!rows || rows.length <= 1) return null;

  const exportTitle = title || filename;

  return (
    <div className="analytics-export-icons" aria-label={`${exportTitle} export options`}>
      <span className="analytics-export-label">Export</span>
      <button
        type="button"
        className="analytics-icon-btn is-csv"
        onClick={() => exportRowsAsCsv(rows, filename)}
        aria-label={`Download ${exportTitle} as CSV`}
        title="CSV"
      >
        <FaFileCsv aria-hidden="true" />
      </button>
      <button
        type="button"
        className="analytics-icon-btn is-excel"
        onClick={() => exportRowsAsExcel(rows, filename)}
        aria-label={`Download ${exportTitle} as Excel`}
        title="Excel"
      >
        <FaFileExcel aria-hidden="true" />
      </button>
      <button
        type="button"
        className="analytics-icon-btn is-pdf"
        onClick={() => printRowsAsPdf(rows, exportTitle)}
        aria-label={`Print ${exportTitle} as PDF`}
        title="PDF"
      >
        <FaFilePdf aria-hidden="true" />
      </button>
    </div>
  );
}

function AnalyticsTable({ title, subtitle, columns, rows }) {
  return (
    <article className="analytics-panel glass-card-static">
      <div className="analytics-panel-header">
        <div className="analytics-panel-title-row">
          <div>
            <h3>{title}</h3>
            <p className="text-surface-400">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="analytics-mini-table">
        <div className="analytics-mini-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((column) => <span key={column}>{column}</span>)}
        </div>
        <div className="analytics-mini-body">
          {rows.length > 0 ? rows.map((row, index) => (
            <div key={`${title}-${index}`} className="analytics-mini-row" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
              {row.map((cell, cellIndex) => <span key={`${title}-${index}-${cellIndex}`}>{cell}</span>)}
            </div>
          )) : (
            <div className="analytics-empty text-surface-500">No data for this range.</div>
          )}
        </div>
      </div>
    </article>
  );
}

function createDefaultChartFilter(preset = 'month') {
  return {
    preset,
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  };
}

function buildStatsParams(filter) {
  const params = { preset: filter.preset || 'month' };
  if (params.preset === 'custom') {
    params.startDate = filter.startDate;
    params.endDate = filter.endDate;
  }
  return params;
}

function ChartRangeControls({ value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="analytics-chart-controls">
      <select
        value={value.preset}
        onChange={(event) => update({ preset: event.target.value })}
        aria-label="Chart date range"
      >
        {rangeOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <input
        type="date"
        value={value.startDate}
        onChange={(event) => update({ preset: 'custom', startDate: event.target.value })}
        aria-label="Chart start date"
      />
      <input
        type="date"
        value={value.endDate}
        onChange={(event) => update({ preset: 'custom', endDate: event.target.value })}
        aria-label="Chart end date"
      />
    </div>
  );
}

export default function AdminDashboard({ mode = 'analytics' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isUsersMode = mode === 'users';
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [userFilter, setUserFilter] = useState('');
  const [analyticsFilters, setAnalyticsFilters] = useState({
    preset: 'month',
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  });
  const [chartFilters, setChartFilters] = useState({
    sales: createDefaultChartFilter('month'),
    items: createDefaultChartFilter('month'),
    cohort: createDefaultChartFilter('year'),
    students: createDefaultChartFilter('month'),
    night: createDefaultChartFilter('month'),
  });
  const [chartStats, setChartStats] = useState({});

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const requests = new Map();
      const getStats = (params) => {
        const requestKey = JSON.stringify(params);
        if (!requests.has(requestKey)) {
          requests.set(requestKey, adminAPI.getStats(params));
        }
        return requests.get(requestKey);
      };

      const analyticsParams = {
        preset: analyticsFilters.preset,
        ...(analyticsFilters.preset === 'custom'
          ? { startDate: analyticsFilters.startDate, endDate: analyticsFilters.endDate }
          : {}),
      };

      const analyticsRequest = getStats(analyticsParams);
      const chartEntriesRequest = Promise.all(
        Object.entries(chartFilters).map(async ([key, filter]) => {
          const { data } = await getStats(buildStatsParams(filter));
          return [key, data.data];
        })
      );

      const [{ data: analyticsData }, entries] = await Promise.all([analyticsRequest, chartEntriesRequest]);
      setStats(analyticsData.data);
      setChartStats(Object.fromEntries(entries));
    } catch (err) {
      console.warn('Analytics fetch failed:', err.message);
      toast.error('Failed to refresh chart analytics');
    }
  }, [analyticsFilters, chartFilters]);

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
    if (!isUsersMode) fetchAnalyticsData();
  }, [isUsersMode, fetchAnalyticsData]);

  useEffect(() => {
    if (isUsersMode && isAdmin) fetchUsers();
  }, [isUsersMode, isAdmin, fetchUsers]);

  const handleRoleChange = async (userId, role) => {
    try {
      await adminAPI.updateRole(userId, role);
      toast.success('Role updated');
      fetchUsers();
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const studentSpendRows = useMemo(
    () => (stats.studentSpending || []).map(normalizeStudentAnalyticsRow),
    [stats.studentSpending]
  );
  const nightCanteenRows = useMemo(
    () => (stats.nightCanteenSpending || []).map(normalizeStudentAnalyticsRow),
    [stats.nightCanteenSpending]
  );
  const chartStudentSpendRows = useMemo(
    () => (chartStats.students?.studentSpending || []).map(normalizeStudentAnalyticsRow),
    [chartStats.students]
  );
  const chartNightCanteenRows = useMemo(
    () => (chartStats.night?.nightCanteenSpending || []).map(normalizeStudentAnalyticsRow),
    [chartStats.night]
  );

  const analyticsExportRows = useMemo(() => {
    const sales = [
      ['Period', 'Sales (INR)', 'Orders', 'Food items sold'],
      ...(chartStats.sales?.periodSeries || []).map((point) => [
        point._id,
        point.sales || 0,
        point.orders || 0,
        point.itemsSold || 0,
      ]),
    ];

    const items = [
      ['Item', 'Quantity sold', 'Revenue (INR)', 'Order lines'],
      ...(chartStats.items?.topItems || []).map((item) => [
        item._id,
        item.quantity || 0,
        item.revenue || 0,
        item.orders || 0,
      ]),
    ];

    const cohort = [
      ['Cohort', 'Students', 'Orders', 'Total spent (INR)', 'Average per student (INR)'],
      ...(chartStats.cohort?.cohortSpending || []).map((entry) => [
        entry.cohort,
        entry.students || 0,
        entry.orders || 0,
        entry.totalSpent || 0,
        entry.averagePerStudent || 0,
      ]),
    ];

    const students = [
      ['Name', 'Email', 'BTID', 'Cohort', 'Orders', 'Total spent (INR)', 'Average order value (INR)'],
      ...chartStudentSpendRows.map((student) => [
        student.name,
        student.email,
        student.btId,
        student.cohort,
        student.orders || 0,
        student.totalSpent || 0,
        student.averageOrderValue || 0,
      ]),
    ];

    const night = [
      ['Name', 'Email', 'BTID', 'Cohort', 'Orders', 'Total spent (INR)', 'Average order value (INR)'],
      ...chartNightCanteenRows.map((student) => [
        student.name,
        student.email,
        student.btId,
        student.cohort,
        student.orders || 0,
        student.totalSpent || 0,
        student.averageOrderValue || 0,
      ]),
    ];

    return { sales, items, cohort, students, night };
  }, [chartStats, chartStudentSpendRows, chartNightCanteenRows]);

  const updateChartFilter = (key, nextFilter) => {
    setChartFilters((prev) => ({ ...prev, [key]: nextFilter }));
  };

  return (
    <div className="admin-dashboard-page flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="admin-dashboard-header">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-[clamp(22px,5vw,32px)] font-semibold leading-tight tracking-normal text-white">
            {isUsersMode ? 'User Directory' : 'System Analytics'}
          </h1>
          <p className="admin-dashboard-kicker text-surface-400">
            {isUsersMode ? 'Administrator User Management' : 'Administrator Analytics Console'}
          </p>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {!isUsersMode ? (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="analytics-page">
            <section className="analytics-toolbar glass-card-static">
              <div className="analytics-toolbar-copy">
                <h2>Sales and Student Analytics</h2>
                <p className="text-surface-400">
                  Track purchases, BTID spend, cohort purchasing power, night-canteen behavior, and product movement.
                </p>
              </div>
              <div className={`analytics-controls ${analyticsFilters.preset === 'custom' ? 'is-custom' : 'is-single'}`}>
                <select
                  value={analyticsFilters.preset}
                  onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, preset: event.target.value }))}
                  aria-label="Analytics date range"
                >
                  {rangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {analyticsFilters.preset === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={analyticsFilters.startDate}
                      onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                      aria-label="Start date"
                    />
                    <input
                      type="date"
                      value={analyticsFilters.endDate}
                      onChange={(event) => setAnalyticsFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                      aria-label="End date"
                    />
                  </>
                )}
              </div>
            </section>

            <section className="analytics-metric-grid">
              {[
                { label: 'Selected sales', value: formatCurrency(stats.rangeSummary?.grossSales), icon: <HiOutlineCurrencyRupee className="w-6 h-6" /> },
                { label: 'All-time sales', value: formatCurrency(stats.totalRevenue), icon: <HiOutlineCurrencyRupee className="w-6 h-6" /> },
                { label: 'Orders in range', value: formatNumber(stats.rangeSummary?.orders), icon: <HiOutlineClipboardList className="w-6 h-6" /> },
                { label: 'Food sold in range', value: formatNumber(stats.rangeSummary?.itemsSold), icon: <HiOutlineCollection className="w-6 h-6" /> },
                { label: 'Active students', value: formatNumber(stats.rangeSummary?.activeStudents), icon: <HiOutlineUserGroup className="w-6 h-6" /> },
                { label: 'Avg order value', value: formatCurrency(stats.rangeSummary?.averageOrderValue), icon: <HiOutlineCurrencyRupee className="w-6 h-6" /> },
              ].map((metric) => (
                <article key={metric.label} className="analytics-metric-card glass-card-static">
                  <div className="analytics-metric-icon text-primary-400">{metric.icon}</div>
                  <p className="analytics-metric-value text-white">{metric.value}</p>
                  <p className="analytics-metric-label text-surface-400">{metric.label}</p>
                </article>
              ))}
            </section>

            <section className="analytics-rollup-grid">
              <article className="analytics-rollup-card analytics-rollup-group-card glass-card-static">
                <div className="analytics-rollup-group-header">
                  <p className="text-surface-400">Food sold summary</p>
                  <span className="text-surface-500">Week / month / year</span>
                </div>
                <div className="analytics-rollup-items">
                  {[
                    { key: 'week', label: 'Week', data: stats.foodSoldRollups?.week },
                    { key: 'month', label: 'Month', data: stats.foodSoldRollups?.month },
                    { key: 'year', label: 'Year', data: stats.foodSoldRollups?.year },
                  ].map((rollup) => (
                    <div key={rollup.key} className="analytics-rollup-item">
                      <span className="text-surface-400">{rollup.label}</span>
                      <strong className="text-white">{formatNumber(rollup.data?.itemsSold)} <small>items</small></strong>
                      <em className="text-surface-500">{formatCurrency(rollup.data?.sales)} · {formatNumber(rollup.data?.orders)} orders</em>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="analytics-chart-grid">
              <article className="analytics-panel glass-card-static">
                <div className="analytics-panel-header">
                  <div className="analytics-panel-title-row">
                    <div>
                      <h3>Sales Peak Over Time</h3>
                      <p className="text-surface-400">Revenue and food sold across this chart's own date range.</p>
                    </div>
                    <AnalyticsExportIcons rows={analyticsExportRows.sales} filename="sales-peak-over-time" title="Sales Peak Over Time" />
                  </div>
                  <ChartRangeControls
                    value={chartFilters.sales}
                    onChange={(next) => updateChartFilter('sales', next)}
                  />
                </div>
                <div className="analytics-chart-frame">
                  {(chartStats.sales?.periodSeries || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartStats.sales.periodSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="_id" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={false} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                        <Line type="monotone" dataKey="sales" stroke="#ff4714" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="itemsSold" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="analytics-empty text-surface-500">No sales data for this chart range.</div>
                  )}
                </div>
              </article>

              <article className="analytics-panel glass-card-static">
                <div className="analytics-panel-header">
                  <div className="analytics-panel-title-row">
                    <div>
                      <h3>Item Sales Distribution</h3>
                      <p className="text-surface-400">Pie view of top purchased products for this chart's date range.</p>
                    </div>
                    <AnalyticsExportIcons rows={analyticsExportRows.items} filename="item-sales-distribution" title="Item Sales Distribution" />
                  </div>
                  <ChartRangeControls
                    value={chartFilters.items}
                    onChange={(next) => updateChartFilter('items', next)}
                  />
                </div>
                <div className="analytics-chart-frame">
                  {(chartStats.items?.topItems || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip cursor={false} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                        <Pie
                          data={chartStats.items.topItems}
                          dataKey="quantity"
                          nameKey="_id"
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={100}
                          paddingAngle={3}
                        >
                          {chartStats.items.topItems.map((entry, index) => (
                            <Cell key={entry._id} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="analytics-empty text-surface-500">No item sales for this chart range.</div>
                  )}
                </div>
                <div className="analytics-chart-legend">
                  {(chartStats.items?.topItems || []).map((item, index) => (
                    <span key={item._id}>
                      <i style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                      {item._id} ({formatNumber(item.quantity)})
                    </span>
                  ))}
                </div>
              </article>

              <article className="analytics-panel glass-card-static">
                <div className="analytics-panel-header">
                  <div className="analytics-panel-title-row">
                    <div>
                      <h3>Cohort Purchasing Power</h3>
                      <p className="text-surface-400">Compare BT23, BT24, BT25 and other batches visually.</p>
                    </div>
                    <AnalyticsExportIcons rows={analyticsExportRows.cohort} filename="cohort-purchasing-power" title="Cohort Purchasing Power" />
                  </div>
                  <ChartRangeControls
                    value={chartFilters.cohort}
                    onChange={(next) => updateChartFilter('cohort', next)}
                  />
                </div>
                <div className="analytics-chart-frame">
                  {(chartStats.cohort?.cohortSpending || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartStats.cohort.cohortSpending} margin={{ left: 8, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="cohort" tick={{ fill: '#e4e4e7', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={false} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                        <Bar dataKey="totalSpent" fill="#10b981" radius={[8, 8, 0, 0]} activeBar={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="analytics-empty text-surface-500">No cohort data for this chart range.</div>
                  )}
                </div>
              </article>

              <article className="analytics-panel glass-card-static">
                <div className="analytics-panel-header">
                  <div className="analytics-panel-title-row">
                    <div>
                      <h3>Student Spend Ranking</h3>
                      <p className="text-surface-400">Top BTID-linked spenders for this chart's selected dates.</p>
                    </div>
                    <AnalyticsExportIcons rows={analyticsExportRows.students} filename="student-spend-ranking" title="Student Spend Ranking" />
                  </div>
                  <ChartRangeControls
                    value={chartFilters.students}
                    onChange={(next) => updateChartFilter('students', next)}
                  />
                </div>
                <div className="analytics-chart-frame">
                  {chartStudentSpendRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartStudentSpendRows.slice(0, 8)} layout="vertical" margin={{ left: 16, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="displayLabel" type="category" width={116} tick={{ fill: '#e4e4e7', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={false} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                        <Bar dataKey="totalSpent" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={20} activeBar={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="analytics-empty text-surface-500">No student spend data for this chart range.</div>
                  )}
                </div>
              </article>

              <article className="analytics-panel glass-card-static">
                <div className="analytics-panel-header">
                  <div className="analytics-panel-title-row">
                    <div>
                      <h3>Night Canteen Spend</h3>
                      <p className="text-surface-400">Spending between 8 PM and 5 AM for selected dates.</p>
                    </div>
                    <AnalyticsExportIcons rows={analyticsExportRows.night} filename="night-canteen-spend" title="Night Canteen Spend" />
                  </div>
                  <ChartRangeControls
                    value={chartFilters.night}
                    onChange={(next) => updateChartFilter('night', next)}
                  />
                </div>
                <div className="analytics-chart-frame">
                  {chartNightCanteenRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartNightCanteenRows.slice(0, 8)} layout="vertical" margin={{ left: 16, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="displayLabel" type="category" width={116} tick={{ fill: '#e4e4e7', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={false} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                        <Bar dataKey="totalSpent" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={20} activeBar={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="analytics-empty text-surface-500">No night canteen spend for this chart range.</div>
                  )}
                </div>
              </article>
            </section>

            <section className="analytics-table-grid">
              <AnalyticsTable
                title="Top 5 Purchased Items"
                subtitle="Highest quantity sold in the selected range."
                columns={['Item', 'Qty', 'Revenue']}
                rows={(stats.topItems || []).map((item) => [item._id, formatNumber(item.quantity), formatCurrency(item.revenue)])}
              />
              <AnalyticsTable
                title="Least Selling Products"
                subtitle="Lowest quantity among products that sold in the selected range."
                columns={['Item', 'Qty', 'Revenue']}
                rows={(stats.leastItems || []).map((item) => [item._id, formatNumber(item.quantity), formatCurrency(item.revenue)])}
              />
              <AnalyticsTable
                title="Student Spend by BTID"
                subtitle="Top spenders with derived BTID and batch."
                columns={['Student', 'BTID', 'Orders', 'Spent']}
                rows={studentSpendRows.map((student) => [student.name, student.btId, formatNumber(student.orders), formatCurrency(student.totalSpent)])}
              />
              <AnalyticsTable
                title="Cohort Purchasing Power"
                subtitle="Compares BT23, BT24, BT25 and other batches."
                columns={['Cohort', 'Students', 'Orders', 'Spent']}
                rows={(stats.cohortSpending || []).map((cohort) => [cohort.cohort, formatNumber(cohort.students), formatNumber(cohort.orders), formatCurrency(cohort.totalSpent)])}
              />
              <AnalyticsTable
                title="Night Canteen Spenders"
                subtitle="Most spend between 8 PM and 5 AM."
                columns={['Student', 'BTID', 'Orders', 'Spent']}
                rows={nightCanteenRows.map((student) => [student.name, student.btId, formatNumber(student.orders), formatCurrency(student.totalSpent)])}
              />
              <AnalyticsTable
                title="Top Items by Period"
                subtitle="Today, week, month, and year leaders."
                columns={['Period', 'Item', 'Qty']}
                rows={[
                  ['Today', stats.topItemsByPeriod?.today?.[0]?._id || '-', formatNumber(stats.topItemsByPeriod?.today?.[0]?.quantity)],
                  ['Week', stats.topItemsByPeriod?.week?.[0]?._id || '-', formatNumber(stats.topItemsByPeriod?.week?.[0]?.quantity)],
                  ['Month', stats.topItemsByPeriod?.month?.[0]?._id || '-', formatNumber(stats.topItemsByPeriod?.month?.[0]?.quantity)],
                  ['Year', stats.topItemsByPeriod?.year?.[0]?._id || '-', formatNumber(stats.topItemsByPeriod?.year?.[0]?.quantity)],
                ]}
              />
            </section>

            <section className="analytics-insights glass-card-static">
              <div className="analytics-panel-title-row">
                <div>
                  <h3>Operational Signals</h3>
                </div>
              </div>
              <div className="analytics-insight-grid">
                <p><span>Most purchased</span><strong>{stats.insights?.mostPurchasedItem?._id || '-'}</strong></p>
                <p><span>Least selling</span><strong>{stats.insights?.leastPurchasedItem?._id || '-'}</strong></p>
                <p><span>Strongest cohort</span><strong>{stats.insights?.strongestCohort?.cohort || '-'}</strong></p>
                <p><span>Highest spender</span><strong>{stats.insights?.topSpender?.name || '-'}</strong></p>
                <p><span>Night canteen leader</span><strong>{stats.insights?.nightCanteenLeader?.name || '-'}</strong></p>
                <p><span>Repeat students</span><strong>{formatNumber(stats.rangeSummary?.repeatStudents)}</strong></p>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="admin-users-section">
            <div className="admin-user-filters">
              {['', 'student', 'kitchen', 'admin'].map((r, i) => (
                <button
                  key={i}
                  onClick={() => setUserFilter(r)}
                  className={`admin-user-filter ${userFilter === r ? 'is-active' : ''}`}
                >
                  {r || 'All Accounts'}
                </button>
              ))}
            </div>

            <div className="admin-users-card">
              <div className="admin-users-table">
               <div className="admin-users-head">
                 <div>Identity</div>
                 <div>System Role</div>
                 <div>Actions</div>
               </div>

              <div className="admin-users-body">
                {users.map(u => (
                  <div key={u._id} className="admin-user-row">
                    <div className="admin-user-identity">
                      <div className="admin-user-avatar gradient-dark border border-white/10 text-primary-400">
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="admin-user-copy">
                        <p className="admin-user-name text-white">{u.name}</p>
                        <p className="admin-user-email text-surface-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="admin-user-controls">
                      <div className="admin-role-cell">
                        <span className="admin-cell-label text-surface-500">Role</span>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="input-field admin-role-select"
                        >
                          <option value="student">STUDENT</option>
                          <option value="kitchen">KITCHEN</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      </div>
                      <div className="admin-actions-cell">
                        <span className="admin-cell-label text-surface-500">Action</span>
                        <button 
                          onClick={() => handleDeleteUser(u._id, u.name)} 
                          className="admin-revoke-btn"
                        >
                          REVOKE
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                   <div className="admin-users-empty text-surface-500">No users match this filter.</div>
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
