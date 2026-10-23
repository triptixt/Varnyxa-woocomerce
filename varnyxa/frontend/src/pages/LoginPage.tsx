import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(redirect);
    } catch (err: any) {
      setFormError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-3 sm:px-6 lg:px-8 py-8 sm:py-16">
      <div className="max-w-md w-full bg-white p-5 sm:p-10 rounded-2xl sm:rounded-3xl border border-[#E8E6E1] shadow-xl space-y-6 sm:space-y-7">
        <div className="text-center space-y-2">
          <span className="font-serif text-2xl font-bold tracking-[0.2em] text-[#121212] block">
            VARNYXA
          </span>
          <h1 className="font-serif text-2xl font-extrabold text-[#121212]">Client Sign In</h1>
          <p className="text-xs text-[#8C887B]">Enter your credentials to access your orders and saved wardrobe</p>
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#121212] mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8C887B] absolute left-3.5 top-3" />
              <input
                required
                type="email"
                placeholder="client@varnyxa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-[#121212]">Password</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8C887B] absolute left-3.5 top-3" />
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#121212] text-white text-xs font-bold uppercase tracking-[0.15em] rounded-xl hover:bg-black transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        <div className="pt-4 border-t border-[#F0EFEA] text-center text-xs text-[#6E6B64]">
          <span>New to VARNYXA? </span>
          <Link to={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-[#121212] hover:text-[#C5A880]">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};
