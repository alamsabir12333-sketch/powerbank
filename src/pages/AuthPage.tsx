import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Gift,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { RegisterFormData, LoginFormData, UserProfile } from '../types';
import {
  verifyReferralCode,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  initialMode?: 'register' | 'login';
  initialReferralCode?: string;
  isReferralReadOnly?: boolean;
  onAuthSuccess: (userProfile: UserProfile, isNewUser?: boolean) => void;
  onShowToast: (msg: string) => void;
  onModeChange?: (mode: 'register' | 'login') => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'register',
  initialReferralCode = '',
  isReferralReadOnly = false,
  onAuthSuccess,
  onShowToast,
  onModeChange,
}) => {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<'register' | 'login'>(initialMode);

  // Registration Form State
  const [username, setUsername] = useState('');
  const [whatsappNo, setWhatsappNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [isReadOnlyCode, setIsReadOnlyCode] = useState(isReferralReadOnly);

  // Login Form State
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  // 1. Synchronize referral code from props, URL or session storage
  useEffect(() => {
    // Check pending invite in storage or url
    const storedInvite =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('pb_pending_invite_code') || localStorage.getItem('pb_pending_invite_code')
        : null;

    const codeToUse = initialReferralCode || storedInvite || '';

    if (codeToUse) {
      setReferralCode(codeToUse.toUpperCase());
      setIsReadOnlyCode(true);
      // Validate code in background
      verifyReferralCode(codeToUse).then((res) => {
        if (res.valid) {
          setReferrerName(res.referrerName || res.referrerId || 'Valid Referrer');
        } else {
          setReferrerName(null);
        }
      });
    } else if (isReferralReadOnly) {
      setIsReadOnlyCode(true);
    }
  }, [initialReferralCode, isReferralReadOnly]);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode]);

  const switchMode = (newMode: 'register' | 'login') => {
    setMode(newMode);
    setError(null);
    onModeChange?.(newMode);

    // Update browser URL query or history without reloading
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (newMode === 'login') {
        window.history.replaceState({}, '', '/login');
      } else {
        if (referralCode && isReadOnlyCode) {
          window.history.replaceState({}, '', `/invite/${referralCode}`);
        } else {
          window.history.replaceState({}, '', '/register');
        }
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (!whatsappNo.trim() || whatsappNo.replace(/\D/g, '').length !== 10) {
      setError('Please enter a valid 10-digit Indian WhatsApp number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Self-referral prevention
    if (
      referralCode &&
      (referralCode.trim().toLowerCase() === username.trim().toLowerCase() ||
        referralCode.trim().toLowerCase() === email.trim().toLowerCase())
    ) {
      setError('You cannot use your own referral code.');
      return;
    }

    setLoading(true);
    try {
      const formData: RegisterFormData = {
        username: username.trim(),
        whatsappNo: whatsappNo.replace(/\D/g, ''),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        referralCode: referralCode.trim().toUpperCase() || undefined,
      };

      const result = await signUp(formData);

      // Clear pending invite code once registered
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pb_pending_invite_code');
        localStorage.removeItem('pb_pending_invite_code');
      }

      onShowToast?.('Account created successfully! Welcome to Power Bank.');

      // Build initial verified user profile
      const newProfile: UserProfile = result.profile || {
        id: result.user?.id || 'usr_' + Date.now(),
        userId: result.user?.id || 'usr_' + Date.now(),
        username: username.trim(),
        whatsappNo: whatsappNo.replace(/\D/g, ''),
        name: username.trim(),
        mobile: whatsappNo.replace(/\D/g, ''),
        email: email.trim().toLowerCase(),
        membershipNumber: result.membershipNumber || 'PB888999',
        referralCode: result.referralCode || result.membershipNumber || 'PB888999',
        referredBy: referralCode.trim().toUpperCase() || undefined,
        role: 'user',
        status: 'active',
        deviceEarnings: 0,
        teamEarnings: 0,
        walletBalance: 50.0,
      };

      onAuthSuccess(newProfile, true);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Please enter your username, WhatsApp number, or email.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const formData: LoginFormData = {
        identifier: identifier.trim(),
        password: loginPassword,
      };

      const profile = await signIn(formData);

      onShowToast?.(`Welcome back, ${profile.username || 'Member'}!`);
      onAuthSuccess(profile, false);
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid login credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center p-4 py-8 relative">
      {/* Brand Header */}
      <div className="w-full max-w-md text-center mb-6 space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF6000] to-[#FFA000] text-white shadow-lg shadow-orange-500/25 mb-1">
          <Zap className="w-8 h-8 fill-current" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          Power Bank
        </h1>
        <p className="text-xs text-gray-500 font-medium">
          Shared Power Cabinet Equipment & Automated Yields
        </p>
      </div>

      {/* Main Auth Card */}
      <motion.div
        layout
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 relative z-10"
      >
        {/* Toggle Pills */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'register'
                ? 'bg-white text-[#FF6200] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Create Account (Register)
          </button>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'login'
                ? 'bg-white text-[#FF6200] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Sign In (Login)
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </motion.div>
        )}

        {/* 1. Register Mode Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                USERNAME <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. rahul_power"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none transition-all font-medium"
                />
              </div>
            </div>

            {/* WhatsApp No */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                WHATSAPP NO. <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 flex items-center gap-1 text-xs font-bold text-gray-500 border-r border-gray-200 pr-2">
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={whatsappNo}
                  onChange={(e) => setWhatsappNo(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-16 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none transition-all font-medium font-mono"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                EMAIL ADDRESS <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                PASSWORD <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none transition-all font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                CONFIRM PASSWORD <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none transition-all font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Referral Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700">
                  REFERRAL CODE {isReadOnlyCode ? '(LOCKED FROM INVITE)' : '(OPTIONAL)'}
                </label>
                {isReadOnlyCode && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Invited
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <Gift className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  type="text"
                  readOnly={isReadOnlyCode}
                  placeholder="e.g. PB888999"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs outline-none transition-all font-mono font-bold ${
                    isReadOnlyCode
                      ? 'bg-orange-50/60 border border-orange-200 text-[#FF6200] cursor-not-allowed'
                      : 'bg-gray-50 border border-gray-200 text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200]'
                  }`}
                />
              </div>
              {referrerName && (
                <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
                  ✓ Inviter: {referrerName}
                </span>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF6000] via-[#FF7A00] to-[#FFA000] text-white font-bold text-sm shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>CREATE ACCOUNT</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Switch to Login Link */}
            <div className="text-center pt-2">
              <p className="text-xs text-gray-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-[#FF6200] hover:underline"
                >
                  Login
                </button>
              </p>
            </div>
          </form>
        )}

        {/* 2. Login Mode Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username / WhatsApp / Email */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                USERNAME, WHATSAPP NO. OR EMAIL
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Enter username, mobile or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">
                PASSWORD
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your account password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none transition-all font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF6000] via-[#FF7A00] to-[#FFA000] text-white font-bold text-sm shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Switch to Register Link */}
            <div className="text-center pt-2">
              <p className="text-xs text-gray-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-bold text-[#FF6200] hover:underline"
                >
                  Register
                </button>
              </p>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
