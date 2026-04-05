import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MdRestaurantMenu } from 'react-icons/md';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success(`Welcome, ${data.user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email) => {
    setEmail(email);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 bg-accent-500/8 rounded-full blur-[120px]" />

      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-xl shadow-primary-500/25 mb-4">
            <MdRestaurantMenu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">
            Uni<span className="text-primary-400">Feast</span>
          </h1>
          <p className="text-surface-400 mt-1">Smart Canteen • IIIT Nagpur</p>
        </div>

        {/* Login Form */}
        <div className="glass-card-static p-8">
          <h2 className="text-xl font-semibold mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@iiit.ac.in"
                required
                id="login-email"
              />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                id="login-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              id="login-submit"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-surface-400 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Quick login buttons */}
        <div className="mt-6 glass-card-static p-4">
          <p className="text-xs text-surface-500 text-center mb-3 uppercase tracking-wider font-semibold">Demo Accounts</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Student', email: 'student@iiit.ac.in', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
              { label: 'Kitchen', email: 'kitchen@iiit.ac.in', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
              { label: 'Admin', email: 'admin@iiit.ac.in', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
            ].map(({ label, email: e, color }) => (
              <button
                key={label}
                onClick={() => quickLogin(e)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-105 ${color}`}
                id={`quick-login-${label.toLowerCase()}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

