import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount: try to verify session via httpOnly cookie first,
    // then fall back to localStorage token
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');

      // Try to verify session with the server (cookie or Bearer token)
      if (storedUser) {
        try {
          const res = await api.get('/auth/me');
          const freshUser = res.data.data;
          setUser(freshUser);
          // Sync localStorage with fresh data
          localStorage.setItem('user', JSON.stringify(freshUser));
        } catch {
          // Session expired or invalid — clear everything
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: userData, token } = res.data.data;

    // Store token as fallback (cookie is primary)
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    const { user: userData, token } = res.data.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — clear local state regardless
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.get('/auth/me');
    const freshUser = res.data.data;
    setUser(freshUser);
    localStorage.setItem('user', JSON.stringify(freshUser));
    return freshUser;
  };

  const updateUser = (updates) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const isAuthenticated = !!user;
  const isVerified = !!user?.emailVerified;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
        isAuthenticated,
        isVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
