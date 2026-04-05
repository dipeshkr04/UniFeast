import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/common/Layout';
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
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-surface-400">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  // Determine home page based on role
  const getHomePage = () => {
    if (!user) return <Navigate to="/login" replace />;
    switch (user.role) {
      case 'kitchen': return <KitchenDashboard />;
      case 'admin': return <AdminDashboard />;
      default: return <MenuPage />;
    }
  };

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={getHomePage()} />

        {/* Student Routes */}
        <Route path="cart" element={<ProtectedRoute roles={['student']}><CartPage /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute roles={['student']}><OrdersPage /></ProtectedRoute>} />
        <Route path="pools" element={<ProtectedRoute roles={['student']}><PoolsPage /></ProtectedRoute>} />
        <Route path="nutrition" element={<ProtectedRoute roles={['student']}><NutritionPage /></ProtectedRoute>} />

        {/* Kitchen Routes */}
        <Route path="kitchen" element={<ProtectedRoute roles={['kitchen', 'admin']}><KitchenDashboard /></ProtectedRoute>} />
        <Route path="menu-manage" element={<ProtectedRoute roles={['kitchen', 'admin']}><MenuManage /></ProtectedRoute>} />
        <Route path="stats" element={<ProtectedRoute roles={['kitchen', 'admin']}><AdminDashboard /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="users" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
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
              position="top-right"
              toastOptions={{
                style: {
                  background: '#1e293b',
                  color: '#f1f5f9',
                  border: '1px solid rgba(148,163,184,0.15)',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
              }}
            />
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
