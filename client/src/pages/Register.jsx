import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MdRestaurantMenu, MdArrowBack } from 'react-icons/md';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const INSTITUTE_EMAIL_DOMAIN = '@iiitn.ac.in';

function isAllowedInstituteEmail(value) {
  return String(value || '').trim().toLowerCase().endsWith(INSTITUTE_EMAIL_DOMAIN);
}

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [attemptToken, setAttemptToken] = useState('');
  const [otp, setOtp] = useState('');

  const { requestRegisterOtp, verifyRegisterOtp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (step === 1) {
        if (!isAllowedInstituteEmail(form.email)) {
            toast.error(`Use your college BT-ID email (${INSTITUTE_EMAIL_DOMAIN})`);
            setLoading(false);
            return;
        }

        if (form.password !== form.confirmPassword) {
            toast.error('Passwords do not match');
            setLoading(false);
            return;
        }
        
        const data = await requestRegisterOtp({ 
            name: form.name, 
            email: form.email, 
            password: form.password, 
            phone: form.phone 
        });

        setAttemptToken(data.attemptToken);
        toast.success(data.message);
        if (data.devOtp) {
           toast("Developer OTP: " + data.devOtp, { duration: 6000, icon: '🔧' });
        }
        setStep(2);

      } else {
        const data = await verifyRegisterOtp(attemptToken, otp);
        toast.success(`Welcome, ${data.user.name}!`);
        navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell bg-[#050505] selection:bg-primary-500/30">
      
      {/* Left Branding Panel */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        className="hidden"
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
             className="text-5xl lg:text-6xl font-black tracking-tight mb-8 leading-tight"
          >
            Join Uni<span className="text-white/80">Feast</span>
          </motion.h1>
          <motion.p 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
             className="text-white/80 text-xl leading-relaxed max-w-md mx-auto mb-10 font-medium"
          >
            Create an account to unlock hyper-connected dining across the IIIT Nagpur campus.
          </motion.p>
          
          <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}
             className="mt-auto border-t border-white/20 pt-8 w-full max-w-md"
          >
            <p className="text-sm font-bold tracking-[0.3em] uppercase text-white/90">Registration Portal</p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Form Panel */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full flex items-center justify-center relative"
      >
        {/* Premium Animated Mesh Background */}
        <div className="hidden">
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

        <div className="auth-card glass-card-static relative z-10">
          <div className="auth-card-inner flex flex-col items-center">
          
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary-500/30 mb-4">
              <MdRestaurantMenu className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-[22px] font-bold tracking-normal mb-1">Uni<span className="text-primary-500">Feast</span></h1>
            <p className="text-[14px] text-surface-400 font-medium">IIIT Nagpur</p>
          </div>

          <div className="mb-7 relative text-center w-full">
            {step === 2 && (
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="absolute -top-12 left-1/2 -translate-x-1/2 lg:-left-12 lg:-top-2 lg:translate-x-0 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/5 rounded-full text-surface-400 hover:text-white transition-colors"
              >
                <MdArrowBack size={24} />
              </button>
            )}
            <h2 className="text-[22px] font-bold mb-1 text-white tracking-normal">
               {step === 1 ? 'Create Account' : 'Verify Email'}
            </h2>
            <p className="text-surface-400 font-medium text-[14px]">
               {step === 1 ? 'Join the smartest canteen network.' : 'Enter the verification OTP sent to your email.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px] w-full">
            <AnimatePresence mode="wait">
              {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col gap-[18px]"
                  >
                      <div className="text-left flex flex-col gap-2">
                        <label className="block text-[13px] font-medium text-surface-300">Full Name</label>
                        <input name="name" value={form.name} onChange={handleChange} className="input-field py-3 bg-[#121214] border-surface-800 text-[14px] text-center" placeholder="John Doe" required />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-left flex flex-col gap-2">
                          <label className="block text-[13px] font-medium text-surface-300">Email Address</label>
                          <input name="email" type="email" value={form.email} onChange={handleChange} className="input-field py-3 bg-[#121214] border-surface-800 text-[14px] text-center" placeholder="bt23xxx@iiitn.ac.in" required />
                        </div>
                        <div className="text-left flex flex-col gap-2">
                          <label className="block text-[13px] font-medium text-surface-300">Phone</label>
                          <input name="phone" type="tel" value={form.phone} onChange={handleChange} className="input-field py-3 bg-[#121214] border-surface-800 text-[14px] text-center" placeholder="9876543210" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-left flex flex-col gap-2">
                          <label className="block text-[13px] font-medium text-surface-300">Password</label>
                          <input name="password" type="password" value={form.password} onChange={handleChange} className="input-field py-3 bg-[#121214] border-surface-800 text-[14px] text-center tracking-widest" placeholder="••••••••" required minLength={6} />
                        </div>
                        <div className="text-left flex flex-col gap-2">
                          <label className="block text-[13px] font-medium text-surface-300">Confirm Password</label>
                          <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} className="input-field py-3 bg-[#121214] border-surface-800 text-[14px] text-center tracking-widest" placeholder="••••••••" required />
                        </div>
                      </div>
                  </motion.div>
              )}

              {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col gap-[18px]"
                  >
                    <div>
                      <label className="block text-[13px] font-medium text-surface-300 mb-4 text-center">One-Time Password</label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="input-field py-4 text-center text-3xl tracking-[0.4em] font-black w-full bg-[#121214] border-surface-800 text-primary-400 focus:border-primary-500"
                        placeholder="000000"
                        maxLength={6}
                        required
                      />
                    </div>
                  </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px] font-semibold rounded-[10px] mt-2 min-h-[48px]">
              {loading ? 'Processing...' : (step === 1 ? 'Continue' : 'Complete Registration')}
            </button>
          </form>

          {step === 1 && (
              <div className="mt-4 text-center pt-4 border-t border-white/5 w-full">
                <p className="text-surface-400 font-medium text-[14px]">
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary-500 hover:text-primary-400 font-black transition-colors underline decoration-primary-500/30 underline-offset-4">
                      Sign in
                    </Link>
                </p>
              </div>
          )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
