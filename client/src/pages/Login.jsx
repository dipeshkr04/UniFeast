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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 bg-accent-500/8 rounded-full blur-[120px]" />

      <div className="w-full max-w-md lg:max-w-4xl animate-fadeIn relative z-10">
        <div className="glass-card overflow-hidden flex flex-col lg:flex-row shadow-2xl border-surface-700/50">
          
          {/* Left Branding Panel — hidden on mobile/tablet, shown on lg+ */}
          <div className="hidden lg:flex lg:w-5/12 gradient-primary p-8 xl:p-12 text-white flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
            
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md shadow-xl border border-white/20 mb-8">
                <MdRestaurantMenu className="w-7 h-7 text-white drop-shadow-md" />
              </div>
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
                Uni<span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">Feast</span>
              </h1>
              <p className="text-primary-100 text-base xl:text-lg leading-relaxed max-w-xs mb-auto">
                The smartest way to order, track, and pool your canteen meals seamlessly.
              </p>
              
              <div className="mt-auto border-t border-white/20 pt-6">
                <p className="text-sm font-semibold tracking-widest uppercase text-primary-100">IIIT Nagpur Campus</p>
              </div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:w-7/12 p-6 sm:p-8 lg:p-10 xl:p-12 bg-surface-900/60 backdrop-blur-xl flex flex-col justify-center">
            
            {/* Mobile logo — shown only below lg */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl gradient-primary shadow-lg">
                <MdRestaurantMenu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Uni<span className="text-primary-400">Feast</span></h1>
                <p className="text-[10px] text-surface-500 tracking-wider uppercase">IIIT Nagpur</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight">Welcome Back</h2>
              <p className="text-surface-400 text-sm sm:text-base">Please enter your details to sign in.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-300 mb-2">Campus Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field bg-surface-800/50 border-surface-700/50 focus:border-primary-500 py-3 px-4 rounded-xl"
                    placeholder="you@iiit.ac.in"
                    required
                    id="login-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-surface-300 mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field bg-surface-800/50 border-surface-700/50 focus:border-primary-500 py-3 px-4 rounded-xl"
                    placeholder="••••••••"
                    required
                    id="login-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 sm:py-3.5 text-base rounded-xl mt-2 relative overflow-hidden group"
                id="login-submit"
              >
                <span className="relative z-10">{loading ? 'Verifying...' : 'Sign In'}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              </button>
            </form>

            <div className="mt-8 text-center border-t border-surface-700/30 pt-6">
              <p className="text-surface-400 text-sm">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary-400 hover:text-primary-300 font-bold transition-colors">
                  Sign up
                </Link>
              </p>
            </div>

            {/* Quick login buttons */}
            <div className="mt-6 pt-6 border-t border-surface-700/30">
              <p className="text-xs text-surface-500 text-center mb-4 uppercase tracking-widest font-bold">Quick Demo Access</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Student', email: 'student@iiit.ac.in', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' },
                  { label: 'Kitchen', email: 'kitchen@iiit.ac.in', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' },
                  { label: 'Admin', email: 'admin@iiit.ac.in', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' },
                ].map(({ label, email: e, color }) => (
                  <button
                    key={label}
                    onClick={() => quickLogin(e)}
                    className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-xs font-bold transition-all hover:-translate-y-0.5 ${color}`}
                    id={`quick-login-${label.toLowerCase()}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
