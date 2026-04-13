import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useSocket } from '../../contexts/SocketContext';
import { adminAPI } from '../../api';
import { HiOutlineShoppingCart, HiOutlineLogout, HiOutlineMenu } from 'react-icons/hi';
import { MdRestaurantMenu } from 'react-icons/md';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Navbar({ onToggleSidebar, canteenLive, setCanteenLive }) {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const { connected } = useSocket() || {};
  const navigate = useNavigate();
  const [toggling, setToggling] = useState(false);

  const canToggle = user?.role === 'kitchen' || user?.role === 'admin';

  const handleToggleCanteen = async () => {
    if (!canToggle || toggling) return;
    setToggling(true);
    try {
      const newStatus = !canteenLive;
      await adminAPI.toggleCanteenStatus(newStatus);
      setCanteenLive(newStatus);
      toast.success(newStatus ? 'Canteen is now LIVE!' : 'Canteen is now CLOSED', {
        icon: newStatus ? '🟢' : '🔴',
      });
    } catch (err) {
      toast.error('Failed to update canteen status');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
      <div style={{ paddingLeft: 'clamp(16px, 4vw, 64px)', paddingRight: 'clamp(16px, 4vw, 64px)', maxWidth: '1440px', marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Left: Logo + Menu Toggle */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onToggleSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-surface-300 hover:text-white transition-all hover:scale-105 active:scale-95"
            >
              <HiOutlineMenu className="w-6 h-6" />
            </button>
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 group-hover:scale-105 transition-all duration-300">
                <MdRestaurantMenu className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-black tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-surface-300">
                  Uni<span className="text-primary-500">Feast</span>
                </h1>
                <p className="text-[10px] text-primary-400/80 leading-none tracking-[0.2em] uppercase mt-1 font-semibold">IIIT Nagpur</p>
              </div>
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Canteen Status Indicator */}
            {canToggle ? (
              /* Kitchen/Admin: clickable toggle */
              <button
                onClick={handleToggleCanteen}
                disabled={toggling}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all duration-300 cursor-pointer group ${
                  canteenLive
                    ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                    : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${canteenLive ? 'bg-green-400 shadow-[0_0_8px_#22c55e]' : 'bg-red-400 shadow-[0_0_8px_#ef4444]'}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${canteenLive ? 'text-green-400' : 'text-red-400'}`}>
                  {toggling ? '...' : canteenLive ? 'Live' : 'Closed'}
                </span>
                <div className={`w-8 h-4 rounded-full relative transition-colors ml-1 ${canteenLive ? 'bg-green-500/30' : 'bg-surface-700'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${canteenLive ? 'left-4 bg-green-400' : 'left-0.5 bg-surface-400'}`} />
                </div>
              </button>
            ) : (
              /* Student: read-only status */
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                canteenLive
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${canteenLive ? 'bg-green-400 shadow-[0_0_8px_#22c55e] animate-pulse' : 'bg-red-400 shadow-[0_0_8px_#ef4444]'}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${canteenLive ? 'text-green-400' : 'text-red-400'}`}>
                  {canteenLive ? 'Canteen Open' : 'Canteen Closed'}
                </span>
              </div>
            )}

            {/* Cart */}
            {user?.role === 'student' && (
              <Link
                to="/cart"
                className="relative w-12 h-12 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all group"
              >
                <HiOutlineShoppingCart className="w-6 h-6 text-surface-300 group-hover:text-primary-400 transition-colors" />
                {totalItems > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full gradient-primary text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-primary-500/50 outline outline-2 outline-[#09090b]"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </Link>
            )}

            {/* User info */}
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/10">
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-white leading-tight">{user?.name}</p>
                <p className="text-[11px] font-medium text-surface-400 uppercase tracking-wider mt-0.5">{user?.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full gradient-dark border border-white/10 flex items-center justify-center text-primary-400 font-black text-sm shadow-inner shrink-0">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-surface-400 hover:text-red-400 transition-all ml-1"
                title="Logout"
              >
                <HiOutlineLogout className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

