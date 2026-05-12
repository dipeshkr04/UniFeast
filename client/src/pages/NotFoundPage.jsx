import { Link, useLocation } from 'react-router-dom';
import { HiOutlineHome, HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import { MdRestaurantMenu } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import PublicNav from '../components/common/PublicNav';

function getHomeCopy(role) {
  switch (role) {
    case 'kitchen':
      return 'Back to live orders';
    case 'admin':
      return 'Back to dashboard';
    default:
      return 'Back to menu';
  }
}

function NotFoundContent({ isPublic }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role;

  return (
    <main className={`not-found-page animate-fadeIn ${isPublic ? 'public-static-main' : ''}`}>
      <section className="not-found-panel glass-card-static">
        <div className="not-found-mark">
          <span>404</span>
          <MdRestaurantMenu className="w-12 h-12" />
        </div>
        <p className="not-found-kicker">Wrong counter</p>
        <h1>This UniFeast link is not on the menu.</h1>
        <p className="not-found-copy">
          The page at <strong>{location.pathname}</strong> does not exist or has moved. Head back to the right place and keep the order moving.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn-primary not-found-primary">
            <HiOutlineHome className="w-5 h-5" />
            {isPublic ? 'Go to home' : getHomeCopy(role)}
          </Link>
          <Link to={role === 'student' ? '/faq' : '/about'} className="btn-secondary not-found-secondary">
            <HiOutlineQuestionMarkCircle className="w-5 h-5" />
            {role === 'student' ? 'Open FAQ' : 'About UniFeast'}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function NotFoundPage() {
  const { user } = useAuth();
  const isPublic = !user;

  if (isPublic) {
    return (
      <div className="public-landing-page public-static-page">
        <PublicNav />
        <NotFoundContent isPublic />
      </div>
    );
  }

  return <NotFoundContent />;
}
