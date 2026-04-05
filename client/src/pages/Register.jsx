import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MdRestaurantMenu } from 'react-icons/md';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, phone: form.phone });
      toast.success('Account created successfully!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-20 -left-32 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-20 -right-32 w-96 h-96 bg-accent-500/8 rounded-full blur-[120px]" />

      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-xl shadow-primary-500/25 mb-4">
            <MdRestaurantMenu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Join Uni<span className="text-primary-400">Feast</span></h1>
          <p className="text-surface-400 mt-1">Create your student account</p>
        </div>

        <div className="glass-card-static p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} className="input-field" placeholder="John Doe" required id="register-name" />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="input-field" placeholder="you@iiit.ac.in" required id="register-email" />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">Phone</label>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange} className="input-field" placeholder="9876543210" id="register-phone" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-surface-400 mb-1.5">Password</label>
                <input name="password" type="password" value={form.password} onChange={handleChange} className="input-field" placeholder="••••••" required minLength={6} id="register-password" />
              </div>
              <div>
                <label className="block text-sm text-surface-400 mb-1.5">Confirm</label>
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} className="input-field" placeholder="••••••" required id="register-confirm" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full" id="register-submit">
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-surface-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

