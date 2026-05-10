import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { MdRestaurantMenu, MdOutlineFlashOn, MdOutlineGroups, MdOutlineSpeed, MdChevronRight } from 'react-icons/md';
import ThemeToggle from '../components/common/ThemeToggle';

const features = [
  {
    icon: MdOutlineSpeed,
    title: 'Smart Queuing',
    desc: 'Queue logic estimates kitchen load and gives students clearer pickup timing.',
  },
  {
    icon: MdOutlineGroups,
    title: 'Order Pools',
    desc: 'Students can join pooled orders and reduce cost when demand overlaps.',
  },
  {
    icon: MdOutlineFlashOn,
    title: 'Live Tracking',
    desc: 'Orders move through placed, preparing, ready, and pickup states in real time.',
  },
];

export default function LandingPage() {
  return (
    <div className="public-landing-page">
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
            <Link to="/login" className="public-nav-link text-surface-300 hover:text-white">Sign In</Link>
            <Link to="/register" className="btn-primary public-nav-cta">Get Started</Link>
          </div>
        </div>
      </nav>

      <main className="public-main">
        <section className="public-hero">
          <Motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="public-hero-copy"
          >
            <div className="public-eyebrow border border-white/10 bg-surface-900/60">
              <span className="public-eyebrow-chip gradient-primary text-white">New</span>
              <span className="text-primary-400">IIIT Nagpur's digital canteen</span>
            </div>

            <h1 className="public-hero-title">
              UniFeast Campus Dining
            </h1>
            <p className="public-hero-subtitle text-surface-400">
              Order food, join pools, track queue status, and reach pickup at the right time.
            </p>

            <div className="public-hero-actions">
              <Link to="/register" className="btn-primary public-primary-action">
                Start Ordering
                <MdOutlineFlashOn className="w-5 h-5" />
              </Link>
              <Link to="/login" className="public-secondary-action text-white border border-white/10 bg-surface-800/80 hover:bg-surface-700/80">
                Access Dashboard
                <MdChevronRight className="w-5 h-5 text-surface-400" />
              </Link>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }}
            className="public-preview-wrap"
          >
            <div className="public-preview-stage">
              <div className="public-preview-frame" />
              <div className="public-preview-inner-frame" />

              <Motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="public-pool-badge"
              >
                <div className="public-pool-title text-info">
                  <MdOutlineGroups className="w-4 h-4" />
                  <span>Active Pool</span>
                </div>
                <p className="public-pool-copy text-white">
                  4/5 Joined <span className="text-surface-500" aria-hidden="true">&bull;</span> <span className="text-success">Save 20%</span>
                </p>
              </Motion.div>

              <div className="public-order-mini-card">
                <div className="public-order-mini-main">
                  <div className="public-order-mini-icon gradient-primary" aria-hidden="true">
                    <MdRestaurantMenu className="w-7 h-7 text-white" />
                  </div>
                  <div className="public-order-mini-copy">
                    <h3 className="text-white">Spicy Paneer Wrap</h3>
                    <p className="text-primary-400">
                      <MdOutlineSpeed className="w-4 h-4" />
                      <span>Ready in 4m</span>
                    </p>
                  </div>
                </div>

                <div className="public-order-mini-progress">
                  <div className="public-progress-track bg-surface-800/80 border border-white/10">
                    <Motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '75%' }}
                      transition={{ duration: 1.4, delay: 0.55, ease: 'easeOut' }}
                      className="public-progress-fill gradient-primary"
                    />
                  </div>
                  <div className="public-progress-labels text-surface-500">
                    <span>Ordered</span>
                    <span className="text-primary-400">Preparing</span>
                  </div>
                </div>
              </div>
            </div>
          </Motion.div>
        </section>

        <section className="public-feature-section">
          <div className="public-section-heading">
            <h2 className="text-white">Why UniFeast?</h2>
            <p className="text-surface-400">Everything needed for a faster, clearer campus dining workflow.</p>
          </div>

          <div className="public-feature-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: index * 0.1, duration: 0.45 }}
                  className="public-feature-card glass-card-static"
                >
                  <div className="public-feature-icon bg-surface-800 border border-white/10 text-primary-400">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-white">{feature.title}</h3>
                  <p className="text-surface-400">{feature.desc}</p>
                </Motion.article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
