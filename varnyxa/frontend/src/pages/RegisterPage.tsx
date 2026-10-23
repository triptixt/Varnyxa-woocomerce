import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, User as UserIcon, Phone, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { register } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters long.';
      setFormError(msg);
      error(msg);
      return;
    }
    if (password !== confirmPassword) {
      const msg = 'Passwords do not match. Please re-enter.';
      setFormError(msg);
      error(msg);
      return;
    }
    if (!agreeTerms) {
      const msg = 'You must accept the terms and privacy policy to register.';
      setFormError(msg);
      error(msg);
      return;
    }

    setLoading(true);
    try {
      await register({
        full_name: fullName,
        email,
        phone: phone || undefined,
        password,
        agree_terms: agreeTerms,
      });
      navigate(redirect);
    } catch (err: any) {
      setFormError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-3 sm:px-6 lg:px-8 py-8 sm:py-16">
      <div className="max-w-md w-full bg-white p-5 sm:p-10 rounded-2xl sm:rounded-3xl border border-[#E8E6E1] shadow-xl space-y-6 sm:space-y-7">
        <div className="text-center space-y-2">
          <span className="font-serif text-2xl font-bold tracking-[0.2em] text-[#121212] block">
            VARNYXA
          </span>
          <h1 className="font-serif text-2xl font-extrabold text-[#121212]">Create Client Account</h1>
          <p className="text-xs text-[#8C887B]">Join VARNYXA to enjoy bespoke tailoring, express dispatch, and order tracking</p>
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#121212] mb-1">Full Name</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-[#8C887B] absolute left-3.5 top-3" />
              <input
                required
                type="text"
                placeholder="e.g. Elena Roy"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black"
              />
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-[#121212] mb-1">Mobile Number (Optional)</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#8C887B] absolute left-3.5 top-3" />
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#121212] mb-1">Password (Min 8 Characters)</label>
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

          <div>
            <label className="block text-xs font-semibold text-[#121212] mb-1">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8C887B] absolute left-3.5 top-3" />
              <input
                required
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              id="terms"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#121212] rounded cursor-pointer"
            />
            <label htmlFor="terms" className="text-[11px] text-[#6E6B64] cursor-pointer">
              I agree to the <span className="font-semibold text-[#121212] underline">Terms of Service</span> and{' '}
              <span className="font-semibold text-[#121212] underline">Privacy Policy</span>.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#121212] text-white text-xs font-bold uppercase tracking-[0.15em] rounded-xl hover:bg-black transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            <span>{loading ? 'Registering Account...' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        <div className="pt-4 border-t border-[#F0EFEA] text-center text-xs text-[#6E6B64]">
          <span>Already registered? </span>
          <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-[#121212] hover:text-[#C5A880]">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
