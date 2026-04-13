import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { adminAPI } from '../../api';
import { useSocket } from '../../contexts/SocketContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [canteenLive, setCanteenLive] = useState(false);
  const { socket } = useSocket() || {};

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
    <div className="min-h-screen overflow-x-hidden relative bg-[#050505]">
      {/* Premium Animated Mesh Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 50, -50, 0], y: [0, -50, 50, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary-600/10 blur-[120px]"
        />
        <motion.div 
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
      
      <main className="min-h-screen relative z-10" style={{ paddingTop: '80px' }}>
        <div style={{ paddingLeft: 'clamp(16px, 4vw, 64px)', paddingRight: 'clamp(16px, 4vw, 64px)', paddingTop: '24px', paddingBottom: '32px', maxWidth: '1440px', marginLeft: 'auto', marginRight: 'auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="glass-card min-h-[80vh] shadow-2xl p-6 sm:p-8"
          >
            <Outlet context={{ canteenLive }} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}

