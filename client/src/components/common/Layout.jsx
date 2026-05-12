import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { adminAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [canteenLive, setCanteenLive] = useState(false);
  const { user } = useAuth();
  const { socket } = useSocket() || {};
  const { pathname } = useLocation();
  const isKitchenDashboardPage = user?.role === 'kitchen' && (pathname === '/' || pathname === '/kitchen');
  const isPoolsListPage = user?.role === 'student' && pathname === '/pools';
  const isFindFeastPage = user?.role === 'student' && pathname === '/find-feast';
  const isRestaurantAdminPage = user?.role === 'admin' && pathname === '/admin/restaurants';
  const isPoolRoomPage = user?.role === 'student'
    && (pathname.startsWith('/pools/') || pathname.startsWith('/outside-food/pool/'));
  const isInfoPage = pathname === '/about' || pathname === '/faq';
  const isNutritionPage = pathname === '/nutrition';
  const appRoutePatterns = [
    /^\/$/,
    /^\/about$/,
    /^\/faq$/,
    /^\/cart$/,
    /^\/orders$/,
    /^\/live-queue$/,
    /^\/nutrition$/,
    /^\/pools$/,
    /^\/pools\/[^/]+$/,
    /^\/outside-food$/,
    /^\/outside-food\/pool\/[^/]+$/,
    /^\/find-feast$/,
    /^\/kitchen$/,
    /^\/menu-manage$/,
    /^\/kitchen-analytics$/,
    /^\/stats$/,
    /^\/users$/,
    /^\/admin\/restaurants$/,
    /^\/admin\/outside-food$/,
  ];
  const isNotFoundPage = !appRoutePatterns.some((pattern) => pattern.test(pathname));
  const isUnframedPage = pathname === '/menu-manage'
    || isKitchenDashboardPage
    || isPoolsListPage
    || isPoolRoomPage
    || isFindFeastPage
    || isRestaurantAdminPage
    || isInfoPage
    || isNutritionPage
    || isNotFoundPage;

  // Fetch canteen status on mount
  useEffect(() => {
    adminAPI.getCanteenStatus()
      .then(({ data }) => setCanteenLive(data.data.isLive))
      .catch(() => setCanteenLive(false));
  }, []);

  // Listen for real-time canteen status changes
  useEffect(() => {
    if (!socket) return;
    const handleCanteenStatus = (data) => {
      setCanteenLive(data.isLive);
    };
    socket.on('canteen-status', handleCanteenStatus);
    return () => socket.off('canteen-status', handleCanteenStatus);
  }, [socket]);

  return (
    <div className="app-shell-root min-h-screen overflow-x-hidden relative">
      {/* Premium Animated Mesh Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <Motion.div 
          animate={{ x: [0, 50, -50, 0], y: [0, -50, 50, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary-600/10 blur-[120px]"
        />
        <Motion.div 
          animate={{ x: [0, -40, 40, 0], y: [0, 40, -40, 0], scale: [1, 1.2, 0.8, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent-500/10 blur-[150px]"
        />
      </div>

      <Navbar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        canteenLive={canteenLive}
        setCanteenLive={setCanteenLive}
      />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="app-main-shell min-h-screen relative z-[1]">
        <div className={`container ${
          isKitchenDashboardPage
            ? 'kitchen-layout-container'
            : isPoolRoomPage
            ? 'pool-room-container pt-0'
            : 'pt-0 pb-6 md:pb-8'
        }`}>
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className={isKitchenDashboardPage
              ? 'kitchen-layout-frame'
              : isPoolRoomPage
              ? 'pool-room-layout-frame'
              : isUnframedPage
              ? 'min-h-[calc(100vh-128px)]'
              : 'glass-card-static min-h-[calc(100vh-128px)] shadow-2xl p-4 md:p-6 lg:p-8'
            }
          >
            <Outlet context={{ canteenLive, setCanteenLive }} />
          </Motion.div>
        </div>
      </main>
    </div>
  );
}
