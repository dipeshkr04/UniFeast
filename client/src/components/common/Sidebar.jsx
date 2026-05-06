import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  HiOutlineHome, HiOutlineClipboardList, HiOutlineUserGroup,
  HiOutlineChartBar
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

  return (
    <>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[998] lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed left-0 top-0 h-[100vh] w-[280px] z-[999] bg-surface-950/95 backdrop-blur-3xl border-r border-white/5 shadow-2xl transition-transform duration-[250ms] ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'} flex flex-col pt-5 lg:hidden`}
      >
        <div className="flex flex-col h-full px-4 pb-5 overflow-y-auto scrollbar-none">
          <nav className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-surface-500 font-bold mb-5 pl-2">
              Navigation
            </p>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-all duration-300 relative group overflow-hidden
                  ${isActive
                    ? 'text-white'
                    : 'text-surface-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div
                        className="absolute inset-0 bg-linear-to-r from-primary-600/20 to-primary-500/5 rounded-lg border border-primary-500/20"
                      />
                    )}
                    {isActive && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary-500 rounded-r-full shadow-[0_0_10px_#ff4714]" />
                    )}
                    <link.icon className={`w-5 h-5 shrink-0 relative z-10 transition-all duration-300 ${isActive ? 'text-primary-400 scale-110 drop-shadow-[0_0_8px_rgba(255,71,20,0.5)]' : 'group-hover:scale-110 group-hover:text-primary-300'}`} />
                    <span className="relative z-10 tracking-wide min-w-0 whitespace-normal leading-snug">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="glass-card flex items-center gap-3 p-4 bg-white/5! hover:border-primary-500/30! group cursor-pointer transition-all">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary-500/30 shrink-0 group-hover:scale-110 transition-transform">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_#ff4714]" />
                  <p className="text-xs text-surface-400 font-medium uppercase tracking-widest truncate">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
