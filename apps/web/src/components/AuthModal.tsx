import React, { useState } from 'react';
import { AuthService, isSupabaseConfigured, type AuthUserProfile } from '../lib/supabase';
import {
  ShieldCheck,
  Mail,
  Lock,
  Building,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUserProfile | null;
  onAuthSuccess: (user: AuthUserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP' | 'CONFIG'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const res = await AuthService.signInWithGoogle();
    setLoading(false);
    if (res.error) {
      setError(res.error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'LOGIN') {
      const res = await AuthService.signInWithEmail(email, password);
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.user) {
        onAuthSuccess(res.user);
        onClose();
      }
    } else {
      if (!fullName || !businessName) {
        setError('Please enter your full name and business name');
        setLoading(false);
        return;
      }
      const res = await AuthService.signUp(email, password, fullName, businessName);
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.user) {
        onAuthSuccess(res.user);
        setMessage('Account registered successfully! You are now logged in.');
        setTimeout(() => onClose(), 1200);
      }
    }
  };

  const handleSignOut = async () => {
    await AuthService.signOut();
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-950/40">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">
            {currentUser ? 'Account & Cloud Security' : mode === 'LOGIN' ? 'Sign In to NEWBAL' : 'Create Business Account'}
          </h2>
          <p className="text-xs text-slate-400">
            {isSupabaseConfigured
              ? 'Secured with Supabase Cloud Auth & Row-Level Security'
              : 'Local & Cloud Authentication Engine'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {currentUser ? (
          /* Profile & Logout view */
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Business:</span>
                <span className="font-bold text-slate-100">{currentUser.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">User:</span>
                <span className="text-slate-200">{currentUser.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Email:</span>
                <span className="text-slate-200">{currentUser.email}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800/80">
                <span className="text-slate-500 font-sans">Cloud Sync:</span>
                <span className="text-emerald-400 font-bold">
                  {currentUser.isCloudSynced ? 'Active (Supabase)' : 'Local Offline Secured'}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-xl font-medium transition"
            >
              Sign Out from this Device
            </button>
          </div>
        ) : (
          /* Sign In / Sign Up Form */
          <div className="space-y-4">
            {isSupabaseConfigured && (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 shadow-sm transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}

            {isSupabaseConfigured && (
              <div className="flex items-center space-x-2 text-[10px] text-slate-500 uppercase font-mono">
                <div className="flex-1 h-px bg-slate-800"></div>
                <span>Or use email</span>
                <div className="flex-1 h-px bg-slate-800"></div>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-3 text-xs">
              {mode === 'SIGNUP' && (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Atharva Pawar"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Company / Business Legal Name</label>
                    <div className="relative">
                      <Building className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Apex Innovations Pvt Ltd"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Business Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-md shadow-emerald-950/40 transition"
              >
                {loading ? 'Authenticating...' : mode === 'LOGIN' ? 'Sign In' : 'Create Lifetime Free Account'}
              </button>
            </form>

            <div className="text-center pt-1 text-slate-400 text-xs">
              {mode === 'LOGIN' ? (
                <span>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('SIGNUP');
                      setError(null);
                    }}
                    className="text-emerald-400 font-medium hover:underline"
                  >
                    Sign up free
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('LOGIN');
                      setError(null);
                    }}
                    className="text-emerald-400 font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>

            {/* Cloud Setup Notice */}
            {!isSupabaseConfigured && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Free Cloud Sync (Supabase) Setup:</span>
                </div>
                <p>
                  To sync across devices via cloud, add your free Supabase URL & Key in <code>apps/web/.env</code>.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
