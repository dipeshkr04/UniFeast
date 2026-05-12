import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { adminAPI } from '../../api';
import { HiOutlineShoppingCart, HiOutlineMenu } from 'react-icons/hi';
import { MdRestaurantMenu } from 'react-icons/md';
import { motion as Motion } from 'framer-motion';
import toast from 'react-hot-toast';
import ThemeToggle from './ThemeToggle';

const studentLinks = [
  { to: '/', label: 'Menu' },
  { to: '/live-queue', label: 'Live Queue' },
  { to: '/orders', label: 'My Orders' },
  { to: '/pools', label: 'Pools' },
  { to: '/find-feast', label: 'Find Your Feast' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/faq', label: 'FAQ' },
  { to: '/about', label: 'About' },
];

const kitchenLinks = [
  { to: '/', label: 'Live Orders' },
  { to: '/menu-manage', label: 'Menu' },
  { to: '/kitchen-analytics', label: 'Analytics' },
  { to: '/about', label: 'About' },
];

const adminLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Users' },
  { to: '/admin/restaurants', label: 'Restaurants' },
  { to: '/about', label: 'About' },
];

export default function Navbar({ onToggleSidebar, canteenLive, setCanteenLive }) {
  const { user } = useAuth();
  const { totalItems } = useCart();
  const [toggling, setToggling] = useState(false);

  const canToggle = user?.role === 'kitchen' || user?.role === 'admin';
  const links = user?.role === 'admin' ? adminLinks :
    user?.role === 'kitchen' ? kitchenLinks : studentLinks;
  const roleLabel = user?.role ? user.role.toUpperCase() : '';

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
    } catch {
      toast.error('Failed to update canteen status');
    } finally {
      setToggling(false);
    }
  };

  const readonlyCanteenStatus = (
    <div className={`canteen-toggle canteen-readonly student-canteen-status ${
      canteenLive
        ? 'bg-green-500/10 border-green-500/30'
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <span className={`canteen-dot ${canteenLive ? 'bg-green-400 shadow-[0_0_8px_#22c55e] animate-pulse' : 'bg-red-400 shadow-[0_0_8px_#ef4444]'}`} />
      <span className={`canteen-label ${canteenLive ? 'text-green-400' : 'text-red-400'}`}>
        {canteenLive ? 'Live' : 'Closed'}
      </span>
    </div>
  );

  return (
    <nav className="app-navbar">
      <div className="app-navbar-inner">
        <div className="app-navbar-grid">
          <Link to="/" className="app-brand group">
            <div className="app-brand-icon gradient-primary shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-all duration-300">
              <MdRestaurantMenu className="w-5 h-5 text-white" />
            </div>
            <div className="app-brand-copy">
              <p className="app-brand-title">
                Uni<span className="text-primary-500">Feast</span>
              </p>
              <p className="app-brand-subtitle text-primary-400/80">IIIT Nagpur</p>
            </div>
          </Link>

          <div className="app-nav-center">
            <div className="app-nav-links">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `app-nav-link ${
                      isActive
                        ? 'active text-primary-400'
                        : 'text-surface-300 hover:text-white'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="app-actions">
            {user?.role === 'student' && (
              <>
                {readonlyCanteenStatus}
                <Link to="/cart" className="nav-icon-btn student-cart-link group hover:bg-white/5">
                  <HiOutlineShoppingCart className="w-6 h-6 text-surface-300 group-hover:text-primary-400 transition-colors" />
                  {totalItems > 0 && (
                    <Motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="cart-count gradient-primary text-white"
                    >
                      {totalItems}
                    </Motion.span>
                  )}
                </Link>
                <ThemeToggle variant="nav" />
              </>
            )}

            <div className="app-user-block">
              <div className="app-user-meta">
                <p className="app-user-name text-white">{user?.name}</p>
                <p className="app-user-role text-surface-400">{roleLabel}</p>
              </div>
              {user?.role !== 'student' && <ThemeToggle variant="nav" />}
              <div className="app-avatar gradient-dark border border-white/10 text-primary-400">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              {canToggle && (
                <button
                  onClick={handleToggleCanteen}
                  disabled={toggling}
                  className={`canteen-toggle staff-canteen-toggle ${
                    canteenLive
                      ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                      : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                  }`}
                >
                  <span className={`canteen-dot ${canteenLive ? 'bg-green-400 shadow-[0_0_8px_#22c55e]' : 'bg-red-400 shadow-[0_0_8px_#ef4444]'}`} />
                  <span className={`canteen-label ${canteenLive ? 'text-green-400' : 'text-red-400'}`}>
                    {toggling ? '...' : canteenLive ? 'Live' : 'Closed'}
                  </span>
                  <span className={`canteen-switch ${canteenLive ? 'bg-green-500/30' : 'bg-surface-700'}`}>
                    <span className={`canteen-switch-thumb ${canteenLive ? 'is-live bg-green-400' : 'bg-surface-400'}`} />
                  </span>
                </button>
              )}
            </div>

            <button
              onClick={onToggleSidebar}
              className="nav-icon-btn nav-menu-btn hover:bg-white/10 text-surface-300 hover:text-white"
              aria-label="Open navigation"
            >
              <HiOutlineMenu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
