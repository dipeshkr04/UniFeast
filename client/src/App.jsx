import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
import NutritionPage from './pages/NutritionPage';
import LiveQueuePage from './pages/LiveQueuePage';
import OutsideFoodPage from './pages/OutsideFoodPage';
import OutsideFoodPoolPage from './pages/OutsideFoodPoolPage';
import FindFeastPage from './pages/FindFeastPage';
import KitchenDashboard from './pages/KitchenDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MenuManage from './pages/MenuManage';
import AdminOutsideFoodPage from './pages/AdminOutsideFoodPage';

const PENDING_ORDER_KEY = 'unifeast_pending_order';

function getUserId(user) {
  return user?._id || user?.id || '';
}

function isClientOrderRetryError(error) {
  const status = error.response?.status;
  return status >= 400 && status < 500;
}

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

  const clearPendingOrder = () => {
    localStorage.removeItem(PENDING_ORDER_KEY);
    setPendingOrder(null);
  };

  useEffect(() => {
    if (!user || user.role !== 'student') {
      setPendingOrder(null);
      return;
    }

    try {
      const raw = localStorage.getItem(PENDING_ORDER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const currentUserId = getUserId(user);
      const paymentId = parsed.razorpayPaymentId || parsed.razorpay_payment_id;
      const isValidPendingOrder =
        parsed?.timestamp &&
        parsed.userId === currentUserId &&
        Array.isArray(parsed.items) &&
        parsed.items.length > 0 &&
        paymentId;

      if (!isValidPendingOrder) {
        localStorage.removeItem(PENDING_ORDER_KEY);
        setPendingOrder(null);
        return;
      }

      const ageMs = Date.now() - parsed.timestamp;
      if (ageMs > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(PENDING_ORDER_KEY);
        setPendingOrder(null);
        return;
      }
      setPendingOrder(parsed);
    } catch {
      localStorage.removeItem(PENDING_ORDER_KEY);
      setPendingOrder(null);
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
      localStorage.removeItem(PENDING_ORDER_KEY);
      setPendingOrder(null);
      toast.success('Pending order completed successfully.');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to complete pending order.';
      if (isClientOrderRetryError(err)) {
        clearPendingOrder();
        toast.error(`${message} Pending retry cleared.`);
      } else {
        toast.error(`${message} Please retry.`);
      }
    } finally {
      setRetrying(false);
    }
  };

  if (!pendingOrder) return null;

  return (
    <div className="fixed top-4 md:top-5 left-1/2 -translate-x-1/2 z-[1100] w-[calc(100vw-32px)] max-w-2xl">
      <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 backdrop-blur-md px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-amber-100">You have a pending order from a previous session - tap to complete.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={retryCreateOrder}
            disabled={retrying}
            className="px-4 py-2 rounded-lg bg-amber-400 text-black text-sm font-semibold disabled:opacity-60 min-h-[44px]"
          >
            {retrying ? 'Retrying...' : 'Retry Now'}
          </button>
          <button
            onClick={clearPendingOrder}
            disabled={retrying}
            className="px-4 py-2 rounded-lg bg-white/10 text-amber-100 text-sm font-semibold disabled:opacity-60 min-h-[44px]"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen min-h-screen flex items-center justify-center">
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
        <Route path="live-queue" element={<ProtectedRoute roles={['student']}><LiveQueuePage /></ProtectedRoute>} />
        <Route path="nutrition" element={<ProtectedRoute roles={['student']}><NutritionPage /></ProtectedRoute>} />
        <Route path="pools" element={<ProtectedRoute roles={['student']}><OutsideFoodPage /></ProtectedRoute>} />
        <Route path="pools/:poolId" element={<ProtectedRoute roles={['student']}><OutsideFoodPoolPage /></ProtectedRoute>} />
        <Route path="outside-food" element={<Navigate to="/pools" replace />} />
        <Route path="outside-food/pool/:poolId" element={<ProtectedRoute roles={['student']}><OutsideFoodPoolPage /></ProtectedRoute>} />
        <Route path="find-feast" element={<ProtectedRoute roles={['student']}><FindFeastPage /></ProtectedRoute>} />

        {/* Kitchen Routes */}
        <Route path="kitchen" element={<ProtectedRoute roles={['kitchen']}><KitchenDashboard /></ProtectedRoute>} />
        <Route path="menu-manage" element={<ProtectedRoute roles={['kitchen']}><MenuManage /></ProtectedRoute>} />
        <Route path="kitchen-analytics" element={<ProtectedRoute roles={['kitchen']}><AdminDashboard mode="analytics" /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="stats" element={<ProtectedRoute roles={['admin']}><AdminDashboard mode="analytics" /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['admin']}><AdminDashboard mode="users" /></ProtectedRoute>} />
        <Route path="admin/restaurants" element={<ProtectedRoute roles={['admin']}><AdminOutsideFoodPage /></ProtectedRoute>} />
        <Route path="admin/outside-food" element={<Navigate to="/admin/restaurants" replace />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <CartProvider>
              <PendingOrderBanner />
              <AppRoutes />
              <Toaster
                position="bottom-center"
                containerStyle={{ zIndex: 3000 }}
                toastOptions={{
                  className: 'unifeast-toast',
                  style: {
                    background: 'rgba(24,24,27,0.85)',
                    backdropFilter: 'blur(16px)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    fontSize: '14px',
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
      </ThemeProvider>
    </BrowserRouter>
  );
}
