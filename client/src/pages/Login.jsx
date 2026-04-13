import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MdRestaurantMenu } from 'react-icons/md';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleAuthSubmit = async (e) => {
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#050505] overflow-hidden selection:bg-primary-500/30">
      
      {/* Left Branding Panel (Full Bleed) */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-gradient-to-br from-primary-600 via-primary-500 to-primary-900 p-12 xl:p-20 text-white flex-col relative overflow-hidden"
      >
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-black/40 rounded-full blur-[120px]" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center">
          <motion.div 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
             className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md shadow-2xl border border-white/20 mb-10"
          >
            <MdRestaurantMenu className="w-10 h-10 text-white drop-shadow-md" />
          </motion.div>
          <motion.h1 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
             className="text-5xl xl:text-6xl font-black tracking-tight mb-8 leading-tight"
          >
            Uni<span className="text-white/80">Feast</span>
          </motion.h1>
          <motion.p 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
             className="text-white/80 text-xl leading-relaxed max-w-md mx-auto mb-10 font-medium"
          >
            The most advanced ecosystem to order, track, and pool your campus meals effortlessly.
          </motion.p>
          
          <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}
             className="mt-auto border-t border-white/20 pt-8 w-full max-w-md"
          >
            <p className="text-sm font-bold tracking-[0.3em] uppercase text-white/90">IIIT Nagpur Campus</p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Form Panel (Full Bleed) */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full lg:w-7/12 xl:w-1/2 min-h-screen flex flex-col justify-center relative bg-[#09090b]"
      >
        {/* Premium Animated Mesh Background inside Form Panel */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div 
            animate={{ x: [0, 50, -50, 0], y: [0, -50, 50, 0], scale: [1, 1.2, 0.8, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute top-10 left-[-20%] w-[600px] h-[600px] rounded-full bg-primary-600/5 blur-[150px]"
          />
          <motion.div 
            animate={{ x: [0, -40, 40, 0], y: [0, 60, -60, 0], scale: [1, 1.3, 0.7, 1] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-10 right-[-20%] w-[700px] h-[700px] rounded-full bg-blue-500/5 blur-[150px]"
          />
        </div>

        <div className="w-full max-w-xl mx-auto p-8 sm:p-12 lg:p-16 relative z-10 flex flex-col justify-center h-full items-center">
          
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-3xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary-500/30 mb-6">
              <MdRestaurantMenu className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2">Uni<span className="text-primary-500">Feast</span></h1>
            <p className="text-xs uppercase tracking-widest text-surface-500 font-bold">IIIT Nagpur</p>
          </div>

          <div className="mb-10 text-center w-full">
            <h2 className="text-4xl sm:text-5xl font-black mb-4 text-white tracking-tight">Welcome Back</h2>
            <p className="text-surface-400 font-medium text-lg">Please enter your details to sign in.</p>
          </div>

          <div className="mb-8 flex justify-center w-full">
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
              theme="filled_black"
              shape="pill"
              size="large"
              text="continue_with"
              width="320"
            />
          </div>
          
          <div className="relative flex items-center mb-10 w-full">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="mx-6 text-surface-500 text-xs font-bold uppercase tracking-[0.2em] text-center">or sign in with email</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-6 w-full max-w-md">
            <div className="space-y-6">
              <div className="text-left">
                <label className="block text-sm font-bold text-surface-300 mb-2 ml-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field py-4 bg-[#121214] border-surface-800 text-base text-center"
                  placeholder="you@gmail.com"
                  required
                />
              </div>
              <div className="text-left">
                <label className="block text-sm font-bold text-surface-300 mb-2 ml-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field py-4 bg-[#121214] border-surface-800 text-base text-center tracking-widest"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-lg rounded-xl mt-4 h-[60px]"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-12 text-center w-full">
            <p className="text-surface-400 font-medium">
              New to UniFeast?{' '}
              <Link to="/register" className="text-primary-500 hover:text-primary-400 font-black transition-colors underline decoration-primary-500/30 underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>

          {/* Quick login */}
          <div className="mt-12 pt-8 border-t border-white/5 w-full max-w-md">
            <p className="text-[10px] text-surface-500 text-center mb-4 uppercase tracking-[0.2em] font-black">Demo Access</p>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Student', email: 'shubhgoel@gmail.com', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/50' },
                { label: 'Kitchen', email: 'kitchen@iiit.ac.in', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/50' },
                { label: 'Admin', email: 'admin@iiit.ac.in', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/50' },
              ].map(({ label, email: e, color }) => (
                <button
                  key={label}
                  onClick={() => quickLogin(e)}
                  className={`py-3.5 px-3 rounded-xl border text-xs font-bold transition-all ${color}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          
        </div>
      </motion.div>
    </div>
  );
}
