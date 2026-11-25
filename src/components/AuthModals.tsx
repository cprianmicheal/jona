import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Clock,
  MessageCircle,
  User,
  LogOut,
  KeyRound,
} from 'lucide-react';
import type { Order, StoreSettings } from '../types';
import { formatNaira } from '../utils/invoicePdf';

export interface CustomerSessionUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
}

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register' | 'forgot';
  settings: StoreSettings;
  user: CustomerSessionUser | null;
  customerToken: string | null;
  onClose: () => void;
  onAuthenticated: (token: string, user: CustomerSessionUser) => void;
  onLogout: () => void;
}

const evaluatePassword = (pw: string) => {
  const rules = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(rules).filter(Boolean).length;
  let label: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
  let barColor = 'bg-red-500';
  if (score === 5) {
    label = 'Strong';
    barColor = 'bg-[#4CB04F]';
  } else if (score === 4) {
    label = 'Good';
    barColor = 'bg-[#4CB04F]';
  } else if (score >= 2) {
    label = 'Fair';
    barColor = 'bg-amber-500';
  }
  return { rules, score, label, barColor, valid: score === 5 };
};

export const CustomerAuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'login',
  settings,
  user,
  customerToken,
  onClose,
  onAuthenticated,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'done'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Account orders
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loginLockedUntilMs, setLoginLockedUntilMs] = useState<number | null>(null);
  const [loginLockSecondsLeft, setLoginLockSecondsLeft] = useState<number>(0);
  const [suggestForgot, setSuggestForgot] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setInfo(null);
  }, [initialMode, open]);

  useEffect(() => {
    if (!expiresAtMs) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAtMs]);

  useEffect(() => {
    if (!loginLockedUntilMs) {
      setLoginLockSecondsLeft(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((loginLockedUntilMs - Date.now()) / 1000));
      setLoginLockSecondsLeft(diff);
      if (diff <= 0) {
        setLoginLockedUntilMs(null);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [loginLockedUntilMs]);

  useEffect(() => {
    if (open && user && customerToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${customerToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.orders) setMyOrders(d.orders);
        })
        .catch(() => {});
    }
  }, [open, user, customerToken]);

  const regEval = useMemo(() => evaluatePassword(regPassword), [regPassword]);
  const resetEval = useMemo(() => evaluatePassword(newPassword), [newPassword]);

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLockSecondsLeft > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.retryAfterSeconds && Number(json.retryAfterSeconds) > 0) {
          const until =
            json.lockedUntil && Number(json.lockedUntil) > Date.now()
              ? Number(json.lockedUntil)
              : Date.now() + Number(json.retryAfterSeconds) * 1000;
          setLoginLockedUntilMs(until);
        }
        if (json.suggestForgotPassword) {
          setSuggestForgot(true);
        }
        setError(json.error || 'Sign in failed.');
      } else {
        setLoginLockedUntilMs(null);
        setSuggestForgot(false);
        onAuthenticated(json.token, json.user);
        onClose();
      }
    } catch {
      setError('Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regEval.valid) {
      setError('Please meet all 5 password strength requirements.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regName,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Account creation failed.');
      } else {
        onAuthenticated(json.token, json.user);
        onClose();
      }
    } catch {
      setError('Unable to create account right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestForgotCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, phone: forgotPhone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Unable to generate reset code.');
      } else {
        setExpiresAtMs(new Date(json.expiresAt).getTime());
        setForgotStep('verify');
        setInfo(json.message);
      }
    } catch {
      setError('Network error sending reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetEval.valid) {
      setError('New password must satisfy all 5 password strength rules.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          phone: forgotPhone,
          code: resetCode,
          newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Password reset failed.');
      } else {
        setForgotStep('done');
        setInfo(json.message);
        setExpiresAtMs(null);
      }
    } catch {
      setError('Network error resetting password.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStrengthMeter = (evaluation: ReturnType<typeof evaluatePassword>) => (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-500">Password Strength</span>
        <span
          className={`font-bold ${
            evaluation.score >= 4
              ? 'text-[#4CB04F]'
              : evaluation.score >= 2
              ? 'text-amber-600'
              : 'text-red-600'
          }`}
        >
          {evaluation.label}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1 h-1.5">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`rounded-full transition-colors ${
              evaluation.score >= step ? evaluation.barColor : 'bg-neutral-200'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
        {[
          { ok: evaluation.rules.length, text: '8+ characters' },
          { ok: evaluation.rules.upper, text: '1 uppercase letter' },
          { ok: evaluation.rules.lower, text: '1 lowercase letter' },
          { ok: evaluation.rules.digit, text: '1 digit (0-9)' },
          { ok: evaluation.rules.special, text: '1 special character' },
        ].map((item) => (
          <div
            key={item.text}
            className={`flex items-center gap-1.5 ${
              item.ok ? 'text-[#235D25] font-medium' : 'text-neutral-400'
            }`}
          >
            {item.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4CB04F] shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Logged-in Profile View
  if (user) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EDF7EE] text-[#4CB04F] flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#151916]">{user.fullName}</h3>
                <p className="text-xs text-neutral-500">
                  {user.email} · {user.phone}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
              Your Recent Orders ({myOrders.length})
            </h4>
            {myOrders.length === 0 ? (
              <p className="text-xs text-neutral-500 bg-[#F7F7F7] rounded-lg p-4">
                No orders placed under this account yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {myOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="border border-neutral-200 rounded-lg p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#151916] font-mono-tabular">
                        {ord.trackingNumber || ord.orderNumber}
                      </p>
                      <p className="text-neutral-500">
                        {ord.trackingStage || ord.orderStatus} · {ord.paymentStatus}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums">
                      {formatNaira(ord.totalAmount, settings.currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded bg-[#4CB04F] text-white text-xs font-semibold"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  const whatsappDigits = settings.whatsappNumber.replace(/\D/g, '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-5 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#151916]">
              {mode === 'login'
                ? 'Customer Sign In'
                : mode === 'register'
                ? 'Create Customer Account'
                : 'Reset Password via WhatsApp'}
            </h3>
            <p className="text-xs text-neutral-500">{settings.storeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setInfo(null);
            }}
            className={`py-1.5 rounded-md transition-colors ${
              mode === 'login' ? 'bg-white text-[#151916] shadow-xs' : 'text-neutral-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setInfo(null);
            }}
            className={`py-1.5 rounded-md transition-colors ${
              mode === 'register' ? 'bg-white text-[#151916] shadow-xs' : 'text-neutral-500'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setForgotStep('request');
              setError(null);
              setInfo(null);
            }}
            className={`py-1.5 rounded-md transition-colors ${
              mode === 'forgot' ? 'bg-white text-[#151916] shadow-xs' : 'text-neutral-500'
            }`}
          >
            Forgot
          </button>
        </div>

        {/* LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-neutral-600 mb-1">Email or WhatsApp Number *</label>
              <input
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@domain.com or +234..."
                className="w-full h-10 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 mb-1">Password *</label>
              <div className="relative">
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-3 pr-9 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginLockSecondsLeft > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between gap-2 text-amber-900 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Sign-In Temporarily Locked (5 Failed Tries)</span>
                  </span>
                  <span className="font-mono-tabular px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                    {String(Math.floor(loginLockSecondsLeft / 60)).padStart(2, '0')}:
                    {String(loginLockSecondsLeft % 60).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Wait for the timer to finish, or reset your password right away using Forgot
                  Password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (loginEmail.includes('@')) setForgotEmail(loginEmail);
                    setMode('forgot');
                    setForgotStep('request');
                    setError(null);
                    setInfo(null);
                  }}
                  className="w-full h-8 rounded bg-[#151916] hover:bg-neutral-800 text-white font-semibold text-[11px] inline-flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#4CB04F]" />
                  <span>Go to Forgot Password</span>
                </button>
              </div>
            )}

            {error && loginLockSecondsLeft === 0 && (
              <div className="space-y-2">
                <p className="text-red-600">{error}</p>
                {suggestForgot && (
                  <button
                    type="button"
                    onClick={() => {
                      if (loginEmail.includes('@')) setForgotEmail(loginEmail);
                      setMode('forgot');
                      setForgotStep('request');
                      setError(null);
                      setInfo(null);
                    }}
                    className="w-full h-8 rounded bg-[#EDF7EE] border border-[#4CB04F]/40 text-[#235D25] font-semibold text-[11px] inline-flex items-center justify-center gap-1.5 hover:bg-[#DFF1E0]"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Reset Password via WhatsApp (Forgot Password)</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loginLockSecondsLeft > 0}
              className="w-full h-10 rounded bg-[#4CB04F] hover:bg-[#419B44] disabled:bg-neutral-300 disabled:text-neutral-600 text-white font-semibold transition-colors"
            >
              {loginLockSecondsLeft > 0
                ? `Locked — Wait ${String(Math.floor(loginLockSecondsLeft / 60)).padStart(2, '0')}:${String(loginLockSecondsLeft % 60).padStart(2, '0')}`
                : submitting
                ? 'Signing In...'
                : 'Sign In'}
            </button>

            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setForgotStep('request');
                  setError(null);
                }}
                className="text-[#4CB04F] hover:underline font-medium"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-neutral-600 hover:text-neutral-900"
              >
                New customer? Create account
              </button>
            </div>
          </form>
        )}

        {/* REGISTER */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3 text-xs">
            <div>
              <label className="block text-neutral-600 mb-1">Full Name *</label>
              <input
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="John Okafor"
                className="w-full h-9 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 mb-1">Email Address *</label>
              <input
                required
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full h-9 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 mb-1">WhatsApp Phone Number *</label>
              <input
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+234 816 385 5656"
                className="w-full h-9 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 mb-1">Create Password *</label>
              <div className="relative">
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 8 chars, upper, lower, digit & special"
                  className="w-full h-9 pl-3 pr-9 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {renderStrengthMeter(regEval)}
            </div>

            {error && <p className="text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !regEval.valid}
              className="w-full h-10 rounded bg-[#4CB04F] hover:bg-[#419B44] disabled:bg-neutral-300 text-white font-semibold"
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <div className="space-y-4 text-xs">
            {forgotStep === 'request' && (
              <form onSubmit={handleRequestForgotCode} className="space-y-3">
                <p className="text-neutral-600 leading-relaxed">
                  Enter your registered email and WhatsApp number. A 1-minute verification code
                  will be issued for your WhatsApp number.
                </p>
                <div>
                  <label className="block text-neutral-600 mb-1">Account Email *</label>
                  <input
                    required
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full h-9 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 mb-1">WhatsApp Phone Number *</label>
                  <input
                    required
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full h-9 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                  />
                </div>
                {error && <p className="text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white font-semibold"
                >
                  {submitting ? 'Sending Code...' : 'Send 1-Minute WhatsApp Code'}
                </button>
              </form>
            )}

            {forgotStep === 'verify' && (
              <form onSubmit={handleCompleteReset} className="space-y-3">
                <div className="p-3 rounded-lg bg-[#EDF7EE] border border-[#CBE7CE] space-y-2">
                  <div className="flex items-center justify-between font-semibold text-[#151916]">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#4CB04F]" />
                      <span>
                        {secondsLeft > 0
                          ? `Code expires in ${secondsLeft}s`
                          : 'Code expired — click Resend for new EXP code'}
                      </span>
                    </span>
                    <span className="font-mono-tabular text-[#235D25]">
                      {secondsLeft > 0 ? `${secondsLeft}s` : '0s'}
                    </span>
                  </div>
                  {info && <p className="text-[11px] text-[#235D25]">{info}</p>}
                  <a
                    href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                      `Hello ${settings.storeName}, please send my password reset verification code for ${forgotEmail} (${forgotPhone}).`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#4CB04F] hover:underline"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Request / Confirm on WhatsApp ({settings.whatsappNumber})</span>
                  </a>
                </div>

                <div>
                  <label className="block text-neutral-600 mb-1">
                    Verification Code (Emmy... or EXP...) *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="Enter code (e.g. Emmy1001 or EXP1001)"
                      className="w-full h-9 pl-8 pr-3 rounded border border-neutral-300 font-mono-tabular focus:outline-none focus:border-[#4CB04F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-600 mb-1">New Password *</label>
                  <input
                    required
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create new strong password"
                    className="w-full h-9 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                  />
                  {renderStrengthMeter(resetEval)}
                </div>

                {error && <p className="text-red-600">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting || secondsLeft > 0}
                    onClick={() => handleRequestForgotCode()}
                    className="px-3.5 h-10 rounded border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50 font-semibold text-neutral-800 whitespace-nowrap"
                  >
                    {secondsLeft > 0 ? `Wait ${secondsLeft}s` : 'Send New Code'}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || secondsLeft === 0 || !resetEval.valid}
                    className="flex-1 h-10 rounded bg-[#4CB04F] hover:bg-[#419B44] disabled:bg-neutral-300 text-white font-semibold"
                  >
                    {submitting ? 'Updating...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'done' && (
              <div className="py-4 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-[#4CB04F] mx-auto" />
                <p className="font-bold text-sm text-[#151916]">Password Updated</p>
                <p className="text-neutral-600">{info}</p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotStep('request');
                  }}
                  className="px-6 py-2 rounded bg-[#4CB04F] text-white font-semibold"
                >
                  Sign In Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
