import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('unifeast_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('unifeast_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      if (token) {
        try {
          const { data } = await authAPI.getMe();
          setUser(data.user);
          localStorage.setItem('unifeast_user', JSON.stringify(data.user));
        } catch {
          logout();
        }
      }
      setLoading(false);
    };
    verify();
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('unifeast_token', data.token);
    localStorage.setItem('unifeast_user', JSON.stringify(data.user));
    return data;
  };

  const googleLogin = async (idToken) => {
    const { data } = await authAPI.googleLogin({ idToken });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('unifeast_token', data.token);
    localStorage.setItem('unifeast_user', JSON.stringify(data.user));
    return data;
  };

  const requestRegisterOtp = async (formData) => {
    const { data } = await authAPI.requestRegisterOtp(formData);
    return data;
  };

  const verifyRegisterOtp = async (attemptToken, otp) => {
    const { data } = await authAPI.verifyRegisterOtp({ attemptToken, otp });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('unifeast_token', data.token);
    localStorage.setItem('unifeast_user', JSON.stringify(data.user));
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('unifeast_token');
    localStorage.removeItem('unifeast_user');
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('unifeast_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, googleLogin, requestRegisterOtp, verifyRegisterOtp, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
