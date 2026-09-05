import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Gift,
  ShieldCheck,
  Globe,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { RegisterFormData, LoginFormData, UserProfile } from '../types';
import { verifyReferralCode } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSiteBranding } from '../context/SiteBrandingContext';
import { PowerBankLogo } from '../components/Artworks';

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
  const { siteSettings } = useSiteBranding();
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [mode, setMode] = useState<'register' | 'login'>(initialMode);

  // Register Fields (Exactly 6 fields per specification)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [withdrawalPassword, setWithdrawalPassword] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [isReadOnlyCode, setIsReadOnlyCode] = useState(isReferralReadOnly);

  // Login Fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Password Visibility State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showWithdrawalPassword, setShowWithdrawalPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  // 1. Synchronize referral code and persistent preferences
  useEffect(() => {
    const storedInvite =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('pb_pending_invite_code') || localStorage.getItem('pb_pending_invite_code')
        : null;

    const codeToUse = initialReferralCode || storedInvite || '';

    if (codeToUse) {
      const clean = codeToUse.toUpperCase();
      setReferralCode(clean);
      setIsReadOnlyCode(true);
      verifyReferralCode(clean).then((res) => {
        if (res.valid) {
          setReferrerName(res.referrerName || res.referrerId || 'Official Partner');
        } else {
          setReferrerName(null);
        }
      });
    } else if (isReferralReadOnly) {
      setIsReadOnlyCode(true);
    }

    // Load saved phone and password if remembered
    const isRemembered = localStorage.getItem('gp_remember_me') === 'true';
    if (isRemembered) {
      const savedPhone = localStorage.getItem('gp_saved_phone') || localStorage.getItem('pb_remembered_phone') || '';
      const savedPassword = localStorage.getItem('gp_saved_password') || '';
      if (savedPhone) setLoginPhone(savedPhone);
      if (savedPassword) setLoginPassword(savedPassword);
      setRememberMe(true);
    } else {
      const savedLogin = localStorage.getItem('pb_remembered_phone');
      if (savedLogin) setLoginPhone(savedLogin);
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

    if (typeof window !== 'undefined') {
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

  // Format and sanitize phone input (digits only, max 10 for India)
  const handlePhoneChange = (val: string, isLogin = false) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (isLogin) {
      setLoginPhone(digits);
    } else {
      setPhone(digits);
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Field Validations
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit Indian phone number.');
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

    const cleanPin = withdrawalPassword.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Withdrawal PIN must be exactly 4 digits.');
      return;
    }

    // Referral Validation
    const cleanRef = referralCode.trim().toUpperCase();
    if (!cleanRef) {
      setError('Referral code is required.');
      return;
    }
    if (cleanRef === cleanPhone) {
      setError('You cannot use your own referral code.');
      return;
    }

    setLoading(true);
    try {
      const formData: RegisterFormData = {
        name: name.trim(),
        username: name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || `user_${cleanPhone.slice(-4)}`,
        phone: cleanPhone,
        whatsappNo: cleanPhone,
        email: `${cleanPhone}@gainpower.internal`,
        password,
        confirmPassword,
        withdrawalPassword: withdrawalPassword.trim(),
        referralCode: cleanRef || undefined,
      };

      const result = await signUp(formData);

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pb_pending_invite_code');
        localStorage.removeItem('pb_pending_invite_code');
        if (rememberMe) {
          localStorage.setItem('gp_saved_phone', cleanPhone);
          localStorage.setItem('gp_saved_password', password);
          localStorage.setItem('gp_remember_me', 'true');
          localStorage.setItem('pb_remembered_phone', cleanPhone);
        }
      }

      onShowToast?.('Account created successfully! Welcome to GAIN POWER.');

      if (!result?.profile) {
        throw new Error('User profile was not returned from database.');
      }

      onAuthSuccess(result.profile, true);
    } catch (err: any) {
      console.error('Registration failed:', err);
      const msg = err.message || 'Failed to register account.';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('duplicate')) {
        setError('This phone number is already registered. Please log in.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = loginPhone.trim();
    if (!cleanId) {
      setError('Please enter your phone number.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const formData: LoginFormData = {
        identifier: cleanId,
        password: loginPassword,
        rememberMe,
      };

      const profile = await signIn(formData);

      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem('gp_saved_phone', cleanId);
          localStorage.setItem('gp_saved_password', loginPassword);
          localStorage.setItem('gp_remember_me', 'true');
          localStorage.setItem('pb_remembered_phone', cleanId);
        } else {
          localStorage.removeItem('gp_saved_phone');
          localStorage.removeItem('gp_saved_password');
          localStorage.removeItem('gp_remember_me');
          localStorage.removeItem('pb_remembered_phone');
        }
      }

      onShowToast?.(`Welcome back, ${profile.name || profile.username || 'Member'}!`);
      onAuthSuccess(profile, false);
    } catch (err: any) {
      console.error('Login failed:', err);
      const msg = err.message || 'Account not found or password incorrect. Please register first.';
      if (
        msg.toLowerCase().includes('invalid login credentials') ||
        msg.toLowerCase().includes('invalid_grant') ||
        msg.toLowerCase().includes('user not found')
      ) {
        setError('Account not found or password incorrect. Please register first.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-page-container"
      className="min-h-screen w-full bg-[#0D0D0E] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-[#FF6000] selection:text-white"
    >
      {/* Ambient Warm Orange Atmospheric Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-gradient-to-b from-[#FF6000]/15 via-[#FF6000]/5 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-20 right-0 w-[300px] h-[300px] bg-orange-600/10 blur-3xl pointer-events-none rounded-full" />

      {/* Main Wrapper Container */}
      <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center">
        {/* Brand Header with Database-backed Uploaded Logo */}
        <div id="auth-brand-header" className="text-center mb-6 flex flex-col items-center">
          {siteSettings?.logoUrl && !logoLoadError ? (
            <div className="relative mb-3 flex items-center justify-center">
              <img
                src={siteSettings.logoUrl}
                alt={siteSettings.siteTitle || 'GAIN POWER'}
                className="h-16 max-h-16 w-auto max-w-[200px] object-contain drop-shadow-md"
                onError={() => setLogoLoadError(true)}
              />
            </div>
          ) : (
            <div className="relative mb-3 flex items-center justify-center">
              {/* Pulsing ring around logo */}
              <div className="absolute inset-0 bg-[#FF6000]/30 rounded-2xl blur-md animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6000] via-[#FF7A00] to-[#FFA000] p-0.5 shadow-xl shadow-orange-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-[#121214] rounded-[14px] flex items-center justify-center">
                  <PowerBankLogo className="w-10 h-10" />
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 font-medium mt-1">
            Smart Power Infrastructure & Yield Sharing
          </p>
        </div>

        {/* White Form Container Card */}
        <motion.div
          id="auth-card-form"
          layout
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full bg-white rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-orange-500/10 relative text-gray-800"
        >
          {/* Login / Register Tab Header */}
          <div id="auth-tab-bar" className="flex border-b border-gray-100 mb-6 relative">
            <button
              id="tab-login-btn"
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 pb-3 text-center text-sm font-bold transition-all relative ${
                mode === 'login' ? 'text-[#FF6000]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Login
              {mode === 'login' && (
                <motion.div
                  layoutId="auth-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.75 bg-gradient-to-r from-[#FF6000] to-[#FFA000] rounded-full"
                />
              )}
            </button>
            <button
              id="tab-register-btn"
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 pb-3 text-center text-sm font-bold transition-all relative ${
                mode === 'register' ? 'text-[#FF6000]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Register
              {mode === 'register' && (
                <motion.div
                  layoutId="auth-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.75 bg-gradient-to-r from-[#FF6000] to-[#FFA000] rounded-full"
                />
              )}
            </button>
          </div>

          {/* Error Message Box */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                id="auth-error-alert"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 rounded-2xl bg-orange-50/90 border border-orange-200 text-orange-900 text-xs font-semibold flex items-start gap-2.5 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-[#FF6000] shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ================================================================= */}
          {/* 1. LOGIN FORM */}
          {/* ================================================================= */}
          {mode === 'login' && (
            <form id="auth-login-form" onSubmit={handleLogin} className="space-y-4">
              {/* Phone Number Field */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Phone Number
                </label>
                <div className="relative flex items-center">
                  {/* Country Selector (+91) */}
                  <div className="absolute left-3 flex items-center gap-1 text-xs font-extrabold text-gray-800 border-r border-gray-200 pr-2 py-0.5">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    id="login-phone-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    value={loginPhone}
                    onChange={(e) => handlePhoneChange(e.target.value, true)}
                    placeholder="Enter phone number"
                    className="w-full bg-[#F8F9FB] border border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3.5 pl-20 pr-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all outline-hidden"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="login-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-[#F8F9FB] border border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3.5 pl-10 pr-11 text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id="login-remember-checkbox"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FF6000] focus:ring-orange-500/20 accent-[#FF6000] border-gray-300 transition-all cursor-pointer"
                  />
                  <span className="text-xs text-gray-600 font-medium">Remember me for 30 days</span>
                </label>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#FF6000] via-[#FF7A00] to-[#FFA000] hover:brightness-105 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-orange-500/25 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <span>Login</span>
                  )}
                </button>
              </div>

              {/* Switch to Register footer */}
              <div className="text-center pt-2">
                <p className="text-xs text-gray-500 font-medium">
                  Don&apos;t have an account?{' '}
                  <button
                    id="switch-to-register-link"
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-[#FF6000] font-bold hover:underline ml-0.5"
                  >
                    Register
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* 2. REGISTER FORM (Exact 6 Fields Required) */}
          {/* ================================================================= */}
          {mode === 'register' && (
            <form id="auth-register-form" onSubmit={handleRegister} className="space-y-3.5">
              
              {/* Field 1: Name */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Name <span className="text-[#FF6000]">*</span>
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="register-name-input"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-[#F8F9FB] border border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3 pl-10 pr-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all outline-hidden"
                  />
                </div>
              </div>

              {/* Field 2: Phone Number */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Phone Number <span className="text-[#FF6000]">*</span>
                </label>
                <div className="relative flex items-center">
                  {/* Country Selector (+91) */}
                  <div className="absolute left-3 flex items-center gap-1 text-xs font-extrabold text-gray-800 border-r border-gray-200 pr-2 py-0.5">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    id="register-phone-input"
                    type="tel"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value, false)}
                    placeholder="Enter phone number"
                    className="w-full bg-[#F8F9FB] border border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3 pl-20 pr-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all outline-hidden"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Field 3: New Password */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  New Password <span className="text-[#FF6000]">*</span>
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="register-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-[#F8F9FB] border border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3 pl-10 pr-11 text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 4: Confirm Password */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Confirm Password <span className="text-[#FF6000]">*</span>
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="register-confirm-password-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter confirm password"
                    className="w-full bg-[#F8F9FB] border border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3 pl-10 pr-11 text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 5: Withdrawal PIN */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700">
                    Withdrawal PIN <span className="text-[#FF6000]">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">For Payouts</span>
                </div>
                <div className="relative flex items-center">
                  <ShieldCheck className="w-4 h-4 text-[#FF6000] absolute left-3.5 pointer-events-none" />
                  <input
                    id="register-withdrawal-password-input"
                    type={showWithdrawalPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={withdrawalPassword}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setWithdrawalPassword(digits);
                    }}
                    placeholder="Enter 4-digit withdrawal PIN"
                    className="w-full bg-[#F8F9FB] border border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3 pl-10 pr-11 text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWithdrawalPassword(!showWithdrawalPassword)}
                    className="absolute right-3.5 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                  >
                    {showWithdrawalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 6: Referral Code (Mandatory) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700">
                    Referral Code <span className="text-[#FF6000]">*</span>
                  </label>
                  {isReadOnlyCode && (
                    <span className="text-[10px] text-[#FF6000] font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                      Invited
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Gift className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="register-referral-input"
                    type="text"
                    required
                    readOnly={isReadOnlyCode}
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Enter referral code"
                    className={`w-full border rounded-2xl py-3 pl-10 pr-4 text-sm font-medium transition-all outline-hidden ${
                      isReadOnlyCode
                        ? 'bg-orange-50/50 border-orange-200 text-gray-700 font-mono font-bold cursor-not-allowed'
                        : 'bg-[#F8F9FB] border-gray-200 focus:border-[#FF6000] focus:ring-4 focus:ring-orange-500/10 text-gray-900 placeholder:text-gray-400'
                    }`}
                  />
                </div>
                {referrerName && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Referred by: {referrerName}</span>
                  </p>
                )}
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                <button
                  id="register-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#FF6000] via-[#FF7A00] to-[#FFA000] hover:brightness-105 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-orange-500/25 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Register</span>
                  )}
                </button>
              </div>

              {/* Switch to Login footer */}
              <div className="text-center pt-1">
                <p className="text-xs text-gray-500 font-medium">
                  Already have an account?{' '}
                  <button
                    id="switch-to-login-link"
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-[#FF6000] font-bold hover:underline ml-0.5"
                  >
                    Login
                  </button>
                </p>
              </div>
            </form>
          )}
        </motion.div>

        {/* Security & Regulatory Footnote */}
        <div className="mt-6 text-center text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#FF7A00]" />
          <span>256-Bit SSL Encrypted & Verified Cloud Network</span>
        </div>
      </div>
    </div>
  );
};
