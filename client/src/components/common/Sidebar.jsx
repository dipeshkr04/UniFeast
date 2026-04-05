import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  HiOutlineHome, HiOutlineClipboardList, HiOutlineUserGroup,
  HiOutlineChartBar, HiOutlineCog, HiOutlineCollection
} from 'react-icons/hi';
import { MdRestaurantMenu, MdOutlineFastfood, MdOutlineKitchen } from 'react-icons/md';
import { IoNutritionOutline } from 'react-icons/io5';

const studentLinks = [
  { to: '/', icon: HiOutlineHome, label: 'Menu' },
  { to: '/orders', icon: HiOutlineClipboardList, label: 'My Orders' },
  { to: '/pools', icon: HiOutlineUserGroup, label: 'Order Pools' },
  { to: '/nutrition', icon: IoNutritionOutline, label: 'Nutrition' },
];

const kitchenLinks = [
  { to: '/', icon: MdOutlineKitchen, label: 'Live Orders' },
  { to: '/menu-manage', icon: MdRestaurantMenu, label: 'Menu' },
  { to: '/stats', icon: HiOutlineChartBar, label: 'Statistics' },
];

const adminLinks = [
  { to: '/', icon: HiOutlineHome, label: 'Dashboard' },
  { to: '/kitchen', icon: MdOutlineKitchen, label: 'Live Orders' },
  { to: '/menu-manage', icon: MdRestaurantMenu, label: 'Menu' },
  { to: '/users', icon: HiOutlineUserGroup, label: 'Users' },
  { to: '/stats', icon: HiOutlineChartBar, label: 'Analytics' },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  const links = user?.role === 'admin' ? adminLinks :
    user?.role === 'kitchen' ? kitchenLinks : studentLinks;

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 bottom-0 w-64 z-40 bg-[#0F111A]/95 backdrop-blur-2xl border-r border-surface-700/50 shadow-2xl transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      >
        <div className="flex flex-col h-full p-4 overflow-y-auto scrollbar-none">
          {/* Navigation */}
          <nav className="flex-1 space-y-1.5 mt-2">
            <p className="text-[11px] uppercase tracking-widest text-surface-500 font-bold mb-4 px-3">
              Navigation
            </p>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden group
                  ${isActive
                    ? 'text-primary-400 bg-primary-500/10 font-semibold blur-bg shadow-inner'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/40'
                  }`
                }
                id={`sidebar-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {({ isActive }) => (
                  <>
                    {/* Active Tab Indicator Line */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 to-accent-500 rounded-r-md shadow-[0_0_10px_rgba(var(--color-primary-500)/0.5)]" />
                    )}
                    
                    <link.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-md' : 'group-hover:scale-110'}`} />
                    <span className="tracking-wide">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom user card */}
          <div className="mt-6 pt-4 border-t border-surface-700/50">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-800/30 hover:bg-surface-800/60 border border-surface-700/30 transition-colors">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/20">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-surface-100 truncate">{user?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${user?.role === 'admin' ? 'bg-purple-400' : user?.role === 'kitchen' ? 'bg-amber-400' : 'bg-primary-400'}`} />
                  <p className="text-xs text-surface-400 capitalize truncate">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
