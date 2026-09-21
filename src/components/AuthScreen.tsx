import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, Calendar, Users, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ExternalLink, KeyRound } from 'lucide-react';

export function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, demoSignIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isOpNotAllowed, setIsOpNotAllowed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsOpNotAllowed(false);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('operation-not-allowed'))) {
        setIsOpNotAllowed(true);
        setError(null);
      } else {
        console.error('Authentication notice:', err);
        let msg = err.message || 'Authentication failed. Please check your credentials.';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          msg = 'Invalid email or password. If you are new, click "Sign Up" below.';
        } else if (err.code === 'auth/email-already-in-use') {
          msg = 'An account with this email already exists. Please log in.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'Password should be at least 6 characters.';
        }
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (role: 'admin' | 'client') => {
    setError(null);
    setIsOpNotAllowed(false);
    setLoading(true);
    try {
      await demoSignIn(role);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('operation-not-allowed'))) {
        setIsOpNotAllowed(false);
      } else {
        setError(err.message || 'Failed to sign in to demo account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-stone-900 text-stone-100 flex items-center justify-center shadow-md">
            <Dumbbell className="w-7 h-7" />
          </div>
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight text-stone-900 font-display">
          CoreStudio Personal Training
        </h1>
        <p className="mt-2 text-center text-sm text-stone-600">
          Individualized coaching & small group sessions (max 4 per hour)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-stone-200 rounded-2xl sm:px-10">
          {/* Quick Demo Access Bar */}
          <div className="mb-6 p-3.5 bg-stone-100/75 rounded-xl border border-stone-200/80">
            <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Quick One-Click Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="demo-login-trainer"
                type="button"
                onClick={() => handleDemo('admin')}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Trainer Admin</span>
              </button>
              <button
                id="demo-login-client"
                type="button"
                onClick={() => handleDemo('client')}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 transition disabled:opacity-50"
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Client Account</span>
              </button>
            </div>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-stone-500">Or sign in with email</span>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex border-b border-stone-200 mb-6">
            <button
              id="tab-login"
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium text-center border-b-2 transition ${
                !isSignUp
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-signup"
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium text-center border-b-2 transition ${
                isSignUp
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              New Client Registration
            </button>
          </div>

          {isOpNotAllowed && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-300 text-stone-900 text-xs shadow-sm">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm mb-1.5">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Firebase Authentication Setup Required</span>
              </div>
              <p className="text-amber-950 mb-2 leading-relaxed">
                By default, Firebase requires the <strong>Email/Password</strong> sign-in provider to be enabled before accounts can be created or logged in.
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 mb-3 space-y-1 text-stone-700">
                <p className="font-semibold text-stone-900">How to enable in Firebase Console (30 seconds):</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>Open <strong>Firebase Console &gt; Authentication</strong></li>
                  <li>Click the <strong>Sign-in method</strong> tab</li>
                  <li>Select <strong>Email/Password</strong>, toggle <strong>Enable</strong> ON, and click <strong>Save</strong></li>
                </ol>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <a
                  href="https://console.firebase.google.com/project/ai-studio-bb17ef32-a721-4efa-a558-0d74700d2ffd/authentication/providers"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 text-white font-medium hover:bg-amber-900 transition"
                >
                  <span>Open Firebase Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDemo('admin')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-stone-100 font-medium hover:bg-stone-800 transition"
                >
                  <span>Launch Trainer Sandbox</span>
                </button>
              </div>
            </div>
          )}

          {!isOpNotAllowed && error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label
                  htmlFor="full-name-input"
                  className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
                >
                  Full Name
                </label>
                <input
                  id="full-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email-input"
                className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
              >
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900"
              />
            </div>

            <div>
              <label
                htmlFor="password-input"
                className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
              >
                Password
              </label>
              <input
                id="password-input"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900"
              />
              {isSignUp && (
                <p className="text-xs text-stone-500 mt-1">At least 6 characters</p>
              )}
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-stone-900 text-white font-medium text-sm hover:bg-stone-800 transition shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Loading...</span>
              ) : (
                <>
                  <span>{isSignUp ? 'Create Client Account' : 'Sign In to Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Value highlights */}
          <div className="mt-6 pt-5 border-t border-stone-100 grid grid-cols-2 gap-3 text-xs text-stone-600">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Max 4 clients/hr</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Real-time booking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Session balance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Instant cancellation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
