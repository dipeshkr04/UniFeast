import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useSocket } from '../../contexts/SocketContext';
import { HiOutlineShoppingCart, HiOutlineBell, HiOutlineLogout, HiOutlineMenu } from 'react-icons/hi';
import { MdRestaurantMenu } from 'react-icons/md';
import { useState } from 'react';

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const { connected } = useSocket() || {};
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card-static" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              id="sidebar-toggle"
            >
              <HiOutlineMenu className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center gap-2.5 group" id="navbar-logo">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
                <MdRestaurantMenu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  Uni<span className="text-primary-400">Feast</span>
                </h1>
                <p className="text-[10px] text-surface-500 -mt-1 tracking-wider uppercase">IIIT Nagpur</p>
              </div>
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Connection indicator */}
            <div className="hidden sm:flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-full bg-surface-800/50">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
              <span className="text-[10px] text-surface-400">{connected ? 'Live' : 'Offline'}</span>
            </div>

            {/* Cart (students only) */}
            {user?.role === 'student' && (
              <Link
                to="/cart"
                className="relative p-2.5 rounded-xl hover:bg-white/5 transition-all"
                id="navbar-cart"
              >
                <HiOutlineShoppingCart className="w-5 h-5 text-surface-300" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse-glow">
                    {totalItems}
                  </span>
                )}
              </Link>
            )}

            {/* User info */}
            <div className="flex items-center gap-2 ml-1 pl-3 border-l border-surface-700/50">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-surface-200 leading-tight">{user?.name}</p>
                <p className="text-[10px] text-surface-500 capitalize">{user?.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-500/10 text-surface-400 hover:text-red-400 transition-all"
                title="Logout"
                id="navbar-logout"
              >
                <HiOutlineLogout className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
