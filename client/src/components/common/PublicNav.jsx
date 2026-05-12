import { Link, NavLink } from 'react-router-dom';
import { MdRestaurantMenu } from 'react-icons/md';
import ThemeToggle from './ThemeToggle';

export default function PublicNav() {
  return (
    <nav className="public-nav">
      <div className="public-nav-inner">
        <Link to="/" className="public-brand">
          <span className="public-brand-icon gradient-primary">
            <MdRestaurantMenu className="w-5 h-5 text-white" />
          </span>
          <span className="public-brand-copy">
            <span className="public-brand-title">Uni<span className="text-primary-500">Feast</span></span>
            <span className="public-brand-subtitle text-primary-400/80">IIIT Nagpur</span>
          </span>
        </Link>

        <div className="public-nav-actions">
          <ThemeToggle variant="public" />
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `public-nav-link ${isActive ? 'text-primary-400' : 'text-surface-300 hover:text-white'}`
            }
          >
            About
          </NavLink>
          <Link to="/login" className="public-nav-link text-surface-300 hover:text-white">Sign In</Link>
          <Link to="/register" className="btn-primary public-nav-cta">Get Started</Link>
        </div>
      </div>
    </nav>
  );
}
