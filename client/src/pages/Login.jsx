import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MdRestaurantMenu } from 'react-icons/md';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { motion as Motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

const INSTITUTE_EMAIL_DOMAIN = '@iiitn.ac.in';

function isAllowedInstituteEmail(value) {
  return String(value || '').trim().toLowerCase().endsWith(INSTITUTE_EMAIL_DOMAIN);
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, googleLogin } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();

  const handleAuthSubmit = async (e) => {
    e.preventDefault();

    if (!isAllowedInstituteEmail(email)) {
      toast.error(`Use your college BT-ID email (${INSTITUTE_EMAIL_DOMAIN})`);
      return;
    }

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
    <div className="auth-shell selection:bg-primary-500/30">
      
      {/* Left Branding Panel (Full Bleed) */}
      <Motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        className="auth-brand-panel"
      >
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary-950/10 rounded-full blur-[140px]" />
        
        <div className="auth-brand-content relative z-10 flex-1 flex flex-col justify-center items-center text-center">
          <Motion.div 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
             className="auth-brand-icon inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl border border-white/20 mb-10"
          >
            <MdRestaurantMenu className="w-10 h-10 text-white drop-shadow-md" />
          </Motion.div>
          <Motion.h1 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
             className="auth-brand-title text-5xl lg:text-6xl font-black tracking-tight mb-8 leading-tight"
          >
            Uni<span className="text-white/80">Feast</span>
          </Motion.h1>
          <Motion.p 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
             className="auth-brand-copy text-white/80 text-xl leading-relaxed max-w-md mx-auto mb-10 font-medium"
          >
            The most advanced ecosystem to order, track, and pool your campus meals effortlessly.
          </Motion.p>
          
          <Motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}
             className="auth-brand-campus mt-auto border-t border-white/20 pt-8 w-full max-w-md"
          >
            <p className="text-sm font-bold tracking-[0.3em] uppercase text-white/90">IIIT Nagpur Campus</p>
          </Motion.div>
        </div>
      </Motion.div>

      {/* Right Form Panel (Full Bleed) */}
      <Motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="auth-form-panel w-full flex items-center justify-center relative"
      >
        {/* Premium Animated Mesh Background inside Form Panel */}
        <div className="hidden">
          <Motion.div 
            animate={{ x: [0, 50, -50, 0], y: [0, -50, 50, 0], scale: [1, 1.2, 0.8, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute top-10 left-[-20%] w-[600px] h-[600px] rounded-full bg-primary-600/5 blur-[150px]"
          />
          <Motion.div 
            animate={{ x: [0, -40, 40, 0], y: [0, 60, -60, 0], scale: [1, 1.3, 0.7, 1] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-10 right-[-20%] w-[700px] h-[700px] rounded-full bg-blue-500/5 blur-[150px]"
          />
        </div>

        <div className="auth-card glass-card-static relative z-10">
          <div className="auth-card-inner flex flex-col items-center">
          
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary-500/30 mb-4">
              <MdRestaurantMenu className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-[22px] font-bold tracking-normal mb-1">Uni<span className="text-primary-500">Feast</span></h1>
            <p className="text-[14px] text-surface-400 font-medium">IIIT Nagpur</p>
          </div>

          <div className="mb-7 text-center w-full">
            <h2 className="text-[22px] font-bold mb-1 text-white tracking-normal">Welcome Back</h2>
            <p className="text-surface-400 font-medium text-[14px]">Please enter your details to sign in.</p>
          </div>

          <div className="mb-6 auth-google-wrap">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                setLoading(true);
                try {
                  const data = await googleLogin(credentialResponse.credential);
                  toast.success(`Welcome, ${data.user.name}!`);
                  navigate('/');
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Google sign-in failed');
                } finally {
                  setLoading(false);
                }
              }}
              onError={() => toast.error('Google Login connection failed')}
              theme={isLight ? 'outline' : 'filled_black'}
              shape="pill"
              size="large"
              text="continue_with"
              width="100%"
            />
          </div>
          
          <div className="relative flex items-center mb-6 w-full">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="mx-4 text-surface-500 text-xs font-bold uppercase tracking-[0.2em] text-center">or sign in with bt email</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-[18px] w-full">
            <div className="flex flex-col gap-[18px]">
              <div className="text-left flex flex-col gap-2">
                <label className="block text-[13px] font-medium text-surface-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field py-3 bg-[#121214] border-surface-800 text-[14px] text-center"
                  placeholder="bt23xxx@iiitn.ac.in"
                  required
                />
              </div>
              <div className="text-left flex flex-col gap-2">
                <label className="block text-[13px] font-medium text-surface-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field py-3 bg-[#121214] border-surface-800 text-[14px] text-center tracking-widest"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-[15px] font-semibold rounded-[10px] mt-2 min-h-[48px]"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center w-full">
            <p className="text-surface-400 font-medium text-[14px]">
              New to UniFeast?{' '}
              <Link to="/register" className="text-primary-500 hover:text-primary-400 font-black transition-colors underline decoration-primary-500/30 underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>

          {/* Quick login */}
          <div className="mt-6 pt-5 border-t border-white/5 w-full">
            <p className="text-xs text-surface-500 text-center mb-4 uppercase tracking-[0.2em] font-black">Demo Access</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Student', email: 'student@iiitn.ac.in', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/50' },
                { label: 'Kitchen', email: 'kitchen@iiitn.ac.in', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/50' },
                { label: 'Admin', email: 'admin@iiitn.ac.in', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/50' },
              ].map(({ label, email: e, color }) => (
                <button
                  key={label}
                  onClick={() => quickLogin(e)}
                  className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all min-h-[44px] ${color}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          </div>
          
        </div>
      </Motion.div>
    </div>
  );
}
