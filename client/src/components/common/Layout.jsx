import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="min-h-screen" style={{ paddingTop: '80px' }}>
        <div style={{ paddingLeft: 'clamp(16px, 4vw, 64px)', paddingRight: 'clamp(16px, 4vw, 64px)', paddingTop: '16px', paddingBottom: '24px', maxWidth: '1440px', marginLeft: 'auto', marginRight: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
