import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { orderAPI } from './api';
import { SocketProvider } from './contexts/SocketContext';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/common/Layout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import PoolsPage from './pages/PoolsPage';
import NutritionPage from './pages/NutritionPage';
import KitchenDashboard from './pages/KitchenDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MenuManage from './pages/MenuManage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return null; // Let AppRoutes handle global loading
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function PendingOrderBanner() {
  const { user } = useAuth();
  const [pendingOrder, setPendingOrder] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    try {
      const raw = localStorage.getItem('unifeast_pending_order');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.timestamp) return;
      const ageMs = Date.now() - parsed.timestamp;
      if (ageMs > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('unifeast_pending_order');
        return;
      }
      setPendingOrder(parsed);
    } catch {
      localStorage.removeItem('unifeast_pending_order');
    }
  }, [user]);

  const retryCreateOrder = async () => {
    if (!pendingOrder) return;
    setRetrying(true);
    try {
      await orderAPI.create({
        items: pendingOrder.items,
        totalAmount: pendingOrder.totalAmount,
        specialInstructions: pendingOrder.specialInstructions || '',
        razorpayPaymentId: pendingOrder.razorpayPaymentId || pendingOrder.razorpay_payment_id,
      });
      localStorage.removeItem('unifeast_pending_order');
      setPendingOrder(null);
      toast.success('Pending order completed successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete pending order. Please retry.');
    } finally {
      setRetrying(false);
    }
  };

  if (!pendingOrder) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-2xl">
      <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 backdrop-blur-md px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-amber-100">You have a pending order from a previous session - tap to complete.</p>
        <button
          onClick={retryCreateOrder}
          disabled={retrying}
          className="px-3 py-2 rounded-lg bg-amber-400 text-black text-sm font-semibold disabled:opacity-60"
        >
          {retrying ? 'Retrying...' : 'Retry Now'}
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
        </div>
      </div>
    );
  }

  // Determine home page based on role
  const getHomePage = () => {
    switch (user.role) {
      case 'kitchen': return <KitchenDashboard />;
      case 'admin': return <AdminDashboard />;
      default: return <MenuPage />;
    }
  };

  // If user is NOT logged in, show Public routes (Landing Page, Login, Register)
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // If user IS logged in, show Protected App Routes
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />

      <Route path="/" element={<Layout />}>
        <Route index element={getHomePage()} />

        {/* Student Routes */}
        <Route path="cart" element={<ProtectedRoute roles={['student']}><CartPage /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute roles={['student']}><OrdersPage /></ProtectedRoute>} />
        <Route path="pools" element={<ProtectedRoute roles={['student']}><PoolsPage /></ProtectedRoute>} />
        <Route path="nutrition" element={<ProtectedRoute roles={['student']}><NutritionPage /></ProtectedRoute>} />

        {/* Kitchen Routes */}
        <Route path="kitchen" element={<ProtectedRoute roles={['kitchen']}><KitchenDashboard /></ProtectedRoute>} />
        <Route path="menu-manage" element={<ProtectedRoute roles={['kitchen']}><MenuManage /></ProtectedRoute>} />
        <Route path="kitchen-analytics" element={<ProtectedRoute roles={['kitchen']}><AdminDashboard mode="analytics" /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="stats" element={<ProtectedRoute roles={['admin']}><AdminDashboard mode="analytics" /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['admin']}><AdminDashboard mode="users" /></ProtectedRoute>} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <CartProvider>
            <PendingOrderBanner />
            <AppRoutes />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: 'rgba(24,24,27,0.85)',
                  backdropFilter: 'blur(16px)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#18181b' } },
                error: { iconTheme: { primary: '#ff4714', secondary: '#18181b' } },
              }}
            />
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
