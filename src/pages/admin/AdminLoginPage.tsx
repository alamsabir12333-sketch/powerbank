import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { loginAdmin } from '../../services/api';
import { AdminSession } from '../../types';
import { ToastType } from '../../components/Toast';

interface AdminLoginPageProps {
  onLoginSuccess: (session: AdminSession) => void;
  onShowToast: (message: string, type?: ToastType) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onShowToast,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Safe wrapper to guarantee onShowToast never throws a runtime error
  const triggerToast = (msg: string, type: ToastType = 'info') => {
    if (typeof onShowToast === 'function') {
      onShowToast(msg, type);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      const msg = 'Please enter both admin username and password.';
      setErrorMsg(msg);
      triggerToast(msg, 'warning');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const session = await loginAdmin(trimmedUsername, trimmedPassword);
      triggerToast('Admin login successful.', 'success');
      onLoginSuccess(session);
    } catch (err: any) {
      const rawMessage = (err?.message || '').toLowerCase();
      let formattedMsg = 'Invalid admin credentials.';

      if (rawMessage.includes('disabled') || rawMessage.includes('inactive') || rawMessage.includes('suspended')) {
        formattedMsg = 'Admin account is disabled.';
      } else if (rawMessage.includes('unauthorized') || rawMessage.includes('not authorized') || rawMessage.includes('access denied')) {
        formattedMsg = 'You are not authorized to access the Admin Panel.';
      } else if (rawMessage.includes('unable to sign in') || rawMessage.includes('network') || rawMessage.includes('connection')) {
        formattedMsg = 'Unable to sign in. Please try again.';
      } else if (err?.message && !rawMessage.includes('rpc') && !rawMessage.includes('sql') && !rawMessage.includes('supabase')) {
        formattedMsg = err.message;
      }

      setErrorMsg(formattedMsg);
      triggerToast(formattedMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0d1117] text-white flex flex-col justify-center items-center p-4 selection:bg-[#FF6000] selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#FF6000]/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-40 right-10 w-[400px] h-[300px] bg-orange-600/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md bg-[#161b22] border border-gray-800/80 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6000] to-amber-500 flex items-center justify-center shadow-lg shadow-orange-950/40 mb-3.5">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Power Bank <span className="text-[#FF6000]">Admin</span>
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            Authorized Platform Security & Operations Terminal
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold tracking-wider text-gray-300 uppercase mb-1.5">
              Admin Username
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-gray-500 pointer-events-none">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                autoComplete="username"
                disabled={loading}
                className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] focus:ring-1 focus:ring-[#FF6000] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold tracking-wider text-gray-300 uppercase mb-1.5">
              Admin Password
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-gray-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={loading}
                className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] focus:ring-1 focus:ring-[#FF6000] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] hover:from-[#ff731d] hover:to-[#ffa024] active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>LOGIN TO ADMIN TERMINAL</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice Footer */}
        <div className="mt-8 pt-5 border-t border-gray-800 text-center">
          <p className="text-[10.5px] text-gray-500">
            Protected endpoint with encrypted session authorization and automated audit logging.
          </p>
        </div>
      </div>
    </div>
  );
};

