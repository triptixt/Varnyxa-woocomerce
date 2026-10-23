import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { api } from '../services/api';

export const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<{ email: string; status: string; consent_at: string; masked_email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('too_frequent');

  useEffect(() => {
    if (!token) {
      setError('No unsubscribe token was provided. Please use the link provided in your email.');
      setLoading(false);
      return;
    }

    const fetchInfo = async () => {
      try {
        const data = await api.newsletter.getUnsubscribeInfo(token);
        setInfo(data);
        if (data.status === 'unsubscribed') {
          setSuccessMessage(`This address (${data.masked_email}) is already unsubscribed from the VARNYXA Club.`);
        }
      } catch (err: any) {
        setError(err.message || 'Invalid or expired unsubscribe token. Please contact concierge support.');
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [token]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.newsletter.unsubscribe(token, reason);
      setSuccessMessage(res.message || 'You have been successfully unsubscribed from the VARNYXA Club.');
      if (info) {
        setInfo({ ...info, status: 'unsubscribed' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process unsubscribe request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-[var(--theme-surface)] p-8 sm:p-10 rounded-3xl border border-[var(--theme-border)] shadow-xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[var(--theme-primary)]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-primary)]">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-[var(--theme-text)]">
            Newsletter Preferences
          </h1>
          <p className="text-xs text-[var(--theme-text-muted)]">
            Manage your VARNYXA Club email dispatch preferences.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
            <p className="text-xs text-[var(--theme-text-muted)]">Verifying subscription token...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to Unsubscribe</p>
                <p className="mt-0.5 opacity-90">{error}</p>
              </div>
            </div>
            <Link
              to="/"
              className="w-full py-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[var(--theme-surface-alt)] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Store</span>
            </Link>
          </div>
        )}

        {/* Success message */}
        {!loading && successMessage && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm space-y-2 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
              <p className="font-semibold text-base">{successMessage}</p>
              <p className="text-xs opacity-80">
                You will no longer receive marketing dispatches. You can always re-subscribe anytime from the homepage.
              </p>
            </div>
            <Link
              to="/"
              className="w-full py-3.5 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continue Shopping</span>
            </Link>
          </div>
        )}

        {/* Active subscription confirmation form */}
        {!loading && !error && !successMessage && info && (
          <form onSubmit={handleUnsubscribe} className="space-y-5">
            <div className="p-4 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
                Subscriber Email
              </span>
              <p className="text-sm font-semibold text-[var(--theme-text)]">
                {info.masked_email}
              </p>
              {info.consent_at && (
                <p className="text-[11px] text-[var(--theme-text-muted)]">
                  Subscribed on: {new Date(info.consent_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--theme-text)]">
                Reason for leaving (Optional)
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
              >
                <option value="too_frequent">Emails are too frequent</option>
                <option value="not_relevant">Content is no longer relevant</option>
                <option value="never_signed_up">I didn't intend to subscribe</option>
                <option value="other">Other reason</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-rose-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-rose-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Confirm Unsubscribe</span>
              )}
            </button>

            <div className="text-center">
              <Link
                to="/"
                className="text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
              >
                Keep my subscription and return to VARNYXA
              </Link>
            </div>
          </form>
        )}

        {/* Compliance Footer */}
        <div className="pt-4 border-t border-[var(--theme-border)]/70 text-center flex items-center justify-center gap-1.5 text-[10px] text-[var(--theme-text-muted)]">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>CAN-SPAM & GDPR Compliant Unsubscribe Engine</span>
        </div>
      </div>
    </div>
  );
};
