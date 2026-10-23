import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, setAuthToken, getAuthToken, getGuestSessionToken } from '../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; phone?: string; agree_terms: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { success, error } = useToast();

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const currentUser = await api.auth.getMe();
        setUser(currentUser);
      } catch {
        // Token invalid or expired
        setAuthToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.auth.login({ email, password });
      setAuthToken(res.access_token);
      setUser(res.user);
      success(`Welcome back, ${res.user.full_name}`);

      // Merge guest cart if items exist
      const guestToken = getGuestSessionToken();
      if (guestToken) {
        try {
          await api.cart.mergeCart(guestToken);
        } catch {
          // Non-blocking merge error
        }
      }
    } catch (err: any) {
      error(err.message || 'Login failed. Please check your credentials.');
      throw err;
    }
  };

  const register = async (data: { email: string; password: string; full_name: string; phone?: string; agree_terms: boolean }) => {
    try {
      const res = await api.auth.register(data);
      setAuthToken(res.access_token);
      setUser(res.user);
      success(`Welcome to VARNYXA, ${res.user.full_name}!`);

      // Merge guest cart if items exist
      const guestToken = getGuestSessionToken();
      if (guestToken) {
        try {
          await api.cart.mergeCart(guestToken);
        } catch {
          // Non-blocking
        }
      }
    } catch (err: any) {
      error(err.message || 'Registration failed.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setUser(null);
      success('You have been logged out.');
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
