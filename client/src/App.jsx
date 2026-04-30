import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
