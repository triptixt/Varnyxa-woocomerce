import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

interface NewsletterSectionProps {
  source?: string;
}

export const NewsletterSection: React.FC<NewsletterSectionProps> = ({ source = 'homepage' }) => {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setStatus('error');
      setMessage('Please enter a valid email address format.');
      return;
    }

    if (!consent) {
      setStatus('error');
      setMessage('Please accept the newsletter terms and privacy consent.');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setMessage('');
    setNote(null);

    try {
      const res = await api.newsletter.subscribe({
        email: email.trim(),
        consent: true,
        source,
      });

      setStatus('success');
      setMessage(res.message || 'Welcome to the VARNYXA Club! You are now subscribed.');
      if (res.email_note) {
        setNote(res.email_note);
      }
      setEmail('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Unable to complete subscription at this time. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden py-14 sm:py-20 bg-[var(--theme-surface)] border-y border-[var(--theme-border)]">
      {/* Background ambient accents */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[var(--theme-primary)]/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[var(--theme-primary)]/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--theme-text)] mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[var(--theme-primary)] shrink-0" />
          <span>Curated Haute Couture Dispatch</span>
        </div>

        {/* Heading */}
        <h2 className="font-serif text-2xl sm:text-4xl md:text-5xl font-extrabold text-[var(--theme-text)] tracking-tight">
          Join the VARNYXA Club
        </h2>

        {/* Subtitle */}
        <p className="mt-3 sm:mt-4 text-xs sm:text-base text-[var(--theme-text-muted)] max-w-xl mx-auto font-light leading-relaxed">
          Be the first to access limited atelier drops, private festive previews, and bespoke style guides across women, men, kids, and fine living.
        </p>

        {/* Subscription Form */}
        <form onSubmit={handleSubmit} className="mt-8 max-w-xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-[var(--theme-text-muted)]" />
              </div>
              <input
                id="newsletter-email-input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status !== 'idle') setStatus('idle');
                }}
                disabled={loading}
                placeholder="Enter your email address (e.g. name@domain.com)"
                className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] transition"
              />
            </div>
            <button
              id="newsletter-subscribe-btn"
              type="submit"
              disabled={loading}
              className="px-6 py-3 sm:py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] font-bold text-xs uppercase tracking-[0.15em] rounded-xl hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2 shrink-0 shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Subscribing...</span>
                </>
              ) : (
                <>
                  <span>Subscribe</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-[var(--theme-text-muted)] cursor-pointer select-none">
              <input
                id="newsletter-consent-checkbox"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="rounded border-[var(--theme-border)] text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] w-3.5 h-3.5 cursor-pointer"
              />
              <span>
                I agree to receive curated updates and accept the{' '}
                <span className="underline">Privacy Policy</span>. You can unsubscribe at any time.
              </span>
            </label>
          </div>

          {/* Feedback states */}
          {status === 'success' && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm flex items-start sm:items-center justify-center gap-2 text-left sm:text-center mt-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="font-medium">{message}</p>
                {note && <p className="text-[11px] opacity-85 mt-0.5">{note}</p>}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex items-center justify-center gap-2 text-left sm:text-center mt-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="font-medium">{message}</p>
            </div>
          )}
        </form>

        {/* Benefits micro-pills */}
        <div className="mt-8 pt-6 border-t border-[var(--theme-border)]/60 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[11px] text-[var(--theme-text-muted)] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)]" />
            Zero Spam Guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)]" />
            1-Click Unsubscribe
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)]" />
            PostgreSQL Consent Verified
          </span>
        </div>
      </div>
    </section>
  );
};
