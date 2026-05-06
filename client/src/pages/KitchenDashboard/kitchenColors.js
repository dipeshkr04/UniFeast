export const STATUS_COLORS = {
  PENDING: { bg: '#171717', border: '#9CA3AF', text: '#E4E4E7', badge: '#6B7280', label: 'Pending' },
  QUEUED: { bg: '#111827', border: '#3B82F6', text: '#DBEAFE', badge: '#2563EB', label: 'Queued' },
  PREPARING: { bg: '#1E1B16', border: '#F97316', text: '#FFEDD5', badge: '#EA580C', label: 'Preparing' },
  READY: { bg: '#052E1A', border: '#22C55E', text: '#DCFCE7', badge: '#16A34A', label: 'Ready' },
  COMPLETED: { bg: '#0F172A', border: '#64748B', text: '#CBD5E1', badge: '#475569', label: 'Done' },
  CANCELLED: { bg: '#2A0B0B', border: '#DC2626', text: '#FECACA', badge: '#DC2626', label: 'Cancelled' },
};

export const URGENCY = {
  NORMAL: { shadow: 'none', pulse: false },
  WARNING: { shadow: '0 0 0 2px rgba(249,115,22,0.55)', pulse: false },
  CRITICAL: { shadow: '0 0 0 3px rgba(220,38,38,0.7)', pulse: true },
};
