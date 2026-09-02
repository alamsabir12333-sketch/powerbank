import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Lock,
  Phone,
  User,
  Mail,
  UserPlus,
  LogIn,
  AlertCircle,
  ShieldCheck,
  Gift,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import {
  registerUserAccount,
  loginUser,
  validateUsername,
  validateWhatsApp,
  validateEmail,
  validatePassword,
  getPasswordStrength,
  checkUsernameAvailability,
  checkWhatsAppAvailability,
  checkEmailAvailability,
  verifyReferralCode,
} from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, msg: string) => void;
  initialMode?: 'login' | 'register';
  initialReferralCode?: string;
  isReferralReadOnly?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
  initialReferralCode = '',
  isReferralReadOnly = false,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Register Fields
  const [username, setUsername] = useState('');
  const [whatsappNo, setWhatsappNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [withdrawalPassword, setWithdrawalPassword] = useState('');
  const [showWithdrawalPassword, setShowWithdrawalPassword] = useState(false);
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [referralLocked, setReferralLocked] = useState(isReferralReadOnly);

  // Login Fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (initialReferralCode) {
        setReferralCode(initialReferralCode.toUpperCase());
        setReferralLocked(isReferralReadOnly);
      }
      setError(null);
    }
  }, [isOpen, initialMode, initialReferralCode, isReferralReadOnly]);

  if (!isOpen) return null;

  const passwordStrength = getPasswordStrength(password);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Field validations
    const uErr = validateUsername(username);
    if (uErr) {
      setError(uErr);
      return;
    }

    const wErr = validateWhatsApp(whatsappNo);
    if (wErr) {
      setError(wErr);
      return;
    }

    const eErr = validateEmail(email);
    if (eErr) {
      setError(eErr);
      return;
    }

    const pErr = validatePassword(password);
    if (pErr) {
      setError(pErr);
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

    setLoading(true);
    setError(null);

    try {
      const result = await registerUserAccount({
        username: username.trim(),
        whatsappNo: whatsappNo.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        withdrawalPassword: withdrawalPassword.trim(),
        referralCode: referralCode.trim() || undefined,
      });

      onSuccess(result.user, `Account created! Membership No: ${result.membershipNumber}`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!loginIdentifier.trim()) {
      setError('Please enter your Username, WhatsApp No., or Email.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await loginUser(loginIdentifier.trim(), loginPassword);
      onSuccess(user, 'Logged in successfully!');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-xs"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative w-full max-w-[420px] bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden text-white z-10 my-auto flex flex-col max-h-[92vh]"
        >
          {/* Header & Tabs */}
          <div className="px-5 pt-5 pb-3 border-b border-[#2a2a2a] bg-[#181818] shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FF6000] text-white flex items-center justify-center font-black text-xs shadow-md shadow-orange-500/20">
                  GP
                </div>
                <div>
                  <span className="font-extrabold text-base text-white block leading-tight">
                    GAIN POWER
                  </span>
                  <span className="text-[10.5px] text-gray-400 font-medium">
                    {mode === 'register' ? 'Join Global Sharing Economy' : 'Access Your Power Dashboard'}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 p-1 bg-[#121212] rounded-xl border border-[#2a2a2a]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-[#FF6000] text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-[#FF6000] text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Form Scroll Area */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* REGISTER FORM */}
            {/* ========================================================================= */}
            {mode === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* 1. USERNAME */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300">
                      Username <span className="text-[#FF6000]">*</span>
                    </label>
                    <span className="text-[10px] text-gray-500">3-30 characters</span>
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="e.g. rahul_power"
                      autoComplete="username"
                      maxLength={30}
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-9 pr-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                  </div>
                </div>

                {/* 2. WHATSAPP NO. */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300">
                      WhatsApp No. <span className="text-[#FF6000]">*</span>
                    </label>
                    <span className="text-[10px] text-gray-500">10-digit Indian Mobile</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <span className="text-sm">🇮🇳</span>
                      <span className="text-gray-400 text-xs font-bold font-mono">+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={whatsappNo}
                      onChange={(e) => setWhatsappNo(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-16 pr-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                  </div>
                </div>

                {/* 3. EMAIL */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Email <span className="text-[#FF6000]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value.trim())}
                      placeholder="name@example.com"
                      autoComplete="email"
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-9 pr-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                  </div>
                </div>

                {/* 4. PASSWORD */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Password <span className="text-[#FF6000]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (min 6 chars)"
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-9 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password.length > 0 && (
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-1">
                          <div
                            className={`h-1.5 w-6 rounded-full ${
                              passwordStrength === 'Weak'
                                ? 'bg-red-500'
                                : passwordStrength === 'Medium'
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                          />
                          <div
                            className={`h-1.5 w-6 rounded-full ${
                              passwordStrength === 'Medium'
                                ? 'bg-yellow-500'
                                : passwordStrength === 'Strong'
                                ? 'bg-green-500'
                                : 'bg-gray-700'
                            }`}
                          />
                          <div
                            className={`h-1.5 w-6 rounded-full ${
                              passwordStrength === 'Strong' ? 'bg-green-500' : 'bg-gray-700'
                            }`}
                          />
                        </div>
                        <span
                          className={`font-semibold ${
                            passwordStrength === 'Weak'
                              ? 'text-red-400'
                              : passwordStrength === 'Medium'
                              ? 'text-yellow-400'
                              : 'text-green-400'
                          }`}
                        >
                          {passwordStrength}
                        </span>
                      </div>
                      <span className="text-gray-500 text-[10px]">Min. 6 chars</span>
                    </div>
                  )}
                </div>

                {/* 5. CONFIRM PASSWORD */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Confirm Password <span className="text-[#FF6000]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className={`w-full bg-[#121212] border rounded-xl pl-9 pr-10 py-2.5 text-white text-sm focus:outline-none transition-colors ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-red-500/80 focus:border-red-500'
                          : confirmPassword && confirmPassword === password
                          ? 'border-green-500/80 focus:border-green-500'
                          : 'border-[#2a2a2a] focus:border-[#FF6000]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <span className="text-red-400 text-[11px] mt-1 block">
                      Passwords do not match.
                    </span>
                  )}
                  {confirmPassword && confirmPassword === password && (
                    <span className="text-green-400 text-[11px] mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Passwords match
                    </span>
                  )}
                </div>

                {/* 6. WITHDRAWAL PIN */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300">
                      Withdrawal PIN <span className="text-[#FF6000]">*</span>
                    </label>
                    <span className="text-[10px] text-gray-500">For Payouts</span>
                  </div>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#FF6000]" />
                    <input
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
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-9 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWithdrawalPassword(!showWithdrawalPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showWithdrawalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10.5px] text-gray-400 mt-1 block leading-tight">
                    Required for withdrawing wallet funds to your bank account.
                  </span>
                </div>

                {/* 7. REFERRAL CODE */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300">
                      Referral Code
                    </label>
                    <span className="text-[10px] text-gray-500">
                      {referralLocked ? 'Locked by invite link' : 'Optional'}
                    </span>
                  </div>
                  <div className="relative">
                    <Gift className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#FF6000]" />
                    <input
                      type="text"
                      readOnly={referralLocked}
                      value={referralCode}
                      onChange={(e) => {
                        if (!referralLocked) {
                          setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                        }
                      }}
                      placeholder="e.g. PB888999"
                      className={`w-full border rounded-xl pl-9 pr-3.5 py-2.5 uppercase font-mono text-sm focus:outline-none transition-colors ${
                        referralLocked
                          ? 'bg-[#181818] border-orange-500/40 text-[#FFA000] cursor-not-allowed'
                          : 'bg-[#121212] border-[#2a2a2a] text-white focus:border-[#FF6000]'
                      }`}
                    />
                    {referralLocked && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#FF6000] text-[10px] font-bold">
                        <Lock className="w-3 h-3" />
                        <span>Invited</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* REGISTER SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-sm shadow-lg shadow-orange-500/25 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 tracking-wide uppercase"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>CREATE ACCOUNT</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ========================================================================= */
              /* LOGIN FORM */
              /* ========================================================================= */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Username, WhatsApp No., or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="Username / 10-digit WhatsApp / Email"
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-9 pr-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-9 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* LOGIN SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-sm shadow-lg shadow-orange-500/25 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 tracking-wide uppercase"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>SIGN IN</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
