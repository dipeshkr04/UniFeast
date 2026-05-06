import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  HiOutlineHome, HiOutlineClipboardList, HiOutlineUserGroup,
  HiOutlineChartBar, HiOutlineX
} from 'react-icons/hi';
import { MdRestaurantMenu, MdOutlineKitchen } from 'react-icons/md';
import { IoNutritionOutline } from 'react-icons/io5';
import { AnimatePresence } from 'framer-motion';

const studentLinks = [
  { to: '/', icon: HiOutlineHome, label: 'Menu' },
  { to: '/orders', icon: HiOutlineClipboardList, label: 'My Orders' },
  { to: '/pools', icon: HiOutlineUserGroup, label: 'Pool Board' },
  { to: '/nutrition', icon: IoNutritionOutline, label: 'Nutrition' },
];

const kitchenLinks = [
  { to: '/', icon: MdOutlineKitchen, label: 'Live Orders' },
  { to: '/menu-manage', icon: MdRestaurantMenu, label: 'Menu' },
  { to: '/kitchen-analytics', icon: HiOutlineChartBar, label: 'Analytics' },
];

const adminLinks = [
  { to: '/', icon: HiOutlineHome, label: 'Dashboard' },
  { to: '/users', icon: HiOutlineUserGroup, label: 'Users' },
  { to: '/stats', icon: HiOutlineChartBar, label: 'Analytics' },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const links = user?.role === 'admin' ? adminLinks :
    user?.role === 'kitchen' ? kitchenLinks : studentLinks;
  const roleLabel = user?.role ? user.role.toUpperCase() : '';

  return (
    <>
      <AnimatePresence>
        {open && (
          <div
            className="mobile-sidebar-backdrop"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={`mobile-sidebar ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
      >
        <div className="mobile-sidebar-scroll">
          <header className="mobile-sidebar-header">
            <div className="mobile-sidebar-brand">
              <div className="mobile-sidebar-brand-icon gradient-primary">
                <MdRestaurantMenu className="w-5 h-5 text-white" />
              </div>
              <div className="mobile-sidebar-brand-copy">
                <p className="mobile-sidebar-brand-title">
                  Uni<span className="text-primary-500">Feast</span>
                </p>
                <p className="mobile-sidebar-brand-subtitle text-primary-400/80">IIIT Nagpur</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mobile-sidebar-close"
              aria-label="Close navigation"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
          </header>

          <nav className="mobile-sidebar-nav" aria-label="Primary navigation">
            <p className="mobile-sidebar-section-label">Navigation</p>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `mobile-sidebar-link ${isActive ? 'is-active' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="mobile-sidebar-link-indicator" aria-hidden="true" />
                    <link.icon className={`mobile-sidebar-link-icon ${isActive ? 'text-primary-400' : ''}`} />
                    <span className="mobile-sidebar-link-label">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <footer className="mobile-sidebar-footer">
            <div className="mobile-sidebar-user">
              <div className="mobile-sidebar-avatar gradient-primary">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="mobile-sidebar-user-copy">
                <p className="mobile-sidebar-user-name text-white">{user?.name}</p>
                <div className="mobile-sidebar-user-role">
                  <span className="mobile-sidebar-user-dot bg-primary-500" />
                  <p className="text-surface-400">{roleLabel}</p>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </aside>
    </>
  );
}
