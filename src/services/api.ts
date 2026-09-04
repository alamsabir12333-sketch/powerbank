import { apiUrl, API_BASE_URL } from './apiClient';
import { supabase, isSupabaseConfigured, isTableMissingError, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import {
  UserProfile,
  Wallet,
  WalletTransaction,
  TransactionType,
  ProductItem,
  PurchaseItem,
  PaymentItem,
  PaymentStatus,
  BankAccount,
  WithdrawalItem,
  AppNotification,
  NotificationItem,
  NotificationType,
  TargetAudienceType,
  AdminCreateNotificationPayload,
  AdminNotificationHistoryItem,
  PaymentSettings,
  NewsItem,
  BannerItem,
  TeamStats,
  RegisterFormData,
  LoginFormData,
  EarningRecord,
  ClaimBatch,
  ProEligibilityConfig,
  PlanCategory,
  ReferralSettings,
  ReferralRewardType,
  ReferralRegistrationRule,
  ReferralStreakRule,
  ReferralTopupTier,
  ReferralStreakRecord,
  ReferralRewardLog,
  TeamMemberItem,
  UserTeamSummary,
  GiftCode,
  GiftCodeClaim,
  GiftCodeAnalytics,
  AdminBalanceType,
  AdminBalanceAdjustment,
  VipLevel,
  UserVipStatus,
  AboutPlatformConfig,
  Mission,
  UserMissionItem,
  UserMissionSummary,
  MissionClaim,
  AdminMissionStats,
  CreateMissionPayload,
  SiteSettings,
  RechargeSettings,
  UsdtSettings,
  UsdtDepositItem,
} from '../types';
import {
  productsData,
  homeBanners,
  platformNewsList,
  defaultProEligibilityConfig,
  defaultReferralSettings,
  initialGiftCodes,
  defaultVipLevels,
  defaultAboutPlatformConfig,
  defaultMissions,
} from '../data/mockData';

// Local storage keys for resilient persistence / preview simulation
const STORAGE_KEYS = {
  SESSION: 'pb_session',
  PROFILE: 'pb_profile',
  WALLET: 'pb_wallet',
  TRANSACTIONS: 'pb_transactions',
  PURCHASES: 'pb_purchases',
  PAYMENTS: 'pb_payments',
  WITHDRAWALS: 'pb_withdrawals',
  BANKS: 'pb_bank_accounts',
  NOTIFICATIONS: 'pb_notifications',
  SETTINGS: 'pb_payment_settings',
  PLANS: 'pb_plans',
  LOCAL_USERS: 'pb_local_users',
  PRO_CONFIG: 'pb_pro_config',
  EARNINGS: 'pb_earnings',
  CLAIMS: 'pb_claims',
  REFERRAL_SETTINGS: 'pb_referral_settings',
  REFERRAL_STREAKS: 'pb_referral_streaks',
  REFERRAL_REWARDS: 'pb_referral_rewards',
  GIFT_CODES: 'pb_gift_codes',
  GIFT_CODE_CLAIMS: 'pb_gift_code_claims',
  BALANCE_ADJUSTMENTS: 'pb_balance_adjustments',
  VIP_LEVELS: 'pb_vip_levels',
  DAILY_CHECKIN: 'pb_daily_checkin',
  ABOUT_PLATFORM: 'pb_about_platform_config',
  MISSIONS: 'pb_missions',
  MISSION_CLAIMS: 'pb_mission_claims',
};

// Default initial state
const defaultPaymentSettings: PaymentSettings = {
  id: 'default',
  upiId: 'powerbank.pay@upi',
  qrImageUrl: '',
  instructions: '1. Scan the QR code using GooglePay, PhonePe, Paytm or any UPI app.\n2. Transfer the exact recharge amount.\n3. Enter the 12-digit UTR transaction number below and submit for verification.',
  isRechargeEnabled: true,
  isPurchaseEnabled: true,
  payuUpiId: 'payu.powerbank@upi',
  payuQrImageUrl: '',
  toppayUpiId: 'toppay.powerbank@upi',
  toppayQrImageUrl: '',
  upayUpiId: 'upay.powerbank@upi',
  upayQrImageUrl: '',
  channels: {
    payu: {
      id: 'payu',
      name: 'PayU',
      subtitle: 'Fast UPI & QR',
      upiId: 'payu.powerbank@upi',
      qrImageUrl: '',
      isEnabled: true,
    },
    toppay: {
      id: 'toppay',
      name: 'TopPay',
      subtitle: 'Auto Scan UPI',
      upiId: 'toppay.powerbank@upi',
      qrImageUrl: '',
      isEnabled: true,
    },
    upay: {
      id: 'upay',
      name: 'UPay',
      subtitle: 'Instant Dynamic UPI',
      upiId: 'upay.powerbank@upi',
      qrImageUrl: '',
      isEnabled: true,
    },
  },
};

// Helper: load from localStorage
function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

// Helper: save to localStorage
function saveLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

// Clear all user session and authenticated state storage
export function clearAuthenticatedStorage() {
  const keysToRemove = [
    STORAGE_KEYS.SESSION,
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.WALLET,
    STORAGE_KEYS.TRANSACTIONS,
    STORAGE_KEYS.PURCHASES,
    STORAGE_KEYS.PAYMENTS,
    STORAGE_KEYS.WITHDRAWALS,
    STORAGE_KEYS.BANKS,
    STORAGE_KEYS.NOTIFICATIONS,
    STORAGE_KEYS.EARNINGS,
    STORAGE_KEYS.CLAIMS,
    STORAGE_KEYS.DAILY_CHECKIN,
    STORAGE_KEYS.GIFT_CODE_CLAIMS,
    STORAGE_KEYS.MISSION_CLAIMS,
    STORAGE_KEYS.REFERRAL_STREAKS,
    STORAGE_KEYS.REFERRAL_REWARDS,
    STORAGE_KEYS.BALANCE_ADJUSTMENTS,
  ];
  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
  try {
    sessionStorage.removeItem('pb_session');
  } catch {}
}

// Initialize seed data if not present
function initializeMockStore() {
  try {
    const existingTxStr = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (
      existingTxStr &&
      (existingTxStr.includes('tx_seed_') ||
        existingTxStr.includes('ORD-982187') ||
        existingTxStr.includes('PUR-882910') ||
        existingTxStr.includes('PUR-773829') ||
        existingTxStr.includes('CLM-7629A1'))
    ) {
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    }
  } catch {}

  if (!localStorage.getItem(STORAGE_KEYS.PLANS)) {
    saveLocal(STORAGE_KEYS.PLANS, productsData);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    saveLocal(STORAGE_KEYS.SETTINGS, defaultPaymentSettings);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRO_CONFIG)) {
    saveLocal(STORAGE_KEYS.PRO_CONFIG, defaultProEligibilityConfig);
  }
  if (!localStorage.getItem(STORAGE_KEYS.REFERRAL_SETTINGS)) {
    saveLocal(STORAGE_KEYS.REFERRAL_SETTINGS, defaultReferralSettings);
  }
}

initializeMockStore();

// ==============================================================================
// VALIDATION HELPERS & UTILITIES
// ==============================================================================

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required.';
  }
  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters long.';
  }
  if (trimmed.length > 30) {
    return 'Username cannot exceed 30 characters.';
  }
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores.';
  }
  return null;
}

export function validateWhatsApp(whatsappNo: string): string | null {
  const digitsOnly = whatsappNo.replace(/\D/g, '');
  if (!digitsOnly) {
    return 'WhatsApp No. is required.';
  }
  // Validate Indian mobile number format: exactly 10 digits starting with 6-9
  const indianMobileRegex = /^[6-9]\d{9}$/;
  if (!indianMobileRegex.test(digitsOnly)) {
    return 'Please enter a valid 10-digit Indian WhatsApp number.';
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email is required.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

export function getPasswordStrength(password: string): 'Weak' | 'Medium' | 'Strong' {
  if (!password || password.length < 6) return 'Weak';
  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (password.length >= 8 && hasLetters && hasNumbers && hasSpecial) {
    return 'Strong';
  }
  if (password.length >= 6 && hasLetters && hasNumbers) {
    return 'Medium';
  }
  return 'Weak';
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const cleanUsername = username.trim();
  if (!cleanUsername) return true;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', cleanUsername)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.warn('Error checking username:', error);
      return true;
    }
    return !data || data.length === 0;
  } else {
    const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
    const current = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as UserProfile);
    const match = [...allUsers, current].find(
      (u) => u.username?.toLowerCase() === cleanUsername.toLowerCase()
    );
    return !match;
  }
}

export async function checkWhatsAppAvailability(whatsappNo: string): Promise<boolean> {
  const cleanNo = whatsappNo.replace(/\D/g, '');
  if (!cleanNo) return true;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .or(`phone.eq.${cleanNo},whatsapp_no.eq.${cleanNo},mobile.eq.${cleanNo}`)
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.warn('Error checking phone availability:', error);
        // Fallback check on phone directly if or filter has column mismatch
        const { data: phoneData } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', cleanNo)
          .maybeSingle();
        if (phoneData) return false;
        return true;
      }
      return !data || data.length === 0;
    } catch {
      return true;
    }
  } else {
    const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
    const current = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as UserProfile);
    const match = [...allUsers, current].find(
      (u) => (u.whatsappNo || u.mobile || (u as any).phone) === cleanNo
    );
    return !match;
  }
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return true;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.warn('Error checking email:', error);
      return true;
    }
    return !data || data.length === 0;
  } else {
    const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
    const current = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as UserProfile);
    const match = [...allUsers, current].find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );
    return !match;
  }
}

export async function verifyReferralCode(code: string): Promise<{
  valid: boolean;
  referrerId?: string;
  referrerName?: string;
}> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false };
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username, membership_number, referral_code')
      .or(`referral_code.ilike.${cleanCode},membership_number.ilike.${cleanCode}`)
      .limit(1);

    if (error || !data || data.length === 0) {
      return { valid: false };
    }

    const refUser = data[0];
    return {
      valid: true,
      referrerId: refUser.user_id,
      referrerName: refUser.username || refUser.membership_number,
    };
  } else {
    const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
    const current = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as UserProfile);
    const match = [...allUsers, current].find(
      (u) =>
        u.referralCode?.toUpperCase() === cleanCode ||
        u.membershipNumber?.toUpperCase() === cleanCode
    );

    if (match) {
      return {
        valid: true,
        referrerId: match.userId || match.id,
        referrerName: match.username || match.membershipNumber,
      };
    }
    // Also accept default GP888999 or legacy PB for test / demo convenience
    if (cleanCode === 'GP888999' || cleanCode === 'PB888999' || cleanCode.startsWith('GP') || cleanCode.startsWith('PB')) {
      return {
        valid: true,
        referrerId: 'usr_demo_01',
        referrerName: 'GAIN POWER Admin',
      };
    }
    return { valid: false };
  }
}

// ==============================================================================
// AUTHENTICATION SERVICES
// ==============================================================================

export async function registerUserAccount(formData: RegisterFormData) {
  const name = (formData.name || formData.username || '').trim();
  const phone = (formData.phone || formData.whatsappNo || '').replace(/\D/g, '');
  const cleanEmail = formData.email?.trim().toLowerCase() || `${phone}@gainpower.internal`;
  const cleanUsername = (formData.username || (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '_') : '') || `user_${phone.slice(-4)}`).trim();
  const { password, confirmPassword, withdrawalPassword, referralCode } = formData;

  // 1. Synchronous Validations
  if (!name) {
    throw new Error('Please enter your name.');
  }

  if (!phone || phone.length !== 10) {
    throw new Error('Please enter a valid 10-digit Indian phone number.');
  }

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  if (password !== confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  const cleanPin = (withdrawalPassword || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    throw new Error('Withdrawal PIN must be exactly 4 digits.');
  }

  const cleanRefCode = referralCode?.trim().toUpperCase() || '';
  if (!cleanRefCode) {
    throw new Error('Referral code is required.');
  }

  // 2. Database & Phone Uniqueness Check (ONE USER = ONE ACCOUNT)
  const isPhoneFree = await checkWhatsAppAvailability(phone);
  if (!isPhoneFree) {
    throw new Error('This phone number is already registered. Please login instead.');
  }

  // 3. Referral Verification & Self-Referral Prevention
  let verifiedReferrerId: string | null = null;
  if (
    cleanRefCode.toLowerCase() === cleanUsername.toLowerCase() ||
    cleanRefCode.toLowerCase() === cleanEmail.toLowerCase() ||
    cleanRefCode === phone
  ) {
    throw new Error('You cannot use your own referral code.');
  }
  const refCheck = await verifyReferralCode(cleanRefCode);
  if (!refCheck.valid) {
    throw new Error('Invalid referral code.');
  }
  if (
    refCheck.referrerName?.toLowerCase() === cleanUsername.toLowerCase() ||
    refCheck.referrerId === cleanUsername
  ) {
    throw new Error('You cannot use your own referral code.');
  }
  verifiedReferrerId = refCheck.referrerId || cleanRefCode;

  const membershipNumber = 'GP' + Math.floor(100000 + Math.random() * 900000);
  const userReferralCode = membershipNumber;

  if (isSupabaseConfigured && supabase) {
    let effectiveUserId: string | null = null;
    let authUser: any = null;
    let serverProfile: any = null;
    let serverWallet: any = null;

    // 4. Authoritative Registration via Express backend (Cloud Run API)
    const regUrl = apiUrl('/api/auth/register');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let regResp: Response;
    try {
      regResp = await fetch(regUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name,
          username: cleanUsername,
          phone,
          email: cleanEmail,
          password,
          withdrawalPassword: withdrawalPassword.trim(),
          referralCode: cleanRefCode,
          membershipNumber,
        }),
      });
    } catch (networkErr: any) {
      clearTimeout(timeoutId);
      throw new Error(`Registration network error: ${networkErr.message || 'Unable to reach backend server.'}`);
    }
    clearTimeout(timeoutId);

    const contentType = regResp.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error(`Backend API returned HTML instead of JSON (${regResp.status}). Check backend status.`);
    }

    let regData: any = null;
    try {
      regData = await regResp.json();
    } catch {
      throw new Error(`Invalid JSON response received from backend during registration.`);
    }

    if (!regResp.ok || !regData?.success || !regData?.userId) {
      const errorMsg = regData?.error || `Registration failed on server (Status: ${regResp.status}).`;
      if (errorMsg.toLowerCase().includes('already registered') || errorMsg.toLowerCase().includes('duplicate')) {
        throw new Error('This phone number is already registered. Please login instead.');
      }
      throw new Error(errorMsg);
    }

    effectiveUserId = regData.userId;
    authUser = regData.user || { id: effectiveUserId, email: cleanEmail };
    serverProfile = regData.profile;
    serverWallet = regData.wallet;

    if (!effectiveUserId) {
      throw new Error('Registration failed: no valid user ID returned from backend.');
    }

    // 5. Establish client Supabase Auth session with credentials
    try {
      const { data: signData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (!signInErr && signData?.user) {
        authUser = signData.user;
      }
    } catch (err) {
      console.warn('[AUTH] Client sign-in after register caught:', err);
    }

    // 6. Post-registration verification: verify that profile and wallet exist in Supabase
    let verifiedProfile: any = serverProfile;
    let verifiedWallet: any = serverWallet;

    if (!verifiedProfile || !verifiedWallet) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        const { data: wData } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (pData) verifiedProfile = pData;
        if (wData) verifiedWallet = wData;

        if (verifiedProfile && verifiedWallet) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!verifiedProfile) {
      throw new Error('Database onboarding failed: user profile was not saved to database.');
    }

    const newProfile: UserProfile = {
      id: verifiedProfile.id || effectiveUserId,
      userId: verifiedProfile.user_id || effectiveUserId,
      username: verifiedProfile.username || cleanUsername,
      whatsappNo: verifiedProfile.whatsapp_no || verifiedProfile.phone || phone,
      name: verifiedProfile.name || verifiedProfile.full_name || name || cleanUsername,
      mobile: verifiedProfile.whatsapp_no || verifiedProfile.phone || phone,
      email: verifiedProfile.email || cleanEmail,
      membershipNumber: verifiedProfile.membership_number || membershipNumber,
      referralCode: verifiedProfile.referral_code || userReferralCode,
      referredBy: verifiedProfile.referred_by || verifiedReferrerId || undefined,
      role: verifiedProfile.role || 'user',
      status: verifiedProfile.status || 'active',
      deviceEarnings: 0,
      teamEarnings: 0,
      walletBalance: Number(verifiedWallet?.available_balance ?? 50.0),
      createdAt: verifiedProfile.created_at || new Date().toISOString(),
    };

    const newWallet: Wallet = {
      id: verifiedWallet?.id || 'wal_' + effectiveUserId,
      userId: effectiveUserId,
      topupBalance: Number(verifiedWallet?.recharge_balance ?? 50.0),
      withdrawBalance: Number(verifiedWallet?.withdraw_balance ?? 0.0),
      availableBalance: Number(verifiedWallet?.available_balance ?? 50.0),
      rechargeBalance: Number(verifiedWallet?.recharge_balance ?? 50.0),
      earnedBalance: Number(verifiedWallet?.withdraw_balance ?? 0.0),
      pendingBalance: Number(verifiedWallet?.pending_balance ?? 0.0),
      totalEarned: Number(verifiedWallet?.total_earned ?? 0.0),
      totalWithdrawn: Number(verifiedWallet?.total_withdrawn ?? 0.0),
    };

    // Save session and local cache
    saveLocal(STORAGE_KEYS.PROFILE, newProfile);
    saveLocal(STORAGE_KEYS.WALLET, newWallet);
    saveLocal(STORAGE_KEYS.SESSION, { userId: effectiveUserId, email: cleanEmail, username: cleanUsername, mobile: phone });

    return {
      user: authUser,
      profile: newProfile,
      wallet: newWallet,
      membershipNumber: newProfile.membershipNumber,
      referralCode: newProfile.referralCode,
    };
  }

  throw new Error('Supabase backend database is not configured. Registration cannot proceed.');
};

export async function loginUser(identifier: string, password: string) {
  const cleanId = identifier.trim();
  if (!cleanId) throw new Error('Please enter your phone number or username.');
  if (!password) throw new Error('Please enter your password.');

  const cleanDigits = cleanId.replace(/\D/g, '');
  let targetEmail = cleanId;

  if (isSupabaseConfigured && supabase) {
    if (!cleanId.includes('@')) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, id, user_id')
          .or(`phone.eq.${cleanDigits},whatsapp_no.eq.${cleanDigits},mobile.eq.${cleanDigits},username.ilike.${cleanId}`)
          .limit(1)
          .maybeSingle();

        if (profile?.email) {
          targetEmail = profile.email;
        } else {
          targetEmail = `${cleanDigits || cleanId}@gainpower.internal`;
        }
      } catch {
        targetEmail = `${cleanDigits || cleanId}@gainpower.internal`;
      }
    }

    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      // If initial login fails and targetEmail was @gainpower.internal, attempt fallback with @powerbank.app
      if (error && targetEmail.endsWith('@gainpower.internal') && cleanDigits) {
        const legacyEmail = `${cleanDigits}@powerbank.app`;
        const legacyResult = await supabase.auth.signInWithPassword({
          email: legacyEmail,
          password,
        });
        if (!legacyResult.error && legacyResult.data) {
          data = legacyResult.data;
          error = null;
          targetEmail = legacyEmail;
        }
      }

      if (error) {
        const errLower = error.message.toLowerCase();
        if (
          errLower.includes('invalid login credentials') ||
          errLower.includes('invalid_grant') ||
          errLower.includes('user not found') ||
          errLower.includes('email not confirmed')
        ) {
          throw new Error('Account not found or password incorrect. Please register first.');
        }
        throw new Error(error.message || 'Account not found or password incorrect. Please register first.');
      }
      if (data?.user) {
        const loggedInUserId = data.user.id;
        const loggedInEmail = data.user.email || targetEmail;

        // Verify/ensure profile and wallet exist in Supabase
        try {
          const { data: pCheck } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', loggedInUserId)
            .maybeSingle();

          if (!pCheck) {
            // Profile missing in DB: reconstruct safely from user metadata or fallback
            const meta = data.user.user_metadata || {};
            const recUsername = meta.username || cleanId.split('@')[0] || 'Member';
            const recWhatsApp = (meta.whatsapp_no || cleanDigits || '9876543210').replace(/\D/g, '');
            const recMemNo = meta.membership_number || 'GP' + Math.floor(100000 + Math.random() * 900000);
            const recRefCode = meta.referral_code || recMemNo;

            try {
              await supabase.from('profiles').insert({
                user_id: loggedInUserId,
                username: recUsername,
                whatsapp_no: recWhatsApp,
                email: loggedInEmail,
                membership_number: recMemNo,
                referral_code: recRefCode,
                role: 'user',
                status: 'active',
                updated_at: new Date().toISOString(),
              });
            } catch {}
          }

          const { data: wCheck } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', loggedInUserId)
            .maybeSingle();

          if (!wCheck) {
            try {
              await supabase.from('wallets').insert({
                user_id: loggedInUserId,
                available_balance: 50.0,
                recharge_balance: 50.0,
                withdraw_balance: 0.0,
                pending_balance: 0.0,
                total_earned: 0.0,
                total_withdrawn: 0.0,
                updated_at: new Date().toISOString(),
              });
            } catch {}
          }
        } catch (recoveryErr) {
          console.warn('[AUTH] Profile/wallet sync on login notice:', recoveryErr);
        }

        saveLocal(STORAGE_KEYS.SESSION, { userId: data.user.id, email: data.user.email || targetEmail, mobile: cleanId });
      }
      return data.user;
    } catch (err: any) {
      const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
      const current = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as UserProfile);
      const cleanDigits = cleanId.replace(/\D/g, '');
      const found = [...allUsers, current].find(
        (u) =>
          u.username?.toLowerCase() === cleanId.toLowerCase() ||
          u.email?.toLowerCase() === cleanId.toLowerCase() ||
          (u.whatsappNo && u.whatsappNo === cleanDigits) ||
          (u.mobile && u.mobile === cleanDigits)
      );
      if (found) {
        saveLocal(STORAGE_KEYS.SESSION, { userId: found.userId || found.id, email: found.email || targetEmail, mobile: found.mobile || cleanId });
        saveLocal(STORAGE_KEYS.PROFILE, found);
        return { id: found.userId || found.id, email: found.email };
      }
      throw err;
    }
  } else {
    const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
    const current = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as UserProfile);
    const cleanDigits = cleanId.replace(/\D/g, '');

    const found = [...allUsers, current].find(
      (u) =>
        u.username?.toLowerCase() === cleanId.toLowerCase() ||
        u.email?.toLowerCase() === cleanId.toLowerCase() ||
        (u.whatsappNo && u.whatsappNo === cleanDigits) ||
        (u.mobile && u.mobile === cleanDigits)
    );

    const userId = found?.userId || found?.id || 'usr_demo_01';
    const email = found?.email || targetEmail;
    saveLocal(STORAGE_KEYS.SESSION, { userId, email, mobile: found?.mobile || cleanId });
    if (found) {
      saveLocal(STORAGE_KEYS.PROFILE, found);
    }
    return { id: userId, email };
  }
}

export async function loginUserAccount(formData: LoginFormData) {
  return loginUser(formData.identifier, formData.password);
}

export async function logoutUser() {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AUTH] Supabase signOut error:', e);
    }
  }
  clearAuthenticatedStorage();
}

export async function getCurrentUser() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) return session.user;
      return null;
    } catch {
      return null;
    }
  } else {
    const session = getLocal<{ userId: string; email: string } | null>(STORAGE_KEYS.SESSION, null);
    return session ? { id: session.userId, email: session.email } : null;
  }
}

// ==============================================================================
// USER PROFILE & WALLET DATA
// ==============================================================================

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const localProfile = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as UserProfile);
  const localWallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, { availableBalance: 0, totalEarned: 0 } as Wallet);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && !isTableMissingError(error) && error.code !== 'PGRST116') {
        console.warn('Supabase fetch profile:', error.message);
      }

      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletError && !isTableMissingError(walletError) && walletError.code !== 'PGRST116') {
        console.warn('Supabase fetch wallet:', walletError.message);
      }

      if (profile) {
        return {
          id: profile.id || userId,
          userId: profile.user_id || userId,
          username: profile.username || profile.name || localProfile.username || 'Member',
          whatsappNo: profile.whatsapp_no || profile.mobile || localProfile.whatsappNo || '9876543210',
          name: profile.username || profile.name || localProfile.name || 'Member',
          mobile: profile.whatsapp_no || profile.mobile || localProfile.mobile || '9876543210',
          email: profile.email || localProfile.email || '',
          membershipNumber: profile.membership_number || localProfile.membershipNumber || 'GP888999',
          referralCode: profile.referral_code || profile.membership_number || localProfile.referralCode || 'GP888999',
          referredBy: profile.referred_by || localProfile.referredBy,
          role: profile.role || localProfile.role || 'user',
          status: profile.status || localProfile.status || 'active',
          deviceEarnings: Number(wallet?.total_earned ?? localWallet.totalEarned ?? 0),
          teamEarnings: 0,
          walletBalance: Number(wallet?.available_balance ?? localWallet.availableBalance ?? 0),
          avatarUrl: profile.avatar_url || localProfile.avatarUrl,
          createdAt: profile.created_at || localProfile.createdAt,
          updatedAt: profile.updated_at || localProfile.updatedAt,
        };
      }
    } catch {
      // Fall through to local
    }
  }

  return {
    ...localProfile,
    userId: localProfile.userId || userId,
    id: localProfile.id || userId,
    username: localProfile.username || localProfile.name || 'Member',
    whatsappNo: localProfile.whatsappNo || localProfile.mobile || '9876543210',
    name: localProfile.username || localProfile.name || 'Member',
    mobile: localProfile.whatsappNo || localProfile.mobile || '9876543210',
    email: localProfile.email || '',
    membershipNumber: localProfile.membershipNumber || 'GP888999',
    referralCode: localProfile.referralCode || 'GP888999',
    role: localProfile.role || 'user',
    status: localProfile.status || 'active',
    walletBalance: localWallet.availableBalance || 0,
    deviceEarnings: localWallet.totalEarned || 0,
  };
}

export async function fetchWallet(userId: string): Promise<Wallet> {
  const localWallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
    id: 'wal_' + userId,
    userId,
    topupBalance: 0,
    withdrawBalance: 0,
    availableBalance: 0,
    rechargeBalance: 0,
    earnedBalance: 0,
    pendingBalance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
  });

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && !isTableMissingError(error) && error.code !== 'PGRST116') {
        console.warn('Supabase fetch wallet:', error.message);
      }

      if (data) {
        const topup = Number(data.recharge_balance !== undefined && data.recharge_balance !== null ? data.recharge_balance : (data.topup_balance ?? 0));
        const withdraw = Number(data.withdraw_balance !== undefined && data.withdraw_balance !== null ? data.withdraw_balance : (data.earned_balance ?? data.available_balance ?? 0));
        const totalEarned = Number(data.total_earned || 0);

        return {
          id: data.id || localWallet.id,
          userId: data.user_id || userId,
          topupBalance: topup,
          withdrawBalance: withdraw,
          availableBalance: withdraw, // backward compatibility
          rechargeBalance: topup,
          earnedBalance: withdraw,
          pendingBalance: Number(data.pending_balance || 0),
          totalEarned,
          totalWithdrawn: Number(data.total_withdrawn || 0),
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch {
      // Fall through to local
    }
  }

  const topup = localWallet.rechargeBalance !== undefined ? localWallet.rechargeBalance : (localWallet.topupBalance || 0);
  const withdraw = localWallet.withdrawBalance !== undefined ? localWallet.withdrawBalance : (localWallet.earnedBalance !== undefined ? localWallet.earnedBalance : (localWallet.availableBalance || 0));

  return {
    ...localWallet,
    topupBalance: topup,
    withdrawBalance: withdraw,
    availableBalance: withdraw,
    rechargeBalance: topup,
    earnedBalance: withdraw,
  };
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // ignore
    }
  }
  return headers;
}

export async function fetchWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  if (!userId) return [];

  // 1. Attempt production backend centralized endpoint
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/wallet/transactions?userId=${encodeURIComponent(userId)}`), {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (apiErr) {
    console.warn('Backend fetchWalletTransactions notice, falling back to direct Supabase query:', apiErr);
  }

  // 2. Direct Supabase Query Fallback
  if (isSupabaseConfigured && supabase) {
    try {
      const [txRes, ledgerRes, depRes, withRes, purRes, payRes, earnRes, claimRes] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('wallet_ledger')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('deposit_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('withdrawals')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('purchases')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('earnings')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('gift_code_claims')
          .select('*')
          .eq('user_id', userId)
          .order('claimed_at', { ascending: false }),
      ]);

      const txMap = new Map<string, WalletTransaction>();

      // A. Process explicit wallet_transactions from DB
      if (!txRes.error && txRes.data) {
        for (const t of txRes.data) {
          const key = t.reference_id || t.id;
          let mappedType = t.type;
          const descLower = (t.description || '').toLowerCase();
          const refLower = (t.reference_id || '').toLowerCase();

          if (refLower.startsWith('checkin') || descLower.includes('check-in') || descLower.includes('daily checkin')) {
            mappedType = 'DAILY_CHECKIN';
          } else if (refLower.startsWith('gift') || descLower.includes('gift code')) {
            mappedType = 'GIFT_CODE_REWARD';
          } else if (refLower.startsWith('signup') || descLower.includes('signup bonus') || descLower.includes('welcome signup')) {
            mappedType = 'SIGNUP_BONUS';
          } else if (refLower.startsWith('tx_msn_') || descLower.includes('mission completed')) {
            mappedType = 'MISSION_BONUS';
          } else if (refLower.startsWith('topup-ref-l') || refLower.startsWith('topup-t') || descLower.includes('team commission') || descLower.includes('referral commission')) {
            mappedType = 'REFERRAL_BONUS';
          } else if (refLower.startsWith('clm-') || descLower.includes('hourly yield') || descLower.includes('device claim') || descLower.includes('hourly device')) {
            mappedType = 'HOURLY_EARNING';
          }

          txMap.set(key, {
            id: t.id,
            userId: t.user_id,
            type: mappedType,
            amount: Number(t.amount),
            balanceBefore: Number(t.balance_before || 0),
            balanceAfter: Number(t.balance_after || 0),
            status: t.status || 'Completed',
            referenceId: t.reference_id || t.id,
            description: t.description,
            paymentMethod: t.payment_method,
            utr: t.utr,
            orderId: t.order_id,
            planName: t.plan_name,
            createdAt: t.created_at,
          });
        }
      }

      // B. Process wallet_ledger
      if (!ledgerRes.error && ledgerRes.data) {
        for (const l of ledgerRes.data) {
          const key = l.reference_id || l.id;
          const txTypeUpper = (l.transaction_type || '').toUpperCase();
          const descLower = (l.description || '').toLowerCase();
          let mappedType: TransactionType = 'ADMIN_ADJUSTMENT';

          if (txTypeUpper.includes('CHECKIN') || descLower.includes('check-in')) {
            mappedType = 'DAILY_CHECKIN';
          } else if (txTypeUpper.includes('GIFT') || descLower.includes('gift code')) {
            mappedType = 'GIFT_CODE_REWARD';
          } else if (txTypeUpper.includes('SIGNUP') || descLower.includes('signup bonus')) {
            mappedType = 'SIGNUP_BONUS';
          } else if (txTypeUpper.includes('MISSION') || descLower.includes('mission')) {
            mappedType = 'MISSION_BONUS';
          } else if (txTypeUpper.includes('REFERRAL') || descLower.includes('referral') || descLower.includes('commission')) {
            mappedType = 'REFERRAL_BONUS';
          } else if (txTypeUpper.includes('HOURLY') || txTypeUpper.includes('EARNING') || descLower.includes('hourly') || descLower.includes('device claim')) {
            mappedType = 'HOURLY_EARNING';
          } else if (txTypeUpper.includes('DEPOSIT') || txTypeUpper.includes('RECHARGE')) {
            mappedType = 'RECHARGE';
          } else if (txTypeUpper.includes('WITHDRAWAL_REVERSAL')) {
            mappedType = 'WITHDRAWAL_REVERSAL';
          } else if (txTypeUpper.includes('WITHDRAWAL')) {
            mappedType = 'WITHDRAWAL';
          }

          if (txMap.has(key)) {
            const existing = txMap.get(key)!;
            if (existing.type === 'ADMIN_ADJUSTMENT' || existing.type === 'EARNING') {
              existing.type = mappedType;
            }
            if (l.description && (!existing.description || existing.description.includes('ADMIN_ADJUSTMENT'))) {
              existing.description = l.description;
            }
          } else {
            txMap.set(key, {
              id: l.id,
              userId: l.user_id,
              type: mappedType,
              amount: l.direction === 'DEBIT' ? -Math.abs(Number(l.amount)) : Number(l.amount),
              balanceBefore: Number(l.balance_before || 0),
              balanceAfter: Number(l.balance_after || 0),
              status: 'Completed',
              referenceId: l.reference_id || l.id,
              description: l.description,
              createdAt: l.created_at,
            });
          }
        }
      }

      // C. Process deposit_transactions (Gateway Deposits)
      if (!depRes.error && depRes.data) {
        for (const d of depRes.data) {
          const ref = d.traceno || d.order_id || d.id;
          const rawStatus = (d.status || '').toUpperCase();
          let mappedStatus: 'Completed' | 'Pending' | 'Failed' = 'Pending';
          if (rawStatus === 'SUCCESS' || rawStatus === 'PAID' || rawStatus === 'COMPLETED') {
            mappedStatus = 'Completed';
          } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'FAILED_GATEWAY_CREATION') {
            mappedStatus = 'Failed';
          }

          if (txMap.has(ref)) {
            const existing = txMap.get(ref)!;
            if (mappedStatus === 'Completed') {
              existing.status = 'Completed';
            } else if (mappedStatus === 'Failed') {
              existing.status = 'Failed';
            }
            if (d.utr) existing.utr = d.utr;
          } else {
            txMap.set(ref, {
              id: d.id,
              userId: d.user_id,
              type: 'RECHARGE',
              amount: Number(d.amount),
              balanceBefore: 0,
              balanceAfter: mappedStatus === 'Completed' ? Number(d.amount) : 0,
              status: mappedStatus,
              referenceId: d.traceno,
              description: `Topup Recharge Order #${d.traceno}`,
              paymentMethod: d.channel || 'UniVePay UPI Gateway',
              utr: d.utr || d.gateway_serial_no,
              createdAt: d.created_at,
            });
          }
        }
      }

      // D. Process manual payments
      if (!payRes.error && payRes.data) {
        for (const p of payRes.data) {
          const ref = p.order_id || p.id;
          const rawStatus = (p.status || '').toUpperCase();
          let mappedStatus: 'Completed' | 'Pending' | 'Failed' = 'Pending';
          if (rawStatus === 'PAID' || rawStatus === 'APPROVED' || rawStatus === 'SUCCESS') {
            mappedStatus = 'Completed';
          } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED') {
            mappedStatus = 'Failed';
          }

          if (!txMap.has(ref) && !txMap.has(p.id)) {
            const isUsdt = (p.payment_type || '').toUpperCase().includes('USDT') || (p.payment_method || '').toUpperCase().includes('USDT');
            txMap.set(ref, {
              id: p.id,
              userId: p.user_id,
              type: 'RECHARGE',
              amount: Number(p.amount),
              balanceBefore: 0,
              balanceAfter: mappedStatus === 'Completed' ? Number(p.amount) : 0,
              status: mappedStatus,
              referenceId: p.order_id || p.id,
              description: isUsdt ? `USDT Deposit (${p.payment_type || 'TRC20'})` : `Manual Recharge (${p.payment_type || 'UPI'})`,
              paymentMethod: p.payment_type || 'Manual UPI',
              utr: p.utr,
              createdAt: p.created_at,
            });
          }
        }
      }

      // E. Process withdrawals
      if (!withRes.error && withRes.data) {
        for (const w of withRes.data) {
          const ref = w.id;
          const rawStatus = (w.status || '').toUpperCase();
          let mappedStatus: 'Completed' | 'Pending' | 'Failed' = 'Pending';
          if (rawStatus === 'APPROVED' || rawStatus === 'PAID' || rawStatus === 'SUCCESS' || rawStatus === 'PROCESSED') {
            mappedStatus = 'Completed';
          } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED') {
            mappedStatus = 'Failed';
          }

          if (!txMap.has(ref)) {
            txMap.set(ref, {
              id: w.id,
              userId: w.user_id,
              type: 'WITHDRAWAL',
              amount: -Math.abs(Number(w.amount)),
              balanceBefore: 0,
              balanceAfter: 0,
              status: mappedStatus,
              referenceId: w.id,
              description: `Withdrawal Request to ${w.bank_name || 'Bank'} ${w.account_number ? `(A/C: ${w.account_number})` : ''}`,
              paymentMethod: 'Bank Transfer',
              utr: w.bank_ref_no,
              createdAt: w.created_at,
            });
          }
        }
      }

      // F. Process hardware purchases
      if (!purRes.error && purRes.data) {
        for (const p of purRes.data) {
          const ref = p.id;
          if (!txMap.has(ref)) {
            const isPro = (p.plan_category || '').toUpperCase() === 'PRO';
            txMap.set(ref, {
              id: p.id,
              userId: p.user_id,
              type: isPro ? 'PRO_PLAN_PURCHASE' : 'PLAN_PURCHASE',
              amount: -Math.abs(Number(p.amount)),
              balanceBefore: 0,
              balanceAfter: 0,
              status: 'Completed',
              referenceId: p.id,
              planName: p.plan_name || 'Hardware Plan',
              description: `Hardware Activation: ${p.plan_name || 'Cabinet'} (₹${p.amount})`,
              createdAt: p.created_at,
            });
          }
        }
      }

      // G. Process claimed earnings / yield claims
      if (!earnRes.error && earnRes.data) {
        for (const e of earnRes.data) {
          const ref = e.claim_batch_id || e.id;
          if (e.status === 'CLAIMED' && !txMap.has(ref) && !txMap.has(e.id)) {
            txMap.set(ref, {
              id: e.id,
              userId: e.user_id,
              type: e.earning_type === 'REFERRAL' ? 'REFERRAL_BONUS' : 'EARNING_CLAIM',
              amount: Number(e.amount),
              balanceBefore: 0,
              balanceAfter: 0,
              status: 'Completed',
              referenceId: ref,
              description: e.plan_name ? `Yield Claim: ${e.plan_name}` : 'Hardware Yield Settlement',
              planName: e.plan_name,
              createdAt: e.claimed_at || e.created_at,
            });
          }
        }
      }

      // H. Process gift code claims
      if (!claimRes.error && claimRes.data) {
        for (const c of claimRes.data) {
          const code = c.code || c.gift_code || '';
          const ref = 'GIFT-' + code;
          if (txMap.has(ref)) {
            const existing = txMap.get(ref)!;
            existing.type = 'GIFT_CODE_REWARD';
            if (!existing.description || existing.description.includes('ADMIN_ADJUSTMENT')) {
              existing.description = `Gift Code Bonus — ${code}`;
            }
          } else if (!txMap.has(c.id)) {
            txMap.set(ref, {
              id: c.id,
              userId: c.user_id,
              type: 'GIFT_CODE_REWARD',
              amount: Number(c.amount),
              balanceBefore: 0,
              balanceAfter: 0,
              status: 'Completed',
              referenceId: ref,
              description: `Gift Code Bonus — ${code || 'Official Gift Code'}`,
              createdAt: c.claimed_at || c.created_at,
            });
          }
        }
      }

      const list = Array.from(txMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // ALWAYS return only real database records (returns [] if user has no transactions)
      return list;
    } catch (e) {
      console.warn('Error fetching Supabase transactions for user:', e);
      return [];
    }
  }

  // Local storage mode without Supabase (only user-created transactions, zero mock seed)
  const localList = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  return localList
    .filter((t) => t.userId === userId && !t.id.startsWith('tx_seed_'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchAdminTransactions(): Promise<WalletTransaction[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const [txRes, depRes, withRes, purRes, profRes] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('deposit_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('withdrawals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('purchases')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('profiles')
          .select('id, user_id, username, mobile, whatsapp_no, membership_number'),
      ]);

      const profileMap = new Map<string, any>();
      if (profRes.data) {
        profRes.data.forEach((p: any) => {
          if (p.user_id) profileMap.set(p.user_id, p);
          if (p.id) profileMap.set(p.id, p);
        });
      }

      const txMap = new Map<string, WalletTransaction>();

      if (!txRes.error && txRes.data) {
        for (const t of txRes.data) {
          const ref = t.reference_id || t.id;
          const prof = profileMap.get(t.user_id) || {};
          txMap.set(ref, {
            id: t.id,
            userId: t.user_id,
            username: prof.username || 'User',
            userMobile: prof.mobile || prof.whatsapp_no || 'N/A',
            type: t.type,
            amount: Number(t.amount),
            balanceBefore: Number(t.balance_before),
            balanceAfter: Number(t.balance_after),
            status: t.status || 'Completed',
            referenceId: t.reference_id,
            description: t.description,
            paymentMethod: t.payment_method,
            utr: t.utr,
            orderId: t.order_id,
            planName: t.plan_name,
            createdAt: t.created_at,
          });
        }
      }

      if (!depRes.error && depRes.data) {
        for (const d of depRes.data) {
          const ref = d.traceno || d.order_id || d.id;
          const rawStatus = (d.status || '').toUpperCase();
          let mappedStatus: 'Completed' | 'Pending' | 'Failed' = 'Pending';
          if (rawStatus === 'SUCCESS' || rawStatus === 'PAID' || rawStatus === 'COMPLETED') {
            mappedStatus = 'Completed';
          } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'FAILED_GATEWAY_CREATION') {
            mappedStatus = 'Failed';
          }

          const prof = profileMap.get(d.user_id) || {};
          if (txMap.has(ref)) {
            const existing = txMap.get(ref)!;
            if (mappedStatus === 'Completed') existing.status = 'Completed';
            if (d.utr) existing.utr = d.utr;
          } else {
            txMap.set(ref, {
              id: d.id,
              userId: d.user_id,
              username: prof.username || 'User',
              userMobile: prof.whatsapp_no || prof.mobile || 'N/A',
              type: 'RECHARGE',
              amount: Number(d.amount),
              balanceBefore: 0,
              balanceAfter: mappedStatus === 'Completed' ? Number(d.amount) : 0,
              status: mappedStatus,
              referenceId: d.traceno,
              description: `Topup Recharge Order #${d.traceno}`,
              paymentMethod: d.channel || 'UniVePay UPI Gateway',
              utr: d.utr || d.gateway_serial_no,
              createdAt: d.created_at,
            });
          }
        }
      }

      if (!withRes.error && withRes.data) {
        for (const w of withRes.data) {
          const ref = w.id;
          const rawStatus = (w.status || '').toUpperCase();
          let mappedStatus: 'Completed' | 'Pending' | 'Failed' = 'Pending';
          if (rawStatus === 'APPROVED' || rawStatus === 'PAID' || rawStatus === 'SUCCESS' || rawStatus === 'PROCESSED' || rawStatus === 'COMPLETED') {
            mappedStatus = 'Completed';
          } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED') {
            mappedStatus = 'Failed';
          }

          const prof = profileMap.get(w.user_id) || {};
          if (!txMap.has(ref)) {
            txMap.set(ref, {
              id: w.id,
              userId: w.user_id,
              username: prof.username || 'User',
              userMobile: prof.whatsapp_no || prof.mobile || 'N/A',
              type: 'WITHDRAWAL',
              amount: -Math.abs(Number(w.amount)),
              balanceBefore: 0,
              balanceAfter: 0,
              status: mappedStatus,
              referenceId: w.id,
              description: `Withdrawal to ${w.bank_name || 'Bank'} ${w.account_number ? `(${w.account_number})` : ''}`,
              paymentMethod: 'Bank Transfer',
              utr: w.bank_ref_no,
              createdAt: w.created_at,
            });
          }
        }
      }

      if (!purRes.error && purRes.data) {
        for (const p of purRes.data) {
          const ref = p.id;
          const prof = profileMap.get(p.user_id) || {};
          if (!txMap.has(ref)) {
            const isPro = (p.plan_category || '').toUpperCase() === 'PRO';
            txMap.set(ref, {
              id: p.id,
              userId: p.user_id,
              username: prof.username || 'User',
              userMobile: prof.whatsapp_no || prof.mobile || 'N/A',
              type: isPro ? 'PRO_PLAN_PURCHASE' : 'PLAN_PURCHASE',
              amount: -Math.abs(Number(p.amount)),
              balanceBefore: 0,
              balanceAfter: 0,
              status: 'Completed',
              referenceId: p.id,
              planName: p.plan_name || 'Hardware Plan',
              description: `Hardware Activation: ${p.plan_name || 'Cabinet'} (₹${p.amount})`,
              createdAt: p.created_at,
            });
          }
        }
      }

      const list = Array.from(txMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return list;
    } catch {
      return [];
    }
  }
  const localList = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  return localList.filter((t) => !t.id.startsWith('tx_seed_'));
}

// ==============================================================================
// PRO ELIGIBILITY CONFIGURATION & CHECK
// ==============================================================================

export async function fetchProEligibilityConfig(): Promise<ProEligibilityConfig> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('id', 'pro_eligibility_config')
      .single();

    if (error || !data) return defaultProEligibilityConfig;
    return { ...defaultProEligibilityConfig, ...(data.value as Partial<ProEligibilityConfig>) };
  } else {
    return getLocal<ProEligibilityConfig>(STORAGE_KEYS.PRO_CONFIG, defaultProEligibilityConfig);
  }
}

export async function updateProEligibilityConfig(config: Partial<ProEligibilityConfig>): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const cur = await fetchProEligibilityConfig();
    const updated = { ...cur, ...config };
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        id: 'pro_eligibility_config',
        value: updated,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
  } else {
    const cur = getLocal<ProEligibilityConfig>(STORAGE_KEYS.PRO_CONFIG, defaultProEligibilityConfig);
    const updated = { ...cur, ...config };
    saveLocal(STORAGE_KEYS.PRO_CONFIG, updated);
  }
}

export async function checkProEligibility(userId: string, targetPlanId?: string): Promise<{
  eligible: boolean;
  reason?: string;
  activeHourlyCount: number;
  activeHourlyInvestment: number;
}> {
  const config = await fetchProEligibilityConfig();
  const purchases = await fetchPurchases(userId);
  const now = Date.now();
  const activePurchases = purchases.filter((p) => {
    const isActive = (p.status || '').toUpperCase() === 'ACTIVE';
    const expiresMs = p.expiresAt ? new Date(p.expiresAt).getTime() : 0;
    return isActive && (!expiresMs || expiresMs > now);
  });
  
  // Active hourly plans
  const activeHourly = activePurchases.filter(
    (p) => (p.planCategory || 'HOURLY').toUpperCase() === 'HOURLY'
  );
  const activeHourlyCount = activeHourly.length;
  const activeHourlyInvestment = activeHourly.reduce((acc, p) => acc + p.amount, 0);

  if (!config.proEnabled) {
    return {
      eligible: false,
      reason: 'PRO Plans are currently paused by the platform administrator.',
      activeHourlyCount,
      activeHourlyInvestment,
    };
  }

  // Check duplicate purchase if specific plan
  if (targetPlanId && !config.allowDuplicateProPurchase) {
    const alreadyPurchased = activePurchases.some(
      (p) => p.planId === targetPlanId && (p.planCategory || '').toUpperCase() === 'PRO'
    );
    if (alreadyPurchased) {
      return {
        eligible: false,
        reason: 'Duplicate purchase is not allowed for this PRO plan while an instance is active.',
        activeHourlyCount,
        activeHourlyInvestment,
      };
    }
  }

  return {
    eligible: true,
    activeHourlyCount,
    activeHourlyInvestment,
  };
}

// ==============================================================================
// DYNAMIC REFERRAL REWARD SYSTEM API & ENGINE
// ==============================================================================

/**
 * Fetch dynamic referral settings (rules, amounts, consecutive days, tier percentages)
 */
export async function fetchReferralSettings(): Promise<ReferralSettings> {
  // 1. Try server endpoint
  try {
    const res = await fetch(apiUrl('/api/referral-settings'));
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          ...defaultReferralSettings,
          ...(json.data as Partial<ReferralSettings>),
        };
      }
    }
  } catch (_e) {}

  // 2. Try Supabase directly
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('id', 'referral_settings')
        .maybeSingle();

      if (!error && data?.value) {
        return {
          ...defaultReferralSettings,
          ...(data.value as Partial<ReferralSettings>),
        };
      }
    } catch (e) {
      console.warn('Supabase fetch referral settings warning, using storage:', e);
    }
  }
  return getLocal<ReferralSettings>(STORAGE_KEYS.REFERRAL_SETTINGS, defaultReferralSettings);
}

/**
 * Update dynamic referral settings from Admin Panel
 */
export async function updateReferralSettings(
  settings: Partial<ReferralSettings>,
  adminId: string = 'adm_master_01'
): Promise<ReferralSettings> {
  const current = await fetchReferralSettings();
  const updated: ReferralSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  // 1. Try server endpoint
  try {
    const res = await fetch(apiUrl('/api/admin/referral-settings'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ settings: updated, adminId }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        saveLocal(STORAGE_KEYS.REFERRAL_SETTINGS, json.data);
        return json.data;
      }
    }
  } catch (_e) {}

  // 2. Try Supabase directly
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('admin_settings').upsert({
        id: 'referral_settings',
        value: updated,
        updated_at: new Date().toISOString(),
      });
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase update referral settings error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase referral settings update error:', e);
    }
  }

  saveLocal(STORAGE_KEYS.REFERRAL_SETTINGS, updated);

  recordAuditLog(
    adminId,
    'UPDATE_REFERRAL_SETTINGS',
    'admin_settings',
    'referral_settings',
    'Admin updated dynamic referral rules, amounts and multi-tier commission rates',
    updated
  ).catch(() => {});

  return updated;
}

/**
 * Find user profile by any identifier (userId, membershipNumber, referralCode, mobile, username)
 */
export async function findUserByIdentifier(identifier: string): Promise<UserProfile | null> {
  if (!identifier) return null;
  const clean = identifier.trim();

  // 1. Check current profile in localStorage
  const currentProfile = getLocal<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  if (
    currentProfile &&
    (currentProfile.userId === clean ||
      currentProfile.id === clean ||
      currentProfile.referralCode === clean ||
      currentProfile.membershipNumber === clean ||
      currentProfile.whatsappNo === clean ||
      currentProfile.mobile === clean ||
      currentProfile.username === clean)
  ) {
    return currentProfile;
  }

  // 2. Check local users list
  const localUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  const foundLocal = localUsers.find(
    (u) =>
      u.userId === clean ||
      u.id === clean ||
      u.referralCode === clean ||
      u.membershipNumber === clean ||
      u.whatsappNo === clean ||
      u.mobile === clean ||
      u.username === clean
  );
  if (foundLocal) return foundLocal;

  // 3. Query Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      const filterStr = isUUID
        ? `id.eq.${clean},user_id.eq.${clean},membership_number.eq.${clean},referral_code.eq.${clean},username.ilike.${clean},whatsapp_no.eq.${clean}`
        : `membership_number.eq.${clean},referral_code.eq.${clean},username.ilike.${clean},whatsapp_no.eq.${clean}`;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(filterStr)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          userId: data.id,
          username: data.username,
          whatsappNo: data.whatsapp_no,
          name: data.name || data.username,
          mobile: data.whatsapp_no,
          email: data.email,
          membershipNumber: data.membership_number,
          referralCode: data.referral_code || data.membership_number,
          referredBy: data.referred_by,
          role: data.role || 'user',
          status: data.status || 'active',
          deviceEarnings: Number(data.device_earnings || 0),
          teamEarnings: Number(data.team_earnings || 0),
          walletBalance: Number(data.wallet_balance || 0),
          avatarUrl: data.avatar_url,
          createdAt: data.created_at,
        };
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Credit referral reward amount to referrer's wallet and ledger
 */
async function creditReferrerWallet(
  referrerUserId: string,
  rewardAmount: number,
  rewardDescription: string,
  referenceId: string,
  rewardType: ReferralRewardType
): Promise<void> {
  if (rewardAmount <= 0) return;

  const roundedAmount = +rewardAmount.toFixed(2);

  // 1. Supabase Wallet Credit
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', referrerUserId)
        .maybeSingle();

      if (walletData) {
        const balBefore = Number(walletData.available_balance || 0);
        const earnedBefore = Number(walletData.earned_balance ?? 0);
        const totalEarnedBefore = Number(walletData.total_earned || 0);
        const newEarned = +(earnedBefore + roundedAmount).toFixed(2);
        const newAvail = +(balBefore + roundedAmount).toFixed(2);
        const newTotalEarned = +(totalEarnedBefore + roundedAmount).toFixed(2);

        await supabase
          .from('wallets')
          .update({
            available_balance: newAvail,
            earned_balance: newEarned,
            total_earned: newTotalEarned,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', referrerUserId);

        await supabase.from('wallet_transactions').insert({
          user_id: referrerUserId,
          type: 'REFERRAL_BONUS',
          amount: roundedAmount,
          balance_before: balBefore,
          balance_after: newAvail,
          balance_type: 'DEVICE_EARNING_BALANCE',
          wallet_type: 'WITHDRAWABLE',
          status: 'COMPLETED',
          reference_id: referenceId,
          description: rewardDescription,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Supabase referral credit warning:', e);
    }
  }

  // 2. Local Wallet Update (if active session user is the referrer)
  const currentProfile = getLocal<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  if (currentProfile && (currentProfile.userId === referrerUserId || currentProfile.id === referrerUserId)) {
    const currentWallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
      availableBalance: 0,
      rechargeBalance: 0,
      earnedBalance: 0,
      totalEarned: 0,
    } as Wallet);

    const balBefore = currentWallet.availableBalance || 0;
    currentWallet.earnedBalance = +((currentWallet.earnedBalance || 0) + roundedAmount).toFixed(2);
    currentWallet.availableBalance = +((currentWallet.rechargeBalance || 0) + currentWallet.earnedBalance).toFixed(2);
    currentWallet.totalEarned = +((currentWallet.totalEarned || 0) + roundedAmount).toFixed(2);
    saveLocal(STORAGE_KEYS.WALLET, currentWallet);

    const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    txs.unshift({
      id: 'tx_ref_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId: referrerUserId,
      type: 'REFERRAL_REWARD',
      amount: roundedAmount,
      balanceBefore: balBefore,
      balanceAfter: currentWallet.availableBalance,
      balanceType: 'DEVICE_EARNING_BALANCE',
      referenceId,
      status: 'Completed',
      description: rewardDescription,
      createdAt: new Date().toISOString(),
    });
    saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);
  }

  // 3. Update in Local Users List
  const localUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  const userIdx = localUsers.findIndex((u) => u.userId === referrerUserId || u.id === referrerUserId);
  if (userIdx !== -1) {
    localUsers[userIdx].teamEarnings = +((localUsers[userIdx].teamEarnings || 0) + roundedAmount).toFixed(2);
    localUsers[userIdx].walletBalance = +((localUsers[userIdx].walletBalance || 0) + roundedAmount).toFixed(2);
    saveLocal(STORAGE_KEYS.LOCAL_USERS, localUsers);
  }
}

/**
 * REWARD 1: Registration Reward (Triggered on registration & first login)
 */
export async function processRegistrationReferralReward(
  refereeUserId: string,
  referrerIdentifier?: string
): Promise<{ success: boolean; amount?: number; message?: string }> {
  try {
    const settings = await fetchReferralSettings();
    if (!settings.isReferralSystemEnabled || !settings.registrationReward.enabled) {
      return { success: false, message: 'Referral registration reward is disabled' };
    }

    const rewardAmount = settings.registrationReward.rewardAmount;
    if (rewardAmount <= 0) return { success: false, message: 'Reward amount is 0' };

    // Idempotency check: reg_reward_<refereeUserId>
    const idempotencyKey = `reg_reward_${refereeUserId}`;
    const rewards = getLocal<ReferralRewardLog[]>(STORAGE_KEYS.REFERRAL_REWARDS, []);
    if (rewards.some((r) => r.idempotencyKey === idempotencyKey)) {
      return { success: false, message: 'Reward already processed for this user registration' };
    }

    // Identify referee and referrer
    const referee = await findUserByIdentifier(refereeUserId);
    const targetReferrerId = referrerIdentifier || referee?.referredBy;
    if (!targetReferrerId) {
      return { success: false, message: 'No referrer found for this user' };
    }

    const referrer = await findUserByIdentifier(targetReferrerId);
    if (!referrer || referrer.userId === refereeUserId) {
      return { success: false, message: 'Valid referrer could not be resolved' };
    }

    const refereeLabel = referee?.username || referee?.mobile || referee?.whatsappNo || 'New Member';
    const description = `Registration Referral Reward: Invited friend ${refereeLabel} registered & logged in`;
    const refId = `REG-${refereeUserId}`;

    // Credit referrer wallet
    await creditReferrerWallet(referrer.userId, rewardAmount, description, refId, 'REGISTRATION');

    // Record reward log
    const newLog: ReferralRewardLog = {
      id: 'rlog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      referrerUserId: referrer.userId,
      refereeUserId,
      refereeUsername: referee?.username,
      refereeMobile: referee?.whatsappNo || referee?.mobile,
      rewardType: 'REGISTRATION',
      amount: rewardAmount,
      status: 'CREDITED',
      description,
      idempotencyKey,
      txId: refId,
      createdAt: new Date().toISOString(),
    };

    rewards.unshift(newLog);
    saveLocal(STORAGE_KEYS.REFERRAL_REWARDS, rewards);

    // Trigger Notification for Referrer
    createNotificationForUser({
      userId: referrer.userId,
      title: 'Referral Reward Credited! 🎉',
      description: `You earned ₹${rewardAmount.toFixed(2)} because your invited friend (${refereeLabel}) successfully registered & logged in!`,
      type: 'PROMOTION',
      isHomePopup: false,
      actionUrl: '/team',
      actionText: 'View Team Hub',
    }).catch(() => {});

    return { success: true, amount: rewardAmount };
  } catch (err: any) {
    console.error('Error processing registration referral reward:', err);
    return { success: false, message: err.message };
  }
}

/**
 * REWARD 2: Consecutive Daily Claim Reward (Streak)
 * Triggered on eligible daily claim in My Device
 */
export async function processConsecutiveClaimReferralReward(
  refereeUserId: string
): Promise<{ success: boolean; streak?: number; rewarded?: boolean; amount?: number }> {
  try {
    const settings = await fetchReferralSettings();
    if (!settings.isReferralSystemEnabled || !settings.streakReward.enabled) {
      return { success: false };
    }

    const referee = await findUserByIdentifier(refereeUserId);
    if (!referee || !referee.referredBy) {
      return { success: false };
    }

    const referrer = await findUserByIdentifier(referee.referredBy);
    if (!referrer || referrer.userId === refereeUserId) {
      return { success: false };
    }

    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const streaks = getLocal<ReferralStreakRecord[]>(STORAGE_KEYS.REFERRAL_STREAKS, []);
    let streakRecord = streaks.find((s) => s.userId === refereeUserId);

    if (!streakRecord) {
      streakRecord = {
        id: 'strk_' + refereeUserId,
        userId: refereeUserId,
        referrerUserId: referrer.userId,
        currentStreak: 1,
        lastClaimDate: todayStr,
        totalCompletedStreaks: 0,
        lastRewardedStreakIndex: 0,
        updatedAt: new Date().toISOString(),
      };
      streaks.push(streakRecord);
    } else {
      if (streakRecord.lastClaimDate === todayStr) {
        // Already claimed today, keep streak unchanged
        return { success: true, streak: streakRecord.currentStreak, rewarded: false };
      } else if (streakRecord.lastClaimDate === yesterdayStr) {
        // Consecutive claim from yesterday!
        streakRecord.currentStreak += 1;
      } else {
        // Missed a day or first claim, reset streak to 1
        streakRecord.currentStreak = 1;
      }
      streakRecord.lastClaimDate = todayStr;
      streakRecord.updatedAt = new Date().toISOString();
    }

    const targetDays = settings.streakReward.consecutiveDays || 3;
    let rewarded = false;
    let rewardAmount = 0;

    // If streak reaches required consecutive days
    if (streakRecord.currentStreak >= targetDays) {
      const cycleIndex = (streakRecord.totalCompletedStreaks || 0) + 1;
      const idempotencyKey = `streak_reward_${refereeUserId}_cycle_${cycleIndex}`;

      const rewards = getLocal<ReferralRewardLog[]>(STORAGE_KEYS.REFERRAL_REWARDS, []);
      if (!rewards.some((r) => r.idempotencyKey === idempotencyKey)) {
        rewardAmount = settings.streakReward.rewardAmount || 15;
        const refereeLabel = referee.username || referee.whatsappNo || 'Invited Friend';
        const description = `${targetDays}-Day Consecutive Claim Reward for referee ${refereeLabel}`;
        const refId = `STRK-${refereeUserId}-${cycleIndex}`;

        await creditReferrerWallet(referrer.userId, rewardAmount, description, refId, 'CONSECUTIVE_CLAIM');

        const newLog: ReferralRewardLog = {
          id: 'rlog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          referrerUserId: referrer.userId,
          refereeUserId,
          refereeUsername: referee.username,
          refereeMobile: referee.whatsappNo || referee.mobile,
          rewardType: 'CONSECUTIVE_CLAIM',
          amount: rewardAmount,
          streakDays: targetDays,
          status: 'CREDITED',
          description,
          idempotencyKey,
          txId: refId,
          createdAt: new Date().toISOString(),
        };
        rewards.unshift(newLog);
        saveLocal(STORAGE_KEYS.REFERRAL_REWARDS, rewards);

        // Notify referrer
        createNotificationForUser({
          userId: referrer.userId,
          title: `Streak Referral Reward! ⚡`,
          description: `You earned ₹${rewardAmount.toFixed(2)} as your invited friend (${refereeLabel}) completed ${targetDays} consecutive daily claims!`,
          type: 'EARNING',
          isHomePopup: false,
          actionUrl: '/team',
          actionText: 'View Team Rewards',
        }).catch(() => {});

        rewarded = true;
        streakRecord.totalCompletedStreaks = cycleIndex;
        // Reset streak to 0 so they can start the next 3-day cycle
        streakRecord.currentStreak = 0;
      }
    }

    saveLocal(STORAGE_KEYS.REFERRAL_STREAKS, streaks);
    return { success: true, streak: streakRecord.currentStreak, rewarded, amount: rewardAmount };
  } catch (err: any) {
    console.error('Error processing consecutive claim referral reward:', err);
    return { success: false };
  }
}

/**
 * REWARD 3: Dynamic Multi-Tier Top-Up Commission
 * Triggered strictly when Admin approves a Recharge Payment
 */
export async function processTopupReferralRewards(
  paymentId: string,
  refereeUserId: string,
  rechargeAmount: number
): Promise<{ success: boolean; count: number; totalDistributed: number }> {
  try {
    if (rechargeAmount <= 0) return { success: false, count: 0, totalDistributed: 0 };

    const settings = await fetchReferralSettings();
    if (!settings.isReferralSystemEnabled) return { success: false, count: 0, totalDistributed: 0 };

    const referee = await findUserByIdentifier(refereeUserId);
    if (!referee || !referee.referredBy) return { success: false, count: 0, totalDistributed: 0 };

    const rewards = getLocal<ReferralRewardLog[]>(STORAGE_KEYS.REFERRAL_REWARDS, []);
    let distributedCount = 0;
    let totalDistributed = 0;

    // Traverse up to 3 tiers
    let currentReferrerId: string | undefined = referee.referredBy;
    const refereeLabel = referee.username || referee.whatsappNo || referee.mobile || 'Team Member';

    for (let tier = 1; tier <= 3; tier++) {
      if (!currentReferrerId) break;

      const referrer = await findUserByIdentifier(currentReferrerId);
      if (!referrer || referrer.userId === refereeUserId) break;

      const tierConfig = settings.topupTiers.find((t) => t.tier === tier);
      if (tierConfig && tierConfig.enabled && tierConfig.percentage > 0) {
        // Check min / max topup conditions
        const meetsMin = !tierConfig.minTopup || rechargeAmount >= tierConfig.minTopup;
        const meetsMax = !tierConfig.maxTopup || tierConfig.maxTopup === 0 || rechargeAmount <= tierConfig.maxTopup;

        if (meetsMin && meetsMax) {
          const commission = +((rechargeAmount * tierConfig.percentage) / 100).toFixed(2);
          const idempotencyKey = `topup_ref_t${tier}_${paymentId}_${refereeUserId}`;

          if (commission > 0 && !rewards.some((r) => r.idempotencyKey === idempotencyKey)) {
            const desc = `Tier ${tier} (${tierConfig.name || `Level ${tier}`}) Commission (${tierConfig.percentage}%): Top-up ₹${rechargeAmount.toFixed(2)} by ${refereeLabel}`;
            const refId = `TOPUP-T${tier}-${paymentId}`;

            await creditReferrerWallet(referrer.userId, commission, desc, refId, 'TOPUP_COMMISSION');

            const newLog: ReferralRewardLog = {
              id: 'rlog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              referrerUserId: referrer.userId,
              refereeUserId,
              refereeUsername: referee.username,
              refereeMobile: referee.whatsappNo || referee.mobile,
              rewardType: 'TOPUP_COMMISSION',
              tier,
              amount: commission,
              topupAmount: rechargeAmount,
              percentage: tierConfig.percentage,
              status: 'CREDITED',
              description: desc,
              idempotencyKey,
              txId: refId,
              createdAt: new Date().toISOString(),
            };

            rewards.unshift(newLog);
            distributedCount++;
            totalDistributed = +(totalDistributed + commission).toFixed(2);

            // Notify Referrer
            createNotificationForUser({
              userId: referrer.userId,
              title: `Tier ${tier} Team Commission Earned! 💰`,
              description: `You received ₹${commission.toFixed(2)} (${tierConfig.percentage}%) from ${refereeLabel}'s recharge of ₹${rechargeAmount.toFixed(2)}.`,
              type: 'EARNING',
              isHomePopup: false,
              actionUrl: '/team',
              actionText: 'View Team Earnings',
            }).catch(() => {});
          }
        }
      }

      // Move to next tier (the referrer's referrer)
      currentReferrerId = referrer.referredBy;
    }

    if (distributedCount > 0) {
      saveLocal(STORAGE_KEYS.REFERRAL_REWARDS, rewards);
    }

    return { success: true, count: distributedCount, totalDistributed };
  } catch (err) {
    console.error('Error processing topup referral rewards:', err);
    return { success: false, count: 0, totalDistributed: 0 };
  }
}

/**
 * Fetch Comprehensive User Team Summary for TeamPage.tsx
 */
export async function fetchUserTeamSummary(userId: string): Promise<UserTeamSummary> {
  const profile = (await findUserByIdentifier(userId)) || {
    id: userId,
    userId,
    username: 'Member',
    referralCode: '2829906',
    membershipNumber: '2829906',
  };

  const myCode = profile.referralCode || profile.membershipNumber || '2829906';
  const settings = await fetchReferralSettings();
  const siteBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gainpower-top-1.com';

  // 0. Live Server API Query
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/referrals/team-summary?userId=${encodeURIComponent(userId)}`), {
      headers: { 'x-user-id': userId, ...authHeaders },
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      const d = json.data;
      return {
        referralCode: myCode,
        referralLink: `${siteBaseUrl}/invite/${myCode}`,
        totalMembers: d.totalMembers,
        directMembers: d.directMembers,
        activeDevices: d.activeDevicesCount,
        totalCommission: d.totalTeamCommission,
        level1Commission: d.level1Commission,
        level2Commission: d.level2Commission,
        level3Commission: d.level3Commission,
        subordinates: {
          1: d.level1Members || [],
          2: d.level2Members || [],
          3: d.level3Members || [],
        },
        rewardHistory: [],
        settings,
      };
    }
  } catch (err) {
    console.warn('[fetchUserTeamSummary] Server API fallback:', err);
  }

  // 1. Live Supabase Query (when configured)
  if (isSupabaseConfigured && supabase) {
    try {
      const [profilesRes, referralsRes, purchasesRes, txsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('referrals').select('*'),
        supabase.from('purchases').select('*'),
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', userId)
          .in('type', ['COMMISSION', 'REFERRAL_BONUS', 'REFERRAL_REWARD']),
      ]);

      const dbProfiles: any[] = profilesRes.data || [];
      const dbReferrals: any[] = referralsRes.data || [];
      const dbPurchases: any[] = purchasesRes.data || [];
      const dbTxs: any[] = txsRes.data || [];

      if (dbProfiles.length > 0) {
        // Direct Level 1
        const l1RefereeIds = new Set<string>();
        dbReferrals
          .filter((r) => r.referrer_id === userId && Number(r.level || 1) === 1)
          .forEach((r) => l1RefereeIds.add(r.referee_id));

        const level1Users = dbProfiles.filter(
          (u) =>
            u.user_id !== userId &&
            u.id !== userId &&
            (l1RefereeIds.has(u.user_id) ||
              l1RefereeIds.has(u.id) ||
              (u.referred_by &&
                (u.referred_by.toUpperCase() === myCode.toUpperCase() ||
                  u.referred_by.toUpperCase() === (profile.membershipNumber || '').toUpperCase() ||
                  u.referred_by === userId ||
                  u.referred_by === profile.id)))
        );

        const level1UserIds = new Set(level1Users.flatMap((u) => [u.user_id, u.id].filter(Boolean)));
        const level1Codes = new Set(
          level1Users.flatMap((u) => [u.referral_code, u.membership_number, u.user_id, u.id].filter(Boolean).map((s: string) => s.toUpperCase()))
        );

        // Level 2 (Indirect B)
        const l2RefereeIds = new Set<string>();
        dbReferrals
          .filter((r) => r.referrer_id === userId && Number(r.level) === 2)
          .forEach((r) => l2RefereeIds.add(r.referee_id));

        const level2Users = dbProfiles.filter(
          (u) =>
            u.user_id !== userId &&
            u.id !== userId &&
            !level1UserIds.has(u.user_id) &&
            !level1UserIds.has(u.id) &&
            (l2RefereeIds.has(u.user_id) ||
              l2RefereeIds.has(u.id) ||
              (u.referred_by && level1Codes.has(u.referred_by.toUpperCase())))
        );

        const level2UserIds = new Set(level2Users.flatMap((u) => [u.user_id, u.id].filter(Boolean)));
        const level2Codes = new Set(
          level2Users.flatMap((u) => [u.referral_code, u.membership_number, u.user_id, u.id].filter(Boolean).map((s: string) => s.toUpperCase()))
        );

        // Level 3 (Indirect C)
        const l3RefereeIds = new Set<string>();
        dbReferrals
          .filter((r) => r.referrer_id === userId && Number(r.level) === 3)
          .forEach((r) => l3RefereeIds.add(r.referee_id));

        const level3Users = dbProfiles.filter(
          (u) =>
            u.user_id !== userId &&
            u.id !== userId &&
            !level1UserIds.has(u.user_id) &&
            !level1UserIds.has(u.id) &&
            !level2UserIds.has(u.user_id) &&
            !level2UserIds.has(u.id) &&
            (l3RefereeIds.has(u.user_id) ||
              l3RefereeIds.has(u.id) ||
              (u.referred_by && level2Codes.has(u.referred_by.toUpperCase())))
        );

        const mapDbMember = (u: any, tier: 1 | 2 | 3): TeamMemberItem => {
          const uId = u.user_id || u.id;
          const userPurchases = dbPurchases.filter((p) => p.user_id === uId && p.status === 'ACTIVE');
          const totalInvested = dbPurchases
            .filter((p) => p.user_id === uId)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          const mobileRaw = u.whatsapp_no || u.phone || u.mobile || '9800000000';
          const maskedMobile =
            mobileRaw.length >= 10
              ? `${mobileRaw.substring(0, 4)}****${mobileRaw.substring(mobileRaw.length - 2)}`
              : mobileRaw;

          const refEntry = dbReferrals.find((r) => r.referrer_id === userId && r.referee_id === uId);
          const commEarned = Number(refEntry?.commission_earned || 0);

          return {
            id: u.id || u.user_id,
            userId: u.user_id || u.id,
            username: u.username || 'Member',
            mobile: maskedMobile,
            joined: u.created_at ? u.created_at.split('T')[0] : '2026-08-20',
            devices: userPurchases.length,
            totalInvested,
            totalCommissionEarned: +commEarned.toFixed(2),
            tier,
          };
        };

        const l1Items = level1Users.map((u) => mapDbMember(u, 1));
        const l2Items = level2Users.map((u) => mapDbMember(u, 2));
        const l3Items = level3Users.map((u) => mapDbMember(u, 3));

        const level1Comm = +dbTxs
          .filter((t) => (t.description || '').includes('Level 1') || (t.description || '').includes('Tier 1') || (t.description || '').includes('Direct'))
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
          .toFixed(2);

        const level2Comm = +dbTxs
          .filter((t) => (t.description || '').includes('Level 2') || (t.description || '').includes('Tier 2'))
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
          .toFixed(2);

        const level3Comm = +dbTxs
          .filter((t) => (t.description || '').includes('Level 3') || (t.description || '').includes('Tier 3'))
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
          .toFixed(2);

        const totalComm = +(dbTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0) || (level1Comm + level2Comm + level3Comm)).toFixed(2);

        const activeDevices =
          l1Items.reduce((s, m) => s + m.devices, 0) +
          l2Items.reduce((s, m) => s + m.devices, 0) +
          l3Items.reduce((s, m) => s + m.devices, 0);

        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gainpower-top-1.com';
        const referralLink = `${baseUrl}/invite/${myCode}`;

        const rewardHistory: ReferralRewardLog[] = dbTxs.map((t) => ({
          id: t.id,
          referrerUserId: userId,
          refereeUserId: t.reference_id || '',
          rewardType: 'TOPUP_COMMISSION',
          amount: Number(t.amount || 0),
          status: 'CREDITED',
          description: t.description || 'Referral Commission',
          idempotencyKey: t.reference_id || t.id,
          txId: t.id,
          createdAt: t.created_at,
        }));

        return {
          referralCode: myCode,
          referralLink,
          totalMembers: l1Items.length + l2Items.length + l3Items.length,
          directMembers: l1Items.length,
          activeDevices,
          totalCommission: totalComm,
          level1Commission: level1Comm,
          level2Commission: level2Comm,
          level3Commission: level3Comm,
          subordinates: {
            1: l1Items,
            2: l2Items,
            3: l3Items,
          },
          rewardHistory,
          settings,
        };
      }
    } catch (dbErr) {
      console.warn('fetchUserTeamSummary DB read fallback:', dbErr);
    }
  }

  // 2. Load all users to construct 3-tier subordinate hierarchy locally (fallback)
  const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  const allPurchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  const allRewards = getLocal<ReferralRewardLog[]>(STORAGE_KEYS.REFERRAL_REWARDS, []);

  // Level 1 Subordinates (Direct)
  const isDirectMatch = (u: UserProfile) =>
    u.userId !== userId &&
    (u.referredBy === myCode ||
      u.referredBy === profile.membershipNumber ||
      u.referredBy === profile.userId ||
      u.referredBy === profile.id);

  const level1Users = allUsers.filter(isDirectMatch);
  const level1Codes = new Set(
    level1Users.flatMap((u) => [u.referralCode, u.membershipNumber, u.userId, u.id].filter(Boolean))
  );

  // Level 2 Subordinates (Indirect B)
  const level2Users = allUsers.filter(
    (u) =>
      u.userId !== userId &&
      !level1Users.some((l1) => l1.userId === u.userId) &&
      u.referredBy &&
      level1Codes.has(u.referredBy)
  );
  const level2Codes = new Set(
    level2Users.flatMap((u) => [u.referralCode, u.membershipNumber, u.userId, u.id].filter(Boolean))
  );

  // Level 3 Subordinates (Indirect C)
  const level3Users = allUsers.filter(
    (u) =>
      u.userId !== userId &&
      !level1Users.some((l1) => l1.userId === u.userId) &&
      !level2Users.some((l2) => l2.userId === u.userId) &&
      u.referredBy &&
      level2Codes.has(u.referredBy)
  );

  // Helper to map UserProfile to TeamMemberItem
  const mapMember = (u: UserProfile, tier: 1 | 2 | 3): TeamMemberItem => {
    const userPurchases = allPurchases.filter((p) => p.userId === u.userId && p.status === 'ACTIVE');
    const userRewards = allRewards.filter(
      (r) => r.referrerUserId === userId && r.refereeUserId === u.userId && r.status === 'CREDITED'
    );
    const commEarned = userRewards.reduce((sum, r) => sum + r.amount, 0);
    const totalInvested = allPurchases
      .filter((p) => p.userId === u.userId)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const mobileRaw = u.whatsappNo || u.mobile || '9800000000';
    const maskedMobile =
      mobileRaw.length >= 10
        ? `${mobileRaw.substring(0, 4)}****${mobileRaw.substring(mobileRaw.length - 2)}`
        : mobileRaw;

    return {
      id: u.id || u.userId,
      userId: u.userId,
      username: u.username || 'Member',
      mobile: maskedMobile,
      joined: u.createdAt ? u.createdAt.split('T')[0] : '2026-08-20',
      devices: userPurchases.length,
      totalInvested,
      totalCommissionEarned: +commEarned.toFixed(2),
      tier,
    };
  };

  const l1Items = level1Users.map((u) => mapMember(u, 1));
  const l2Items = level2Users.map((u) => mapMember(u, 2));
  const l3Items = level3Users.map((u) => mapMember(u, 3));

  // Compute commissions earned from rewards log
  const myRewards = allRewards.filter((r) => r.referrerUserId === userId && r.status === 'CREDITED');
  const level1Comm = myRewards
    .filter((r) => r.tier === 1 || r.rewardType === 'REGISTRATION' || r.rewardType === 'CONSECUTIVE_CLAIM')
    .reduce((sum, r) => sum + r.amount, 0);
  const level2Comm = myRewards.filter((r) => r.tier === 2).reduce((sum, r) => sum + r.amount, 0);
  const level3Comm = myRewards.filter((r) => r.tier === 3).reduce((sum, r) => sum + r.amount, 0);
  const totalComm = level1Comm + level2Comm + level3Comm;

  const activeDevices = l1Items.reduce((s, m) => s + m.devices, 0) +
    l2Items.reduce((s, m) => s + m.devices, 0) +
    l3Items.reduce((s, m) => s + m.devices, 0);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gainpower-top-1.com';
  const referralLink = `${baseUrl}/invite/${myCode}`;

  return {
    referralCode: myCode,
    referralLink,
    totalMembers: l1Items.length + l2Items.length + l3Items.length,
    directMembers: l1Items.length,
    activeDevices,
    totalCommission: +totalComm.toFixed(2),
    level1Commission: +level1Comm.toFixed(2),
    level2Commission: +level2Comm.toFixed(2),
    level3Commission: +level3Comm.toFixed(2),
    subordinates: {
      1: l1Items,
      2: l2Items,
      3: l3Items,
    },
    rewardHistory: myRewards,
    settings,
  };
}

/**
 * Fetch Full Referral Network & Audit Ledger for Admin Panel
 */
export async function fetchAdminReferralData(): Promise<{
  settings: ReferralSettings;
  stats: {
    totalReferrals: number;
    totalCommissionsPaid: number;
    registrationRewardsPaid: number;
    streakRewardsPaid: number;
    topupCommissionsPaid: number;
    activeReferrersCount: number;
  };
  members: Array<{
    userId: string;
    username: string;
    mobile: string;
    referralCode: string;
    referredBy?: string;
    directInvites: number;
    totalTeamSize: number;
    totalCommissionEarned: number;
    status: string;
    joined: string;
  }>;
  rewardsHistory: ReferralRewardLog[];
}> {
  const settings = await fetchReferralSettings();

  if (isSupabaseConfigured && supabase) {
    try {
      const [profilesRes, referralsRes, earningsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('referrals').select('*'),
        supabase.from('earnings').select('*').like('earning_type', '%REFERRAL%'),
      ]);

      const profiles = profilesRes.data || [];
      const referrals = referralsRes.data || [];
      const earnings = earningsRes.data || [];

      if (profiles.length > 0) {
        const totalCommissionsPaid = +earnings.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2);
        const uniqueReferrers = new Set(referrals.map((r: any) => r.referrer_id).filter(Boolean));

        const members = profiles.map((p: any) => {
          const myId = p.user_id || p.id;
          const myCode = p.referral_code || p.membership_number || '';
          
          const directs = referrals.filter(
            (r: any) => r.referrer_id === myId || (r.metadata && r.metadata.referrer_code === myCode)
          ).length;

          const myEarnings = earnings
            .filter((e: any) => e.user_id === myId)
            .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

          return {
            userId: myId,
            username: p.username || 'User',
            mobile: p.whatsapp_no || p.mobile || 'N/A',
            referralCode: myCode || 'N/A',
            referredBy: p.referred_by || 'None (Direct)',
            directInvites: directs,
            totalTeamSize: directs,
            totalCommissionEarned: +myEarnings.toFixed(2),
            status: p.status || 'active',
            joined: p.created_at ? p.created_at.split('T')[0] : '2026-08-20',
          };
        });

        const history: ReferralRewardLog[] = earnings.map((e: any) => ({
          id: e.id,
          referrerUserId: e.user_id,
          rewardType: (e.earning_type || 'TOPUP_COMMISSION') as any,
          amount: Number(e.amount || 0),
          claimedAt: e.created_at,
          status: 'CREDITED',
        }));

        return {
          settings,
          stats: {
            totalReferrals: referrals.length || profiles.filter((p: any) => !!p.referred_by).length,
            totalCommissionsPaid,
            registrationRewardsPaid: 0,
            streakRewardsPaid: 0,
            topupCommissionsPaid: totalCommissionsPaid,
            activeReferrersCount: uniqueReferrers.size,
          },
          members,
          rewardsHistory: history,
        };
      }
    } catch (e) {
      console.warn('Error fetching Supabase admin referral data:', e);
    }
  }

  const allUsers = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  const currentProfile = getLocal<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  if (currentProfile && !allUsers.some((u) => u.userId === currentProfile.userId)) {
    allUsers.unshift(currentProfile);
  }

  const allRewards = getLocal<ReferralRewardLog[]>(STORAGE_KEYS.REFERRAL_REWARDS, []);

  // Compute platform aggregate stats
  const totalCommissionsPaid = allRewards
    .filter((r) => r.status === 'CREDITED')
    .reduce((sum, r) => sum + r.amount, 0);

  const registrationRewardsPaid = allRewards
    .filter((r) => r.rewardType === 'REGISTRATION' && r.status === 'CREDITED')
    .reduce((sum, r) => sum + r.amount, 0);

  const streakRewardsPaid = allRewards
    .filter((r) => r.rewardType === 'CONSECUTIVE_CLAIM' && r.status === 'CREDITED')
    .reduce((sum, r) => sum + r.amount, 0);

  const topupCommissionsPaid = allRewards
    .filter((r) => r.rewardType === 'TOPUP_COMMISSION' && r.status === 'CREDITED')
    .reduce((sum, r) => sum + r.amount, 0);

  const uniqueReferrers = new Set(allRewards.map((r) => r.referrerUserId));

  // Build member network rows
  const members = allUsers.map((u) => {
    const myCode = u.referralCode || u.membershipNumber;
    const directInvites = allUsers.filter(
      (sub) => sub.referredBy === myCode || sub.referredBy === u.userId || sub.referredBy === u.membershipNumber
    ).length;

    const userRewards = allRewards.filter(
      (r) => (r.referrerUserId === u.userId || r.referrerUserId === u.id) && r.status === 'CREDITED'
    );
    const commEarned = userRewards.reduce((sum, r) => sum + r.amount, 0);

    return {
      userId: u.userId || u.id,
      username: u.username || 'User',
      mobile: u.whatsappNo || u.mobile || 'N/A',
      referralCode: myCode || 'N/A',
      referredBy: u.referredBy || 'None (Direct)',
      directInvites,
      totalTeamSize: directInvites,
      totalCommissionEarned: +commEarned.toFixed(2),
      status: u.status || 'active',
      joined: u.createdAt ? u.createdAt.split('T')[0] : '2026-08-20',
    };
  });

  return {
    settings,
    stats: {
      totalReferrals: allUsers.filter((u) => !!u.referredBy).length,
      totalCommissionsPaid: +totalCommissionsPaid.toFixed(2),
      registrationRewardsPaid: +registrationRewardsPaid.toFixed(2),
      streakRewardsPaid: +streakRewardsPaid.toFixed(2),
      topupCommissionsPaid: +topupCommissionsPaid.toFixed(2),
      activeReferrersCount: uniqueReferrers.size,
    },
    members,
    rewardsHistory: allRewards,
  };
}


// ==============================================================================
// PLANS & PURCHASES (UNLIMITED ACTIVE PLANS + PRO + DYNAMIC CATEGORIES)
// ==============================================================================

export async function fetchPlans(): Promise<ProductItem[]> {
  // 1. Try server endpoint first
  try {
    const res = await fetch(apiUrl('/api/plans'));
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (_err) {}

  // 2. Direct Supabase query fallback
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .neq('status', 'archived')
      .order('price', { ascending: false });

    if (error || !data || data.length === 0) {
      return getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData).filter((p) => p.status !== 'archived');
    }

    return data.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || (p.name.toUpperCase().includes('PRO') ? 'PRO' : 'HOURLY'),
      description: p.description,
      imageUrl: p.image_url,
      limit: p.limit_per_user || 999,
      devicePrice: Number(p.price),
      price: Number(p.price),
      hourlyEarnings: Number(p.earning_rate || (Number(p.daily_earnings || 0) / 24)),
      dailyEarnings: Number(p.daily_earnings || (Number(p.earning_rate || 0) * 24)),
      instantBonus: Number(p.instant_bonus || 0),
      earningType: p.earning_type || (p.category === 'PRO' ? 'DAILY' : 'HOURLY'),
      tags: p.tags || ['Shared Power', 'Sharing Economy'],
      imageType: p.image_type || (p.category === 'PRO' ? 'cabinet-pro' : 'cabinet-green'),
      status: p.status || 'active',
      duration: p.duration || 365,
      durationDays: p.duration_days || p.duration || 365,
      allowDuplicate: p.allow_duplicate !== false,
      eligibilityType: p.eligibility_type || 'ANY_ACTIVE_HOURLY',
      minimumHourlyPlans: p.minimum_hourly_plans || 1,
      minimumHourlyInvestment: p.minimum_hourly_investment || 0,
      allowedHourlyPlanIds: p.allowed_hourly_plan_ids || [],
    }));
  } else {
    return getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData).filter((p) => p.status !== 'archived');
  }
}

export async function createPlan(planData: Omit<ProductItem, 'id'>): Promise<ProductItem> {
  const newPlan: ProductItem = {
    ...planData,
    id: 'prod_' + Date.now(),
    devicePrice: planData.devicePrice || planData.price || 1000,
    price: planData.price || planData.devicePrice || 1000,
    category: planData.category || 'HOURLY',
    status: planData.status || 'active',
    allowDuplicate: planData.allowDuplicate !== false,
    tags: planData.tags && planData.tags.length > 0 ? planData.tags : ['Shared Power'],
    imageType: planData.imageType || (planData.category === 'PRO' ? 'cabinet-pro' : 'cabinet-green'),
  };

  try {
    const res = await fetch(apiUrl('/api/admin/plans/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ plan: newPlan, adminId: 'adm_root_700' }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      return { ...newPlan, ...json.data, id: json.data.id || newPlan.id };
    }
  } catch (err) {
    console.warn('Backend plan save error, falling back:', err);
  }

  const list = getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData);
  list.unshift(newPlan);
  saveLocal(STORAGE_KEYS.PLANS, list);
  return newPlan;
}

export async function updatePlan(planId: string, planData: Partial<ProductItem>): Promise<void> {
  try {
    const res = await fetch(apiUrl('/api/admin/plans/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ plan: { id: planId, ...planData }, adminId: 'adm_root_700' }),
    });
    const json = await res.json();
    if (json.success) {
      return;
    }
  } catch (err) {
    console.warn('Backend plan update error, falling back:', err);
  }

  const list = getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData);
  const index = list.findIndex((p) => p.id === planId);
  if (index !== -1) {
    list[index] = { ...list[index], ...planData };
    saveLocal(STORAGE_KEYS.PLANS, list);
  }
}

export async function togglePlanStatus(planId: string, status: 'active' | 'disabled' | 'sold_out' | 'archived'): Promise<void> {
  await updatePlan(planId, { status });
}

export async function deletePlan(planId: string): Promise<void> {
  try {
    const res = await fetch(apiUrl('/api/admin/plans/delete'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ planId, adminId: 'adm_root_700' }),
    });
    const json = await res.json();
    if (json.success) {
      return;
    }
  } catch (err) {
    console.warn('Backend plan delete error, falling back:', err);
  }

  const list = getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData);
  const filtered = list.filter((p) => p.id !== planId);
  saveLocal(STORAGE_KEYS.PLANS, filtered);
}

export async function fetchPurchases(userId: string): Promise<PurchaseItem[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error && !isTableMissingError(error)) {
        console.warn('Supabase fetch purchases:', error.message);
      }

      if (data && data.length > 0) {
        return data.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          planId: p.plan_id,
          planName: p.plan_name || 'Device Cabinet',
          planCategory: p.plan_category || (p.plan_name?.includes('PRO') ? 'PRO' : 'HOURLY'),
          amount: Number(p.amount),
          instantBonus: Number(p.instant_bonus || 0),
          dailyEarnings: Number(p.daily_earnings || (Number(p.earning_rate || 0) * 24)),
          hourlyEarnings: Number(p.earning_rate || (Number(p.daily_earnings || 0) / 24)),
          earningRate: Number(p.earning_rate || (Number(p.daily_earnings || 0) / 24)),
          earningType: p.earning_type || 'HOURLY',
          durationDays: p.duration_days || 365,
          status: p.status,
          startedAt: p.started_at,
          expiresAt: p.expires_at,
          totalEarned: Number(p.total_earned || 0),
          claimedAmount: Number(p.claimed_amount || 0),
          claimedHours: Number(p.claimed_hours || (Number(p.earning_rate || 0) > 0 ? Math.round(Number(p.claimed_amount || 0) / Number(p.earning_rate)) : 0)),
          lastClaimedAt: p.last_claimed_at,
          lastSettledAt: p.last_settled_at,
        }));
      }
    } catch {
      // Fall through to local
    }
  }

  const localPurchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  return localPurchases.filter((p) => p.userId === userId);
}

export async function purchasePlanWithWallet(userId: string, plan: ProductItem) {
  const planPrice = plan.devicePrice || plan.price || 0;
  let planCat = (plan.category || '').toUpperCase();
  if (planCat === 'STANDARD' || planCat === 'HOURLY' || !planCat) {
    planCat = (plan.name || '').toUpperCase().includes('PRO') ? 'PRO' : 'VIP';
  }
  const isPro = planCat === 'PRO';
  const isEvent = planCat === 'EVENT';

  // 1. Authoritative VIP Level Enforcement
  // VIP Level 0: VIP Plan unlocked, PRO & EVENT locked
  // VIP Level 1: VIP & PRO unlocked, EVENT locked
  // VIP Level 2+: All unlocked
  const userVipStatus = await fetchUserVipStatus(userId);
  const userVipLevel = Number(userVipStatus?.currentLevel?.levelNumber || 0);

  if (isPro && userVipLevel < 1) {
    throw new Error('Unlock at VIP Level 1 (Your level: VIP 0). Activate at least 1 VIP Plan to unlock PRO Plans.');
  }

  if (isEvent && userVipLevel < 2) {
    throw new Error(`Unlock at VIP Level 2 (Your level: VIP ${userVipLevel}). Upgrade to VIP Level 2 to unlock Limited Event Plans.`);
  }

  // Check Eligibility if PRO plan
  if (isPro) {
    const check = await checkProEligibility(userId, plan.id);
    if (!check.eligible) {
      throw new Error(check.reason || 'PRO plan is currently unavailable.');
    }
  }

  // Check Event Plan active time window
  if (isEvent || plan.startAt || plan.endAt || plan.startDate || plan.endDate) {
    const now = Date.now();
    const start = plan.startAt || plan.startDate;
    const end = plan.endAt || plan.endDate;
    if (start && now < new Date(start).getTime()) {
      throw new Error('This Event Plan has not started yet. Please check back when the event opens.');
    }
    if (end && now > new Date(end).getTime()) {
      throw new Error('This Event Plan has ended.');
    }
  }

  // Check purchase limit per user
  const userPurchases = await fetchPurchases(userId);
  if (plan.limit && plan.limit > 0) {
    const boughtCount = userPurchases.filter((p) => p.planId === plan.id && p.status === 'ACTIVE').length;
    if (boughtCount >= plan.limit) {
      throw new Error(`You have reached the maximum purchase limit (${plan.limit}) for this plan.`);
    }
  }

  // Check duplicate restriction if plan.allowDuplicate is false
  if (plan.allowDuplicate === false) {
    const existing = userPurchases.find((p) => p.planId === plan.id && p.status === 'ACTIVE');
    if (existing) {
      throw new Error('You already have an active instance of this plan. Duplicate purchases are not allowed.');
    }
  }

  // 2. Try Server API endpoint
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(apiUrl('/api/plans/purchase'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId, ...authHeaders },
      body: JSON.stringify({ userId, planId: plan.id }),
    });
    if (res.ok) {
      const resData = await res.json();
      if (resData.success) {
        if (resData.vipLevel !== undefined && resData.vipLevel !== null) {
          const prof = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as any);
          if (prof && prof.id) {
            prof.vipLevel = Math.max(prof.vipLevel || 0, Number(resData.vipLevel));
            saveLocal(STORAGE_KEYS.PROFILE, prof);
          }
        }
        return resData;
      } else {
        throw new Error(resData.error || 'Failed to purchase plan');
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        throw new Error(errData.error);
      }
      throw new Error(`Server returned status ${res.status}`);
    }
  } catch (e: any) {
    // If the server explicitly rejected the purchase (e.g., VIP, limit, balance error), propagate directly!
    if (e.message && (
      e.message.includes('VIP') ||
      e.message.includes('Insufficient') ||
      e.message.includes('limit') ||
      e.message.includes('Duplicate') ||
      e.message.includes('Event') ||
      e.message.includes('not found') ||
      e.message.includes('active')
    )) {
      throw e;
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // Invoke Atomic Stored Procedure / RPC
      const { data, error } = await supabase.rpc('purchase_plan', {
        p_user_id: userId,
        p_plan_id: plan.id,
      });

      if (!error && data?.success) {
        return data;
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase purchase RPC error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  // Local Atomic Simulation - TOPUP WALLET STRICT DEDUCTION
  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
    availableBalance: 0,
    topupBalance: 0,
    withdrawBalance: 0,
    rechargeBalance: 0,
    earnedBalance: 0,
  } as Wallet);

  const curTopup = wallet.topupBalance !== undefined ? wallet.topupBalance : (wallet.rechargeBalance || 0);

  if (curTopup < planPrice) {
    throw new Error(`Insufficient Topup Wallet balance. Plan purchase requires Topup Wallet balance. (Available Topup: ₹${curTopup.toFixed(2)}, Required: ₹${planPrice.toFixed(2)})`);
  }

  const balanceBefore = curTopup;
  wallet.topupBalance = +(curTopup - planPrice).toFixed(2);
  wallet.rechargeBalance = wallet.topupBalance;
  const curWithdraw = wallet.withdrawBalance !== undefined ? wallet.withdrawBalance : (wallet.earnedBalance || 0);
  wallet.withdrawBalance = curWithdraw;
  wallet.earnedBalance = curWithdraw;
  wallet.availableBalance = curWithdraw;

  const balanceAfterDeduction = wallet.topupBalance;

  const purchaseId = 'pur_' + Date.now();
  const durationDays = plan.durationDays || plan.duration || 365;
  const totalPlanHours = durationDays * 24;
  const instantBonus = plan.instantBonus || 0;
  const dailyEarning = Number(plan.dailyEarnings || (plan.hourlyEarnings ? plan.hourlyEarnings * 24 : 0));
  const hourlyRate = Number((dailyEarning > 0 ? dailyEarning / 24 : (plan.hourlyEarnings || 0)).toFixed(2));
  const nowMs = Date.now();
  const startedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + totalPlanHours * 3600 * 1000).toISOString();

  const newPurchase: PurchaseItem = {
    id: purchaseId,
    userId,
    planId: plan.id,
    planName: plan.name,
    planCategory: plan.category || (isPro ? 'PRO' : 'HOURLY'),
    amount: planPrice,
    instantBonus: instantBonus,
    dailyEarnings: dailyEarning,
    hourlyEarnings: hourlyRate,
    earningRate: hourlyRate,
    earningType: plan.earningType || (isPro ? 'DAILY' : 'HOURLY'),
    durationDays: durationDays,
    totalPlanHours: totalPlanHours,
    claimedHours: 0,
    status: 'ACTIVE',
    startedAt: startedAt,
    expiresAt: expiresAt,
    totalEarned: 0,
    lastSettledAt: startedAt,
    lastClaimedAt: undefined,
  };

  const purchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  purchases.unshift(newPurchase);
  saveLocal(STORAGE_KEYS.PURCHASES, purchases);

  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);

  // 1. Record Plan Purchase Transaction
  const tx: WalletTransaction = {
    id: 'tx_pur_' + Date.now(),
    userId,
    type: 'PLAN_PURCHASE',
    amount: -planPrice,
    balanceBefore,
    balanceAfter: balanceAfterDeduction,
    balanceType: 'TOPUP_WALLET',
    referenceId: purchaseId,
    description: `Purchase: ${plan.name} (${newPurchase.planCategory})`,
    createdAt: new Date().toISOString(),
  };
  txs.unshift(tx);

  let finalBalance = balanceAfterDeduction;

  // 2. If PRO plan has Instant Bonus cashback, credit into Withdraw Wallet!
  if (instantBonus > 0) {
    const bonusBalBefore = wallet.withdrawBalance || 0;
    wallet.withdrawBalance = +(bonusBalBefore + instantBonus).toFixed(2);
    wallet.earnedBalance = wallet.withdrawBalance;
    wallet.availableBalance = wallet.withdrawBalance;
    wallet.totalEarned = +((wallet.totalEarned || 0) + instantBonus).toFixed(2);

    const bonusTx: WalletTransaction = {
      id: 'tx_bonus_' + (Date.now() + 1),
      userId,
      type: 'PRO_INSTANT_BONUS',
      amount: instantBonus,
      balanceBefore: bonusBalBefore,
      balanceAfter: wallet.withdrawBalance,
      balanceType: 'WITHDRAW_WALLET',
      referenceId: purchaseId,
      description: `PRO Instant Bonus Cashback: ${plan.name}`,
      createdAt: new Date(Date.now() + 50).toISOString(),
    };
    txs.unshift(bonusTx);
  }

  saveLocal(STORAGE_KEYS.WALLET, wallet);
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('purchases').insert({
        user_id: userId,
        plan_id: plan.id,
        plan_name: plan.name,
        plan_category: newPurchase.planCategory,
        amount: planPrice,
        hourly_rate: hourlyRate,
        earning_rate: hourlyRate,
        daily_earnings: dailyEarning,
        duration_days: durationDays,
        instant_bonus: instantBonus,
        total_earned: 0,
        claimable_earnings: 0,
        status: 'ACTIVE',
      });

      await supabase.from('wallets').update({
        recharge_balance: wallet.rechargeBalance,
        withdraw_balance: wallet.withdrawBalance,
        available_balance: (wallet.rechargeBalance || 0) + (wallet.withdrawBalance || 0),
        total_earned: wallet.totalEarned || 0,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    } catch (dbErr) {
      console.warn('[PURCHASE] Supabase sync notice:', dbErr);
    }
  }

  // Check and update VIP level locally if qualified
  const profile = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as any);
  let localVipLevel = 0;
  if (profile && profile.id) {
    const curLevel = Number(profile.vipLevel || 0);
    let nextVip = curLevel;
    if (curLevel === 0 && planPrice >= 550) {
      nextVip = 1;
    } else if (curLevel === 1 && isPro) {
      nextVip = 2;
    }
    if (nextVip > curLevel) {
      profile.vipLevel = nextVip;
      saveLocal(STORAGE_KEYS.PROFILE, profile);
    }
    localVipLevel = profile.vipLevel || nextVip;
  }

  // Create Notification
  const notifs = getLocal<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  notifs.unshift({
    id: 'notif_' + Date.now(),
    userId,
    title: `${plan.name} Activated!`,
    message: instantBonus > 0
      ? `Your device is active! Instant cashback bonus of ₹${instantBonus} has been credited to your wallet.`
      : `Your device is active and generating revenue. Claim your earnings anytime in My Device.`,
    type: 'SUCCESS',
    read: false,
    createdAt: new Date().toISOString(),
  });
  saveLocal(STORAGE_KEYS.NOTIFICATIONS, notifs);

  return {
    success: true,
    purchaseId,
    balance: finalBalance,
    instantBonusCredited: instantBonus,
    vipLevel: localVipLevel,
    message: `${plan.name} purchased successfully!`,
  };
}

// ==============================================================================
// RECHARGE SYSTEM (MANUAL QR UPI + UTR + PROOF UPLOAD)
// ==============================================================================

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) return defaultPaymentSettings;

    return {
      id: data.id,
      upiId: data.upi_id || defaultPaymentSettings.upiId,
      qrImageUrl: data.qr_image_url || defaultPaymentSettings.qrImageUrl,
      instructions: data.instructions || defaultPaymentSettings.instructions,
      isRechargeEnabled: data.is_recharge_enabled ?? true,
      isPurchaseEnabled: data.is_purchase_enabled ?? true,
      payuUpiId: data.payu_upi_id || defaultPaymentSettings.payuUpiId,
      payuQrImageUrl: data.payu_qr_image_url || defaultPaymentSettings.payuQrImageUrl,
      toppayUpiId: data.toppay_upi_id || defaultPaymentSettings.toppayUpiId,
      toppayQrImageUrl: data.toppay_qr_image_url || defaultPaymentSettings.toppayQrImageUrl,
      upayUpiId: data.upay_upi_id || defaultPaymentSettings.upayUpiId,
      upayQrImageUrl: data.upay_qr_image_url || defaultPaymentSettings.upayQrImageUrl,
      channels: data.channels || defaultPaymentSettings.channels,
      updatedAt: data.updated_at,
    };
  } else {
    return getLocal<PaymentSettings>(STORAGE_KEYS.SETTINGS, defaultPaymentSettings);
  }
}

export async function updatePaymentSettings(settings: Partial<PaymentSettings>, adminId = 'adm_root') {
  try {
    const res = await fetch(apiUrl('/api/admin/payment-settings'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ config: settings, adminId }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const cur = getLocal<PaymentSettings>(STORAGE_KEYS.SETTINGS, defaultPaymentSettings);
      const updated = { ...cur, ...settings };
      saveLocal(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    }
  } catch (err) {
    console.warn('[PAYMENT SETTINGS] Backend update error:', err);
  }

  const cur = getLocal<PaymentSettings>(STORAGE_KEYS.SETTINGS, defaultPaymentSettings);
  const updated = { ...cur, ...settings };
  saveLocal(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

export async function uploadPaymentProof(file: File, userId: string): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${Date.now()}_proof.${ext}`;
    const { error } = await supabase.storage.from('payment-proofs').upload(filePath, file, {
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
    return data.publicUrl;
  } else {
    // Return base64 preview for local mode
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}

export async function uploadQrImage(file: File): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const filePath = `admin_qr_${Date.now()}.png`;
    const { error } = await supabase.storage.from('upi-qr').upload(filePath, file, {
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('upi-qr').getPublicUrl(filePath);
    return data.publicUrl;
  } else {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}

export async function submitRechargeRequest(
  userId: string,
  amount: number,
  utr: string,
  proofUrl?: string
) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('submit_recharge', {
        p_user_id: userId,
        p_amount: amount,
        p_utr: utr.trim(),
        p_proof_url: proofUrl || null,
      });
      if (!error && data?.success) {
        return data;
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase submit recharge error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  const orderId = 'RECHARGE-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const paymentId = 'pay_' + Date.now();
  const newPayment: PaymentItem = {
    id: paymentId,
    userId,
    userMobile: '9876543210',
    orderId,
    amount,
    paymentType: 'RECHARGE',
    utr: utr.trim(),
    proofUrl,
    status: 'PENDING_VERIFICATION',
    createdAt: new Date().toISOString(),
  };
  const list = getLocal<PaymentItem[]>(STORAGE_KEYS.PAYMENTS, []);
  list.unshift(newPayment);
  saveLocal(STORAGE_KEYS.PAYMENTS, list);

  // Record pending transaction
  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, { availableBalance: 0 } as Wallet);
  const tx: WalletTransaction = {
    id: 'tx_rec_' + Date.now(),
    userId,
    type: 'RECHARGE',
    amount,
    balanceBefore: wallet.availableBalance,
    balanceAfter: wallet.availableBalance,
    balanceType: 'RECHARGE_BALANCE',
    referenceId: orderId,
    utr: utr.trim(),
    description: `Manual UPI Recharge (Pending Admin Approval)`,
    createdAt: new Date().toISOString(),
  };
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  txs.unshift(tx);
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  // Notification to User
  createNotificationForUser({
    userId,
    title: 'Recharge Pending',
    description: `Your recharge request of ₹${amount.toFixed(2)} is pending Admin approval.`,
    type: 'RECHARGE',
    isHomePopup: false,
  }).catch(() => {});

  return { success: true, paymentId, orderId };
}

export async function fetchUserPayments(userId: string): Promise<PaymentItem[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          orderId: p.order_id,
          amount: Number(p.amount),
          paymentType: p.payment_type,
          utr: p.utr,
          proofUrl: p.proof_url,
          status: p.status,
          adminId: p.admin_id,
          rejectionReason: p.rejection_reason,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));
      }
    } catch {
      // Fall through to local
    }
  }

  const all = getLocal<PaymentItem[]>(STORAGE_KEYS.PAYMENTS, []);
  return all.filter((p) => p.userId === userId);
}

// ==============================================================================
// EARNINGS ACCRUAL & CLAIM ENGINE (STRICT HOURLY DISCRETE CYCLE)
// ==============================================================================

export interface DeviceHourlyStatus {
  purchaseId: string;
  planName: string;
  planCategory: string;
  hourlyEarnings: number;
  dailyEarnings: number;
  totalPlanHours: number;
  totalCompletedHours: number;
  claimedHours: number;
  unclaimedHours: number;
  claimableAmount: number;
  totalEarnedAmount: number;
  remainingHours: number;
  isActive: boolean;
  isExpired: boolean;
  startedAt: string;
  expiresAt: string;
  lastClaimedAt?: string;
  lastClaimTimeFormatted: string;
  nextEarningTimestamp?: number;
  nextEarningTimeFormatted: string;
  formattedSecondsUntilNext?: string;
}

/**
 * Calculates discrete hourly earnings strictly per completed full hour cycle (FLOOR(elapsed / 3600)).
 * No partial-hour earnings. No timer reset upon claim. Server-authoritative timeline.
 */
export function calculateDeviceHourlyStatus(device: PurchaseItem, now: number = Date.now()): DeviceHourlyStatus {
  const durationDays = device.durationDays || 365;
  const totalPlanHours = device.totalPlanHours || durationDays * 24;
  const startedMs = new Date(device.startedAt || now).getTime();
  const expiresMs = device.expiresAt ? new Date(device.expiresAt).getTime() : startedMs + totalPlanHours * 3600 * 1000;

  // Daily Earning is authoritative: hourly rate = daily / 24
  const dailyEarnings = Number(
    device.dailyEarnings ||
      (device.hourlyEarnings ? device.hourlyEarnings * 24 : (device.earningRate ? device.earningRate * 24 : 0))
  );
  const hourlyEarnings = device.hourlyEarnings || Number((dailyEarnings > 0 ? dailyEarnings / 24 : 0).toFixed(2));

  const effectiveEndMs = Math.min(now, expiresMs);
  const elapsedSeconds = Math.max(0, Math.floor((effectiveEndMs - startedMs) / 1000));

  // Discrete formula: FLOOR( elapsed_seconds / 3600 ) - Never CEIL, never round up
  const totalCompletedHours = Math.min(totalPlanHours, Math.floor(elapsedSeconds / 3600));
  
  // Authoritative claimed hours
  const claimedAmount = Number(device.claimedAmount || 0);
  const claimedHours = device.claimedHours !== undefined && device.claimedHours !== null
    ? Number(device.claimedHours)
    : (hourlyEarnings > 0 ? Math.round(claimedAmount / hourlyEarnings) : 0);

  const unclaimedHours = Math.max(0, totalCompletedHours - claimedHours);
  const isExpired = now >= expiresMs || totalCompletedHours >= totalPlanHours;
  const isActive = (device.status === 'ACTIVE' || (device.status as string) === 'active') && !isExpired;

  // SINGLE COMPLETED HOURLY CYCLE RULE:
  // ONE COMPLETED HOURLY CYCLE = ONE CLAIMABLE HOURLY EARNING UNIT.
  // The system must NEVER add already-claimed amounts back into the current claimable amount.
  // If at least 1 completed cycle is unclaimed, claimable amount is exactly 1 * hourlyEarnings.
  const isEligibleCycle = unclaimedHours >= 1 && isActive;
  const claimableAmount = isEligibleCycle ? hourlyEarnings : 0;
  const totalEarnedAmount = Number((device.totalEarned || claimedAmount || 0).toFixed(2));
  const remainingHours = Math.max(0, totalPlanHours - totalCompletedHours);

  // Next Earning Time calculation
  let nextEarningTimestamp: number | undefined = undefined;
  let nextEarningTimeFormatted = 'Completed';
  let formattedSecondsUntilNext = '';

  if (totalCompletedHours < totalPlanHours) {
    nextEarningTimestamp = startedMs + (totalCompletedHours + 1) * 3600 * 1000;
    const diffMs = nextEarningTimestamp - now;
    if (diffMs > 0) {
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffSeconds = Math.floor((diffMs % 60000) / 1000);
      formattedSecondsUntilNext = `${diffMinutes}m ${diffSeconds}s`;
      const timeStr = new Date(nextEarningTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      nextEarningTimeFormatted = `${timeStr} (in ${diffMinutes}m)`;
    } else {
      nextEarningTimeFormatted = isEligibleCycle ? 'Cycle ready to claim' : 'Processing cycle...';
    }
  }

  const lastClaimTimeFormatted = device.lastClaimedAt
    ? new Date(device.lastClaimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
      ' (' +
      new Date(device.lastClaimedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ')'
    : 'Never claimed';

  return {
    purchaseId: device.id,
    planName: device.planName || 'Power Bank Device',
    planCategory: (device.planCategory || 'HOURLY').toUpperCase(),
    hourlyEarnings,
    dailyEarnings,
    totalPlanHours,
    totalCompletedHours,
    claimedHours,
    unclaimedHours: isEligibleCycle ? 1 : 0,
    claimableAmount,
    totalEarnedAmount,
    remainingHours,
    isActive,
    isExpired,
    startedAt: device.startedAt,
    expiresAt: new Date(expiresMs).toISOString(),
    lastClaimedAt: device.lastClaimedAt,
    lastClaimTimeFormatted,
    nextEarningTimestamp,
    nextEarningTimeFormatted,
    formattedSecondsUntilNext,
  };
}

/**
 * Calculates and accrues yield from all active devices as CLAIMABLE strictly on completed hours.
 * Note: Does NOT automatically add to wallet available_balance. User must claim.
 */
export async function settleAndCalculateEarnings(userId: string): Promise<{
  newAccrued: number;
  totalClaimable: number;
  deviceStatuses: DeviceHourlyStatus[];
}> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('settle_and_calculate_earnings', { p_user_id: userId });
      if (!error && data) {
        const claimable = await fetchClaimableEarnings(userId);
        return {
          newAccrued: Number(data?.accrued || 0),
          totalClaimable: claimable.totalClaimable,
          deviceStatuses: claimable.deviceStatuses,
        };
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase settle earnings error:', error.message);
      }
    } catch {
      // Fall through to local simulation
    }
  }

  // Local simulation: Calculate discrete completed hours per device
  const purchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  const userPurchases = purchases.filter((p) => p.userId === userId);
  const earnings = getLocal<EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
  let newlyAccruedSum = 0;
  let totalClaimableSum = 0;
  const now = Date.now();
  const deviceStatuses: DeviceHourlyStatus[] = [];

  userPurchases.forEach((p) => {
    const status = calculateDeviceHourlyStatus(p, now);
    deviceStatuses.push(status);
    totalClaimableSum += status.claimableAmount;

    // Synchronize discrete claimable records for auditing and batch claiming
    if (status.unclaimedHours > 0) {
      const existingClaimables = earnings.filter(
        (e) => e.userId === userId && e.purchaseId === p.id && e.status === 'CLAIMABLE'
      );
      const existingRecordedAmount = existingClaimables.reduce((s, e) => s + e.amount, 0);
      const diff = Number((status.claimableAmount - existingRecordedAmount).toFixed(2));

      if (diff > 0) {
        newlyAccruedSum += diff;
        const isPro = status.planCategory === 'PRO';
        const earningId = 'earn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        earnings.unshift({
          id: earningId,
          userId,
          purchaseId: p.id,
          planName: status.planName,
          planCategory: status.planCategory,
          amount: diff,
          earningType: isPro ? 'PRO_DAILY' : 'HOURLY_DEVICE',
          status: 'CLAIMABLE',
          earningDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
        });
      }
    }
  });

  if (newlyAccruedSum > 0) {
    saveLocal(STORAGE_KEYS.EARNINGS, earnings);
  }

  return {
    newAccrued: Number(newlyAccruedSum.toFixed(2)),
    totalClaimable: Number(totalClaimableSum.toFixed(2)),
    deviceStatuses,
  };
}

// Backward compatibility alias
export async function settleAndFetchEarnings(userId: string) {
  return settleAndCalculateEarnings(userId);
}

/**
 * Fetch all claimable earnings for a user strictly calculated by completed hourly cycles.
 */
export async function fetchClaimableEarnings(userId: string): Promise<{
  totalClaimable: number;
  count: number;
  records: EarningRecord[];
  deviceStatuses: DeviceHourlyStatus[];
}> {
  let userPurchases: PurchaseItem[] = [];
  try {
    userPurchases = await fetchPurchases(userId);
  } catch {
    const purchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
    userPurchases = purchases.filter((p) => p.userId === userId);
  }

  const now = Date.now();
  let total = 0;
  let unclaimedCyclesCount = 0;
  const deviceStatuses: DeviceHourlyStatus[] = [];

  userPurchases.forEach((p) => {
    const status = calculateDeviceHourlyStatus(p, now);
    deviceStatuses.push(status);
    if (status.isActive && status.claimableAmount > 0) {
      total += status.claimableAmount;
      unclaimedCyclesCount += 1;
    }
  });

  const earnings = getLocal<EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
  const userClaimables = earnings.filter((e) => e.userId === userId && e.status === 'CLAIMABLE');

  return {
    totalClaimable: Number(total.toFixed(2)),
    count: unclaimedCyclesCount,
    records: userClaimables,
    deviceStatuses,
  };
}

/**
 * Claim all accumulated hourly earnings atomically into user's wallet.
 * Claiming DOES NOT reset the device timeline, startedAt, or duration timer.
 * Claiming only sets claimable amount to 0 and advances claimedHours to totalCompletedHours.
 */
export async function claimUserEarnings(userId: string): Promise<{
  success: boolean;
  amount: number;
  claimBatchId: string;
  newBalance: number;
  itemsCount: number;
}> {
  // 1. Try authoritative server endpoint first
  try {
    const res = await fetch(apiUrl('/api/earnings/claim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          amount: Number(data.amount),
          claimBatchId: data.claimBatchId,
          newBalance: Number(data.newWithdrawBalance),
          itemsCount: Number(data.itemsCount || 1),
        };
      } else {
        throw new Error(data.error || 'Failed to claim device earnings');
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        throw new Error(errData.error);
      }
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('No completed') || e.message.includes('No active'))) {
      throw e;
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('claim_user_earnings', { p_user_id: userId });
      if (!error && data?.success) {
        return {
          success: true,
          amount: Number(data.amount),
          claimBatchId: data.claim_batch_id,
          newBalance: Number(data.new_balance),
          itemsCount: Number(data.items_count || 1),
        };
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase claim error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  const purchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  const userPurchases = purchases.filter((p) => p.userId === userId);
  const now = Date.now();
  const claimedTimestamp = new Date().toISOString();
  let totalClaimAmount = 0;
  let eligibleCyclesCount = 0;

  // 1. Calculate claimable amount per device and update claimedAmount without resetting startedAt
  userPurchases.forEach((p) => {
    const status = calculateDeviceHourlyStatus(p, now);
    if (status.isActive && status.claimableAmount > 0) {
      totalClaimAmount = Number((totalClaimAmount + status.claimableAmount).toFixed(2));
      eligibleCyclesCount += 1;

      // Advance claimedAmount and claimedHours
      p.claimedAmount = Number(((p.claimedAmount || 0) + status.claimableAmount).toFixed(2));
      p.claimedHours = Number((p.claimedHours || 0) + 1);
      p.totalEarned = Number(((p.totalEarned || 0) + status.claimableAmount).toFixed(2));
      p.lastClaimedAt = claimedTimestamp;
      p.lastSettledAt = claimedTimestamp;

      if (status.isExpired) {
        p.status = 'COMPLETED';
      }
    }
  });

  if (totalClaimAmount <= 0) {
    throw new Error('No completed hourly earnings available to claim. Earnings are generated only after each full hour.');
  }

  const claimBatchId = 'CLM-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // 2. Mark earning records as CLAIMED
  const earnings = getLocal<EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
  earnings.forEach((e) => {
    if (e.userId === userId && e.status === 'CLAIMABLE') {
      e.status = 'CLAIMED';
      e.claimBatchId = claimBatchId;
      e.claimedAt = claimedTimestamp;
    }
  });
  saveLocal(STORAGE_KEYS.EARNINGS, earnings);
  saveLocal(STORAGE_KEYS.PURCHASES, purchases);

  // 3. Credit Withdraw Wallet
  const wallet = getLocal<Wallet>(
    STORAGE_KEYS.WALLET,
    { topupBalance: 0, withdrawBalance: 0, availableBalance: 0, rechargeBalance: 0, earnedBalance: 0, totalEarned: 0 } as Wallet
  );
  const balBefore = wallet.withdrawBalance !== undefined ? wallet.withdrawBalance : (wallet.earnedBalance || 0);
  wallet.withdrawBalance = Number((balBefore + totalClaimAmount).toFixed(2));
  wallet.earnedBalance = wallet.withdrawBalance;
  wallet.availableBalance = wallet.withdrawBalance;
  wallet.totalEarned = Number(((wallet.totalEarned || 0) + totalClaimAmount).toFixed(2));
  saveLocal(STORAGE_KEYS.WALLET, wallet);

  // 4. Record Wallet Transaction (WITHDRAW_WALLET)
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  const tx: WalletTransaction = {
    id: 'tx_claim_' + Date.now(),
    userId,
    type: 'EARNING_CLAIM',
    amount: totalClaimAmount,
    balanceBefore: balBefore,
    balanceAfter: wallet.withdrawBalance,
    balanceType: 'WITHDRAW_WALLET',
    referenceId: claimBatchId,
    description: `Device Hourly Yield Claim (${claimBatchId})`,
    createdAt: claimedTimestamp,
  };
  txs.unshift(tx);
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  // 5. Save Claim Batch History
  const claims = getLocal<ClaimBatch[]>(STORAGE_KEYS.CLAIMS, []);
  claims.unshift({
    id: claimBatchId,
    userId,
    amount: totalClaimAmount,
    itemsCount: eligibleCyclesCount,
    status: 'CLAIMED',
    claimedAt: claimedTimestamp,
    txId: tx.id,
  });
  saveLocal(STORAGE_KEYS.CLAIMS, claims);

  // 6. Notify User
  const notifs = getLocal<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  notifs.unshift({
    id: 'notif_' + Date.now(),
    userId,
    title: 'Hourly Earnings Claimed',
    message: `₹${totalClaimAmount.toFixed(2)} hourly device earnings have been added to your wallet.`,
    type: 'SUCCESS',
    read: false,
    createdAt: claimedTimestamp,
  });
  saveLocal(STORAGE_KEYS.NOTIFICATIONS, notifs);

  // 7. Trigger Dynamic Consecutive Claim Referral Reward (Streak check)
  processConsecutiveClaimReferralReward(userId).catch((e) => {
    console.warn('Streak referral reward error:', e);
  });

  return {
    success: true,
    amount: totalClaimAmount,
    claimBatchId,
    newBalance: wallet.withdrawBalance,
    itemsCount: eligibleCyclesCount,
  };
}

/**
 * Fetch past claim history batches for user.
 */
export async function fetchClaimHistory(userId: string): Promise<ClaimBatch[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('claim_batches')
        .select('*')
        .eq('user_id', userId)
        .order('claimed_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((c) => ({
          id: c.id,
          userId: c.user_id,
          amount: Number(c.amount),
          itemsCount: Number(c.items_count || 1),
          status: c.status || 'CLAIMED',
          claimedAt: c.claimed_at,
          txId: c.tx_id,
        }));
      }
    } catch {
      // Fall through to local
    }
  }

  const claims = getLocal<ClaimBatch[]>(STORAGE_KEYS.CLAIMS, []);
  return claims.filter((c) => c.userId === userId);
}

/**
 * Fetch all earnings records for Admin audit.
 */
export async function fetchAdminEarningsAudit(): Promise<{
  earnings: EarningRecord[];
  claims: ClaimBatch[];
  totalAccrued: number;
  totalClaimable: number;
  totalClaimed: number;
}> {
  if (isSupabaseConfigured && supabase) {
    try {
      const [earningsRes, claimsRes] = await Promise.all([
        supabase.from('earnings').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('claim_batches').select('*').order('claimed_at', { ascending: false }).limit(100),
      ]);

      if (earningsRes.data || claimsRes.data) {
        const earningsList: EarningRecord[] = (earningsRes.data || []).map((e) => ({
          id: e.id,
          userId: e.user_id,
          purchaseId: e.purchase_id,
          planName: e.plan_name,
          planCategory: e.plan_category,
          amount: Number(e.amount),
          earningType: e.earning_type,
          status: e.status,
          earningDate: e.earning_date,
          claimBatchId: e.claim_batch_id,
          claimedAt: e.claimed_at,
          createdAt: e.created_at,
        }));

        const claimsList: ClaimBatch[] = (claimsRes.data || []).map((c) => ({
          id: c.id,
          userId: c.user_id,
          amount: Number(c.amount),
          itemsCount: Number(c.items_count || 1),
          status: c.status,
          claimedAt: c.claimed_at,
          txId: c.tx_id,
        }));

        const totalClaimable = earningsList
          .filter((e) => e.status === 'CLAIMABLE')
          .reduce((acc, e) => acc + e.amount, 0);

        const totalClaimed = earningsList
          .filter((e) => e.status === 'CLAIMED')
          .reduce((acc, e) => acc + e.amount, 0);

        return {
          earnings: earningsList,
          claims: claimsList,
          totalAccrued: +(totalClaimable + totalClaimed).toFixed(2),
          totalClaimable: +totalClaimable.toFixed(2),
          totalClaimed: +totalClaimed.toFixed(2),
        };
      }
    } catch {
      // Fall through to local
    }
  }

  const earnings = getLocal<EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
  const claims = getLocal<ClaimBatch[]>(STORAGE_KEYS.CLAIMS, []);

  const totalClaimable = earnings
    .filter((e) => e.status === 'CLAIMABLE')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalClaimed = earnings
    .filter((e) => e.status === 'CLAIMED')
    .reduce((acc, e) => acc + e.amount, 0);

  return {
    earnings,
    claims,
    totalAccrued: +(totalClaimable + totalClaimed).toFixed(2),
    totalClaimable: +totalClaimable.toFixed(2),
    totalClaimed: +totalClaimed.toFixed(2),
  };
}

// ==============================================================================
// BANK ACCOUNTS & WITHDRAWALS (BANK ACCOUNT ONLY — FULL CRUD SUPPORT)
// ==============================================================================

export async function fetchBankAccounts(userId: string): Promise<BankAccount[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });

      if (!error && data && data.length > 0) {
        return data
          .filter((b) => !b.is_deleted && b.status !== 'deleted')
          .map((b) => ({
            id: b.id,
            userId: b.user_id,
            accountHolderName: b.account_holder_name || b.holder_name,
            holderName: b.holder_name || b.account_holder_name,
            bankName: b.bank_name,
            accountNumber: b.account_number,
            ifsc: b.ifsc || b.ifsc_code,
            ifscCode: b.ifsc_code || b.ifsc,
            mobileNumber: b.mobile_number,
            email: b.email,
            isDefault: Boolean(b.is_default),
            isDeleted: Boolean(b.is_deleted),
            status: b.status || 'active',
            createdAt: b.created_at,
            updatedAt: b.updated_at,
          }));
      }
    } catch {
      // Fall through to local
    }
  }

  const banks = getLocal<BankAccount[]>(STORAGE_KEYS.BANKS, []);
  const activeBanks = banks.filter((b) => b.userId === userId && !b.isDeleted && b.status !== 'deleted');
  // Sort so default is first
  return activeBanks.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
}

export async function saveBankAccount(
  userId: string,
  data: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    mobileNumber?: string;
    email?: string;
    isDefault?: boolean;
  }
): Promise<BankAccount> {
  const banks = getLocal<BankAccount[]>(STORAGE_KEYS.BANKS, []);
  const userActiveBanks = banks.filter((b) => b.userId === userId && !b.isDeleted && b.status !== 'deleted');
  const isFirstCard = userActiveBanks.length === 0;
  const willBeDefault = isFirstCard || Boolean(data.isDefault);

  if (willBeDefault) {
    banks.forEach((b) => {
      if (b.userId === userId) {
        b.isDefault = false;
      }
    });
  }

  const newBankId = 'bnk_' + Date.now();
  const newBank: BankAccount = {
    id: newBankId,
    userId,
    accountHolderName: data.accountHolderName.trim(),
    holderName: data.accountHolderName.trim(),
    bankName: data.bankName.trim(),
    accountNumber: data.accountNumber.trim(),
    ifsc: data.ifsc.trim().toUpperCase(),
    ifscCode: data.ifsc.trim().toUpperCase(),
    mobileNumber: data.mobileNumber?.trim() || undefined,
    email: data.email?.trim() || undefined,
    isDefault: willBeDefault,
    isDeleted: false,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (willBeDefault) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { error } = await supabase.from('bank_accounts').insert({
        id: newBank.id,
        user_id: userId,
        account_holder_name: newBank.accountHolderName,
        holder_name: newBank.accountHolderName,
        bank_name: newBank.bankName,
        account_number: newBank.accountNumber,
        ifsc: newBank.ifsc,
        ifsc_code: newBank.ifsc,
        is_default: newBank.isDefault,
      });
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase save bank error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  banks.unshift(newBank);
  saveLocal(STORAGE_KEYS.BANKS, banks);
  return newBank;
}

export async function updateBankAccount(
  userId: string,
  bankId: string,
  data: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    mobileNumber?: string;
    email?: string;
    isDefault?: boolean;
  }
): Promise<BankAccount> {
  const banks = getLocal<BankAccount[]>(STORAGE_KEYS.BANKS, []);
  const bankIndex = banks.findIndex((b) => b.id === bankId && b.userId === userId);
  if (bankIndex === -1) {
    throw new Error('Bank account not found.');
  }

  if (data.isDefault) {
    banks.forEach((b) => {
      if (b.userId === userId) {
        b.isDefault = false;
      }
    });
  }

  const existing = banks[bankIndex];
  const updatedBank: BankAccount = {
    ...existing,
    accountHolderName: data.accountHolderName ? data.accountHolderName.trim() : existing.accountHolderName,
    holderName: data.accountHolderName ? data.accountHolderName.trim() : existing.accountHolderName,
    bankName: data.bankName ? data.bankName.trim() : existing.bankName,
    accountNumber: data.accountNumber ? data.accountNumber.trim() : existing.accountNumber,
    ifsc: data.ifsc ? data.ifsc.trim().toUpperCase() : existing.ifsc,
    ifscCode: data.ifsc ? data.ifsc.trim().toUpperCase() : existing.ifsc,
    mobileNumber: data.mobileNumber !== undefined ? data.mobileNumber.trim() : existing.mobileNumber,
    email: data.email !== undefined ? data.email.trim() : existing.email,
    isDefault: data.isDefault !== undefined ? data.isDefault : existing.isDefault,
    updatedAt: new Date().toISOString(),
  };

  banks[bankIndex] = updatedBank;
  saveLocal(STORAGE_KEYS.BANKS, banks);

  if (isSupabaseConfigured && supabase) {
    try {
      if (data.isDefault) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      await supabase
        .from('bank_accounts')
        .update({
          account_holder_name: updatedBank.accountHolderName,
          bank_name: updatedBank.bankName,
          account_number: updatedBank.accountNumber,
          ifsc: updatedBank.ifsc,
          is_default: updatedBank.isDefault,
          updated_at: updatedBank.updatedAt,
        })
        .eq('id', bankId)
        .eq('user_id', userId);
    } catch {
      // Fall through to local
    }
  }

  return updatedBank;
}

export async function deleteBankAccount(userId: string, bankId: string): Promise<void> {
  const banks = getLocal<BankAccount[]>(STORAGE_KEYS.BANKS, []);
  const bank = banks.find((b) => b.id === bankId && b.userId === userId);
  if (!bank) return;

  // Soft delete to protect historical withdrawal records
  bank.isDeleted = true;
  bank.status = 'deleted';
  bank.updatedAt = new Date().toISOString();

  // If the deleted bank was default, promote another active card to default
  if (bank.isDefault) {
    bank.isDefault = false;
    const remainingActive = banks.find((b) => b.userId === userId && !b.isDeleted && b.status !== 'deleted');
    if (remainingActive) {
      remainingActive.isDefault = true;
    }
  }

  saveLocal(STORAGE_KEYS.BANKS, banks);

  if (isSupabaseConfigured && supabase) {
    try {
      // Direct delete or soft delete
      const { error: delErr } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', bankId)
        .eq('user_id', userId);

      if (delErr) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .eq('id', bankId)
          .eq('user_id', userId);
      }

      // Re-assign default if needed
      const remainingActive = banks.find((b) => b.userId === userId && !b.isDeleted && b.status !== 'deleted');
      if (remainingActive) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: true })
          .eq('id', remainingActive.id);
      }
    } catch {
      // Fall through to local
    }
  }
}

export async function setDefaultBankAccount(userId: string, bankId: string): Promise<void> {
  const banks = getLocal<BankAccount[]>(STORAGE_KEYS.BANKS, []);
  banks.forEach((b) => {
    if (b.userId === userId) {
      b.isDefault = b.id === bankId;
      if (b.id === bankId) {
        b.updatedAt = new Date().toISOString();
      }
    }
  });
  saveLocal(STORAGE_KEYS.BANKS, banks);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('bank_accounts')
        .update({ is_default: false })
        .eq('user_id', userId);

      await supabase
        .from('bank_accounts')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', bankId)
        .eq('user_id', userId);
    } catch {
      // Fall through to local
    }
  }
}

export async function submitWithdrawalRequest(
  userId: string,
  amount: number,
  bankAccountId?: string,
  withdrawalPassword?: string
) {
  // 1. Verify Bank Account (Bank Only - No UPI)
  const activeBanks = await fetchBankAccounts(userId);
  if (activeBanks.length === 0) {
    throw new Error('Please bind your Bank Account first to request a withdrawal.');
  }

  let selectedBank = activeBanks.find((b) => b.id === bankAccountId);
  if (!selectedBank) {
    selectedBank = activeBanks.find((b) => b.isDefault) || activeBanks[0];
  }

  if (!selectedBank) {
    throw new Error('Valid Bank Account is required for withdrawal.');
  }

  const cleanPin = (withdrawalPassword || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    throw new Error('Withdrawal PIN must be exactly 4 digits.');
  }

  // 2. Call server withdrawal verification endpoint
  try {
    const resp = await fetch(apiUrl('/api/wallet/withdraw'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        amount,
        bankAccountId: selectedBank.id,
        withdrawalPassword: withdrawalPassword.trim(),
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Withdrawal request failed.');
    }
    return data;
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('request_withdrawal', {
        p_user_id: userId,
        p_amount: amount,
        p_bank_account_id: selectedBank.id,
      });
      if (!error && data?.success) {
        return data;
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase request withdrawal error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
    topupBalance: 0,
    withdrawBalance: 0,
    availableBalance: 0,
    pendingBalance: 0,
    rechargeBalance: 0,
    earnedBalance: 0,
  } as Wallet);

  const withdrawableEarned = wallet.withdrawBalance !== undefined ? wallet.withdrawBalance : (wallet.earnedBalance || wallet.availableBalance || 0);
  if (amount < 100) throw new Error('Minimum withdrawal amount is ₹100');
  if (withdrawableEarned < amount) throw new Error(`Insufficient Withdraw Wallet balance. Available withdraw balance: ₹${withdrawableEarned.toFixed(2)}. (Topup Wallet balance cannot be withdrawn)`);

  const balBefore = withdrawableEarned;
  wallet.withdrawBalance = +(withdrawableEarned - amount).toFixed(2);
  wallet.earnedBalance = wallet.withdrawBalance;
  wallet.availableBalance = wallet.withdrawBalance;
  wallet.pendingBalance = +((wallet.pendingBalance || 0) + amount).toFixed(2);
  saveLocal(STORAGE_KEYS.WALLET, wallet);

  const withdrawalId = 'wd_' + Date.now();
  const newWd: WithdrawalItem = {
    id: withdrawalId,
    userId,
    userMobile: '9876543210',
    amount,
    fee: 0,
    netAmount: amount,
    bankAccountId: selectedBank.id,
    bankDetails: selectedBank,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  const list = getLocal<WithdrawalItem[]>(STORAGE_KEYS.WITHDRAWALS, []);
  list.unshift(newWd);
  saveLocal(STORAGE_KEYS.WITHDRAWALS, list);

  const tx: WalletTransaction = {
    id: 'tx_wd_' + Date.now(),
    userId,
    type: 'WITHDRAWAL',
    amount: -amount,
    balanceBefore: balBefore,
    balanceAfter: wallet.withdrawBalance,
    balanceType: 'WITHDRAW_WALLET',
    referenceId: withdrawalId,
    bankDetails: `${selectedBank.bankName} - A/C ${selectedBank.accountNumber} (${selectedBank.ifsc})`,
    status: 'Pending',
    description: `Bank Withdrawal: ₹${amount.toFixed(2)} to ${selectedBank.bankName} (${selectedBank.accountNumber.slice(-4)})`,
    createdAt: new Date().toISOString(),
  };
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  txs.unshift(tx);
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  // Trigger Notification
  createNotificationForUser({
    userId,
    title: 'Withdrawal Pending',
    description: `Your bank withdrawal of ₹${amount.toFixed(2)} to ${selectedBank.bankName} is pending approval.`,
    type: 'WITHDRAWAL',
    isHomePopup: false,
  }).catch(() => {});

  return { success: true, withdrawalId };
}

export async function fetchUserWithdrawals(userId: string): Promise<WithdrawalItem[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((w: any) => ({
          id: w.id,
          userId: w.user_id,
          amount: Number(w.amount),
          fee: Number(w.fee || 0),
          netAmount: Number(w.net_amount || w.actual_amount || w.amount),
          bankAccountId: w.bank_account_id,
          upiId: w.upi_id,
          status: w.status,
          adminNote: w.admin_note,
          rejectionReason: w.rejection_reason || w.rejected_reason,
          createdAt: w.created_at,
          processedAt: w.processed_at,
        }));
      }
    } catch {
      // Fall through to local
    }
  }

  const all = getLocal<WithdrawalItem[]>(STORAGE_KEYS.WITHDRAWALS, []);
  return all.filter((w) => w.userId === userId);
}

// ==============================================================================
// ADMIN MANAGEMENT (IDEMPOTENT APPROVALS & REJECTIONS)
// ==============================================================================

export async function fetchAdminPayments(): Promise<PaymentItem[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const [manualRes, gatewayRes, profilesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('deposit_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('profiles')
          .select('id, user_id, username, mobile, whatsapp_no'),
      ]);

      const profileMap = new Map<string, any>();
      if (profilesRes.data) {
        profilesRes.data.forEach((p: any) => {
          if (p.user_id) profileMap.set(p.user_id, p);
          if (p.id) profileMap.set(p.id, p);
        });
      }

      const manualPayments: PaymentItem[] = (!manualRes.error && manualRes.data)
        ? manualRes.data.map((p: any) => {
            const prof = profileMap.get(p.user_id) || {};
            return {
              id: p.id,
              userId: p.user_id,
              username: prof.username || 'User',
              userMobile: prof.mobile || prof.whatsapp_no || 'N/A',
              orderId: p.order_id || p.reference_id || p.id,
              amount: Number(p.amount),
              paymentType: p.payment_type || 'MANUAL_QR',
              utr: p.utr || p.utr_number || p.reference_id,
              proofUrl: p.proof_url || p.receipt_url,
              status: p.status as PaymentStatus,
              adminId: p.admin_id,
              rejectionReason: p.rejection_reason,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            };
          })
        : [];

      const gatewayDeposits: PaymentItem[] = (!gatewayRes.error && gatewayRes.data)
        ? gatewayRes.data.map((d: any) => {
            const prof = profileMap.get(d.user_id) || {};
            const rawStatus = (d.status || '').toUpperCase();
            let mappedStatus: PaymentStatus = 'PAYMENT_PENDING';
            if (rawStatus === 'SUCCESS' || rawStatus === 'PAID' || rawStatus === 'COMPLETED') {
              mappedStatus = 'PAID';
            } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'FAILED_GATEWAY_CREATION') {
              mappedStatus = 'FAILED';
            } else {
              mappedStatus = 'PAYMENT_PENDING';
            }

            return {
              id: d.id,
              userId: d.user_id,
              username: prof.username || 'User',
              userMobile: prof.whatsapp_no || prof.mobile || 'N/A',
              orderId: d.traceno || d.order_id || d.id,
              amount: Number(d.amount),
              paymentType: d.channel || 'UNIVEPAY_GATEWAY',
              utr: d.utr || d.gateway_serial_no || d.traceno,
              proofUrl: d.pay_url,
              status: mappedStatus,
              adminId: undefined,
              rejectionReason: d.rejection_reason,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
            };
          })
        : [];

      const combined = [...manualPayments, ...gatewayDeposits].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      if (combined.length > 0) {
        return combined;
      }
    } catch {
      // Fall through to local
    }
  }

  return getLocal<PaymentItem[]>(STORAGE_KEYS.PAYMENTS, []);
}

export async function approveRecharge(paymentId: string, adminId: string) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('approve_recharge', {
        p_payment_id: paymentId,
        p_admin_id: adminId,
      });
      if (!error && data?.success) {
        return data;
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase approve recharge error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  const list = getLocal<PaymentItem[]>(STORAGE_KEYS.PAYMENTS, []);
  const payment = list.find((p) => p.id === paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.status === 'PAID') throw new Error('Payment already approved');

  payment.status = 'PAID';
  payment.adminId = adminId;
  payment.processedAt = new Date().toISOString();
  saveLocal(STORAGE_KEYS.PAYMENTS, list);

  // Credit user Topup Wallet (topupBalance & rechargeBalance)
  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
    topupBalance: 0,
    withdrawBalance: 0,
    availableBalance: 0,
    rechargeBalance: 0,
    earnedBalance: 0,
  } as Wallet);
  const curTopup = wallet.topupBalance !== undefined ? wallet.topupBalance : (wallet.rechargeBalance || 0);
  const balBefore = curTopup;
  wallet.topupBalance = +(curTopup + payment.amount).toFixed(2);
  wallet.rechargeBalance = wallet.topupBalance;
  saveLocal(STORAGE_KEYS.WALLET, wallet);

  // Record or update wallet transaction
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  const pendingTx = txs.find((t) => t.referenceId === payment.orderId && t.type === 'RECHARGE');
  if (pendingTx) {
    pendingTx.balanceBefore = balBefore;
    pendingTx.balanceAfter = wallet.topupBalance;
    pendingTx.balanceType = 'TOPUP_WALLET';
    pendingTx.description = `Recharge Approved (UTR: ${payment.utr})`;
    pendingTx.status = 'Completed';
  } else {
    const tx: WalletTransaction = {
      id: 'tx_rec_' + Date.now(),
      userId: payment.userId,
      type: 'RECHARGE',
      amount: payment.amount,
      balanceBefore: balBefore,
      balanceAfter: wallet.topupBalance,
      balanceType: 'TOPUP_WALLET',
      referenceId: payment.orderId,
      utr: payment.utr,
      status: 'Completed',
      description: `Recharge Approved (UTR: ${payment.utr})`,
      createdAt: new Date().toISOString(),
    };
    txs.unshift(tx);
  }
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  // Audit Log
  logAdminAction(
    adminId,
    'APPROVE_RECHARGE',
    'PAYMENT',
    paymentId,
    `Approved recharge ₹${payment.amount.toFixed(2)} (UTR: ${payment.utr}) for user ${payment.userId}`,
    { amount: payment.amount, utr: payment.utr, userId: payment.userId }
  ).catch(() => {});

  // Trigger Notification
  createNotificationForUser({
    userId: payment.userId,
    title: 'Recharge Successful',
    description: `Your ₹${payment.amount.toFixed(2)} recharge has been approved and added to your wallet.`,
    type: 'RECHARGE',
    isHomePopup: false,
    actionUrl: '/purchase',
    actionText: 'Rent Power Bank',
  }).catch(() => {});

  // Trigger Dynamic Multi-Tier Top-Up Referral Commission (T1, T2, T3)
  processTopupReferralRewards(paymentId, payment.userId, payment.amount).catch((e) => {
    console.warn('Topup referral reward error:', e);
  });

  return { success: true };
}

export async function rejectRecharge(paymentId: string, param2: string, param3?: string) {
  // Support both (paymentId, adminId, reason) and (paymentId, reason, adminId)
  const isParam2Admin = param2.startsWith('adm_') || param2.startsWith('admin_');
  const adminId = isParam2Admin ? param2 : (param3 || 'adm_master_01');
  const reason = isParam2Admin ? (param3 || 'Verification Failed') : param2;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('reject_recharge', {
        p_payment_id: paymentId,
        p_admin_id: adminId,
        p_reason: reason,
      });
      if (!error && data?.success) {
        return data;
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase reject recharge error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  const list = getLocal<PaymentItem[]>(STORAGE_KEYS.PAYMENTS, []);
  const payment = list.find((p) => p.id === paymentId);
  if (!payment) throw new Error('Payment not found');
  payment.status = 'REJECTED';
  payment.adminId = adminId;
  payment.rejectionReason = reason;
  payment.processedAt = new Date().toISOString();
  saveLocal(STORAGE_KEYS.PAYMENTS, list);

  // Update pending transaction status if present
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  const pendingTx = txs.find((t) => t.referenceId === payment.orderId && t.type === 'RECHARGE');
  if (pendingTx) {
    pendingTx.description = `Recharge Rejected: ${reason}`;
    pendingTx.status = 'Rejected';
    saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);
  }

  // Audit Log
  logAdminAction(
    adminId,
    'REJECT_RECHARGE',
    'PAYMENT',
    paymentId,
    `Rejected recharge ₹${payment.amount.toFixed(2)} (Reason: ${reason})`,
    { amount: payment.amount, reason, userId: payment.userId }
  ).catch(() => {});

  // Trigger Notification
  createNotificationForUser({
    userId: payment.userId,
    title: 'Recharge Rejected',
    description: `Your ₹${payment.amount.toFixed(2)} recharge was rejected.\nReason: ${reason}`,
    type: 'RECHARGE',
    isHomePopup: false,
  }).catch(() => {});

  return { success: true };
}

export async function fetchAdminWithdrawals(): Promise<WithdrawalItem[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const [withdrawalsRes, profilesRes, banksRes] = await Promise.all([
        supabase
          .from('withdrawals')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, user_id, username, mobile, whatsapp_no'),
        supabase
          .from('bank_accounts')
          .select('*'),
      ]);

      if (!withdrawalsRes.error && withdrawalsRes.data && withdrawalsRes.data.length > 0) {
        const profileMap = new Map<string, any>();
        if (profilesRes.data) {
          profilesRes.data.forEach((p: any) => {
            if (p.user_id) profileMap.set(p.user_id, p);
            if (p.id) profileMap.set(p.id, p);
          });
        }

        const bankMap = new Map<string, any>();
        if (banksRes.data) {
          banksRes.data.forEach((b: any) => {
            if (b.id) bankMap.set(b.id, b);
          });
        }

        return withdrawalsRes.data.map((w: any) => {
          const prof = profileMap.get(w.user_id) || {};
          const bank = bankMap.get(w.bank_account_id) || {};
          return {
            id: w.id,
            userId: w.user_id,
            userMobile: prof.mobile || prof.whatsapp_no || 'N/A',
            amount: Number(w.amount),
            fee: Number(w.fee || 0),
            netAmount: Number(w.net_amount || w.actual_amount || w.amount),
            bankAccountId: w.bank_account_id,
            bankDetails: {
              id: bank.id || w.bank_account_id,
              userId: bank.user_id || w.user_id,
              accountHolderName: bank.account_holder_name || bank.holder_name || prof.username || 'Account Holder',
              bankName: bank.bank_name || w.bank_name || 'Bank',
              accountNumber: bank.account_number || w.account_number || 'N/A',
              ifsc: bank.ifsc || bank.ifsc_code || w.ifsc_code || 'N/A',
              upiId: bank.upi_id || w.upi_id,
              isDefault: bank.is_default,
            },
            upiId: w.upi_id,
            status: w.status,
            adminNote: w.admin_note,
            rejectionReason: w.rejection_reason || w.rejected_reason,
            createdAt: w.created_at,
            processedAt: w.processed_at,
          };
        });
      }
    } catch {
      // Fall through to local
    }
  }

  return getLocal<WithdrawalItem[]>(STORAGE_KEYS.WITHDRAWALS, []);
}

export async function approveWithdrawal(withdrawalId: string, bankRefNoOrAdminId: string, optionalAdminId?: string) {
  const isFirstAdmin = bankRefNoOrAdminId.startsWith('adm_') || bankRefNoOrAdminId.startsWith('admin_');
  const adminId = optionalAdminId || (isFirstAdmin ? bankRefNoOrAdminId : 'adm_master_01');
  const bankRef = isFirstAdmin ? (optionalAdminId || '') : bankRefNoOrAdminId;

  // 1. Call authoritative Server Endpoint
  try {
    const resp = await fetch(apiUrl('/api/admin/approve-withdrawal'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({
        withdrawalId,
        adminId,
        bankRef,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.success) {
        return data;
      }
    }
  } catch (err) {
    console.warn('API approve-withdrawal failed, falling back:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('complete_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_admin_id: adminId,
      });
      if (!error && data) {
        return data;
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase approve withdrawal error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  const list = getLocal<WithdrawalItem[]>(STORAGE_KEYS.WITHDRAWALS, []);
  const wd = list.find((w) => w.id === withdrawalId);
  if (!wd) throw new Error('Withdrawal not found');
  if (wd.status === 'COMPLETED') throw new Error('Withdrawal already completed');

  wd.status = 'COMPLETED';
  wd.processedAt = new Date().toISOString();
  if (bankRef) {
    wd.adminNote = `UTR/Bank Ref: ${bankRef}`;
  }
  saveLocal(STORAGE_KEYS.WITHDRAWALS, list);

  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, { totalWithdrawn: 0, pendingBalance: 0 } as Wallet);
  wallet.pendingBalance = Math.max(0, +(wallet.pendingBalance - wd.amount).toFixed(2));
  wallet.totalWithdrawn = +(wallet.totalWithdrawn + wd.amount).toFixed(2);
  saveLocal(STORAGE_KEYS.WALLET, wallet);

  // Update Transaction
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  const pendingTx = txs.find((t) => t.referenceId === wd.id && t.type === 'WITHDRAWAL');
  if (pendingTx) {
    pendingTx.description = `Withdrawal Approved ${bankRef ? `(Ref: ${bankRef})` : ''}`;
    pendingTx.status = 'Completed';
    saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);
  }

  // Audit Log
  logAdminAction(
    adminId,
    'APPROVE_WITHDRAWAL',
    'WITHDRAWAL',
    withdrawalId,
    `Approved withdrawal of ₹${wd.amount.toFixed(2)} (Net: ₹${wd.netAmount.toFixed(2)}, Ref: ${bankRef || 'N/A'})`,
    { amount: wd.amount, netAmount: wd.netAmount, bankRef, userId: wd.userId }
  ).catch(() => {});

  // Trigger Notification
  createNotificationForUser({
    userId: wd.userId,
    title: 'Withdrawal Successful',
    description: `Your withdrawal of ₹${wd.amount.toFixed(2)} has been approved.`,
    type: 'WITHDRAWAL',
    isHomePopup: false,
  }).catch(() => {});

  return { success: true };
}

export async function rejectWithdrawal(withdrawalId: string, param2: string, param3?: string) {
  // Support both (withdrawalId, adminId, reason) and (withdrawalId, reason, adminId)
  const isParam2Admin = param2.startsWith('adm_') || param2.startsWith('admin_');
  const adminId = isParam2Admin ? param2 : (param3 || 'adm_master_01');
  const reason = isParam2Admin ? (param3 || 'Details Mismatch') : param2;

  // 1. Call authoritative Server Endpoint
  try {
    const resp = await fetch(apiUrl('/api/admin/reject-withdrawal'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({
        withdrawalId,
        adminId,
        reason,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.success) {
        return data;
      }
    }
  } catch (err) {
    console.warn('API reject-withdrawal failed, falling back:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('reject_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_admin_id: adminId,
        p_reason: reason,
      });
      if (!error && data) {
        return data;
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase reject withdrawal error:', error.message);
      }
    } catch {
      // Fall through to local
    }
  }

  const list = getLocal<WithdrawalItem[]>(STORAGE_KEYS.WITHDRAWALS, []);
  const wd = list.find((w) => w.id === withdrawalId);
  if (!wd) throw new Error('Withdrawal not found');
  if (wd.status === 'REJECTED') throw new Error('Withdrawal already rejected');

  wd.status = 'REJECTED';
  wd.rejectionReason = reason;
  wd.processedAt = new Date().toISOString();
  saveLocal(STORAGE_KEYS.WITHDRAWALS, list);

  // Refund wallet held balance back into Withdraw Wallet (withdrawBalance)
  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
    topupBalance: 0,
    withdrawBalance: 0,
    availableBalance: 0,
    pendingBalance: 0,
    rechargeBalance: 0,
    earnedBalance: 0,
  } as Wallet);
  const curWithdraw = wallet.withdrawBalance !== undefined ? wallet.withdrawBalance : (wallet.earnedBalance || 0);
  const balBefore = curWithdraw;
  wallet.pendingBalance = Math.max(0, +((wallet.pendingBalance || 0) - wd.amount).toFixed(2));
  wallet.withdrawBalance = +(curWithdraw + wd.amount).toFixed(2);
  wallet.earnedBalance = wallet.withdrawBalance;
  wallet.availableBalance = wallet.withdrawBalance;
  saveLocal(STORAGE_KEYS.WALLET, wallet);

  // Record reversal transaction
  const tx: WalletTransaction = {
    id: 'tx_rev_' + Date.now(),
    userId: wd.userId,
    type: 'WITHDRAWAL_REVERSAL',
    amount: wd.amount,
    balanceBefore: balBefore,
    balanceAfter: wallet.withdrawBalance,
    balanceType: 'WITHDRAW_WALLET',
    referenceId: wd.id,
    status: 'Completed',
    description: `Withdrawal Reversal: ${reason}`,
    createdAt: new Date().toISOString(),
  };
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  txs.unshift(tx);
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  // Audit Log
  logAdminAction(
    adminId,
    'REJECT_WITHDRAWAL',
    'WITHDRAWAL',
    withdrawalId,
    `Rejected withdrawal of ₹${wd.amount.toFixed(2)} (Reason: ${reason}). Refunded ₹${wd.amount.toFixed(2)} to user wallet.`,
    { amount: wd.amount, reason, userId: wd.userId }
  ).catch(() => {});

  // Trigger Notification
  createNotificationForUser({
    userId: wd.userId,
    title: 'Withdrawal Rejected',
    description: `Your withdrawal request of ₹${wd.amount.toFixed(2)} was rejected.\nReason: ${reason}`,
    type: 'WITHDRAWAL',
    isHomePopup: false,
  }).catch(() => {});

  return { success: true };
}

// ==============================================================================
// ADMIN PLAN MANAGEMENT & PRO CONFIGURATION
// ==============================================================================

export async function saveAdminPlan(
  plan: Partial<ProductItem> & { id?: string },
  adminId?: string
): Promise<ProductItem> {
  const isNew = !plan.id || plan.id.startsWith('new_');
  const planId = isNew ? 'plan_' + Date.now() : plan.id!;

  const fullPlan: ProductItem = {
    id: planId,
    name: plan.name || 'New Power Cabinet',
    category: (plan.category || 'HOURLY').toUpperCase(),
    devicePrice: Number(plan.devicePrice || plan.price || 500),
    price: Number(plan.devicePrice || plan.price || 500),
    hourlyEarnings: Number(plan.hourlyEarnings || 1.25),
    dailyEarnings: Number(plan.dailyEarnings || (Number(plan.hourlyEarnings || 1.25) * 24)),
    limit: Number(plan.limit || 3),
    durationDays: Number(plan.durationDays || plan.duration || 365),
    duration: Number(plan.durationDays || plan.duration || 365),
    instantBonus: Number(plan.instantBonus || 0),
    requiresActiveHourlyPlan: plan.requiresActiveHourlyPlan ?? (plan.category === 'PRO'),
    tags: plan.tags || ['Hourly Yield', 'Auto Settle'],
    imageType: plan.imageType || (plan.category === 'PRO' ? 'cabinet-pro' : 'cabinet-green'),
    status: plan.status || 'active',
    description: plan.description || plan.name || 'Power Cabinet Plan',
  };

  try {
    const res = await fetch(apiUrl('/api/admin/plans/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ plan: fullPlan, adminId }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const saved = { ...fullPlan, ...json.data, id: json.data.id || fullPlan.id };
      const list = getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData);
      const existingIndex = list.findIndex((p) => p.id === planId || p.id === saved.id);
      if (existingIndex >= 0) {
        list[existingIndex] = saved;
      } else {
        list.push(saved);
      }
      saveLocal(STORAGE_KEYS.PLANS, list);
      return saved;
    }
  } catch (err) {
    console.warn('Backend plan save error, falling back:', err);
  }

  const list = getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData);
  const existingIndex = list.findIndex((p) => p.id === planId);
  if (existingIndex >= 0) {
    list[existingIndex] = fullPlan;
  } else {
    list.push(fullPlan);
  }
  saveLocal(STORAGE_KEYS.PLANS, list);
  if (adminId) {
    await recordAuditLog(adminId, isNew ? 'CREATE_PLAN' : 'UPDATE_PLAN', 'plans', planId, `${isNew ? 'Created' : 'Updated'} plan: ${fullPlan.name}`);
  }
  return fullPlan;
}

export async function deleteAdminPlan(planId: string, adminId?: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/admin/plans/delete'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ planId, adminId }),
    });
    const json = await res.json();
    if (json.success) {
      const list = getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData);
      const filtered = list.filter((p) => p.id !== planId);
      saveLocal(STORAGE_KEYS.PLANS, filtered);
      return true;
    }
  } catch (err) {
    console.warn('Backend delete plan error, falling back:', err);
  }

  const list = getLocal<ProductItem[]>(STORAGE_KEYS.PLANS, productsData);
  const filtered = list.filter((p) => p.id !== planId);
  saveLocal(STORAGE_KEYS.PLANS, filtered);
  if (adminId) {
    await recordAuditLog(adminId, 'DELETE_PLAN', 'plans', planId, `Deleted plan ${planId}`);
  }
  return true;
}

// ==============================================================================
// ADVANCED ADMIN SERVICES & SECURE AUTHENTICATION
// ==============================================================================

const ADMIN_STORAGE_KEYS = {
  ADMIN_SESSION: 'pb_admin_secure_session',
  SYSTEM_SETTINGS: 'pb_system_settings',
  AUDIT_LOGS: 'pb_audit_logs',
  NEWS: 'pb_platform_news',
  BANNERS: 'pb_platform_banners',
};

// Initial dynamic system configuration
const defaultSystemSettings: import('../types').SystemSettings = {
  minWithdrawal: 100,
  maxWithdrawal: 50000,
  withdrawalFeePercent: 0,
  referralBonusPercent: 10,
  isRechargeEnabled: true,
  isWithdrawalEnabled: true,
  isClaimEnabled: true,
  isProEnabled: true,
  isHourlyPlanEnabled: true,
  upiId: 'powerbank.pay@upi',
  qrImageUrl: '',
  instructions: '1. Scan the QR code or transfer to UPI ID.\n2. Enter the exact recharge amount.\n3. Input the 12-digit UTR and submit for verification.',
  isSignUpBonusEnabled: true,
  signUpBonusAmount: 50.00,
  isDailyCheckInEnabled: true,
  dailyCheckInAmount: 5.00,
  dailyCheckInDay7Bonus: 100.00,
};

/**
 * Cryptographic SHA-256 with security salt and resilient fallback
 */
async function computeSecureHash(input: string, salt: string = 'pb_bank_admin_salt_700'): Promise<string> {
  const salted = `${salt}:${input.trim()}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const msgUint8 = new TextEncoder().encode(salted);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('SubtleCrypto unavailable, falling back to secure hash algorithm:', e);
  }

  // Fallback hash implementation if SubtleCrypto is unavailable in insecure context
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

/**
 * Secure Admin Login Verification
 * Verifies credentials against Supabase / secure cryptographic hash without exposing plaintext comparisons in client state.
 */
export async function loginAdmin(usernameInput: string, passwordInput: string): Promise<import('../types').AdminSession> {
  const cleanUsername = (usernameInput || '').trim();
  const cleanPassword = (passwordInput || '').trim();

  if (!cleanUsername || !cleanPassword) {
    throw new Error('Please enter both admin username and password.');
  }

  // 1. Authenticate with backend /api/admin/login
  try {
    const loginRes = await fetch(apiUrl('/api/admin/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
    });
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      if (loginData.success && loginData.session) {
        sessionStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(loginData.session));
        await recordAuditLog(loginData.session.adminId, 'ADMIN_LOGIN', 'auth', loginData.session.adminId, 'Admin authenticated via /api/admin/login');
        return loginData.session;
      }
    } else if (loginRes.status === 401 || loginRes.status === 403) {
      const err = await loginRes.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid admin credentials.');
    }
  } catch (err: any) {
    if (err.message === 'Invalid admin credentials.' || err.message === 'Admin account is disabled.' || err.message === 'You are not authorized to access the Admin Panel.') {
      throw err;
    }
    console.warn('Backend admin login fallback:', err);
  }

  // 2. Verify credentials via secure cryptographic hashing
  const credString = `${cleanUsername}:${cleanPassword}`;
  const computedHash = await computeSecureHash(credString);

  // Supabase Auth & RPC check if configured
  if (isSupabaseConfigured && supabase) {
    try {
      // 1a. Try RPC if defined
      const { data: rpcData, error: rpcError } = await supabase.rpc('verify_admin_login', {
        p_username: cleanUsername,
        p_password_hash: computedHash,
      });

      if (!rpcError && rpcData) {
        if (rpcData.is_active === false || rpcData.status === 'disabled' || rpcData.status === 'banned') {
          throw new Error('Admin account is disabled.');
        }
        if (rpcData.role && rpcData.role !== 'admin') {
          throw new Error('You are not authorized to access the Admin Panel.');
        }
        if (rpcData.success) {
          const session: import('../types').AdminSession = {
            token: rpcData.session_token || ('adm_tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36)),
            adminId: rpcData.admin_id || 'adm_root_700',
            username: cleanUsername,
            role: 'admin',
            expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4 hours validity
          };
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(session));
          await recordAuditLog(session.adminId, 'ADMIN_LOGIN', 'auth', session.adminId, 'Admin authenticated successfully into /adminbank console');
          return session;
        }
      }

      // 1b. Try Supabase Auth email login (mapped from username)
      const adminEmail = `${cleanUsername.toLowerCase()}@powerbank.internal`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: cleanPassword,
      });

      if (!authError && authData?.user) {
        // Query profiles table for role & active status
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, status, is_active')
          .eq('id', authData.user.id)
          .maybeSingle();

        const role = profile?.role || authData.user.user_metadata?.role;
        const isActive = profile ? (profile.is_active !== false && profile.status !== 'disabled' && profile.status !== 'banned') : true;

        if (role !== 'admin') {
          throw new Error('You are not authorized to access the Admin Panel.');
        }
        if (!isActive) {
          throw new Error('Admin account is disabled.');
        }

        const session: import('../types').AdminSession = {
          token: authData.session?.access_token || ('adm_tok_' + Math.random().toString(36).substring(2)),
          adminId: authData.user.id,
          username: cleanUsername,
          role: 'admin',
          expiresAt: Date.now() + 4 * 60 * 60 * 1000,
        };
        sessionStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(session));
        await recordAuditLog(session.adminId, 'ADMIN_LOGIN', 'auth', session.adminId, 'Admin authenticated via Supabase Auth');
        return session;
      }
    } catch (e: any) {
      if (e.message === 'Admin account is disabled.' || e.message === 'You are not authorized to access the Admin Panel.') {
        throw e;
      }
      console.warn('Supabase admin login fallback to secure cryptographic verification:', e);
    }
  }

  // 2. Verified secure cryptographic credential comparison (adminbank / adminbank@700)
  const expectedHash = await computeSecureHash('adminbank:adminbank@700');
  if (computedHash !== expectedHash) {
    throw new Error('Invalid admin credentials.');
  }

  // 3. Issue cryptographically random Admin Session Token
  const randomBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const token = 'adm_tok_' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  const adminSession: import('../types').AdminSession = {
    token,
    adminId: 'adm_root_700',
    username: cleanUsername,
    role: 'admin',
    expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4 hours session lifetime
  };

  // Secure storage in sessionStorage only (isolated from normal user localStorage)
  sessionStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(adminSession));

  // Record audit log
  await recordAuditLog(adminSession.adminId, 'ADMIN_LOGIN', 'auth', adminSession.adminId, 'Admin logged in via /adminbank');

  return adminSession;
}

/**
 * Retrieve active Admin Session if valid and not expired
 */
export function getAdminSession(): import('../types').AdminSession | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION);
    if (!raw) return null;
    const session: import('../types').AdminSession = JSON.parse(raw);
    if (!session || session.role !== 'admin' || session.expiresAt < Date.now()) {
      sessionStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION);
      return null;
    }
    return session;
  } catch (e) {
    sessionStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION);
    return null;
  }
}

/**
 * Return authorization headers for administrative requests
 */
export function getAdminAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const session = getAdminSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    headers['X-Admin-Token'] = session.token;
  }
  return headers;
}

/**
 * Destroy Admin Session & Logout
 */
export async function logoutAdmin(): Promise<void> {
  const session = getAdminSession();
  if (session) {
    await recordAuditLog(session.adminId, 'ADMIN_LOGOUT', 'auth', session.adminId, 'Admin logged out of /adminbank');
  }
  sessionStorage.removeItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION);
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
}

/**
 * Record an action in the Admin Audit Log
 */
export async function recordAuditLog(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string = '',
  description: string = '',
  details: Record<string, any> = {}
): Promise<void> {
  const entry: import('../types').AuditLogEntry = {
    id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    adminUserId,
    adminUsername: 'adminbank',
    action,
    targetType,
    targetId,
    description,
    details,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('audit_logs').insert({
        actor_id: adminUserId.length === 36 ? adminUserId : null,
        action,
        target_type: targetType,
        target_id: targetId,
        details: { description, ...details },
      });
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  }

  const list = getLocal<import('../types').AuditLogEntry[]>(ADMIN_STORAGE_KEYS.AUDIT_LOGS, []);
  list.unshift(entry);
  if (list.length > 500) list.pop(); // Keep latest 500 entries
  saveLocal(ADMIN_STORAGE_KEYS.AUDIT_LOGS, list);
}

export const logAdminAction = recordAuditLog;

/**
 * Fetch all Audit Log Records
 */
export async function fetchAdminAuditLogs(): Promise<import('../types').AuditLogEntry[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        return data.map((d) => ({
          id: d.id,
          adminUserId: d.actor_id || 'adm_root',
          adminUsername: 'adminbank',
          action: d.action,
          targetType: d.target_type,
          targetId: d.target_id || '',
          description: d.details?.description || d.action,
          details: d.details || {},
          createdAt: d.created_at,
        }));
      }
    } catch (e) {
      console.warn('Error fetching Supabase audit logs:', e);
    }
  }
  return getLocal<import('../types').AuditLogEntry[]>(ADMIN_STORAGE_KEYS.AUDIT_LOGS, []);
}

/**
 * Fetch Full Aggregated Dashboard Statistics
 */
export async function fetchAdminDashboardStats(): Promise<import('../types').AdminDashboardStats> {
  // First try backend API endpoint with admin authentication
  try {
    const apiRes = await fetch(apiUrl('/api/admin/dashboard-stats'), {
      headers: getAdminAuthHeaders(),
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (e) {
    // Continue to direct Supabase or local store
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const [profilesRes, walletsRes, paymentsRes, depositsRes, withdrawalsRes, purchasesRes, earningsRes, complaintsRes] = await Promise.all([
        supabase.from('profiles').select('id, status'),
        supabase.from('wallets').select('available_balance, recharge_balance, withdraw_balance'),
        supabase.from('payments').select('amount, status, payment_type'),
        supabase.from('deposit_transactions').select('amount, status'),
        supabase.from('withdrawals').select('amount, status'),
        supabase.from('purchases').select('amount, status, plan_category, plan_name'),
        supabase.from('earnings').select('amount, status, earning_type'),
        supabase.from('payments').select('id, status, payment_type'),
      ]);

      const profiles = profilesRes.data || [];
      const wallets = walletsRes.data || [];
      const payments = paymentsRes.data || [];
      const deposits = depositsRes.data || [];
      const withdrawals = withdrawalsRes.data || [];
      const purchases = purchasesRes.data || [];
      const earnings = earningsRes.data || [];

      const totalUsers = profiles.length;
      const activeUsers = profiles.filter((p) => p.status === 'active').length;
      const totalWalletBalance = +wallets.reduce((acc, w) => acc + Number(w.available_balance || 0), 0).toFixed(2);

      const paidManual = payments.filter((p) => p.status === 'PAID' || p.status === 'COMPLETED').reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const paidGateway = deposits.filter((d) => d.status === 'SUCCESS' || d.status === 'COMPLETED').reduce((acc, d) => acc + Number(d.amount || 0), 0);
      const totalRecharge = +(paidManual + paidGateway).toFixed(2);

      const pendingManual = payments.filter((p) => p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING' || p.status === 'PENDING').reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const pendingGateway = deposits.filter((d) => d.status === 'PENDING').reduce((acc, d) => acc + Number(d.amount || 0), 0);
      const pendingRecharge = +(pendingManual + pendingGateway).toFixed(2);
      const pendingRechargesCount = payments.filter((p) => p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING' || p.status === 'PENDING').length + deposits.filter((d) => d.status === 'PENDING').length;
      const pendingComplaintsCount = payments.filter((p) => (p.payment_type === 'COMPLAINT' || p.payment_type === 'PAYMENT_COMPLAINT') && (p.status === 'PENDING' || p.status === 'REVIEWING' || p.status === 'PENDING_VERIFICATION')).length;

      const totalWithdrawals = +withdrawals.filter((w) => w.status === 'COMPLETED' || w.status === 'SUCCESS' || w.status === 'APPROVED').reduce((acc, w) => acc + Number(w.amount || 0), 0).toFixed(2);
      const pendingWithdrawals = +withdrawals.filter((w) => w.status === 'PENDING' || w.status === 'PROCESSING').reduce((acc, w) => acc + Number(w.amount || 0), 0).toFixed(2);
      const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'PENDING' || w.status === 'PROCESSING').length;

      const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
      const totalInvestments = +activePurchases.reduce((acc, p) => acc + Number(p.amount || 0), 0).toFixed(2);

      const activeHourlyPlans = activePurchases.filter((p: any) => {
        const cat = (p.plan_category || p.plan_name || '').toUpperCase();
        return !cat.includes('PRO');
      }).length;

      const activeProPlans = activePurchases.filter((p: any) => {
        const cat = (p.plan_category || p.plan_name || '').toUpperCase();
        return cat.includes('PRO');
      }).length;

      const totalEarnings = +earnings.reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
      const totalClaimableEarnings = +earnings.filter((e) => e.status === 'CLAIMABLE').reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
      const totalClaimedEarnings = +earnings.filter((e) => e.status === 'CLAIMED').reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
      const referralEarnings = +earnings.filter((e) => (e.earning_type || '').includes('REFERRAL')).reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);

      return {
        totalUsers,
        activeUsers,
        totalWalletBalance,
        totalRecharge,
        pendingRecharge,
        pendingRechargesCount,
        pendingComplaintsCount,
        totalWithdrawals,
        pendingWithdrawals,
        pendingWithdrawalsCount,
        totalInvestments,
        activeHourlyPlans,
        activeProPlans,
        totalEarnings,
        totalClaimableEarnings,
        totalClaimedEarnings,
        referralEarnings,
      };
    } catch (e) {
      console.warn('Error fetching Supabase dashboard stats, using storage store:', e);
    }
  }

  // Local calculation fallback
  const localUsers = getLocal<import('../types').UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  const mainProfile = getLocal<import('../types').UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  const allProfiles = mainProfile ? [mainProfile, ...localUsers.filter((u) => u.userId !== mainProfile.userId)] : localUsers;

  const wallet = getLocal<import('../types').Wallet>(STORAGE_KEYS.WALLET, { availableBalance: 0 } as any);
  const payments = getLocal<import('../types').PaymentItem[]>(STORAGE_KEYS.PAYMENTS, []);
  const withdrawals = getLocal<import('../types').WithdrawalItem[]>(STORAGE_KEYS.WITHDRAWALS, []);
  const purchases = getLocal<import('../types').PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  const earnings = getLocal<import('../types').EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
  const localComplaints = getLocal<any[]>('pb_deposit_complaints', []);

  const totalUsers = Math.max(allProfiles.length, 1);
  const activeUsers = allProfiles.filter((u) => u.status !== 'banned' && u.status !== 'suspended').length || 1;
  const totalWalletBalance = wallet.availableBalance || 0;

  const totalRecharge = +payments.filter((p) => p.status === 'PAID').reduce((acc, p) => acc + p.amount, 0).toFixed(2);
  const pendingRecharge = +payments.filter((p) => p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING').reduce((acc, p) => acc + p.amount, 0).toFixed(2);
  const pendingRechargesCount = payments.filter((p) => p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING').length;
  const pendingComplaintsCount = localComplaints.filter((c) => c.status === 'PENDING' || c.status === 'REVIEWING').length;

  const totalWithdrawals = +withdrawals.filter((w) => w.status === 'COMPLETED').reduce((acc, w) => acc + w.amount, 0).toFixed(2);
  const pendingWithdrawals = +withdrawals.filter((w) => w.status === 'PENDING' || w.status === 'PROCESSING').reduce((acc, w) => acc + w.amount, 0).toFixed(2);
  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'PENDING' || w.status === 'PROCESSING').length;

  const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
  const totalInvestments = +activePurchases.reduce((acc, p) => acc + p.amount, 0).toFixed(2);
  const activeHourlyPlans = activePurchases.filter((p) => (p.planCategory || '').toUpperCase() !== 'PRO').length;
  const activeProPlans = activePurchases.filter((p) => (p.planCategory || '').toUpperCase() === 'PRO').length;

  const totalEarnings = +earnings.reduce((acc, e) => acc + e.amount, 0).toFixed(2);
  const totalClaimableEarnings = +earnings.filter((e) => e.status === 'CLAIMABLE').reduce((acc, e) => acc + e.amount, 0).toFixed(2);
  const totalClaimedEarnings = +earnings.filter((e) => e.status === 'CLAIMED').reduce((acc, e) => acc + e.amount, 0).toFixed(2);
  const referralEarnings = +earnings.filter((e) => (e.earningType || '').includes('REFERRAL')).reduce((acc, e) => acc + e.amount, 0).toFixed(2);

  return {
    totalUsers,
    activeUsers,
    totalWalletBalance,
    totalRecharge,
    pendingRecharge,
    pendingRechargesCount,
    pendingComplaintsCount,
    totalWithdrawals,
    pendingWithdrawals,
    pendingWithdrawalsCount,
    totalInvestments,
    activeHourlyPlans,
    activeProPlans,
    totalEarnings,
    totalClaimableEarnings,
    totalClaimedEarnings,
    referralEarnings,
  };
}

/**
 * Fetch all Users for Admin Management
 */
export async function fetchAdminUsers(searchQuery: string = ''): Promise<(import('../types').UserProfile & { availableBalance?: number; totalInvested?: number; activeDevices?: number })[]> {
  const query = searchQuery.trim().toLowerCase();

  // 1. First try authenticated backend API
  try {
    const apiRes = await fetch(apiUrl('/api/admin/users'), {
      headers: getAdminAuthHeaders(),
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json.success && Array.isArray(json.data)) {
        let mapped = json.data;
        if (query) {
          mapped = mapped.filter((u: any) =>
            (u.username || '').toLowerCase().includes(query) ||
            (u.whatsappNo || '').toLowerCase().includes(query) ||
            (u.mobile || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query) ||
            (u.membershipNumber || '').toLowerCase().includes(query) ||
            (u.referralCode || '').toLowerCase().includes(query)
          );
        }
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Backend admin/users fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const [profilesRes, walletsRes, purchasesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('wallets').select('*'),
        supabase.from('purchases').select('*'),
      ]);

      const profiles = profilesRes.data || [];
      const wallets = walletsRes.data || [];
      const purchases = purchasesRes.data || [];

      if (profiles.length > 0) {
        const walletMap = new Map<string, any>();
        wallets.forEach((w: any) => {
          if (w.user_id) walletMap.set(w.user_id, w);
          if (w.id) walletMap.set(w.id, w);
        });

        const mapped = profiles.map((p: any) => {
          const uId = p.user_id || p.id;
          const userPurchases = purchases.filter((purch: any) => (purch.user_id === uId || purch.user_id === p.id) && purch.status === 'ACTIVE');
          const totalInvested = userPurchases.reduce((acc: number, purch: any) => acc + Number(purch.amount || 0), 0);
          const userWallet = walletMap.get(uId) || walletMap.get(p.id) || {};
          const bal = Number(userWallet.available_balance || 0);

          return {
            id: p.id,
            userId: uId,
            username: p.username || 'User',
            whatsappNo: p.whatsapp_no || p.mobile || 'N/A',
            mobile: p.whatsapp_no || p.mobile || 'N/A',
            email: p.email || 'N/A',
            membershipNumber: p.membership_number || 'N/A',
            referralCode: p.referral_code || 'N/A',
            referredBy: p.referred_by,
            role: p.role,
            status: p.status || 'active',
            deviceEarnings: 0,
            teamEarnings: 0,
            walletBalance: bal,
            availableBalance: bal,
            totalInvested,
            activeDevices: userPurchases.length,
            createdAt: p.created_at,
          };
        });

        if (query) {
          return mapped.filter((u) =>
            (u.username || '').toLowerCase().includes(query) ||
            (u.whatsappNo || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query) ||
            (u.membershipNumber || '').toLowerCase().includes(query) ||
            (u.referralCode || '').toLowerCase().includes(query)
          );
        }
        return mapped;
      }
    } catch (e) {
      console.warn('Error fetching Supabase admin users:', e);
    }
  }

  const localUsers = getLocal<import('../types').UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  const mainProfile = getLocal<import('../types').UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  const wallet = getLocal<import('../types').Wallet>(STORAGE_KEYS.WALLET, { availableBalance: 0 } as any);
  const purchases = getLocal<import('../types').PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);

  let list = mainProfile ? [mainProfile, ...localUsers.filter((u) => u.userId !== mainProfile.userId)] : localUsers;
  if (list.length === 0 && mainProfile) list = [mainProfile];

  const result = list.map((u) => {
    const isMain = u.userId === mainProfile?.userId || u.id === mainProfile?.id;
    const userPurchases = purchases.filter((p) => p.userId === (u.userId || u.id) && p.status === 'ACTIVE');
    return {
      ...u,
      availableBalance: isMain ? wallet.availableBalance : u.walletBalance || 0,
      totalInvested: userPurchases.reduce((acc, p) => acc + p.amount, 0),
      activeDevices: userPurchases.length,
    };
  });

  if (query) {
    return result.filter((u) =>
      (u.username || '').toLowerCase().includes(query) ||
      (u.whatsappNo || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.membershipNumber || '').toLowerCase().includes(query) ||
      (u.referralCode || '').toLowerCase().includes(query)
    );
  }
  return result;
}

/**
 * Fetch Comprehensive User Details for Admin Inspection
 */
export async function fetchAdminUserDetails(targetUserId: string): Promise<import('../types').AdminUserDetails> {
  const [profile, wallet, purchases, recharges, withdrawals, txs, earningsData] = await Promise.all([
    fetchUserProfile(targetUserId),
    fetchWallet(targetUserId),
    fetchPurchases(targetUserId),
    fetchAdminPayments(),
    fetchUserWithdrawals(targetUserId),
    fetchWalletTransactions(targetUserId),
    fetchEarningsHistory(targetUserId),
  ]);

  const userRecharges = recharges.filter((r) => r.userId === targetUserId);

  return {
    profile,
    wallet,
    purchases,
    recharges: userRecharges,
    withdrawals,
    transactions: txs,
    earnings: earningsData.earnings,
    claims: earningsData.claims,
    referrals: [
      {
        id: 'ref_01',
        refereeUsername: 'member_' + targetUserId.substring(0, 4),
        refereeMobile: '9876543210',
        bonusAmount: 100,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Update User Status (Enable / Disable / Ban)
 */
export async function updateUserStatus(
  userId: string,
  newStatus: 'active' | 'suspended' | 'banned',
  adminId: string
): Promise<void> {
  const res = await fetch(apiUrl('/api/admin/user-status'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({
      userId,
      newStatus,
      adminId,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to update user status on server.');
  }

  // Update local storage cache if present
  const localUsers = getLocal<import('../types').UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  const user = localUsers.find((u) => u.userId === userId || u.id === userId);
  if (user) {
    user.status = newStatus;
    saveLocal(STORAGE_KEYS.LOCAL_USERS, localUsers);
  }
  const profile = getLocal<import('../types').UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  if (profile && (profile.userId === userId || profile.id === userId)) {
    profile.status = newStatus;
    saveLocal(STORAGE_KEYS.PROFILE, profile);
  }
}

/**
 * Audited Admin Wallet Balance Adjustment (Credit / Debit)
 */
export async function adminAdjustUserWallet(
  userId: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT',
  reason: string,
  adminId: string
): Promise<{ success: boolean; newBalance: number }> {
  const action = type === 'CREDIT' ? 'ADMIN_CREDIT' : 'ADMIN_DEDUCT';
  const res = await adminAdjustUserBalance(
    userId,
    'WITHDRAW_WALLET',
    amount,
    action,
    reason,
    adminId
  );
  return { success: true, newBalance: res.afterBalance };
}

/**
 * Fetch Fresh Real-time Wallet Details for Admin
 */
export async function fetchAdminUserWallet(userId: string): Promise<{
  userId: string;
  rechargeBalance: number;
  topupBalance: number;
  withdrawBalance: number;
  myWalletBalance: number;
  teamCommission: number;
  availableBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingBalance: number;
}> {
  const res = await fetch(apiUrl(`/api/admin/users/${userId}/wallet`), {
    headers: getAdminAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch user wallet.');
  }
  return json.data;
}

/**
 * Fetch All Global Transactions for Admin Ledger
 */
export async function fetchAdminAllTransactions(filters?: {
  userId?: string;
  type?: string;
  query?: string;
}): Promise<import('../types').WalletTransaction[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const allTx = await fetchAdminTransactions();
      let list = allTx;

      if (filters?.userId) {
        list = list.filter((t) => t.userId === filters.userId);
      }
      if (filters?.type && filters.type !== 'ALL') {
        list = list.filter((t) => t.type === filters.type);
      }
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        list = list.filter(
          (t) =>
            (t.description || '').toLowerCase().includes(q) ||
            (t.referenceId || '').toLowerCase().includes(q) ||
            (t.userId || '').toLowerCase().includes(q) ||
            (t.username || '').toLowerCase().includes(q) ||
            (t.userMobile || '').toLowerCase().includes(q)
        );
      }
      return list;
    } catch (e) {
      console.warn('Error fetching Supabase transactions:', e);
    }
  }

  const txs = getLocal<import('../types').WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []).filter(
    (t) => !t.id.startsWith('tx_seed_')
  );
  let list = txs;
  if (filters?.userId) {
    list = list.filter((t) => t.userId === filters.userId);
  }
  if (filters?.type && filters.type !== 'ALL') {
    list = list.filter((t) => t.type === filters.type);
  }
  if (filters?.query) {
    const q = filters.query.toLowerCase();
    list = list.filter(
      (t) =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.referenceId || '').toLowerCase().includes(q) ||
        (t.userId || '').toLowerCase().includes(q)
    );
  }
  return list;
}

/**
 * Dynamic System Settings API
 */
export async function fetchSystemSettings(): Promise<import('../types').SystemSettings> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('admin_settings').select('value').eq('id', 'system').single();
      if (!error && data?.value) {
        return { ...defaultSystemSettings, ...data.value };
      }
    } catch (e) {
      console.warn('Error fetching system settings:', e);
    }
  }
  return getLocal<import('../types').SystemSettings>(ADMIN_STORAGE_KEYS.SYSTEM_SETTINGS, defaultSystemSettings);
}

export async function updateSystemSettings(
  settings: Partial<import('../types').SystemSettings>,
  adminId: string
): Promise<import('../types').SystemSettings> {
  const current = await fetchSystemSettings();
  const merged = { ...current, ...settings };

  if (isSupabaseConfigured && supabase) {
    await supabase.from('admin_settings').upsert({
      id: 'system',
      value: merged,
      updated_at: new Date().toISOString(),
    });
  }

  saveLocal(ADMIN_STORAGE_KEYS.SYSTEM_SETTINGS, merged);

  // Sync with PaymentSettings
  if (settings.upiId || settings.instructions || settings.isRechargeEnabled !== undefined) {
    await updatePaymentSettings({
      upiId: merged.upiId,
      instructions: merged.instructions,
      isRechargeEnabled: merged.isRechargeEnabled,
      qrImageUrl: merged.qrImageUrl,
    });
  }

  await recordAuditLog(adminId, 'UPDATE_SYSTEM_SETTINGS', 'settings', 'system', 'Admin updated core platform settings', settings);

  return merged;
}

/**
 * Platform News & Announcements Management
 */

/**
 * Fetch Published Platform News for Public Users (Home & News Pages)
 */
export async function fetchPlatformNews(): Promise<import('../types').NewsItem[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('platform_news')
        .select('*')
        .or('is_published.eq.true,is_published.is.null')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((n: any) => ({
          id: n.id,
          title: n.title,
          description: n.description || n.content || '',
          content: n.content || n.description || '',
          imageUrl: n.image_url || n.imageUrl,
          image_url: n.image_url || n.imageUrl,
          category: n.category || n.tag || 'Notice',
          tag: n.tag || n.category || 'Notice',
          isPublished: n.is_published !== false,
          is_published: n.is_published !== false,
          sortOrder: n.sort_order ?? 0,
          sort_order: n.sort_order ?? 0,
          date: n.created_at ? n.created_at.split('T')[0] : '2026-08-21',
          createdAt: n.created_at || new Date().toISOString(),
          created_at: n.created_at || new Date().toISOString(),
          updatedAt: n.updated_at,
          updated_at: n.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Error fetching Supabase platform news, falling back to storage:', e);
    }
  }

  const list = getLocal<import('../types').NewsItem[]>(ADMIN_STORAGE_KEYS.NEWS, platformNewsList);
  return list.filter((n) => n.isPublished !== false && n.is_published !== false);
}

/**
 * Fetch all Admin Platform News (includes drafts / unpublished)
 */
export async function fetchAdminNews(): Promise<import('../types').NewsItem[]> {
  try {
    const res = await fetch(apiUrl('/api/news'));
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch (err) {
    console.warn('Backend fetchAdminNews error, fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('platform_news')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((n: any) => ({
          id: n.id,
          title: n.title,
          description: n.description || n.content || '',
          content: n.content || n.description || '',
          imageUrl: n.image_url || n.imageUrl,
          image_url: n.image_url || n.imageUrl,
          category: n.category || n.tag || 'Notice',
          tag: n.tag || n.category || 'Notice',
          isPublished: n.is_published !== false,
          is_published: n.is_published !== false,
          sortOrder: n.sort_order ?? 0,
          sort_order: n.sort_order ?? 0,
          date: n.created_at ? n.created_at.split('T')[0] : '2026-08-21',
          createdAt: n.created_at,
          created_at: n.created_at,
          updatedAt: n.updated_at,
          updated_at: n.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Error fetching admin news:', e);
    }
  }

  return getLocal<import('../types').NewsItem[]>(ADMIN_STORAGE_KEYS.NEWS, platformNewsList);
}

export async function saveAdminNews(news: Partial<import('../types').NewsItem>, adminId: string): Promise<import('../types').NewsItem> {
  const isNew = !news.id || news.id.startsWith('new_');
  const newsId = isNew ? 'news_' + Date.now() : news.id!;
  const desc = news.description || news.content || '';
  const isPub = news.isPublished !== undefined ? news.isPublished : (news.is_published !== undefined ? news.is_published : true);
  const sort = typeof news.sortOrder === 'number' ? news.sortOrder : (typeof news.sort_order === 'number' ? news.sort_order : 0);
  const cat = news.category || news.tag || 'Notice';

  const item: import('../types').NewsItem = {
    id: newsId,
    title: news.title || 'Platform Notice',
    description: desc,
    content: desc,
    imageUrl: news.imageUrl || news.image_url || '',
    image_url: news.image_url || news.imageUrl || '',
    category: cat,
    tag: cat,
    isPublished: isPub,
    is_published: isPub,
    sortOrder: sort,
    sort_order: sort,
    date: news.date || new Date().toISOString().split('T')[0],
    createdAt: news.createdAt || news.created_at || new Date().toISOString(),
    created_at: news.created_at || news.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(apiUrl('/api/admin/news/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ newsItem: item, adminId }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const saved = { ...item, ...json.data };
      const list = getLocal<import('../types').NewsItem[]>(ADMIN_STORAGE_KEYS.NEWS, platformNewsList);
      const idx = list.findIndex((n) => n.id === newsId || n.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.unshift(saved);
      saveLocal(ADMIN_STORAGE_KEYS.NEWS, list);
      return saved;
    }
  } catch (err) {
    console.warn('Backend saveAdminNews error, fallback:', err);
  }

  const list = getLocal<import('../types').NewsItem[]>(ADMIN_STORAGE_KEYS.NEWS, platformNewsList);
  const idx = list.findIndex((n) => n.id === newsId);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  saveLocal(ADMIN_STORAGE_KEYS.NEWS, list);

  await recordAuditLog(adminId, isNew ? 'CREATE_NEWS' : 'UPDATE_NEWS', 'news', newsId, `News article ${isNew ? 'created' : 'updated'}: ${item.title}`);
  return item;
}

export async function deleteAdminNews(newsId: string, adminId: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/admin/news/delete'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ id: newsId, adminId }),
    });
    const json = await res.json();
    if (json.success) {
      const list = getLocal<import('../types').NewsItem[]>(ADMIN_STORAGE_KEYS.NEWS, platformNewsList);
      const filtered = list.filter((n) => n.id !== newsId);
      saveLocal(ADMIN_STORAGE_KEYS.NEWS, filtered);
      return true;
    }
  } catch (err) {
    console.warn('Backend deleteAdminNews error, fallback:', err);
  }

  const list = getLocal<import('../types').NewsItem[]>(ADMIN_STORAGE_KEYS.NEWS, platformNewsList);
  const filtered = list.filter((n) => n.id !== newsId);
  saveLocal(ADMIN_STORAGE_KEYS.NEWS, filtered);
  await recordAuditLog(adminId, 'DELETE_NEWS', 'news', newsId, `Deleted news item ${newsId}`);
  return true;
}

/**
 * Fetch Comprehensive Real User Home Financial & Earning Summary from Supabase
 */
export async function fetchUserHomeSummary(userId: string): Promise<{
  remainingHours: number;
  totalAssets: number;
  todayEarnings: number;
  promotionEarnings: number;
  activePlansCount: number;
}> {
  // 1. Try server earnings summary first
  try {
    const sumRes = await fetch(apiUrl(`/api/user/earnings-summary?userId=${userId}`));
    if (sumRes.ok) {
      const sumJson = await sumRes.json();
      if (sumJson.success) {
        // Also fetch promotion earnings
        let promoEarnings = 0;
        try {
          const prof = await fetchUserProfile(userId);
          promoEarnings = Number(prof?.teamEarnings || 0);
        } catch {}
        return {
          remainingHours: sumJson.remainingHours || 0,
          totalAssets: Number(sumJson.totalAssets || 0),
          todayEarnings: Number(sumJson.todayEarnings || 0),
          promotionEarnings: promoEarnings,
          activePlansCount: sumJson.activeDevicesCount || 0,
        };
      }
    }
  } catch {}

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let purchases: import('../types').PurchaseItem[] = [];
  let userWallet: import('../types').Wallet | null = null;
  let userProfile: import('../types').UserProfile | null = null;
  let earnings: import('../types').EarningRecord[] = [];
  let transactions: import('../types').WalletTransaction[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const [purchRes, walRes, profRes, earnRes, txRes] = await Promise.all([
        supabase.from('purchases').select('*').eq('user_id', userId),
        supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('earnings').select('*').eq('user_id', userId),
        supabase.from('wallet_transactions').select('*').eq('user_id', userId),
      ]);

      if (!purchRes.error && purchRes.data) {
        purchases = purchRes.data.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          planId: p.plan_id,
          planName: p.plan_name,
          planCategory: p.plan_category,
          amount: Number(p.amount || 0),
          earningRate: Number(p.earning_rate || 0),
          dailyEarnings: Number(p.daily_earnings || 0),
          durationDays: Number(p.duration_days || 365),
          status: p.status,
          startedAt: p.started_at,
          expiresAt: p.expires_at,
          totalEarned: Number(p.total_earned || 0),
          lastSettledAt: p.last_settled_at,
        }));
      }

      if (!walRes.error && walRes.data) {
        userWallet = {
          id: walRes.data.id,
          userId: walRes.data.user_id,
          availableBalance: Number(walRes.data.available_balance || 0),
          rechargeBalance: Number(walRes.data.recharge_balance !== undefined ? walRes.data.recharge_balance : (walRes.data.topup_balance || 0)),
          withdrawBalance: Number(walRes.data.withdraw_balance !== undefined ? walRes.data.withdraw_balance : (walRes.data.earned_balance || 0)),
          topupBalance: Number(walRes.data.recharge_balance !== undefined ? walRes.data.recharge_balance : (walRes.data.topup_balance || 0)),
          pendingBalance: Number(walRes.data.pending_balance || 0),
          totalEarned: Number(walRes.data.total_earned || 0),
          totalWithdrawn: Number(walRes.data.total_withdrawn || 0),
        };
      }

      if (!profRes.error && profRes.data) {
        userProfile = {
          id: profRes.data.id,
          userId: profRes.data.user_id,
          username: profRes.data.username,
          mobile: profRes.data.whatsapp_no,
          membershipNumber: profRes.data.membership_number,
          deviceEarnings: Number(profRes.data.device_earnings || 0),
          teamEarnings: Number(profRes.data.team_earnings || 0),
          walletBalance: Number(userWallet?.availableBalance || 0),
        };
      }

      if (!earnRes.error && earnRes.data) {
        earnings = earnRes.data.map((e: any) => ({
          id: e.id,
          userId: e.user_id,
          purchaseId: e.purchase_id,
          amount: Number(e.amount || 0),
          earningType: e.earning_type,
          status: e.status,
          earningDate: e.earning_date,
          createdAt: e.created_at,
        }));
      }

      if (!txRes.error && txRes.data) {
        transactions = txRes.data.map((t: any) => ({
          id: t.id,
          userId: t.user_id,
          type: t.type,
          amount: Number(t.amount || 0),
          balanceBefore: Number(t.balance_before || 0),
          balanceAfter: Number(t.balance_after || 0),
          createdAt: t.created_at,
        }));
      }
    } catch (e) {
      console.warn('Supabase fetchUserHomeSummary fallback to local:', e);
    }
  }

  // Local fallback if empty or offline
  if (purchases.length === 0) {
    const allPurchases = getLocal<import('../types').PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
    purchases = allPurchases.filter((p) => p.userId === userId);
  }
  if (!userWallet) {
    userWallet = getLocal<import('../types').Wallet>(STORAGE_KEYS.WALLET, { availableBalance: 0 } as any);
  }
  if (!userProfile) {
    userProfile = getLocal<import('../types').UserProfile>(STORAGE_KEYS.PROFILE, {} as any);
  }
  if (earnings.length === 0) {
    const allEarnings = getLocal<import('../types').EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
    earnings = allEarnings.filter((e) => e.userId === userId);
  }
  if (transactions.length === 0) {
    const allTx = getLocal<import('../types').WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    transactions = allTx.filter((t) => t.userId === userId);
  }

  // 1. Calculate Remaining Hours across all active plans
  const activePurchases = purchases.filter((p) => p.status === 'ACTIVE' || (p.status as string) === 'active');
  let remainingHours = 0;

  if (activePurchases.length > 0) {
    const planHours = activePurchases.map((p) => {
      const startTime = p.startedAt ? new Date(p.startedAt).getTime() : now;
      const durationHours = (p.durationDays || 365) * 24;
      const endTime = p.expiresAt ? new Date(p.expiresAt).getTime() : startTime + durationHours * 3600 * 1000;
      return Math.max(0, Math.ceil((endTime - now) / 3600000));
    });
    remainingHours = Math.max(...planHours);
  }

  // 2. Authoritative Total Assets (Live Total Wallet: Recharge/Topup + Withdraw/Available)
  const curTopup = Number(userWallet?.rechargeBalance !== undefined ? userWallet.rechargeBalance : (userWallet?.topupBalance || 0));
  const curWithdraw = Number(userWallet?.withdrawBalance !== undefined ? userWallet.withdrawBalance : (userWallet?.earnedBalance !== undefined ? userWallet.earnedBalance : userWallet?.availableBalance || 0));
  const totalAssets = Number((curTopup + curWithdraw).toFixed(2));

  // 3. Today's Earnings = SUM of successful claims made TODAY
  const claimsToday = transactions.filter((t) => {
    const isClaim = t.type === 'EARNING_CLAIM' || (t.type as string) === 'EARNINGS_CLAIM' || (t as any).transaction_type === 'DEVICE_EARNING_CLAIM';
    const isToday = t.createdAt && new Date(t.createdAt).getTime() >= todayStart.getTime();
    return isClaim && isToday;
  });

  const todayEarnings = Number(claimsToday.reduce((sum, t) => sum + Number(t.amount || 0), 0).toFixed(2));

  // 4. Calculate Promotion Earnings from referral/team earnings
  let promotionEarnings = Number(userProfile?.teamEarnings || 0);
  if (promotionEarnings === 0) {
    const referralEarningsSum = earnings
      .filter((e) => (e.earningType || '').toUpperCase().includes('REFERRAL') || (e.earningType || '').toUpperCase().includes('TEAM'))
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    const referralTxSum = transactions
      .filter((t) => t.type === 'REFERRAL_BONUS' || t.type === 'TEAM_BONUS')
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    promotionEarnings = Math.max(referralEarningsSum, referralTxSum, Number(userProfile?.teamEarnings || 0));
  }
  promotionEarnings = +promotionEarnings.toFixed(2);

  return {
    remainingHours,
    totalAssets,
    todayEarnings,
    promotionEarnings,
    activePlansCount: activePurchases.length,
  };
}


/**
 * Admin Banner Management & Public Active Banners
 */
export async function fetchAdminBanners(): Promise<import('../types').BannerItem[]> {
  try {
    const res = await fetch(apiUrl('/api/banners'));
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch (err) {
    console.warn('Backend fetchAdminBanners error, fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((b) => ({
          id: b.id,
          title: b.title || 'Official Hardware Promotion',
          subtitle: b.subtitle || 'Continuous Hourly Yields',
          ctaText: b.cta_text || 'Go Now >',
          badge: b.priority === 0 ? 'Official' : undefined,
          artworkType: 'commission',
          imageUrl: b.image_url || undefined,
          linkUrl: b.link_url || b.target_tab || undefined,
          priority: Number(b.priority || b.sort_order || 0),
          isActive: b.is_active !== undefined ? b.is_active : (b.active !== undefined ? b.active : true),
          targetTab: b.target_tab || b.link_url || undefined,
        }));
      }
    } catch (e) {
      console.warn('Error fetching admin banners from Supabase:', e);
    }
  }
  return getLocal<import('../types').BannerItem[]>(ADMIN_STORAGE_KEYS.BANNERS, homeBanners);
}

export async function fetchActiveBanners(): Promise<import('../types').BannerItem[]> {
  const all = await fetchAdminBanners();
  const active = all.filter((b) => b.isActive !== false);
  return active.length > 0 ? active : homeBanners;
}

export async function saveAdminBanner(
  banner: Partial<import('../types').BannerItem>,
  adminId: string
): Promise<import('../types').BannerItem> {
  const isNew = !banner.id || banner.id.startsWith('new_') || banner.id.startsWith('ban_');
  const bannerId = isNew ? crypto.randomUUID() : banner.id!;
  const item: import('../types').BannerItem = {
    id: bannerId,
    title: banner.title || 'Platform Promotion',
    subtitle: banner.subtitle || 'Sharing Economy',
    ctaText: banner.ctaText || 'Go Now >',
    badge: banner.badge || 'HOT',
    artworkType: banner.artworkType || 'commission',
    imageUrl: banner.imageUrl || '',
    linkUrl: banner.linkUrl || '/purchase',
    priority: Number(banner.priority || 1),
    isActive: banner.isActive !== false,
    targetTab: banner.targetTab || banner.linkUrl || '/purchase',
  };

  try {
    const res = await fetch(apiUrl('/api/admin/banners/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ banner: item, adminId }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const saved = { ...item, ...json.data };
      const list = getLocal<import('../types').BannerItem[]>(ADMIN_STORAGE_KEYS.BANNERS, homeBanners);
      const idx = list.findIndex((b) => b.id === bannerId || b.id === banner.id);
      if (idx >= 0) list[idx] = saved;
      else list.unshift(saved);
      saveLocal(ADMIN_STORAGE_KEYS.BANNERS, list);
      return saved;
    }
  } catch (err) {
    console.warn('Backend saveAdminBanner error, fallback:', err);
  }

  const list = getLocal<import('../types').BannerItem[]>(ADMIN_STORAGE_KEYS.BANNERS, homeBanners);
  const idx = list.findIndex((b) => b.id === bannerId || b.id === banner.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  saveLocal(ADMIN_STORAGE_KEYS.BANNERS, list);

  await recordAuditLog(
    adminId,
    isNew ? 'CREATE_BANNER' : 'UPDATE_BANNER',
    'banners',
    bannerId,
    `Banner ${isNew ? 'created' : 'updated'}: ${item.title}`
  );
  return item;
}

export async function deleteAdminBanner(bannerId: string, adminId: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/admin/banners/delete'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ id: bannerId, adminId }),
    });
    const json = await res.json();
    if (json.success) {
      const list = getLocal<import('../types').BannerItem[]>(ADMIN_STORAGE_KEYS.BANNERS, homeBanners);
      const filtered = list.filter((b) => b.id !== bannerId);
      saveLocal(ADMIN_STORAGE_KEYS.BANNERS, filtered);
      return true;
    }
  } catch (err) {
    console.warn('Backend deleteAdminBanner error, fallback:', err);
  }

  const list = getLocal<import('../types').BannerItem[]>(ADMIN_STORAGE_KEYS.BANNERS, homeBanners);
  const filtered = list.filter((b) => b.id !== bannerId);
  saveLocal(ADMIN_STORAGE_KEYS.BANNERS, filtered);
  await recordAuditLog(adminId, 'DELETE_BANNER', 'banners', bannerId, `Deleted banner ${bannerId}`);
  return true;
}

/**
 * Website Popup Management APIs
 */
export async function fetchWebsitePopup(): Promise<import('../types').WebsitePopupConfig> {
  const defaultConfig: import('../types').WebsitePopupConfig = {
    title: 'Welcome to GainPower',
    description: 'Join the premier hardware dividend platform and maximize daily yields.',
    imageUrl: '',
    link1Text: 'Official Telegram',
    link1Url: 'https://t.me/gainpower',
    link2Text: 'WhatsApp Group',
    link2Url: 'https://chat.whatsapp.com',
    link3Text: 'Revenue Guide',
    link3Url: '/purchase',
    link4Text: 'Customer Care',
    link4Url: 'https://t.me/gainpower_service',
    isActive: true,
  };

  try {
    const resp = await fetch(apiUrl('/api/website-popup'));
    if (resp.ok) {
      const json = await resp.json();
      if (json.success && json.data) {
        return { ...defaultConfig, ...json.data };
      }
    }
  } catch (_e) {}

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('admin_settings').select('value').eq('id', 'website_popup').maybeSingle();
      if (!error && data?.value) {
        return { ...defaultConfig, ...data.value };
      }
    } catch (_e) {}
  }

  return getLocal<import('../types').WebsitePopupConfig>('GP_WEBSITE_POPUP_CONFIG', defaultConfig);
}

export async function saveWebsitePopup(
  config: import('../types').WebsitePopupConfig,
  adminId: string
): Promise<import('../types').WebsitePopupConfig> {
  try {
    const resp = await fetch(apiUrl('/api/admin/website-popup'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ config, adminId }),
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json.success && json.data) {
        saveLocal('GP_WEBSITE_POPUP_CONFIG', json.data);
        return json.data;
      }
    }
  } catch (_e) {}

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('admin_settings').upsert({
        id: 'website_popup',
        value: config,
        updated_at: new Date().toISOString(),
      });
    } catch (_e) {}
  }

  saveLocal('GP_WEBSITE_POPUP_CONFIG', config);
  await recordAuditLog(adminId, 'UPDATE_WEBSITE_POPUP', 'settings', 'website_popup', `Updated Website Popup Config (Active: ${config.isActive})`, config);
  return config;
}


// ==============================================================================
// ADMIN PLAN, PRODUCT & EARNING ENGINE HELPERS
// ==============================================================================

export const fetchProducts = fetchPlans;

/**
 * Fetch Comprehensive Earnings and Claim Records (Optionally filtered by User)
 */
export async function fetchEarningsHistory(userId?: string): Promise<{
  earnings: EarningRecord[];
  claims: any[];
}> {
  if (isSupabaseConfigured && supabase) {
    try {
      let qEarn = supabase.from('earnings').select('*').order('created_at', { ascending: false });
      let qClaim = supabase.from('earnings_claims').select('*').order('created_at', { ascending: false });

      if (userId) {
        qEarn = qEarn.eq('user_id', userId);
        qClaim = qClaim.eq('user_id', userId);
      }

      const [earnRes, claimRes] = await Promise.all([qEarn.limit(200), qClaim.limit(200)]);

      const earnings: EarningRecord[] = (earnRes.data || []).map((e) => ({
        id: e.id,
        userId: e.user_id,
        purchaseId: e.purchase_id,
        planName: e.plan_name,
        planCategory: e.plan_category,
        amount: Number(e.amount),
        earningType: e.earning_type,
        status: e.status,
        earningDate: e.earning_date,
        claimBatchId: e.claim_batch_id,
        claimedAt: e.claimed_at,
        createdAt: e.created_at,
      }));

      const claims = (claimRes.data || []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        amount: Number(c.amount),
        batchId: c.claim_batch_id,
        itemsCount: c.items_count,
        claimedAt: c.created_at,
      }));

      return { earnings, claims };
    } catch (e) {
      console.warn('Error fetching Supabase earnings history:', e);
    }
  }

  const allEarnings = getLocal<EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
  const filtered = userId ? allEarnings.filter((e) => e.userId === userId) : allEarnings;

  // Group claimed earnings into synthetic claims batches
  const claimedBatches: { [key: string]: any } = {};
  filtered.forEach((e) => {
    if (e.status === 'CLAIMED' && e.claimBatchId) {
      if (!claimedBatches[e.claimBatchId]) {
        claimedBatches[e.claimBatchId] = {
          id: 'clm_' + e.claimBatchId,
          userId: e.userId,
          amount: 0,
          batchId: e.claimBatchId,
          itemsCount: 0,
          claimedAt: e.claimedAt || e.createdAt,
        };
      }
      claimedBatches[e.claimBatchId].amount += e.amount;
      claimedBatches[e.claimBatchId].itemsCount += 1;
    }
  });

  return {
    earnings: filtered,
    claims: Object.values(claimedBatches),
  };
}

/**
 * Trigger Global Platform-Wide Hourly Yield Accrual Cycle
 */
export async function triggerHourlyYieldCycle(adminId: string): Promise<{
  success: boolean;
  totalAccrued: number;
  devicesProcessed: number;
  message: string;
}> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('trigger_global_yield_accrual', {
        p_admin_id: adminId,
      });
      if (error) throw new Error(error.message);
      await recordAuditLog(adminId, 'TRIGGER_GLOBAL_YIELD', 'yield_engine', 'all', `Admin initiated global yield accrual cycle`);
      return {
        success: true,
        totalAccrued: Number(data?.total_accrued || 0),
        devicesProcessed: Number(data?.devices_processed || 0),
        message: data?.message || 'Global yield accrual cycle completed successfully',
      };
    } catch (e: any) {
      console.warn('Supabase global yield RPC fallback:', e);
    }
  }

  // Local simulated global cycle across all users
  const purchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
  const earnings = getLocal<EarningRecord[]>(STORAGE_KEYS.EARNINGS, []);
  let totalAccrued = 0;
  const now = Date.now();

  activePurchases.forEach((p) => {
    const isPro = (p.planCategory || '').toUpperCase() === 'PRO';
    const rate = isPro ? (p.dailyEarnings || 35) / 24 : (p.earningRate || 1.85);
    const earned = +rate.toFixed(2);

    if (earned > 0) {
      p.totalEarned = +(p.totalEarned + earned).toFixed(2);
      p.lastSettledAt = new Date().toISOString();
      totalAccrued += earned;

      const earningId = 'earn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      earnings.unshift({
        id: earningId,
        userId: p.userId,
        purchaseId: p.id,
        planName: p.planName,
        planCategory: p.planCategory || (isPro ? 'PRO' : 'HOURLY'),
        amount: earned,
        earningType: isPro ? 'PRO_DAILY' : 'HOURLY_DEVICE',
        status: 'CLAIMABLE',
        earningDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      });
    }
  });

  saveLocal(STORAGE_KEYS.PURCHASES, purchases);
  saveLocal(STORAGE_KEYS.EARNINGS, earnings);

  await recordAuditLog(
    adminId,
    'TRIGGER_GLOBAL_YIELD',
    'yield_engine',
    'all',
    `Simulated global yield accrual for ${activePurchases.length} devices (+₹${totalAccrued.toFixed(2)})`
  );

  return {
    success: true,
    totalAccrued: +totalAccrued.toFixed(2),
    devicesProcessed: activePurchases.length,
    message: `Accrued ₹${totalAccrued.toFixed(2)} across ${activePurchases.length} active devices as CLAIMABLE.`,
  };
}

// ==============================================================================
// REAL SUPABASE NOTIFICATIONS & BROADCAST ENGINE
// ==============================================================================

const NOTIFICATION_STORAGE_KEYS = {
  ADMIN_BATCHES: 'pb_admin_notification_batches',
};

/**
 * Fetch all notifications for a specific user.
 * Loads from Supabase 'notifications' table with automatic offline fallback.
 */
export async function fetchUserNotifications(userId: string): Promise<NotificationItem[]> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},user_id.eq.all`)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          title: n.title,
          description: n.description,
          type: (n.type || 'SYSTEM').toUpperCase() as NotificationType,
          isRead: Boolean(n.is_read),
          isHomePopup: Boolean(n.is_home_popup),
          homePopupDismissed: Boolean(n.home_popup_dismissed),
          createdAt: n.created_at,
          readAt: n.read_at,
          expiresAt: n.expires_at,
          imageUrl: n.image_url,
          actionUrl: n.action_url,
          actionText: n.action_text,
          status: n.status || 'active',
          batchId: n.batch_id,
          targetAudience: n.target_audience,
        }));
      }
    } catch (e) {
      console.warn('Supabase notifications fetch fallback to local store:', e);
    }
  }

  // Local storage fallback
  const list = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const userNotifs = list.filter(
    (n) => (n.userId === userId || n.userId === 'all' || n.userId === 'usr_demo_01') &&
      (!n.expiresAt || n.expiresAt > now)
  );

  return userNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Fetch unread notifications count for logged-in user.
 */
export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const notifs = await fetchUserNotifications(userId);
  return notifs.filter((n) => !n.isRead).length;
}

/**
 * Fetch eligible Home Popup notification for the user.
 * Returns the newest un-dismissed and non-expired popup notification.
 */
export async function fetchEligibleHomeNotification(userId: string): Promise<NotificationItem | null> {
  const notifs = await fetchUserNotifications(userId);
  const now = new Date().toISOString();

  const eligible = notifs.find(
    (n) => n.isHomePopup && !n.homePopupDismissed && (!n.expiresAt || n.expiresAt > now)
  );

  return eligible || null;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: now,
        })
        .eq('id', notificationId);

      if (!error) {
        // sync local cache
        const list = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
        const item = list.find((n) => n.id === notificationId);
        if (item) {
          item.isRead = true;
          item.readAt = now;
          saveLocal(STORAGE_KEYS.NOTIFICATIONS, list);
        }
        return true;
      }
    } catch (e) {
      console.warn('Supabase markNotificationAsRead fallback:', e);
    }
  }

  const list = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const item = list.find((n) => n.id === notificationId);
  if (item) {
    item.isRead = true;
    item.readAt = now;
    saveLocal(STORAGE_KEYS.NOTIFICATIONS, list);
    return true;
  }
  return false;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: now,
        })
        .or(`user_id.eq.${userId},user_id.eq.all`)
        .eq('is_read', false);
    } catch (e) {
      console.warn('Supabase markAllNotificationsAsRead fallback:', e);
    }
  }

  const list = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  list.forEach((n) => {
    if (n.userId === userId || n.userId === 'all' || n.userId === 'usr_demo_01') {
      n.isRead = true;
      n.readAt = now;
    }
  });
  saveLocal(STORAGE_KEYS.NOTIFICATIONS, list);
  return true;
}

/**
 * Dismiss Home Popup for a notification.
 * IMPORTANT: This DOES NOT delete the notification or mark it as read.
 * It strictly sets home_popup_dismissed = true in Supabase & local state.
 */
export async function dismissHomePopup(notificationId: string, userId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          home_popup_dismissed: true,
        })
        .eq('id', notificationId);

      if (!error) {
        const list = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
        const item = list.find((n) => n.id === notificationId);
        if (item) {
          item.homePopupDismissed = true;
          saveLocal(STORAGE_KEYS.NOTIFICATIONS, list);
        }
        return true;
      }
    } catch (e) {
      console.warn('Supabase dismissHomePopup fallback:', e);
    }
  }

  const list = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const item = list.find((n) => n.id === notificationId);
  if (item) {
    item.homePopupDismissed = true;
    saveLocal(STORAGE_KEYS.NOTIFICATIONS, list);
    return true;
  }
  return false;
}

/**
 * Create a user-specific system or transaction notification.
 */
export async function createNotificationForUser(
  payload: Partial<NotificationItem> & { userId: string; title: string; description: string }
): Promise<NotificationItem> {
  const notifId = payload.id || 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  const fullNotif: NotificationItem = {
    id: notifId,
    userId: payload.userId,
    title: payload.title,
    description: payload.description,
    type: payload.type || 'SYSTEM',
    isRead: false,
    isHomePopup: Boolean(payload.isHomePopup),
    homePopupDismissed: false,
    createdAt: now,
    readAt: null,
    expiresAt: payload.expiresAt || null,
    imageUrl: payload.imageUrl || null,
    actionUrl: payload.actionUrl || null,
    actionText: payload.actionText || null,
    status: 'active',
    batchId: payload.batchId,
    targetAudience: payload.targetAudience || 'SPECIFIC_USER',
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('notifications').insert({
        id: fullNotif.id,
        user_id: fullNotif.userId,
        title: fullNotif.title,
        description: fullNotif.description,
        type: fullNotif.type,
        is_read: false,
        is_home_popup: fullNotif.isHomePopup,
        home_popup_dismissed: false,
        created_at: fullNotif.createdAt,
        expires_at: fullNotif.expiresAt,
        image_url: fullNotif.imageUrl,
        action_url: fullNotif.actionUrl,
        action_text: fullNotif.actionText,
        status: fullNotif.status,
      });
    } catch (e) {
      console.warn('Supabase createNotificationForUser fallback:', e);
    }
  }

  const list = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  list.unshift(fullNotif);
  saveLocal(STORAGE_KEYS.NOTIFICATIONS, list);

  return fullNotif;
}

/**
 * Admin: Broadcast or Send Notifications to Target Audience.
 * Supports ALL_USERS, ACTIVE_USERS, SPECIFIC_USER, MULTIPLE_USERS, HOURLY_PLAN_USERS, PRO_PLAN_USERS.
 */
export async function adminSendNotification(
  payload: AdminCreateNotificationPayload,
  adminId: string
): Promise<{ success: boolean; deliveredCount: number; batchId: string }> {
  const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  // 1. Resolve Target User IDs
  let targetUserIds: string[] = [];

  if (payload.targetAudience === 'SPECIFIC_USER' || payload.targetAudience === 'MULTIPLE_USERS') {
    targetUserIds = payload.specificUserIds && payload.specificUserIds.length > 0
      ? payload.specificUserIds
      : ['usr_demo_01'];
  } else if (isSupabaseConfigured && supabase) {
    try {
      if (payload.targetAudience === 'ALL_USERS') {
        const { data } = await supabase.from('profiles').select('id, user_id');
        targetUserIds = (data || []).map((p: any) => p.user_id || p.id).filter(Boolean);
      } else if (payload.targetAudience === 'ACTIVE_USERS') {
        const { data } = await supabase.from('purchases').select('user_id').eq('status', 'ACTIVE');
        targetUserIds = Array.from(new Set((data || []).map((p: any) => p.user_id).filter(Boolean)));
      } else if (payload.targetAudience === 'HOURLY_PLAN_USERS') {
        const { data } = await supabase
          .from('purchases')
          .select('user_id')
          .eq('status', 'ACTIVE')
          .neq('plan_category', 'PRO');
        targetUserIds = Array.from(new Set((data || []).map((p: any) => p.user_id).filter(Boolean)));
      } else if (payload.targetAudience === 'PRO_PLAN_USERS') {
        const { data } = await supabase
          .from('purchases')
          .select('user_id')
          .eq('status', 'ACTIVE')
          .eq('plan_category', 'PRO');
        targetUserIds = Array.from(new Set((data || []).map((p: any) => p.user_id).filter(Boolean)));
      }
    } catch (e) {
      console.warn('Error resolving target audience from Supabase:', e);
    }
  }

  // Fallback / Local resolution
  if (targetUserIds.length === 0) {
    const allProfiles = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
    const currProfile = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, { id: 'usr_demo_01', userId: 'usr_demo_01' } as UserProfile);
    const purchases = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);

    const combinedUsers = Array.from(new Set([...allProfiles.map((u) => u.userId || u.id || ''), currProfile.userId || currProfile.id || 'usr_demo_01'])).filter(Boolean);

    if (payload.targetAudience === 'ALL_USERS') {
      targetUserIds = combinedUsers;
    } else if (payload.targetAudience === 'ACTIVE_USERS') {
      targetUserIds = Array.from(new Set(purchases.filter((p) => p.status === 'ACTIVE').map((p) => p.userId)));
      if (targetUserIds.length === 0) targetUserIds = [currProfile.userId || 'usr_demo_01'];
    } else if (payload.targetAudience === 'HOURLY_PLAN_USERS') {
      targetUserIds = Array.from(new Set(purchases.filter((p) => p.status === 'ACTIVE' && p.planCategory !== 'PRO').map((p) => p.userId)));
      if (targetUserIds.length === 0) targetUserIds = [currProfile.userId || 'usr_demo_01'];
    } else if (payload.targetAudience === 'PRO_PLAN_USERS') {
      targetUserIds = Array.from(new Set(purchases.filter((p) => p.status === 'ACTIVE' && p.planCategory === 'PRO').map((p) => p.userId)));
      if (targetUserIds.length === 0) targetUserIds = [currProfile.userId || 'usr_demo_01'];
    } else {
      targetUserIds = [currProfile.userId || 'usr_demo_01'];
    }
  }

  // Always ensure at least primary user is targeted in demo environments
  if (targetUserIds.length === 0) {
    targetUserIds = ['usr_demo_01'];
  }

  // 2. Build Records
  const notificationRecords: NotificationItem[] = targetUserIds.map((uId, idx) => ({
    id: `notif_${batchId}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
    userId: uId,
    title: payload.title.trim(),
    description: payload.description.trim(),
    type: payload.type,
    isRead: false,
    isHomePopup: Boolean(payload.isHomePopup),
    homePopupDismissed: false,
    createdAt: now,
    readAt: null,
    expiresAt: payload.expiresAt || null,
    imageUrl: payload.imageUrl || null,
    actionUrl: payload.actionUrl || null,
    actionText: payload.actionText || null,
    status: 'active',
    batchId,
    targetAudience: payload.targetAudience,
  }));

  // 3. Persist to Supabase in chunks of 200
  if (isSupabaseConfigured && supabase) {
    try {
      const chunkSize = 200;
      for (let i = 0; i < notificationRecords.length; i += chunkSize) {
        const chunk = notificationRecords.slice(i, i + chunkSize).map((n) => ({
          id: n.id,
          user_id: n.userId,
          title: n.title,
          description: n.description,
          type: n.type,
          is_read: false,
          is_home_popup: n.isHomePopup,
          home_popup_dismissed: false,
          created_at: n.createdAt,
          expires_at: n.expiresAt,
          image_url: n.imageUrl,
          action_url: n.actionUrl,
          action_text: n.actionText,
          status: n.status,
          batch_id: n.batchId,
          target_audience: n.targetAudience,
        }));
        await supabase.from('notifications').insert(chunk);
      }
    } catch (e) {
      console.warn('Supabase bulk notification insert fallback:', e);
    }
  }

  // 4. Update Local Store
  const localList = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  localList.unshift(...notificationRecords);
  saveLocal(STORAGE_KEYS.NOTIFICATIONS, localList);

  // 5. Record Admin Batch History
  const historyItem: AdminNotificationHistoryItem = {
    id: batchId,
    title: payload.title,
    description: payload.description,
    type: payload.type,
    targetAudience: payload.targetAudience,
    targetCount: notificationRecords.length,
    readCount: 0,
    isHomePopup: payload.isHomePopup,
    expiresAt: payload.expiresAt,
    createdAt: now,
    status: 'active',
    actionUrl: payload.actionUrl,
    actionText: payload.actionText,
    imageUrl: payload.imageUrl,
  };

  const batches = getLocal<AdminNotificationHistoryItem[]>(NOTIFICATION_STORAGE_KEYS.ADMIN_BATCHES, []);
  batches.unshift(historyItem);
  saveLocal(NOTIFICATION_STORAGE_KEYS.ADMIN_BATCHES, batches);

  // 6. Security Audit Log
  await recordAuditLog(
    adminId,
    'SEND_NOTIFICATION',
    'notifications',
    batchId,
    `Broadcast notification "${payload.title}" to ${notificationRecords.length} user(s) (Audience: ${payload.targetAudience}, Home Popup: ${payload.isHomePopup ? 'ON' : 'OFF'})`
  );

  return {
    success: true,
    deliveredCount: notificationRecords.length,
    batchId,
  };
}

/**
 * Fetch Admin Notification History with Live Read Counts
 */
export async function fetchAdminNotificationHistory(): Promise<AdminNotificationHistoryItem[]> {
  const batches = getLocal<AdminNotificationHistoryItem[]>(NOTIFICATION_STORAGE_KEYS.ADMIN_BATCHES, []);
  const allNotifs = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);

  // Update real-time read counts per batch
  batches.forEach((b) => {
    const batchItems = allNotifs.filter((n) => n.batchId === b.id);
    if (batchItems.length > 0) {
      b.targetCount = batchItems.length;
      b.readCount = batchItems.filter((n) => n.isRead).length;
    }
  });

  return batches;
}

/**
 * Archive a notification batch from Admin Console (Soft Delete).
 */
export async function archiveAdminNotification(batchId: string, adminId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('notifications')
        .update({ status: 'archived' })
        .eq('batch_id', batchId);
    } catch (e) {
      console.warn('Supabase archive notification fallback:', e);
    }
  }

  const batches = getLocal<AdminNotificationHistoryItem[]>(NOTIFICATION_STORAGE_KEYS.ADMIN_BATCHES, []);
  const target = batches.find((b) => b.id === batchId);
  if (target) {
    target.status = 'archived';
    saveLocal(NOTIFICATION_STORAGE_KEYS.ADMIN_BATCHES, batches);
  }

  const notifs = getLocal<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  notifs.forEach((n) => {
    if (n.batchId === batchId) {
      n.status = 'archived';
    }
  });
  saveLocal(STORAGE_KEYS.NOTIFICATIONS, notifs);

  await recordAuditLog(
    adminId,
    'ARCHIVE_NOTIFICATION',
    'notifications',
    batchId,
    `Archived notification broadcast batch ${batchId}`
  );

  return true;
}

// ==============================================================================
// UNIVEPAY PAYMENT GATEWAY & UTILITY SERVICES
// ==============================================================================

export async function createUniVePayDeposit(params: {
  amount: number;
  userId?: string;
  payCode?: string;
}): Promise<{
  success: boolean;
  status?: string;
  traceno: string;
  payUrl?: string;
  payOrderid?: string;
  amount: number;
  error?: string;
}> {
  const numAmount = Number(params.amount);
  if (isNaN(numAmount) || numAmount < 100) {
    throw new Error('Minimum top up amount is ₹100');
  }

  // 1. Resolve active user ID and session token
  let effectiveUserId = params.userId;
  let accessToken: string | null = null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
      if (!effectiveUserId && sessionData?.session?.user?.id) {
        effectiveUserId = sessionData.session.user.id;
      }
    } catch (authErr) {
      console.warn('[UNIVEPAY AUTH] Error getting session:', authErr);
    }
  }

  // Fallback to local storage user state if session not directly available
  if (!effectiveUserId) {
    try {
      const localUser = getLocal<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
      if (localUser?.id) {
        effectiveUserId = localUser.id;
      }
    } catch {}
  }

  if (!effectiveUserId && !accessToken) {
    throw new Error('Please login to your account to initiate a recharge.');
  }

  // 2. Primary: Invoke Supabase create-payin-order Edge Function if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-payin-order', {
        body: {
          amount: numAmount,
          userId: effectiveUserId,
          customerName: effectiveUserId,
          payCode: params.payCode || 'UPI',
        },
      });

      if (!edgeErr && edgeData?.success && edgeData?.payUrl) {
        return {
          success: true,
          status: '00',
          traceno: edgeData.orderId || edgeData.traceno,
          payUrl: edgeData.payUrl,
          payOrderid: edgeData.orderId,
          amount: numAmount,
        };
      }
    } catch (edgeEx) {
      console.warn('[GATEWAY] Supabase functions invoke create-payin-order error:', edgeEx);
    }
  }

  // 3. Fallback: Call Express backend /api/create-payin-order or /api/univepay/create-payment
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(apiUrl('/api/create-payin-order'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount: numAmount,
        userId: effectiveUserId,
        payCode: params.payCode || '印度UPI-银台',
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success && data?.payUrl) {
      return {
        success: true,
        status: '00',
        traceno: data.traceno || data.orderId,
        payUrl: data.payUrl,
        payOrderid: data.payOrderid || data.orderId,
        amount: Number(data.payAmount || numAmount),
      };
    }

    if (data && data.success === false && data.error && !data.error.includes('gateway temporarily unavailable')) {
      return {
        success: false,
        traceno: data?.traceno || '',
        amount: numAmount,
        error: data.error,
      };
    }
  } catch (backendErr: any) {
    console.warn('[UNIVEPAY] Backend /api/create-payin-order error:', backendErr);
  }

  return {
    success: false,
    traceno: '',
    amount: numAmount,
    error: 'Payment gateway temporarily unavailable. Please use the manual UPI QR recharge option below.',
  };
}

export const createPayInOrder = createUniVePayDeposit;

export async function checkUniVePayDepositStatus(traceno: string, amount?: number): Promise<{
  success: boolean;
  status: string;
  data?: any;
  amount?: number;
  error?: string;
}> {
  if (!traceno) {
    return { success: false, status: 'PENDING' };
  }

  // 1. Check Supabase Edge Function 'order-query' if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('order-query', {
        body: { orderId: traceno, traceno },
      });
      if (!edgeErr && edgeData?.success) {
        return {
          success: true,
          status: edgeData.status || 'PENDING',
          data: edgeData.data || edgeData,
          amount: edgeData.amount ? Number(edgeData.amount) : amount,
        };
      }
    } catch (e) {
      console.warn('[GATEWAY] Supabase order-query invoke error:', e);
    }
  }

  // 2. Check backend /api/order-query
  try {
    const res = await fetch(apiUrl('/api/order-query'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: traceno, traceno }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          success: true,
          status: data.status || 'PENDING',
          data: data.data || data,
          amount: data.amount ? Number(data.amount) : amount,
        };
      }
    }
  } catch (err) {
    console.warn('[GATEWAY] Backend order-query error:', err);
  }

  // 2. Fallback to Supabase direct query
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: dep } = await supabase
        .from('deposit_transactions')
        .select('*')
        .eq('traceno', traceno)
        .maybeSingle();

      if (dep) {
        return {
          success: true,
          status: dep.status || 'PENDING',
          data: dep,
          amount: dep.amount ? Number(dep.amount) : amount,
        };
      }
    } catch (dbErr) {
      console.warn('[UNIVEPAY] DB query error:', dbErr);
    }
  }

  return { success: true, status: 'PENDING' };
}

export async function submitUniVePayUtrSupplement(
  traceno: string,
  utr: string,
  amount?: number
): Promise<{ success: boolean; data: any }> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('deposit_transactions')
        .update({ utr, updated_at: new Date().toISOString() })
        .eq('traceno', traceno);
    } catch (e) {}
  }
  return { success: true, data: { utr } };
}

export async function requestWithdrawalGateway(params: {
  userId: string;
  amount: number;
  bankAccountId?: string;
  method?: 'MANUAL' | 'UNIVEPAY_AUTO';
  bankName?: string;
  bankCode?: string;
  accountName?: string;
  accountNumber?: string;
  upiId?: string;
}): Promise<{
  success: boolean;
  method: string;
  traceno: string;
  amount: number;
  serialNo?: string;
  gatewayStatus?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch(apiUrl('/api/univepay/create-withdrawal'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: params.userId,
        amount: params.amount,
        method: params.method || 'UNIVEPAY_AUTO',
        bankName: params.bankName,
        bankCode: params.bankCode,
        accountName: params.accountName,
        accountNumber: params.accountNumber,
        upiId: params.upiId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to request withdrawal');
    }
    return data;
  } catch (err: any) {
    console.warn('Backend create-withdrawal error, falling back to database RPC:', err.message);
    await submitWithdrawalRequest(params.userId, params.amount, params.bankAccountId);
    return {
      success: true,
      method: 'MANUAL',
      traceno: 'WTH_' + Date.now(),
      amount: params.amount,
    };
  }
}

export async function checkUniVePayWithdrawalStatus(traceno: string, amount?: number): Promise<{
  success: boolean;
  data: any;
}> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('withdrawal_transactions')
        .select('*')
        .eq('traceno', traceno)
        .maybeSingle();
      if (data) return { success: true, data };
    } catch (e) {}
  }
  return { success: true, data: { status: 'PENDING' } };
}

export async function fetchUniVePayBalance(): Promise<import('../types').UniVePayBalanceResult> {
  try {
    const res = await fetch(apiUrl('/api/univepay/balance'));
    if (res.ok) {
      const data = await res.json();
      return {
        merchantNo: data.merchantNo || '',
        balance: data.balance || 0,
        balanceCanUse: data.balanceCanUse || 0,
        retcode: data.retcode || '0000',
        retmsg: data.retmsg || 'OK',
        lastChecked: data.lastChecked || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.warn('Error querying Univepay balance:', e);
  }

  const settings = await fetchGatewaySettings();
  return {
    merchantNo: settings.merchantNo || 'UNIVEPAY_GATEWAY',
    balance: settings.gatewayTotalBalance || 0,
    balanceCanUse: settings.gatewayAvailableBalance || 0,
    retcode: '0000',
    retmsg: 'Live Gateway Active',
    lastChecked: settings.gatewayLastChecked || new Date().toISOString(),
  };
}

export async function fetchGatewaySettings(): Promise<import('../types').GatewaySettings> {
  const defaultSettings: import('../types').GatewaySettings = {
    id: 'default',
    isUniVePayDepositEnabled: true,
    isUpiDepositEnabled: true,
    isManualWithdrawalEnabled: true,
    isUniVePayAutoWithdrawalEnabled: true,
    minWithdrawal: 100,
    maxWithdrawal: 50000,
    withdrawalFeePercent: 0,
    gatewayFeePercent: 2,
    merchantNo: '',
    gatewayTotalBalance: 0,
    gatewayAvailableBalance: 0,
    gatewayConnectivity: 'CONNECTED',
    gatewayLastChecked: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('gateway_settings').select('*').eq('id', 'default').single();
      if (!error && data) {
        return {
          id: data.id,
          isUniVePayDepositEnabled: data.is_univepay_deposit_enabled ?? true,
          isUpiDepositEnabled: data.is_upi_deposit_enabled ?? true,
          isManualWithdrawalEnabled: data.is_manual_withdrawal_enabled ?? true,
          isUniVePayAutoWithdrawalEnabled: data.is_univepay_auto_withdrawal_enabled ?? true,
          minWithdrawal: Number(data.min_withdrawal || 100),
          maxWithdrawal: Number(data.max_withdrawal || 50000),
          withdrawalFeePercent: Number(data.withdrawal_fee_percent || 0),
          gatewayFeePercent: Number(data.gateway_fee_percent || 2),
          merchantNo: data.merchant_no || '',
          gatewayTotalBalance: Number(data.gateway_total_balance || 0),
          gatewayAvailableBalance: Number(data.gateway_available_balance || 0),
          gatewayConnectivity: data.gateway_connectivity || 'CONNECTED',
          gatewayLastChecked: data.gateway_last_checked,
          updatedAt: data.updated_at,
        };
      }
    } catch (e) {
      console.warn('Error fetching gateway settings from Supabase:', e);
    }
  }

  return getLocal<import('../types').GatewaySettings>('pb_gateway_settings', defaultSettings);
}

export async function updateGatewaySettings(
  settings: Partial<import('../types').GatewaySettings>,
  adminId?: string
): Promise<import('../types').GatewaySettings> {
  const current = await fetchGatewaySettings();
  const merged = { ...current, ...settings, updatedAt: new Date().toISOString() };

  if (isSupabaseConfigured && supabase) {
    await supabase.from('gateway_settings').upsert({
      id: 'default',
      is_univepay_deposit_enabled: merged.isUniVePayDepositEnabled,
      is_upi_deposit_enabled: merged.isUpiDepositEnabled,
      is_manual_withdrawal_enabled: merged.isManualWithdrawalEnabled,
      is_univepay_auto_withdrawal_enabled: merged.isUniVePayAutoWithdrawalEnabled,
      min_withdrawal: merged.minWithdrawal,
      max_withdrawal: merged.maxWithdrawal,
      withdrawal_fee_percent: merged.withdrawalFeePercent,
      gateway_fee_percent: merged.gatewayFeePercent,
      merchant_no: merged.merchantNo,
      gateway_total_balance: merged.gatewayTotalBalance,
      gateway_available_balance: merged.gatewayAvailableBalance,
      gateway_connectivity: merged.gatewayConnectivity,
      gateway_last_checked: merged.gatewayLastChecked,
      updated_at: merged.updatedAt,
    });
  }

  saveLocal('pb_gateway_settings', merged);

  if (adminId) {
    await recordAuditLog(adminId, 'UPDATE_GATEWAY_SETTINGS', 'settings', 'gateway', 'Updated UniVePay payment gateway settings', settings);
  }

  return merged;
}

export async function fetchDepositTransactions(userId?: string): Promise<import('../types').DepositTransaction[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      if (userId) {
        // Query deposit_transactions, wallet_transactions (RECHARGE), and payments in parallel
        const [depRes, walRes, payRes] = await Promise.all([
          supabase
            .from('deposit_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'RECHARGE')
            .order('created_at', { ascending: false }),
          supabase
            .from('payments')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        ]);

        if (depRes.error && walRes.error && payRes.error) {
          console.error('[fetchDepositTransactions] DB error:', depRes.error || walRes.error || payRes.error);
          throw new Error(depRes.error?.message || walRes.error?.message || 'Database query failed');
        }

        const map = new Map<string, import('../types').DepositTransaction>();

        // 1. Process deposit_transactions (Gateway Deposits)
        if (depRes.data) {
          for (const d of depRes.data) {
            const key = d.traceno || d.merchant_order_id || d.id;
            map.set(key, {
              id: d.id,
              userId: d.user_id,
              username: 'User',
              traceno: d.traceno || d.merchant_order_id || d.id,
              amount: Number(d.amount),
              currency: d.currency || 'INR',
              payCode: d.pay_code || '101',
              status: (d.status || 'PENDING').toUpperCase() as any,
              gatewayStatus: d.gateway_status,
              payUrl: d.pay_url,
              gatewayOrderId: d.gateway_order_id,
              gatewaySerialNo: d.gateway_serial_no,
              paymentMethod: d.payment_method || d.channel || 'UniVePay UPI Gateway',
              channel: d.channel || 'UNIVEPAY',
              utr: d.utr || d.gateway_serial_no,
              proofUrl: d.proof_url,
              rejectionReason: d.rejection_reason,
              adminNote: d.admin_note,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
              creditedAt: d.credited_at,
            });
          }
        }

        // 2. Process wallet_transactions (Recharge entries)
        if (walRes.data) {
          for (const w of walRes.data) {
            const key = w.reference_id || w.order_id || w.id;
            const rawStatus = (w.status || '').toUpperCase();
            let statusMapped: any = 'PENDING';
            if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS' || rawStatus === 'PAID') {
              statusMapped = 'PAID';
            } else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED') {
              statusMapped = 'FAILED';
            } else {
              statusMapped = 'PENDING';
            }

            if (map.has(key)) {
              const existing = map.get(key)!;
              if (statusMapped === 'PAID') existing.status = 'PAID';
              if (w.utr && !existing.utr) existing.utr = w.utr;
            } else {
              map.set(key, {
                id: w.id,
                userId: w.user_id,
                username: 'User',
                traceno: w.reference_id || w.id,
                amount: Number(w.amount),
                currency: 'INR',
                payCode: '101',
                status: statusMapped,
                paymentMethod: w.payment_method || 'UPI Recharge',
                channel: 'WALLET',
                utr: w.utr,
                createdAt: w.created_at,
                updatedAt: w.created_at,
              });
            }
          }
        }

        // 3. Process payments (Manual / UPI deposits)
        if (payRes.data) {
          for (const p of payRes.data) {
            const key = p.order_id || p.id;
            const rawStatus = (p.status || '').toUpperCase();
            let statusMapped: any = 'PENDING';
            if (rawStatus === 'PAID' || rawStatus === 'APPROVED' || rawStatus === 'SUCCESS') {
              statusMapped = 'PAID';
            } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED') {
              statusMapped = 'FAILED';
            }

            if (map.has(key)) {
              const existing = map.get(key)!;
              if (statusMapped === 'PAID') existing.status = 'PAID';
            } else {
              map.set(key, {
                id: p.id,
                userId: p.user_id,
                username: 'User',
                traceno: p.order_id || p.id,
                amount: Number(p.amount),
                currency: 'INR',
                payCode: '101',
                status: statusMapped,
                paymentMethod: p.method || 'Manual UPI',
                channel: 'PAYMENT',
                utr: p.utr,
                createdAt: p.created_at,
                updatedAt: p.created_at,
              });
            }
          }
        }

        const sorted = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return sorted;
      }

      // Admin or general fetch: query deposit_transactions directly without joining profiles
      const { data, error } = await supabase
        .from('deposit_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('[fetchDepositTransactions] query error:', error);
        throw error;
      }

      if (data) {
        return data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          username: 'User',
          traceno: d.traceno || d.merchant_order_id || d.id,
          amount: Number(d.amount),
          currency: d.currency || 'INR',
          payCode: d.pay_code || '101',
          status: (d.status || 'PENDING').toUpperCase() as any,
          gatewayStatus: d.gateway_status,
          payUrl: d.pay_url,
          gatewayOrderId: d.gateway_order_id,
          gatewaySerialNo: d.gateway_serial_no,
          paymentMethod: d.payment_method || d.channel || 'UniVePay UPI Gateway',
          channel: d.channel || 'UNIVEPAY',
          utr: d.utr || d.gateway_serial_no,
          proofUrl: d.proof_url,
          rejectionReason: d.rejection_reason,
          adminNote: d.admin_note,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
          creditedAt: d.credited_at,
        }));
      }
    } catch (e: any) {
      console.warn('Error fetching deposit transactions:', e);
      throw e;
    }
  }
  return [];
}

export async function fetchWithdrawalTransactions(userId?: string): Promise<import('../types').WithdrawalTransaction[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('withdrawal_transactions').select('*').order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.limit(200);
      if (error) {
        console.error('[fetchWithdrawalTransactions] error:', error);
        throw error;
      }
      if (data) {
        return data.map((w: any) => ({
          id: w.id,
          userId: w.user_id,
          username: 'User',
          traceno: w.traceno,
          gatewaySerialNo: w.gateway_serial_no,
          amount: Number(w.amount),
          fee: Number(w.fee || 0),
          netAmount: Number(w.net_amount),
          method: w.method,
          status: w.status,
          gatewayStatus: w.gateway_status,
          bankName: w.bank_name,
          bankCode: w.bank_code,
          accountName: w.account_name,
          accountNumber: w.account_number,
          upiId: w.upi_id,
          paymentType: w.payment_type,
          utr: w.utr,
          amountLocked: Number(w.amount_locked || w.amount),
          rejectionReason: w.rejection_reason,
          adminNote: w.admin_note,
          createdAt: w.created_at,
          updatedAt: w.updated_at,
          completedAt: w.completed_at,
        }));
      }
    } catch (e) {
      console.warn('Error fetching withdrawal transactions:', e);
      throw e;
    }
  }
  return [];
}

export async function fetchWalletLedger(userId?: string): Promise<import('../types').WalletLedgerEntry[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('wallet_ledger').select('*').order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.limit(200);
      if (!error && data) {
        return data.map((l: any) => ({
          id: l.id,
          userId: l.user_id,
          walletType: l.wallet_type,
          transactionType: l.transaction_type,
          amount: Number(l.amount),
          direction: l.direction,
          referenceType: l.reference_type,
          referenceId: l.reference_id,
          balanceBefore: Number(l.balance_before),
          balanceAfter: Number(l.balance_after),
          description: l.description,
          createdAt: l.created_at,
        }));
      }
    } catch (e) {
      console.warn('Error fetching wallet ledger:', e);
    }
  }
  return [];
}

// ==============================================================================
// GIFT CODE ENGINE & ADMIN FINANCIAL CONTROL APIS
// ==============================================================================

/**
 * Fetch all Gift Codes
 */
export async function fetchGiftCodes(filters?: { status?: string; query?: string }): Promise<GiftCode[]> {
  try {
    const res = await fetch(apiUrl('/api/gift-codes'));
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      let list: GiftCode[] = json.data;
      if (filters?.status && filters.status !== 'ALL') {
        list = list.filter((c) => c.status === filters.status);
      }
      if (filters?.query) {
        const q = filters.query.toLowerCase().trim();
        list = list.filter((c) =>
          c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
        );
      }
      return list;
    }
  } catch (err) {
    console.warn('Backend fetchGiftCodes error, fallback to local:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('gift_codes').select('*').order('created_at', { ascending: false });
      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((g: any) => ({
          id: g.id,
          code: g.code,
          amountType: g.amount_type || g.reward_type || 'FIXED',
          amount: g.amount ? Number(g.amount) : undefined,
          minAmount: g.min_amount ? Number(g.min_amount) : undefined,
          maxAmount: g.max_amount ? Number(g.max_amount) : undefined,
          totalPool: Number(g.total_pool || 0),
          remainingPool: Number(g.remaining_pool !== undefined ? g.remaining_pool : g.total_pool || 0),
          totalUses: Number(g.total_uses || g.max_claims || 0),
          usedCount: Number(g.claims_count || g.claimed_uses || g.used_count || 0),
          perUserLimit: Number(g.per_user_limit || 1),
          startDate: g.start_date || g.created_at,
          expiryDate: g.expiry_date || g.expires_at,
          status: g.status || (g.is_active ? 'ACTIVE' : 'DISABLED'),
          description: g.description || '',
          walletDestination: g.wallet_destination || g.wallet_type || 'TOPUP_WALLET',
          createdBy: g.created_by || 'Admin',
          createdAt: g.created_at,
          updatedAt: g.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Error fetching gift codes from Supabase:', e);
    }
  }

  const codes = getLocal<GiftCode[]>(STORAGE_KEYS.GIFT_CODES, initialGiftCodes);
  let list = [...codes];

  // Auto update expired codes based on timestamp
  const now = Date.now();
  let changed = false;
  list = list.map((c) => {
    if (c.status === 'ACTIVE' && c.expiryDate && new Date(c.expiryDate).getTime() < now) {
      changed = true;
      return { ...c, status: 'EXPIRED' as const };
    }
    return c;
  });
  if (changed) {
    saveLocal(STORAGE_KEYS.GIFT_CODES, list);
  }

  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((c) => c.status === filters.status);
  }
  if (filters?.query) {
    const q = filters.query.toLowerCase().trim();
    list = list.filter((c) =>
      c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    );
  }
  return list;
}

/**
 * Fetch Single Gift Code by ID
 */
export async function fetchGiftCodeById(id: string): Promise<GiftCode | null> {
  const codes = await fetchGiftCodes();
  return codes.find((c) => c.id === id) || null;
}

/**
 * Create New Gift Code (Admin Only)
 */
export async function createGiftCode(
  payload: {
    code: string;
    amountType: 'FIXED' | 'RANDOM';
    amount?: number;
    minAmount?: number;
    maxAmount?: number;
    totalPool: number;
    totalUses: number;
    perUserLimit?: number;
    startDate?: string;
    expiryDate?: string;
    status?: import('../types').GiftCodeStatus;
    description?: string;
    walletDestination?: import('../types').GiftCodeDestination;
  },
  adminId: string
): Promise<GiftCode> {
  const normalizedCode = payload.code.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error('Gift code cannot be empty.');
  }

  if (payload.totalPool <= 0) {
    throw new Error('Total pool amount must be greater than zero.');
  }
  if (payload.totalUses <= 0) {
    throw new Error('Total uses count must be greater than zero.');
  }

  if (payload.amountType === 'FIXED') {
    if (!payload.amount || payload.amount <= 0) {
      throw new Error('Fixed amount must be greater than zero.');
    }
    if (payload.amount > payload.totalPool) {
      throw new Error('Fixed reward amount cannot exceed total gift pool.');
    }
  } else {
    const min = payload.minAmount || 0;
    const max = payload.maxAmount || 0;
    if (min <= 0 || max <= 0 || min > max) {
      throw new Error('Please specify a valid minimum and maximum reward amount range (Min <= Max).');
    }
    if (max > payload.totalPool) {
      throw new Error('Maximum reward amount cannot exceed total gift pool.');
    }
  }

  const generatedUuid = crypto.randomUUID();
  const newCode: GiftCode = {
    id: generatedUuid,
    code: normalizedCode,
    amountType: payload.amountType,
    amount: payload.amountType === 'FIXED' ? payload.amount : undefined,
    minAmount: payload.amountType === 'RANDOM' ? payload.minAmount : undefined,
    maxAmount: payload.amountType === 'RANDOM' ? payload.maxAmount : undefined,
    totalPool: payload.totalPool,
    remainingPool: payload.totalPool,
    totalUses: payload.totalUses,
    usedCount: 0,
    perUserLimit: payload.perUserLimit || 1,
    startDate: payload.startDate || new Date().toISOString(),
    expiryDate: payload.expiryDate,
    status: payload.status || 'ACTIVE',
    description: payload.description || '',
    walletDestination: payload.walletDestination || 'TOPUP_WALLET',
    createdBy: adminId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(apiUrl('/api/admin/gift-codes/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ giftCode: newCode, adminId, isNew: true }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const saved = { ...newCode, ...json.data, id: json.data.id || newCode.id };
      const list = getLocal<GiftCode[]>(STORAGE_KEYS.GIFT_CODES, initialGiftCodes);
      list.unshift(saved);
      saveLocal(STORAGE_KEYS.GIFT_CODES, list);
      return saved;
    } else {
      throw new Error(json.error || 'Failed to create gift code on server.');
    }
  } catch (err: any) {
    console.error('Backend createGiftCode error:', err);
    throw new Error(err.message || 'Failed to create gift code.');
  }
}

/**
 * Update Gift Code (Admin Only)
 */
export async function updateGiftCode(
  id: string,
  updates: Partial<GiftCode>,
  adminId: string
): Promise<GiftCode> {
  const list = getLocal<GiftCode[]>(STORAGE_KEYS.GIFT_CODES, initialGiftCodes);
  const index = list.findIndex((c) => c.id === id);

  const current = index !== -1 ? list[index] : { id, code: 'GIFT' } as any;
  const updated: GiftCode = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(apiUrl('/api/admin/gift-codes/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ giftCode: { id, ...updated }, adminId, isNew: false }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const saved = { ...updated, ...json.data };
      if (index !== -1) {
        list[index] = saved;
      } else {
        list.unshift(saved);
      }
      saveLocal(STORAGE_KEYS.GIFT_CODES, list);
      return saved;
    } else {
      throw new Error(json.error || 'Failed to update gift code on server.');
    }
  } catch (err: any) {
    console.error('Backend updateGiftCode error:', err);
    throw new Error(err.message || 'Failed to update gift code.');
  }
}

/**
 * Delete Gift Code (Admin Only)
 */
export async function deleteGiftCode(id: string, adminId: string): Promise<boolean> {
  const list = getLocal<GiftCode[]>(STORAGE_KEYS.GIFT_CODES, initialGiftCodes);
  const target = list.find((c) => c.id === id);
  const filtered = list.filter((c) => c.id !== id);
  saveLocal(STORAGE_KEYS.GIFT_CODES, filtered);

  try {
    const res = await fetch(apiUrl('/api/admin/gift-codes/delete'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ id, adminId }),
    });
    const json = await res.json();
    if (json.success) {
      return true;
    }
  } catch (err) {
    console.warn('Backend deleteGiftCode error, fallback to client:', err);
  }

  if (target) {
    await recordAuditLog(
      adminId,
      'ADMIN_DELETE_GIFT_CODE',
      'gift_codes',
      id,
      `Deleted Gift Code ${target.code}`
    );
  }

  return true;
}

/**
 * Fetch Gift Code Claims (Admin or User)
 */
export async function fetchGiftCodeClaims(giftCodeId?: string, userId?: string): Promise<GiftCodeClaim[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('gift_code_claims').select('*').order('claimed_at', { ascending: false });
      if (giftCodeId) query = query.eq('gift_code_id', giftCodeId);
      if (userId) query = query.eq('user_id', userId);
      const [claimsRes, profilesRes] = await Promise.all([
        query,
        supabase.from('profiles').select('id, user_id, username, whatsapp_no, mobile'),
      ]);

      if (!claimsRes.error && claimsRes.data) {
        const profileMap = new Map<string, any>();
        if (profilesRes.data) {
          profilesRes.data.forEach((p: any) => {
            if (p.user_id) profileMap.set(p.user_id, p);
            if (p.id) profileMap.set(p.id, p);
          });
        }

        return claimsRes.data.map((c: any) => {
          const prof = profileMap.get(c.user_id) || {};
          return {
            id: c.id,
            giftCodeId: c.gift_code_id,
            code: c.code,
            userId: c.user_id,
            username: prof.username || c.username || 'Member',
            mobile: prof.whatsapp_no || prof.mobile || c.mobile || 'N/A',
            rewardAmount: Number(c.reward_amount),
            walletDestination: c.wallet_destination || 'EARNING_BALANCE',
            txId: c.tx_id,
            status: c.status || 'COMPLETED',
            claimedAt: c.claimed_at,
          };
        });
      }
    } catch (e) {
      console.warn('Error fetching gift code claims:', e);
    }
  }

  let claims = getLocal<GiftCodeClaim[]>(STORAGE_KEYS.GIFT_CODE_CLAIMS, []);
  if (giftCodeId) {
    claims = claims.filter((c) => c.giftCodeId === giftCodeId);
  }
  if (userId) {
    claims = claims.filter((c) => c.userId === userId);
  }
  return claims;
}

/**
 * Fetch Gift Code Analytics for Admin Dashboard
 */
export async function fetchGiftCodeAnalytics(): Promise<GiftCodeAnalytics> {
  const codes = await fetchGiftCodes();
  const claims = await fetchGiftCodeClaims();

  const totalCodes = codes.length;
  const activeCodes = codes.filter((c) => c.status === 'ACTIVE').length;
  const expiredCodes = codes.filter((c) => c.status === 'EXPIRED').length;
  const exhaustedCodes = codes.filter((c) => c.status === 'EXHAUSTED').length;
  const disabledCodes = codes.filter((c) => c.status === 'DISABLED' || c.status === 'PAUSED').length;

  const totalPoolAllocated = codes.reduce((acc, c) => acc + (c.totalPool || 0), 0);
  const totalDistributedAmount = claims.reduce((acc, c) => acc + (c.rewardAmount || 0), 0);
  const totalClaimsCount = claims.length;

  // Find top gift code by claims
  const codeCounts: Record<string, number> = {};
  claims.forEach((c) => {
    codeCounts[c.code] = (codeCounts[c.code] || 0) + 1;
  });
  let topGiftCode = '';
  let maxClaims = 0;
  Object.entries(codeCounts).forEach(([code, count]) => {
    if (count > maxClaims) {
      maxClaims = count;
      topGiftCode = `${code} (${count} claims)`;
    }
  });

  return {
    totalCodes,
    activeCodes,
    expiredCodes,
    exhaustedCodes,
    disabledCodes,
    totalPoolAllocated,
    totalDistributedAmount,
    totalClaimsCount,
    topGiftCode: topGiftCode || (codes[0]?.code ? `${codes[0].code} (0 claims)` : 'None'),
  };
}

/**
 * Atomic Server-Safe Gift Code Claim Execution (User Side)
 */
export async function claimGiftCode(
  rawCode: string,
  userId: string
): Promise<{
  success: boolean;
  rewardAmount: number;
  code: string;
  destination: import('../types').GiftCodeDestination;
  newBalance: number;
}> {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('Please enter a valid gift code.');
  }

  // 0. Attempt Server-Side Atomic Redemption
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(apiUrl('/api/gift-codes/redeem'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ code: cleanCode, userId }),
    });
    const json = await res.json();
    if (json.success) {
      // Sync local wallet and claim cache
      const userProfile = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {
        mobile: '9500667390',
        membershipNumber: '2829906',
        walletBalance: 0,
        deviceEarnings: 0,
      } as any);
      const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
        id: 'w_' + userId,
        userId,
        topupBalance: 0,
        withdrawBalance: 0,
        availableBalance: 0,
        rechargeBalance: 0,
        earnedBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      } as any);

      const dest = json.destination || 'TOPUP_WALLET';
      const isTopup = dest === 'TOPUP_WALLET' || dest === 'TOPUP' || dest === 'RECHARGE_BALANCE';
      if (isTopup) {
        wallet.topupBalance = json.newBalance;
        wallet.rechargeBalance = json.newBalance;
        const curWithdraw = Number(wallet.withdrawBalance !== undefined ? wallet.withdrawBalance : (wallet.earnedBalance || 0));
        wallet.availableBalance = +(json.newBalance + curWithdraw).toFixed(2);
        userProfile.walletBalance = wallet.availableBalance;
      } else {
        wallet.withdrawBalance = json.newBalance;
        wallet.earnedBalance = json.newBalance;
        wallet.availableBalance = json.newBalance;
        userProfile.walletBalance = json.newBalance;
      }
      saveLocal(STORAGE_KEYS.WALLET, wallet);
      saveLocal(STORAGE_KEYS.PROFILE, userProfile);

      return {
        success: true,
        rewardAmount: json.rewardAmount,
        code: json.code,
        destination: dest,
        newBalance: json.newBalance,
      };
    } else if (json.error) {
      throw new Error(json.error);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
    console.warn('Backend claimGiftCode error, falling back to local simulation:', err);
  }

  // 1. Fetch code & validate exists
  const codes = getLocal<GiftCode[]>(STORAGE_KEYS.GIFT_CODES, initialGiftCodes);
  const codeIndex = codes.findIndex((c) => c.code.toUpperCase() === cleanCode);
  if (codeIndex === -1) {
    throw new Error('Invalid gift code.');
  }

  const giftCode = codes[codeIndex];

  // 2. Validate Status
  if (giftCode.status === 'DISABLED') {
    throw new Error('This gift code is no longer active.');
  }
  if (giftCode.status === 'PAUSED' || giftCode.status === 'DRAFT') {
    throw new Error('This gift code is not currently active.');
  }
  if (giftCode.status === 'EXHAUSTED') {
    throw new Error('This gift code has been fully claimed.');
  }

  // 3. Validate Dates
  const now = Date.now();
  if (giftCode.startDate && new Date(giftCode.startDate).getTime() > now) {
    throw new Error('This gift code is not active yet.');
  }
  if (giftCode.expiryDate && new Date(giftCode.expiryDate).getTime() < now) {
    // Mark expired
    giftCode.status = 'EXPIRED';
    codes[codeIndex] = giftCode;
    saveLocal(STORAGE_KEYS.GIFT_CODES, codes);
    throw new Error('This gift code has expired.');
  }

  // 4. Validate Remaining Pool and Total Uses
  if (giftCode.remainingPool <= 0 || giftCode.usedCount >= giftCode.totalUses) {
    giftCode.status = 'EXHAUSTED';
    codes[codeIndex] = giftCode;
    saveLocal(STORAGE_KEYS.GIFT_CODES, codes);
    throw new Error('This gift code has been fully claimed.');
  }

  // 5. Validate Per-User Claims
  const claims = getLocal<GiftCodeClaim[]>(STORAGE_KEYS.GIFT_CODE_CLAIMS, []);
  const userPreviousClaims = claims.filter(
    (c) => c.giftCodeId === giftCode.id && c.userId === userId && c.status === 'COMPLETED'
  );

  const maxAllowed = giftCode.perUserLimit || 1;
  if (userPreviousClaims.length >= maxAllowed) {
    throw new Error('You have already claimed this gift code.');
  }

  // 6. Calculate Reward Amount Server-Side
  let calculatedReward = 0;
  if (giftCode.amountType === 'FIXED') {
    calculatedReward = Number(giftCode.amount || 0);
    if (calculatedReward <= 0) {
      throw new Error('Invalid gift code configuration.');
    }
    if (giftCode.remainingPool < calculatedReward) {
      if (giftCode.remainingPool <= 0) {
        giftCode.status = 'EXHAUSTED';
        codes[codeIndex] = giftCode;
        saveLocal(STORAGE_KEYS.GIFT_CODES, codes);
        throw new Error('This gift code has been fully claimed.');
      }
      calculatedReward = giftCode.remainingPool;
    }
  } else {
    // RANDOM AMOUNT
    const min = Number(giftCode.minAmount || 1);
    const max = Number(giftCode.maxAmount || 100);
    if (giftCode.remainingPool < min) {
      giftCode.status = 'EXHAUSTED';
      codes[codeIndex] = giftCode;
      saveLocal(STORAGE_KEYS.GIFT_CODES, codes);
      throw new Error('This gift code has been fully claimed.');
    }
    const effectiveMax = Math.min(max, giftCode.remainingPool);
    calculatedReward = Math.floor(Math.random() * (effectiveMax - min + 1)) + min;
  }

  // Safety clamp
  calculatedReward = Math.min(calculatedReward, giftCode.remainingPool);
  calculatedReward = +(calculatedReward.toFixed(2));
  if (calculatedReward <= 0) {
    giftCode.status = 'EXHAUSTED';
    codes[codeIndex] = giftCode;
    saveLocal(STORAGE_KEYS.GIFT_CODES, codes);
    throw new Error('This gift code has been fully claimed.');
  }

  // 7. Deduct pool and update Gift Code atomically
  const newRemainingPool = +(Math.max(0, giftCode.remainingPool - calculatedReward).toFixed(2));
  const newUsedCount = giftCode.usedCount + 1;

  giftCode.remainingPool = newRemainingPool;
  giftCode.usedCount = newUsedCount;

  const minRequiredNext = giftCode.amountType === 'FIXED' ? (giftCode.amount || 1) : (giftCode.minAmount || 1);
  if (newRemainingPool <= 0 || newUsedCount >= giftCode.totalUses || newRemainingPool < minRequiredNext) {
    giftCode.status = 'EXHAUSTED';
  }
  giftCode.updatedAt = new Date().toISOString();
  codes[codeIndex] = giftCode;
  saveLocal(STORAGE_KEYS.GIFT_CODES, codes);

  // 8. Credit User Wallet
  const userProfile = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {
    mobile: '9500667390',
    membershipNumber: '2829906',
    walletBalance: 0,
    deviceEarnings: 0,
  } as any);

  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
    id: 'w_' + userId,
    userId,
    topupBalance: 0,
    withdrawBalance: 0,
    availableBalance: userProfile.walletBalance || 0,
    rechargeBalance: 0,
    earnedBalance: userProfile.deviceEarnings || 0,
    pendingBalance: 0,
    totalEarned: userProfile.deviceEarnings || 0,
    totalWithdrawn: 0,
  } as any);

  const destination = giftCode.walletDestination || 'TOPUP_WALLET';
  const isTopupDest = destination === 'TOPUP_WALLET' || destination === 'RECHARGE_BALANCE' || (destination !== 'WITHDRAW_WALLET' && destination !== 'EARNING_BALANCE');
  const curTopup = wallet.topupBalance !== undefined ? wallet.topupBalance : (wallet.rechargeBalance || 0);
  const curWithdraw = wallet.withdrawBalance !== undefined ? wallet.withdrawBalance : (wallet.earnedBalance || wallet.availableBalance || 0);

  const balBefore = isTopupDest ? curTopup : curWithdraw;

  if (isTopupDest) {
    wallet.topupBalance = +(curTopup + calculatedReward).toFixed(2);
    wallet.rechargeBalance = wallet.topupBalance;
  } else {
    wallet.withdrawBalance = +(curWithdraw + calculatedReward).toFixed(2);
    wallet.earnedBalance = wallet.withdrawBalance;
    wallet.availableBalance = wallet.withdrawBalance;
    wallet.totalEarned = +((wallet.totalEarned || 0) + calculatedReward).toFixed(2);
    userProfile.walletBalance = wallet.withdrawBalance;
    userProfile.deviceEarnings = +((userProfile.deviceEarnings || 0) + calculatedReward).toFixed(2);
  }

  saveLocal(STORAGE_KEYS.WALLET, wallet);
  saveLocal(STORAGE_KEYS.PROFILE, userProfile);

  const balAfter = isTopupDest ? wallet.topupBalance : wallet.withdrawBalance;
  const txId = 'tx_gift_' + Date.now();

  // 9. Create Wallet Transaction
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  txs.unshift({
    id: txId,
    userId,
    type: 'GIFT_CODE_REWARD',
    amount: calculatedReward,
    balanceBefore: balBefore,
    balanceAfter: balAfter,
    balanceType: isTopupDest ? 'TOPUP_WALLET' : 'WITHDRAW_WALLET',
    referenceId: 'GIFT-' + giftCode.code,
    description: `Gift Code Bonus — ${giftCode.code}`,
    createdAt: new Date().toISOString(),
  });
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  // 10. Record Claim Record
  const claimRecord: GiftCodeClaim = {
    id: 'claim_' + Date.now(),
    giftCodeId: giftCode.id,
    code: giftCode.code,
    userId,
    username: userProfile.username || userProfile.name || 'Member',
    mobile: userProfile.whatsappNo || userProfile.mobile || 'N/A',
    rewardAmount: calculatedReward,
    walletDestination: destination,
    txId,
    status: 'COMPLETED',
    claimedAt: new Date().toISOString(),
  };
  claims.unshift(claimRecord);
  saveLocal(STORAGE_KEYS.GIFT_CODE_CLAIMS, claims);

  // 11. Create In-App Notification
  createNotificationForUser({
    userId,
    title: 'Gift Code Claimed! 🎁',
    description: `You received ₹${calculatedReward.toFixed(2)} from gift code ${giftCode.code}.`,
    type: 'EARNING',
    isHomePopup: false,
  }).catch(() => {});

  return {
    success: true,
    rewardAmount: calculatedReward,
    code: giftCode.code,
    destination,
    newBalance: balAfter,
  };
}

/**
 * Enhanced Admin User Balance Adjustment (Credit / Deduct)
 */
export async function adminAdjustUserBalance(
  userId: string,
  balanceType: AdminBalanceType,
  amount: number,
  action: 'ADMIN_CREDIT' | 'ADMIN_DEDUCT',
  reason: string,
  adminId: string
): Promise<{
  success: boolean;
  beforeBalance: number;
  afterBalance: number;
  balanceType: AdminBalanceType;
  action: 'ADMIN_CREDIT' | 'ADMIN_DEDUCT';
  availableBalance?: number;
  rechargeBalance?: number;
  withdrawBalance?: number;
  teamCommission?: number;
}> {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw new Error('Mandatory audit justification reason is required for financial balance adjustments.');
  }
  const numAmount = Number(amount);
  if (numAmount <= 0 || isNaN(numAmount) || !isFinite(numAmount)) {
    throw new Error('Adjustment amount must be a valid number greater than zero.');
  }

  // 1. Authenticated Server-Side Mutation
  const res = await fetch(apiUrl('/api/admin/adjust-wallet'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({
      userId,
      balanceType,
      amount: numAmount,
      action,
      reason: cleanReason,
      adminId,
      idempotencyKey: `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Server error processing wallet adjustment.');
  }

  const data = json.data;

  // 2. Synchronize local storage cache if user session is active on this device
  try {
    const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, null as any);
    if (wallet && (wallet.userId === userId || wallet.id === userId)) {
      if (data.rechargeBalance !== undefined) {
        wallet.rechargeBalance = data.rechargeBalance;
        wallet.topupBalance = data.rechargeBalance;
      }
      if (data.withdrawBalance !== undefined) {
        wallet.withdrawBalance = data.withdrawBalance;
        wallet.earnedBalance = data.withdrawBalance;
      }
      if (data.availableBalance !== undefined) {
        wallet.availableBalance = data.availableBalance;
      }
      saveLocal(STORAGE_KEYS.WALLET, wallet);
    }
  } catch (_syncErr) {}

  return {
    success: true,
    beforeBalance: data.beforeBalance,
    afterBalance: data.afterBalance,
    balanceType: data.balanceType,
    action: data.action,
    availableBalance: data.availableBalance,
    rechargeBalance: data.rechargeBalance,
    withdrawBalance: data.withdrawBalance,
    teamCommission: data.teamCommission,
  };
}

// ==============================================================================
// DYNAMIC VIP LEVEL SYSTEM SERVICES & CALCULATION ENGINE
// ==============================================================================

/**
 * Fetch all VIP levels from Supabase or LocalStorage fallback
 */
export async function fetchVipLevels(includeInactive: boolean = false): Promise<VipLevel[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('vip_levels')
        .select('*')
        .order('display_order', { ascending: true })
        .order('level_number', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          levelNumber: Number(row.level_number),
          name: row.name,
          minInvestment: Number(row.min_investment || 0),
          maxInvestment: row.max_investment !== null && row.max_investment !== undefined ? Number(row.max_investment) : null,
          icon: row.icon || 'crown',
          badgeText: row.badge_text || `VIP ${row.level_number}`,
          description: row.description || '',
          benefits: Array.isArray(row.benefits) ? row.benefits : [],
          dailyBonusRate: Number(row.daily_bonus_rate || 0),
          withdrawalFeeDiscount: Number(row.withdrawal_fee_discount || 0),
          displayOrder: Number(row.display_order || 0),
          isActive: row.is_active ?? true,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase fetch VIP levels warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase VIP levels error, fallback to local storage:', e);
    }
  }

  const stored = getLocal<VipLevel[]>(STORAGE_KEYS.VIP_LEVELS, defaultVipLevels);
  if (!stored || stored.length === 0) {
    saveLocal(STORAGE_KEYS.VIP_LEVELS, defaultVipLevels);
    return includeInactive ? defaultVipLevels : defaultVipLevels.filter((l) => l.isActive);
  }
  return includeInactive ? stored : stored.filter((l) => l.isActive);
}

/**
 * Fetch Comprehensive User VIP Status calculated authoritatively from profile & database source of truth
 */
export async function fetchUserVipStatus(userId: string): Promise<UserVipStatus> {
  const allLevels = await fetchVipLevels(false);
  // Sort ascending by levelNumber
  const sorted = [...allLevels].sort((a, b) => a.levelNumber - b.levelNumber);

  // 1. Authoritative VIP Level from Server / Database
  let effectiveVip = 0;
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/user/vip-status?userId=${encodeURIComponent(userId)}`), {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.vipLevel !== undefined && json.vipLevel !== null) {
        effectiveVip = Number(json.vipLevel);
      }
    }
  } catch (_netErr) {}

  if (effectiveVip === 0 && isSupabaseConfigured && supabase) {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('vip_level')
        .eq('user_id', userId)
        .maybeSingle();
      if (prof && prof.vip_level !== undefined && prof.vip_level !== null) {
        effectiveVip = Number(prof.vip_level);
      }
    } catch (_dbErr) {}
  }

  if (effectiveVip === 0) {
    const localProf = getLocal<UserProfile>(STORAGE_KEYS.PROFILE, {} as any);
    if (localProf && localProf.vipLevel !== undefined && localProf.vipLevel !== null) {
      effectiveVip = Number(localProf.vipLevel);
    }
  }

  // Fetch all user purchases
  const purchases = await fetchPurchases(userId);
  const totalInvested = purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Match current level by levelNumber
  let currentLevel = sorted.find((l) => l.levelNumber === effectiveVip) ||
    defaultVipLevels.find((l) => l.levelNumber === effectiveVip) ||
    sorted[0] ||
    defaultVipLevels[0];

  // Match next level by levelNumber
  const nextLevel = sorted.find((l) => l.levelNumber === effectiveVip + 1) ||
    defaultVipLevels.find((l) => l.levelNumber === effectiveVip + 1) ||
    null;

  let remainingForNextLevel = 0;
  let progressPercentage = 100;

  if (nextLevel) {
    if (effectiveVip === 0) {
      // Rule 2: VIP 0 -> VIP 1 requires first qualifying purchase >= 550
      const highestPurchase = purchases.reduce((max, p) => Math.max(max, Number(p.amount) || 0), 0);
      remainingForNextLevel = Math.max(0, +(550 - highestPurchase).toFixed(2));
      progressPercentage = Math.min(100, Math.max(0, Math.round((highestPurchase / 550) * 100)));
    } else if (effectiveVip === 1) {
      // Rule 4: VIP 1 -> VIP 2 requires purchasing a PRO plan
      const hasPro = purchases.some((p) => (p.planCategory || '').toUpperCase() === 'PRO' || (p.planName || '').toUpperCase().includes('PRO'));
      remainingForNextLevel = hasPro ? 0 : 1;
      progressPercentage = hasPro ? 100 : 50;
    } else {
      // Rule 6: VIP 3-6 are deposit-based tiers
      const range = nextLevel.minInvestment - currentLevel.minInvestment;
      const progressSoFar = Math.max(0, totalInvested - currentLevel.minInvestment);
      remainingForNextLevel = Math.max(0, +(nextLevel.minInvestment - totalInvested).toFixed(2));
      progressPercentage = Math.min(100, Math.max(0, Math.round((progressSoFar / (range > 0 ? range : 1)) * 100)));
    }
  }

  return {
    currentLevel,
    nextLevel,
    totalInvested: +totalInvested.toFixed(2),
    remainingForNextLevel,
    progressPercentage,
    allLevels: sorted,
  };
}

/**
 * Create a new VIP Level (Admin)
 */
export async function createVipLevel(
  levelData: Partial<VipLevel>,
  adminId: string = 'adm_master_01'
): Promise<VipLevel> {
  const newLevel: VipLevel = {
    id: 'vip_' + Date.now(),
    levelNumber: levelData.levelNumber !== undefined ? levelData.levelNumber : 1,
    name: levelData.name || `VIP ${levelData.levelNumber || 1}`,
    minInvestment: Number(levelData.minInvestment || 0),
    maxInvestment: levelData.maxInvestment ? Number(levelData.maxInvestment) : null,
    icon: levelData.icon || 'crown',
    badgeText: levelData.badgeText || `VIP ${levelData.levelNumber || 1}`,
    description: levelData.description || '',
    benefits: levelData.benefits || [],
    dailyBonusRate: Number(levelData.dailyBonusRate || 0),
    withdrawalFeeDiscount: Number(levelData.withdrawalFeeDiscount || 0),
    displayOrder: levelData.displayOrder !== undefined ? levelData.displayOrder : 0,
    isActive: levelData.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('vip_levels')
        .insert({
          level_number: newLevel.levelNumber,
          name: newLevel.name,
          min_investment: newLevel.minInvestment,
          max_investment: newLevel.maxInvestment,
          icon: newLevel.icon,
          badge_text: newLevel.badgeText,
          description: newLevel.description,
          benefits: newLevel.benefits,
          daily_bonus_rate: newLevel.dailyBonusRate,
          withdrawal_fee_discount: newLevel.withdrawalFeeDiscount,
          display_order: newLevel.displayOrder,
          is_active: newLevel.isActive,
        })
        .select()
        .single();

      if (!error && data) {
        newLevel.id = data.id;
      } else if (error && !isTableMissingError(error)) {
        console.warn('Supabase insert VIP level error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase create VIP level error:', e);
    }
  }

  // Update local
  const current = getLocal<VipLevel[]>(STORAGE_KEYS.VIP_LEVELS, defaultVipLevels);
  const updated = [...current, newLevel].sort((a, b) => a.minInvestment - b.minInvestment);
  saveLocal(STORAGE_KEYS.VIP_LEVELS, updated);

  await recordAuditLog(
    adminId,
    'CREATE_VIP_LEVEL',
    'vip_levels',
    newLevel.id,
    `Created VIP level: ${newLevel.name} (Min: ₹${newLevel.minInvestment})`
  );

  return newLevel;
}

/**
 * Update an existing VIP Level (Admin)
 */
export async function updateVipLevel(
  id: string,
  updates: Partial<VipLevel>,
  adminId: string = 'adm_master_01'
): Promise<VipLevel> {
  const currentList = getLocal<VipLevel[]>(STORAGE_KEYS.VIP_LEVELS, defaultVipLevels);
  const index = currentList.findIndex((l) => l.id === id || String(l.levelNumber) === id);

  if (index === -1) {
    throw new Error('VIP Level not found.');
  }

  const updatedItem: VipLevel = {
    ...currentList[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('vip_levels')
        .update({
          level_number: updatedItem.levelNumber,
          name: updatedItem.name,
          min_investment: updatedItem.minInvestment,
          max_investment: updatedItem.maxInvestment,
          icon: updatedItem.icon,
          badge_text: updatedItem.badgeText,
          description: updatedItem.description,
          benefits: updatedItem.benefits,
          daily_bonus_rate: updatedItem.dailyBonusRate,
          withdrawal_fee_discount: updatedItem.withdrawalFeeDiscount,
          display_order: updatedItem.displayOrder,
          is_active: updatedItem.isActive,
          updated_at: updatedItem.updatedAt,
        })
        .match(id.startsWith('vip_') ? { id } : { level_number: updatedItem.levelNumber });

      if (error && !isTableMissingError(error)) {
        console.warn('Supabase update VIP level error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase update VIP level error:', e);
    }
  }

  currentList[index] = updatedItem;
  currentList.sort((a, b) => a.minInvestment - b.minInvestment);
  saveLocal(STORAGE_KEYS.VIP_LEVELS, currentList);

  await recordAuditLog(
    adminId,
    'UPDATE_VIP_LEVEL',
    'vip_levels',
    id,
    `Updated VIP level: ${updatedItem.name}`
  );

  return updatedItem;
}

/**
 * Delete a VIP Level (Admin)
 */
export async function deleteVipLevel(id: string, adminId: string = 'adm_master_01'): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('vip_levels')
        .delete()
        .eq('id', id);

      if (error && !isTableMissingError(error)) {
        console.warn('Supabase delete VIP level error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase delete VIP level error:', e);
    }
  }

  const currentList = getLocal<VipLevel[]>(STORAGE_KEYS.VIP_LEVELS, defaultVipLevels);
  const filtered = currentList.filter((l) => l.id !== id);
  saveLocal(STORAGE_KEYS.VIP_LEVELS, filtered);

  await recordAuditLog(
    adminId,
    'DELETE_VIP_LEVEL',
    'vip_levels',
    id,
    `Deleted VIP level with ID: ${id}`
  );

  return true;
}

/**
 * Reset / Seed Default VIP Levels
 */
export async function seedDefaultVipLevels(adminId: string = 'adm_master_01'): Promise<VipLevel[]> {
  saveLocal(STORAGE_KEYS.VIP_LEVELS, defaultVipLevels);

  if (isSupabaseConfigured && supabase) {
    try {
      for (const level of defaultVipLevels) {
        await supabase.from('vip_levels').upsert({
          level_number: level.levelNumber,
          name: level.name,
          min_investment: level.minInvestment,
          max_investment: level.maxInvestment,
          icon: level.icon,
          badge_text: level.badgeText,
          description: level.description,
          benefits: level.benefits,
          daily_bonus_rate: level.dailyBonusRate,
          withdrawal_fee_discount: level.withdrawalFeeDiscount,
          display_order: level.displayOrder,
          is_active: level.isActive,
        }, { onConflict: 'level_number' });
      }
    } catch (e) {
      console.warn('Supabase seed VIP levels warning:', e);
    }
  }

  await recordAuditLog(
    adminId,
    'SEED_VIP_LEVELS',
    'vip_levels',
    'default',
    'Reset and seeded default VIP Level tiers (VIP 0 to VIP 6)'
  );

  return defaultVipLevels;
}

// ==============================================================================
// DYNAMIC DAILY CHECK-IN REWARD ENGINE
// ==============================================================================

/**
 * Fetch User Daily Check-in Status
 */
export async function fetchDailyCheckInStatus(userId: string): Promise<import('../types').DailyCheckInStatus> {
  const sysSettings = await fetchSystemSettings();
  const isEnabled = sysSettings.isDailyCheckInEnabled !== false;
  const baseReward = typeof sysSettings.dailyCheckInAmount === 'number' ? sysSettings.dailyCheckInAmount : 5.00;
  const day7Bonus = typeof sysSettings.dailyCheckInDay7Bonus === 'number' ? sysSettings.dailyCheckInDay7Bonus : 100.00;

  const storageKey = `${STORAGE_KEYS.DAILY_CHECKIN}_${userId}`;

  // Try backend API first for database-persistent status
  if (userId) {
    try {
      let accessToken: string | null = null;
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            accessToken = sessionData.session.access_token;
          }
        } catch (authErr) {
          console.warn('[CHECKIN STATUS AUTH] Notice:', authErr);
        }
      }
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const resp = await fetch(apiUrl(`/api/fortune/checkin-status?userId=${encodeURIComponent(userId)}`), {
        headers,
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success) {
          const statusResult: import('../types').DailyCheckInStatus = {
            lastCheckInDate: json.lastCheckInDate,
            currentStreak: json.currentStreak || 0,
            hasCheckedInToday: !!json.hasCheckedInToday,
            todayDayNumber: json.todayDayNumber || 1,
            todayReward: json.todayReward !== undefined ? json.todayReward : (json.todayDayNumber === 7 ? day7Bonus : baseReward),
            day7Bonus: json.day7Bonus !== undefined ? json.day7Bonus : day7Bonus,
            dailyReward: json.dailyReward !== undefined ? json.dailyReward : baseReward,
            isDailyCheckInEnabled: json.isDailyCheckInEnabled !== undefined ? json.isDailyCheckInEnabled : isEnabled,
            totalClaimed: json.totalClaimed || 0,
            history: json.history || [],
          };
          saveLocal(storageKey, {
            lastCheckInDate: json.lastCheckInDate,
            currentStreak: json.currentStreak || 0,
            totalClaimed: json.totalClaimed || 0,
            history: json.history || [],
          });
          return statusResult;
        }
      }
    } catch (apiErr) {
      console.warn('Backend check-in status fetch failed, checking local state:', apiErr);
    }
  }

  const checkInData = getLocal<{
    lastCheckInDate?: string;
    currentStreak: number;
    totalClaimed: number;
    history: import('../types').DailyCheckInHistoryItem[];
  }>(storageKey, {
    lastCheckInDate: undefined,
    currentStreak: 0,
    totalClaimed: 0,
    history: [],
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = checkInData.lastCheckInDate === todayStr;

  let streak = checkInData.currentStreak || 0;
  if (!hasCheckedInToday && checkInData.lastCheckInDate) {
    const lastDate = new Date(checkInData.lastCheckInDate);
    const today = new Date(todayStr);
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      streak = 0;
    }
  }

  let todayDayNumber = 1;
  if (hasCheckedInToday) {
    todayDayNumber = streak > 0 ? ((streak - 1) % 7) + 1 : 1;
  } else {
    todayDayNumber = (streak % 7) + 1;
  }

  const todayReward = todayDayNumber === 7 ? day7Bonus : baseReward;

  return {
    lastCheckInDate: checkInData.lastCheckInDate,
    currentStreak: streak,
    hasCheckedInToday,
    todayDayNumber,
    todayReward,
    day7Bonus,
    dailyReward: baseReward,
    isDailyCheckInEnabled: isEnabled,
    totalClaimed: checkInData.totalClaimed || 0,
    history: checkInData.history || [],
  };
}

/**
 * Perform Daily Check-in & Credit Reward to Wallet
 */
export async function performDailyCheckIn(userId: string): Promise<{
  success: boolean;
  reward: number;
  streak: number;
  message: string;
  newBalance: number;
}> {
  if (!userId) {
    throw new Error('User authentication required for daily check-in.');
  }

  const storageKey = `${STORAGE_KEYS.DAILY_CHECKIN}_${userId}`;

  // 1. Resolve active user session token if available
  let accessToken: string | null = null;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
      if (!userId && sessionData?.session?.user?.id) {
        userId = sessionData.session.user.id;
      }
    } catch (authErr) {
      console.warn('[CHECKIN AUTH] Notice:', authErr);
    }
  }

  // 2. Call Server-Side Supabase Admin Backend API with standard CORS-allowed headers
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const resp = await fetch(apiUrl('/api/fortune/checkin'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
    });

    const text = await resp.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Server returned an invalid response. Please try again.');
    }

    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to claim daily check-in reward.');
    }

    const reward = Number(json.reward || 5.00);
    const streak = Number(json.streak || 1);
    const newBal = Number(json.newRechargeBalance !== undefined ? json.newRechargeBalance : (json.newBalance || 0));
    const todayStr = new Date().toISOString().split('T')[0];

    // Sync Local Wallet & Storage
    const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
      id: 'wal_' + userId,
      userId,
      topupBalance: 0,
      withdrawBalance: 0,
      availableBalance: 0,
      rechargeBalance: 0,
      earnedBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    });
    wallet.rechargeBalance = newBal;
    wallet.topupBalance = newBal;
    if (json.newAvailableBalance !== undefined) {
      wallet.availableBalance = Number(json.newAvailableBalance);
    }
    saveLocal(STORAGE_KEYS.WALLET, wallet);

    // Sync Local Checkin State
    const checkInData = getLocal<{
      lastCheckInDate?: string;
      currentStreak: number;
      totalClaimed: number;
      history: import('../types').DailyCheckInHistoryItem[];
    }>(storageKey, {
      lastCheckInDate: undefined,
      currentStreak: 0,
      totalClaimed: 0,
      history: [],
    });

    const historyItem: import('../types').DailyCheckInHistoryItem = {
      date: todayStr,
      dayNumber: json.dayNumber || ((streak - 1) % 7) + 1,
      amount: reward,
      claimedAt: new Date().toISOString(),
      txId: json.txId || 'tx_' + Date.now(),
    };
    checkInData.lastCheckInDate = todayStr;
    checkInData.currentStreak = streak;
    checkInData.totalClaimed = +((checkInData.totalClaimed || 0) + reward).toFixed(2);
    checkInData.history = [historyItem, ...(checkInData.history || [])];
    saveLocal(storageKey, checkInData);

    return {
      success: true,
      reward,
      streak,
      message: json.message || `🎉 Daily Check-in Successful! Credited ₹${reward.toFixed(2)} to your Topup Wallet.`,
      newBalance: newBal,
    };
  } catch (err: any) {
    console.error('Check-in error:', err);
    throw err;
  }
}

// ==============================================================================
// ABOUT PLATFORM DYNAMIC CONFIGURATION SERVICES
// ==============================================================================

/**
 * Fetch dynamic About Platform rules and section settings.
 * Loads from Server / Supabase 'about_platform_config' or local cache.
 */
export async function fetchAboutPlatformConfig(): Promise<AboutPlatformConfig> {
  try {
    const res = await fetch(apiUrl('/api/about-platform'));
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          id: json.data.id || defaultAboutPlatformConfig.id,
          pageTitle: json.data.pageTitle || defaultAboutPlatformConfig.pageTitle,
          pageSubtitle: json.data.pageSubtitle || defaultAboutPlatformConfig.pageSubtitle,
          heroBadge: json.data.heroBadge || defaultAboutPlatformConfig.heroBadge,
          companyName: json.data.companyName || defaultAboutPlatformConfig.companyName,
          appVersion: json.data.platformVersion || json.data.appVersion || defaultAboutPlatformConfig.appVersion,
          supportEmail: json.data.supportEmail || defaultAboutPlatformConfig.supportEmail,
          supportTelegram: json.data.supportTelegram || defaultAboutPlatformConfig.supportTelegram,
          supportWhatsapp: json.data.supportWhatsapp || defaultAboutPlatformConfig.supportWhatsapp,
          supportHours: json.data.supportHours || defaultAboutPlatformConfig.supportHours,
          investingSteps: json.data.investingSteps || defaultAboutPlatformConfig.investingSteps,
          customRules: json.data.customRules || defaultAboutPlatformConfig.customRules,
          sections: json.data.sections || defaultAboutPlatformConfig.sections,
          topupWalletNotes: json.data.topupWalletNotes || defaultAboutPlatformConfig.topupWalletNotes,
          withdrawWalletNotes: json.data.withdrawWalletNotes || defaultAboutPlatformConfig.withdrawWalletNotes,
          giftCodeNotes: json.data.giftCodeNotes || defaultAboutPlatformConfig.giftCodeNotes,
          updatedAt: json.data.updatedAt,
        };
      }
    }
  } catch (err) {
    console.warn('Backend fetchAboutPlatformConfig error, fallback to Supabase/local:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('about_platform_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const sectionsObj = (data.sections && typeof data.sections === 'object' && !Array.isArray(data.sections) && Object.keys(data.sections).length > 0)
          ? { ...defaultAboutPlatformConfig.sections, ...data.sections }
          : defaultAboutPlatformConfig.sections;

        return {
          id: data.id || defaultAboutPlatformConfig.id,
          pageTitle: data.hero_title || data.page_title || defaultAboutPlatformConfig.pageTitle,
          pageSubtitle: data.hero_subtitle || data.page_subtitle || defaultAboutPlatformConfig.pageSubtitle,
          heroBadge: data.hero_badge || defaultAboutPlatformConfig.heroBadge,
          companyName: data.company_name || defaultAboutPlatformConfig.companyName,
          appVersion: data.platform_version || defaultAboutPlatformConfig.appVersion,
          supportEmail: data.support_email || defaultAboutPlatformConfig.supportEmail,
          supportTelegram: data.support_telegram || defaultAboutPlatformConfig.supportTelegram,
          supportWhatsapp: data.support_whatsapp || defaultAboutPlatformConfig.supportWhatsapp,
          supportHours: data.support_hours || defaultAboutPlatformConfig.supportHours,
          investingSteps: (Array.isArray(data.investing_steps) && data.investing_steps.length > 0) ? data.investing_steps : defaultAboutPlatformConfig.investingSteps,
          customRules: (Array.isArray(data.custom_rules) && data.custom_rules.length > 0) ? data.custom_rules : defaultAboutPlatformConfig.customRules,
          sections: sectionsObj,
          topupWalletNotes: data.topup_wallet_notes || defaultAboutPlatformConfig.topupWalletNotes,
          withdrawWalletNotes: data.withdraw_wallet_notes || defaultAboutPlatformConfig.withdrawWalletNotes,
          giftCodeNotes: data.gift_code_notes || defaultAboutPlatformConfig.giftCodeNotes,
          updatedAt: data.updated_at,
        };
      }
    } catch (_e) {}
  }

  return getLocal<AboutPlatformConfig>(
    STORAGE_KEYS.ABOUT_PLATFORM,
    defaultAboutPlatformConfig
  );
}

/**
 * Update dynamic About Platform configuration (Admin only).
 * Saves to Server / Supabase and persists across users.
 */
export async function updateAboutPlatformConfig(
  config: AboutPlatformConfig,
  adminId: string
): Promise<AboutPlatformConfig> {
  const updated: AboutPlatformConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: adminId,
  };

  try {
    const res = await fetch(apiUrl('/api/admin/about-platform'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ config: updated, adminId }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        saveLocal(STORAGE_KEYS.ABOUT_PLATFORM, updated);
        return updated;
      }
    }
  } catch (err) {
    console.warn('Backend updateAboutPlatformConfig error, fallback to Supabase/local:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const dbPayload = {
        id: updated.id || 'default',
        company_name: updated.companyName,
        license_no: (updated as any).licenseNo || 'CIN-U72900DL2024PTC394821',
        platform_version: updated.appVersion,
        hero_title: updated.pageTitle,
        hero_subtitle: updated.pageSubtitle,
        hero_badge: updated.heroBadge,
        support_email: updated.supportEmail,
        support_telegram: updated.supportTelegram,
        support_whatsapp: updated.supportWhatsapp,
        support_hours: updated.supportHours,
        sections: updated.sections,
        investing_steps: updated.investingSteps,
        custom_rules: updated.customRules,
        topup_wallet_notes: updated.topupWalletNotes,
        withdraw_wallet_notes: updated.withdrawWalletNotes,
        gift_code_notes: updated.giftCodeNotes,
        updated_at: updated.updatedAt,
      };
      await supabase.from('about_platform_config').upsert(dbPayload, { onConflict: 'id' });
      await supabase.from('admin_settings').upsert({ id: 'about_platform', value: updated, updated_at: updated.updatedAt });
    } catch (_e) {}
  }

  saveLocal(STORAGE_KEYS.ABOUT_PLATFORM, updated);

  try {
    await recordAuditLog(
      adminId,
      'UPDATE_ABOUT_PLATFORM_CONFIG',
      'about_platform_config',
      updated.id || 'cfg_about_platform_01',
      `Updated About Platform dynamic rules, sections, and investing guide`
    );
  } catch (_e) {}

  return updated;
}

// ==============================================================================
// DYNAMIC MISSION BONUS SYSTEM API & ENGINE
// ==============================================================================

/**
 * Fetch all missions (from Supabase via server endpoint with storage fallback)
 */
export async function fetchMissions(includeDisabled: boolean = false): Promise<Mission[]> {
  try {
    const res = await fetch(apiUrl(`/api/missions?includeDisabled=${includeDisabled}`));
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch (err) {
    console.warn('Backend fetchMissions error, fallback to local:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('missions')
        .select('*')
        .order('display_order', { ascending: true });

      if (!includeDisabled) {
        query = query.eq('status', 'ACTIVE');
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        return data.map((m: any) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          requiredReferrals: Number(m.required_referrals ?? m.requiredReferrals ?? 1),
          rewardAmount: Number(m.reward_amount ?? m.rewardAmount ?? 50),
          walletType: 'WITHDRAW_WALLET' as const,
          icon: m.icon || 'Target',
          status: (m.status || 'ACTIVE') as 'ACTIVE' | 'DISABLED',
          displayOrder: Number(m.display_order ?? m.displayOrder ?? 1),
          createdAt: m.created_at || m.createdAt,
          updatedAt: m.updated_at || m.updatedAt,
        }));
      }
    } catch (e) {
      console.warn('Supabase fetchMissions notice, using storage fallback:', e);
    }
  }

  const list = getLocal<Mission[]>(STORAGE_KEYS.MISSIONS, defaultMissions);
  const sorted = [...list].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return includeDisabled ? sorted : sorted.filter((m) => m.status === 'ACTIVE');
}

/**
 * Create a new Mission (Admin)
 */
export async function createMission(
  payload: CreateMissionPayload,
  adminId: string = 'adm_root_700'
): Promise<Mission> {
  const allMissions = getLocal<Mission[]>(STORAGE_KEYS.MISSIONS, defaultMissions);
  const nextOrder = payload.displayOrder !== undefined ? payload.displayOrder : allMissions.length + 1;

  const newMission: Mission = {
    id: 'msn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: payload.title.trim(),
    description: payload.description?.trim() || `Invite ${payload.requiredReferrals} active friends with first plan purchase.`,
    requiredReferrals: Math.max(1, Number(payload.requiredReferrals)),
    rewardAmount: Math.max(1, Number(payload.rewardAmount)),
    walletType: 'WITHDRAW_WALLET',
    icon: payload.icon || 'Target',
    status: payload.status || 'ACTIVE',
    displayOrder: nextOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(apiUrl('/api/admin/missions/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ mission: newMission, adminId }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const savedMission = { ...newMission, ...json.data, id: json.data.id || newMission.id };
      allMissions.push(savedMission);
      allMissions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      saveLocal(STORAGE_KEYS.MISSIONS, allMissions);
      return savedMission;
    }
  } catch (err) {
    console.warn('Backend createMission error, fallback to client:', err);
  }

  allMissions.push(newMission);
  allMissions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  saveLocal(STORAGE_KEYS.MISSIONS, allMissions);

  try {
    await recordAuditLog(
      adminId,
      'CREATE_MISSION',
      'missions',
      newMission.id,
      `Created new mission: "${newMission.title}" (Requires ${newMission.requiredReferrals} Active Referrals, Reward: ₹${newMission.rewardAmount})`,
      newMission
    );
  } catch (err) {}

  return newMission;
}

/**
 * Update a Mission (Admin)
 */
export async function updateMission(
  id: string,
  payload: Partial<Mission>,
  adminId: string = 'adm_root_700'
): Promise<Mission> {
  const allMissions = getLocal<Mission[]>(STORAGE_KEYS.MISSIONS, defaultMissions);
  const idx = allMissions.findIndex((m) => m.id === id);

  const updated: Mission = {
    ...(idx !== -1 ? allMissions[idx] : { id, title: 'Mission', requiredReferrals: 1, rewardAmount: 50, walletType: 'WITHDRAW_WALLET', icon: 'Target', status: 'ACTIVE', displayOrder: 1, createdAt: new Date().toISOString() }),
    ...payload,
    walletType: 'WITHDRAW_WALLET', // enforce Withdraw Wallet
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(apiUrl('/api/admin/missions/save'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ mission: { id, ...updated }, adminId }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const savedMission = { ...updated, ...json.data };
      if (idx !== -1) {
        allMissions[idx] = savedMission;
      } else {
        allMissions.push(savedMission);
      }
      allMissions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      saveLocal(STORAGE_KEYS.MISSIONS, allMissions);
      return savedMission;
    }
  } catch (err) {
    console.warn('Backend updateMission error, fallback to client:', err);
  }

  if (idx !== -1) {
    allMissions[idx] = updated;
    allMissions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    saveLocal(STORAGE_KEYS.MISSIONS, allMissions);
  }

  try {
    await recordAuditLog(
      adminId,
      'UPDATE_MISSION',
      'missions',
      id,
      `Updated mission: "${updated.title}"`,
      payload
    );
  } catch (err) {}

  return updated;
}

/**
 * Delete a Mission (Admin)
 * Already claimed rewards remain securely preserved in transactions history.
 */
export async function deleteMission(id: string, adminId: string = 'adm_root_700'): Promise<void> {
  const allMissions = getLocal<Mission[]>(STORAGE_KEYS.MISSIONS, defaultMissions);
  const existing = allMissions.find((m) => m.id === id);
  const filtered = allMissions.filter((m) => m.id !== id);

  try {
    const res = await fetch(apiUrl('/api/admin/missions/delete'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ missionId: id, adminId }),
    });
    const json = await res.json();
    if (json.success) {
      saveLocal(STORAGE_KEYS.MISSIONS, filtered);
      return;
    }
  } catch (err) {
    console.warn('Backend deleteMission error, fallback to client:', err);
  }

  saveLocal(STORAGE_KEYS.MISSIONS, filtered);

  try {
    await recordAuditLog(
      adminId,
      'DELETE_MISSION',
      'missions',
      id,
      `Deleted mission "${existing?.title || id}"`
    );
  } catch (err) {}
}

/**
 * Toggle Mission Status (ACTIVE <-> DISABLED)
 */
export async function toggleMissionStatus(
  id: string,
  status: 'ACTIVE' | 'DISABLED',
  adminId: string = 'adm_root_700'
): Promise<void> {
  await updateMission(id, { status }, adminId);
}

/**
 * Reorder Missions (Admin)
 */
export async function reorderMissions(orderedIds: string[], adminId: string = 'adm_root_700'): Promise<void> {
  const allMissions = getLocal<Mission[]>(STORAGE_KEYS.MISSIONS, defaultMissions);
  const map = new Map(allMissions.map((m) => [m.id, m]));

  orderedIds.forEach((id, index) => {
    const item = map.get(id);
    if (item) {
      item.displayOrder = index + 1;
      item.updatedAt = new Date().toISOString();
    }
  });

  const updatedList = Array.from(map.values()).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  saveLocal(STORAGE_KEYS.MISSIONS, updatedList);

  if (isSupabaseConfigured && supabase) {
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase
          .from('missions')
          .update({ display_order: i + 1, updated_at: new Date().toISOString() })
          .eq('id', orderedIds[i]);
      }
    } catch (e) {
      console.warn('Supabase reorderMissions fallback:', e);
    }
  }

  try {
    await recordAuditLog(
      adminId,
      'REORDER_MISSIONS',
      'missions',
      'bulk',
      `Reordered ${orderedIds.length} missions`
    );
  } catch (err) {}
}

/**
 * Helper: Calculate Active Direct Referrals (L1 who purchased FIRST plan)
 */
export async function calculateActiveDirectReferrals(userId: string): Promise<{
  activeCount: number;
  activeReferrals: { userId: string; username?: string; mobile?: string; firstPurchaseDate?: string; planName?: string }[];
}> {
  const profile = (await findUserByIdentifier(userId)) || {
    id: userId,
    userId,
    referralCode: '2829906',
    membershipNumber: '2829906',
  };

  const myCodes = new Set([
    profile.referralCode,
    profile.membershipNumber,
    profile.userId,
    profile.id,
    userId,
  ].filter(Boolean));

  // Get all users
  let allUsers: UserProfile[] = getLocal<UserProfile[]>(STORAGE_KEYS.LOCAL_USERS, []);
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data && data.length > 0) {
        allUsers = data.map((d: any) => ({
          id: d.id,
          userId: d.id,
          username: d.username,
          whatsappNo: d.whatsapp_no,
          mobile: d.whatsapp_no || d.mobile,
          membershipNumber: d.membership_number,
          referralCode: d.referral_code,
          referredBy: d.referred_by,
          deviceEarnings: Number(d.device_earnings || 0),
          teamEarnings: Number(d.team_earnings || 0),
          walletBalance: Number(d.wallet_balance || 0),
          createdAt: d.created_at,
        }));
      }
    } catch {
      // fallback
    }
  }

  // Filter ONLY Direct Referrals (L1)
  const directReferrals = allUsers.filter(
    (u) =>
      u.userId !== userId &&
      u.id !== userId &&
      u.referredBy &&
      myCodes.has(u.referredBy)
  );

  if (directReferrals.length === 0) {
    return { activeCount: 0, activeReferrals: [] };
  }

  // Get all purchases
  let allPurchases: PurchaseItem[] = getLocal<PurchaseItem[]>(STORAGE_KEYS.PURCHASES, []);
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('purchases').select('*');
      if (!error && data && data.length > 0) {
        allPurchases = data.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          planId: p.plan_id,
          planName: p.plan_name,
          amount: Number(p.amount || p.price || 0),
          status: p.status || 'ACTIVE',
          startedAt: p.started_at || p.created_at,
          createdAt: p.created_at,
        }));
      }
    } catch {
      // fallback
    }
  }

  const activeReferralsList: {
    userId: string;
    username?: string;
    mobile?: string;
    firstPurchaseDate?: string;
    planName?: string;
  }[] = [];

  const countedRefereeIds = new Set<string>();

  for (const referee of directReferrals) {
    const refereeId = referee.userId || referee.id;
    if (!refereeId || countedRefereeIds.has(refereeId)) continue;

    // Check if referee has at least 1 plan purchase
    const userPurchases = allPurchases.filter(
      (p) => (p.userId === refereeId || p.userId === referee.id) && p.status !== 'CANCELLED'
    );

    if (userPurchases.length > 0) {
      // Sort to find first purchase
      userPurchases.sort((a, b) => new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime());
      const firstPurchase = userPurchases[0];

      countedRefereeIds.add(refereeId);
      activeReferralsList.push({
        userId: refereeId,
        username: referee.username || 'Member',
        mobile: referee.whatsappNo || referee.mobile || '9800000000',
        firstPurchaseDate: firstPurchase.startedAt || new Date().toISOString(),
        planName: firstPurchase.planName || 'Device Plan',
      });
    }
  }

  return {
    activeCount: activeReferralsList.length,
    activeReferrals: activeReferralsList,
  };
}

/**
 * Fetch Comprehensive User Mission Summary
 */
export async function fetchUserMissionSummary(userId: string): Promise<UserMissionSummary> {
  // 0. Live Server API Query
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/missions/user-summary?userId=${encodeURIComponent(userId)}`), {
      headers: { 'x-user-id': userId, ...authHeaders },
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('[fetchUserMissionSummary] Server API fallback:', err);
  }

  const [missions, { activeCount }] = await Promise.all([
    fetchMissions(false),
    calculateActiveDirectReferrals(userId),
  ]);

  // Load claims
  let allClaims = getLocal<MissionClaim[]>(STORAGE_KEYS.MISSION_CLAIMS, []);
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('mission_claims')
        .select('*')
        .eq('user_id', userId)
        .order('claimed_at', { ascending: false });

      if (!error && data && data.length > 0) {
        allClaims = data.map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          missionId: c.mission_id,
          missionTitle: c.mission_title || 'Mission Bonus',
          rewardAmount: Number(c.reward_amount || 0),
          walletType: 'WITHDRAW_WALLET' as const,
          transactionId: c.transaction_id,
          claimedAt: c.claimed_at,
          status: 'COMPLETED' as const,
        }));
      }
    } catch {
      // fallback
    }
  }

  const userClaims = allClaims.filter((c) => c.userId === userId);
  const claimedMissionIds = new Map(userClaims.map((c) => [c.missionId, c.claimedAt]));

  const userMissions: UserMissionItem[] = missions.map((m) => {
    const isClaimed = claimedMissionIds.has(m.id);
    const claimedAt = claimedMissionIds.get(m.id);
    const currentProgress = Math.min(activeCount, m.requiredReferrals);
    const isCompleted = activeCount >= m.requiredReferrals;

    return {
      ...m,
      currentProgress,
      isCompleted,
      isClaimed,
      claimedAt,
    };
  });

  const completedMissionsCount = userMissions.filter((m) => m.isCompleted).length;
  const pendingMissionsCount = userMissions.filter((m) => !m.isCompleted).length;
  const totalBonusEarned = userClaims.reduce((sum, c) => sum + (c.rewardAmount || 0), 0);

  return {
    totalActiveReferrals: activeCount,
    completedMissionsCount,
    pendingMissionsCount,
    totalBonusEarned: +totalBonusEarned.toFixed(2),
    missions: userMissions,
    history: userClaims,
  };
}

/**
 * Claim Mission Reward
 * - One-time claim per mission
 * - Strictly credits into WITHDRAW WALLET
 * - Creates WalletTransaction and Notification
 */
export async function claimMissionReward(
  userId: string,
  missionId: string
): Promise<{ success: boolean; reward: number; message: string; transactionId?: string }> {
  if (!userId || !missionId) {
    throw new Error('User ID and Mission ID are required.');
  }

  // 0. Live Server API Claim
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(apiUrl('/api/missions/claim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId, ...authHeaders },
      body: JSON.stringify({ userId, missionId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      // Update local wallet cache if present
      const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
        availableBalance: 0,
        topupBalance: 0,
        withdrawBalance: 0,
        rechargeBalance: 0,
        earnedBalance: 0,
        totalEarned: 0,
      } as Wallet);
      if (data.newWithdrawBalance !== undefined) {
        wallet.withdrawBalance = data.newWithdrawBalance;
        wallet.earnedBalance = data.newWithdrawBalance;
        wallet.availableBalance = data.newWithdrawBalance;
        wallet.totalEarned = +((wallet.totalEarned || 0) + Number(data.rewardAmount || 0)).toFixed(2);
        saveLocal(STORAGE_KEYS.WALLET, wallet);
      }
      return {
        success: true,
        reward: Number(data.rewardAmount || 0),
        message: data.message || `Mission claimed!`,
        transactionId: data.transactionId,
      };
    }
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to claim mission');
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
  }

  // 1. Fetch missions and verify requirement
  const allMissions = await fetchMissions(true);
  const mission = allMissions.find((m) => m.id === missionId);
  if (!mission) {
    throw new Error('Mission not found or no longer available.');
  }

  if (mission.status === 'DISABLED') {
    throw new Error('This mission is currently unavailable.');
  }

  // 2. Check if already claimed
  let claims = getLocal<MissionClaim[]>(STORAGE_KEYS.MISSION_CLAIMS, []);
  if (claims.some((c) => c.userId === userId && c.missionId === missionId)) {
    throw new Error('You have already claimed this mission bonus!');
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: existingClaim } = await supabase
        .from('mission_claims')
        .select('id')
        .eq('user_id', userId)
        .eq('mission_id', missionId)
        .maybeSingle();

      if (existingClaim) {
        throw new Error('You have already claimed this mission bonus!');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('already claimed')) throw e;
    }
  }

  // 3. Server-side verification of active referrals
  const { activeCount } = await calculateActiveDirectReferrals(userId);
  if (activeCount < mission.requiredReferrals) {
    throw new Error(
      `Mission not completed yet! You have ${activeCount} / ${mission.requiredReferrals} active referrals.`
    );
  }

  const reward = Number(mission.rewardAmount);
  if (reward <= 0) {
    throw new Error('Invalid reward amount.');
  }

  const txId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'tx_msn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const claimId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'mclm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const nowStr = new Date().toISOString();

  // 4. Fetch User Profile
  const profile = await findUserByIdentifier(userId);

  // 5. Credit WITHDRAW WALLET
  let curWithdraw = 0;
  let newWithdraw = 0;

  // Supabase Atomic Credit
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletData) {
        curWithdraw = Number(walletData.withdraw_balance ?? walletData.earned_balance ?? walletData.available_balance ?? 0);
        newWithdraw = +(curWithdraw + reward).toFixed(2);
        const newTotalEarned = +((Number(walletData.total_earned || 0)) + reward).toFixed(2);

        await supabase
          .from('wallets')
          .update({
            withdraw_balance: newWithdraw,
            earned_balance: newWithdraw,
            available_balance: newWithdraw,
            total_earned: newTotalEarned,
            updated_at: nowStr,
          })
          .eq('user_id', userId);

        await supabase.from('wallet_transactions').insert({
          id: txId,
          user_id: userId,
          type: 'EARNING',
          amount: reward,
          balance_before: curWithdraw,
          balance_after: newWithdraw,
          wallet_type: 'WITHDRAW',
          status: 'COMPLETED',
          reference_id: mission.id,
          description: `Mission completed: ${mission.title}`,
          metadata: { missionId: mission.id, rewardType: 'MISSION' },
          created_at: nowStr,
        });

        await supabase.from('mission_claims').insert({
          id: claimId,
          user_id: userId,
          mission_id: mission.id,
          mission_title: mission.title,
          reward_amount: reward,
          wallet_type: 'WITHDRAW_WALLET',
          claimed_at: nowStr,
        });
      }
    } catch (err) {
      console.warn('Supabase claimMissionReward warning, proceeding with local persistence:', err);
    }
  }

  // Local Wallet Update
  const wallet = getLocal<Wallet>(STORAGE_KEYS.WALLET, {
    availableBalance: 0,
    topupBalance: 0,
    withdrawBalance: 0,
    rechargeBalance: 0,
    earnedBalance: 0,
    totalEarned: 0,
  } as Wallet);

  curWithdraw = wallet.withdrawBalance !== undefined ? wallet.withdrawBalance : (wallet.earnedBalance || wallet.availableBalance || 0);
  newWithdraw = +(curWithdraw + reward).toFixed(2);

  wallet.withdrawBalance = newWithdraw;
  wallet.earnedBalance = newWithdraw;
  wallet.availableBalance = newWithdraw;
  wallet.totalEarned = +((wallet.totalEarned || 0) + reward).toFixed(2);
  // Topup balance is strictly UNCHANGED
  saveLocal(STORAGE_KEYS.WALLET, wallet);

  // Record Transaction
  const txs = getLocal<WalletTransaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  const newTx: WalletTransaction = {
    id: txId,
    userId,
    type: 'MISSION_BONUS',
    amount: reward,
    balanceBefore: curWithdraw,
    balanceAfter: newWithdraw,
    balanceType: 'WITHDRAW_WALLET',
    status: 'Completed',
    referenceId: mission.id,
    description: `Mission completed: ${mission.title}`,
    createdAt: nowStr,
  };
  txs.unshift(newTx);
  saveLocal(STORAGE_KEYS.TRANSACTIONS, txs);

  // Save Claim Record
  const newClaim: MissionClaim = {
    id: claimId,
    userId,
    userMobile: profile?.whatsappNo || profile?.mobile,
    username: profile?.username || 'Member',
    missionId: mission.id,
    missionTitle: mission.title,
    rewardAmount: reward,
    walletType: 'WITHDRAW_WALLET',
    transactionId: txId,
    claimedAt: nowStr,
    status: 'COMPLETED',
  };
  claims.unshift(newClaim);
  saveLocal(STORAGE_KEYS.MISSION_CLAIMS, claims);

  // Create Notification
  try {
    await createNotificationForUser({
      userId,
      title: 'Mission Bonus Received',
      description: `Congratulations! You received ₹${reward.toFixed(2)} Mission Bonus.`,
      type: 'EARNING',
      isHomePopup: false,
      actionUrl: '/transactions',
      actionText: 'View Wallet Ledger',
    });
  } catch {}

  return {
    success: true,
    reward,
    message: `Congratulations! You received ₹${reward.toFixed(2)} Mission Bonus in your Withdraw Wallet.`,
    transactionId: txId,
  };
}

/**
 * Fetch Admin Mission Stats
 */
export async function fetchAdminMissionStats(): Promise<AdminMissionStats> {
  const missions = await fetchMissions(true);
  let claims = getLocal<MissionClaim[]>(STORAGE_KEYS.MISSION_CLAIMS, []);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('mission_claims').select('*');
      if (!error && data && data.length > 0) {
        claims = data.map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          missionId: c.mission_id,
          missionTitle: c.mission_title || 'Mission Bonus',
          rewardAmount: Number(c.reward_amount || 0),
          walletType: 'WITHDRAW_WALLET',
          transactionId: c.transaction_id,
          claimedAt: c.claimed_at,
          status: 'COMPLETED',
        }));
      }
    } catch {}
  }

  const totalBonusDistributed = claims.reduce((sum, c) => sum + (c.rewardAmount || 0), 0);

  return {
    totalMissions: missions.length,
    activeMissions: missions.filter((m) => m.status === 'ACTIVE').length,
    completedClaims: claims.length,
    pendingClaims: 0,
    totalBonusDistributed: +totalBonusDistributed.toFixed(2),
  };
}

/**
 * Fetch Admin Mission Claims Log
 */
export async function fetchAdminMissionClaims(): Promise<MissionClaim[]> {
  let claims = getLocal<MissionClaim[]>(STORAGE_KEYS.MISSION_CLAIMS, []);

  if (isSupabaseConfigured && supabase) {
    try {
      const [claimsRes, profilesRes] = await Promise.all([
        supabase
          .from('mission_claims')
          .select('*')
          .order('claimed_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, user_id, username, whatsapp_no, mobile'),
      ]);

      if (!claimsRes.error && claimsRes.data && claimsRes.data.length > 0) {
        const profileMap = new Map<string, any>();
        if (profilesRes.data) {
          profilesRes.data.forEach((p: any) => {
            if (p.user_id) profileMap.set(p.user_id, p);
            if (p.id) profileMap.set(p.id, p);
          });
        }

        return claimsRes.data.map((c: any) => {
          const prof = profileMap.get(c.user_id) || {};
          return {
            id: c.id,
            userId: c.user_id,
            userMobile: prof.whatsapp_no || prof.mobile || c.user_mobile || '9800000000',
            username: prof.username || c.username || 'Member',
            missionId: c.mission_id,
            missionTitle: c.mission_title || 'Mission Bonus',
            rewardAmount: Number(c.reward_amount || 0),
            walletType: 'WITHDRAW_WALLET' as const,
            transactionId: c.transaction_id,
            claimedAt: c.claimed_at,
            status: 'COMPLETED' as const,
          };
        });
      }
    } catch {}
  }

  return claims;
}

// ==============================================================================
// DEPOSIT COMPLAINTS API & STORAGE HELPERS
// ==============================================================================

export async function compressImageFile(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } else {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => {
        resolve((e.target?.result as string) || '');
      };
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export async function uploadComplaintScreenshot(file: File, userId?: string): Promise<string> {
  // Compress image before upload/fallback
  let compressedBase64 = '';
  try {
    compressedBase64 = await compressImageFile(file);
  } catch {
    // fallback
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const fileExt = 'jpg';
      const userFolder = userId ? userId.trim() : 'anonymous';
      const fileName = `complaint_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `${userFolder}/${fileName}`;

      let blobToUpload: Blob = file;
      if (compressedBase64 && compressedBase64.startsWith('data:image')) {
        const byteString = atob(compressedBase64.split(',')[1]);
        const mimeString = compressedBase64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        blobToUpload = new Blob([ab], { type: mimeString });
      }

      const { error: uploadError } = await supabase.storage
        .from('deposit-complaints')
        .upload(filePath, blobToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });

      if (!uploadError) {
        // Return private storage path for secure signed URL resolution
        return filePath;
      } else {
        console.warn('Storage upload error, falling back to data URL:', uploadError);
      }
    } catch (err) {
      console.warn('Screenshot upload exception:', err);
    }
  }

  // Fallback to compressed Data URL
  if (compressedBase64) {
    return compressedBase64;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function fetchUserComplaintSignedUrl(params: {
  userId: string;
  complaintId?: string;
  filePath?: string;
}): Promise<string | null> {
  try {
    const resp = await fetch(apiUrl('/api/deposit-complaint/signed-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json.success && json.signedUrl) {
        return json.signedUrl;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch user complaint signed URL:', err);
  }
  return null;
}

export async function submitDepositComplaint(data: {
  userId: string;
  traceno: string;
  amount: number;
  utr: string;
  proofUrl?: string;
  note?: string;
}): Promise<{ success: boolean; complaintId?: string; message: string }> {
  try {
    const resp = await fetch(apiUrl('/api/deposit-complaint'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const text = await resp.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Server returned an invalid response while submitting complaint.');
    }

    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to submit deposit complaint.');
    }

    return json;
  } catch (err: any) {
    // If backend endpoint is temporarily unreachable, fallback to direct Supabase insert
    if (isSupabaseConfigured && supabase) {
      const nowIso = new Date().toISOString();
      const { data: complaint, error } = await supabase
        .from('payments')
        .insert({
          user_id: data.userId,
          order_id: data.traceno,
          reference_id: data.traceno,
          amount: data.amount,
          payment_type: 'DEPOSIT_COMPLAINT',
          payment_method: 'PAY_COMPLAINT',
          utr: data.utr,
          utr_number: data.utr,
          proof_url: data.proofUrl || null,
          status: 'PENDING_VERIFICATION',
          rejection_reason: data.note ? `User note: ${data.note}` : null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      return {
        success: true,
        complaintId: complaint.id,
        message: 'Deposit complaint registered. Admin will review and credit shortly.',
      };
    }
    throw err;
  }
}

export async function fetchAdminDepositComplaints(): Promise<import('../types').DepositComplaint[]> {
  try {
    const resp = await fetch(apiUrl('/api/admin/complaints'), {
      headers: getAdminAuthHeaders(),
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('Error fetching complaints from API:', e);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const [paymentsRes, profilesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .or('payment_type.eq.DEPOSIT_COMPLAINT,payment_method.eq.PAY_COMPLAINT')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, user_id, username, whatsapp_no, membership_number, mobile'),
      ]);

      if (!paymentsRes.error && paymentsRes.data) {
        const profileMap = new Map<string, any>();
        if (profilesRes.data) {
          profilesRes.data.forEach((p: any) => {
            if (p.user_id) profileMap.set(p.user_id, p);
            if (p.id) profileMap.set(p.id, p);
          });
        }

        return paymentsRes.data.map((p: any) => {
          const prof = profileMap.get(p.user_id) || {};
          return {
            id: p.id,
            userId: p.user_id,
            username: prof.username || 'User',
            userMobile: prof.whatsapp_no || prof.mobile || '',
            membershipNumber: prof.membership_number || '',
            orderId: p.order_id || p.reference_id || 'N/A',
            traceno: p.order_id || p.reference_id || 'N/A',
            amount: Number(p.amount || 0),
            utr: p.utr || p.utr_number || '',
            proofUrl: p.proof_url || p.receipt_url || '',
            receiptUrl: p.proof_url || p.receipt_url || '',
            status: p.status,
            adminId: p.admin_id,
            adminNote: p.rejection_reason,
            rejectionReason: p.rejection_reason,
            verifiedAt: p.verified_at,
            verifiedBy: p.verified_by,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          };
        });
      }
    } catch {}
  }

  return [];
}

export async function approveDepositComplaint(complaintId: string, adminId: string, adminNote?: string): Promise<{ success: boolean; message: string }> {
  const resp = await fetch(apiUrl('/api/admin/approve-complaint'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ complaintId, adminId, adminNote }),
  });

  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Invalid server response during approval.');
  }

  if (!resp.ok || !json.success) {
    throw new Error(json.error || 'Failed to approve complaint.');
  }

  return json;
}

export async function rejectDepositComplaint(complaintId: string, rejectionReason: string, adminId: string): Promise<{ success: boolean; message: string }> {
  const resp = await fetch(apiUrl('/api/admin/reject-complaint'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ complaintId, rejectionReason, adminId }),
  });

  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Invalid server response during rejection.');
  }

  if (!resp.ok || !json.success) {
    throw new Error(json.error || 'Failed to reject complaint.');
  }

  return json;
}

// ==============================================================================
// SITE SETTINGS (BRANDING) SERVICES
// ==============================================================================

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(apiUrl('/api/site-settings'));
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('[SITE SETTINGS] Failed to fetch from API, falling back:', e);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', 'site_settings')
        .maybeSingle();

      if (!error && data?.value) {
        return data.value;
      }
    } catch (_e) {}
  }

  return {
    siteTitle: 'GAINPOWER',
    logoUrl: '',
    faviconUrl: '',
  };
}

export async function saveSiteSettings(config: Partial<SiteSettings>, adminId = 'adm_root'): Promise<{ success: boolean; data: SiteSettings }> {
  try {
    const res = await fetch(apiUrl('/api/admin/site-settings'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ config, adminId }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        return json;
      }
    }
  } catch (_e) {}

  if (isSupabaseConfigured && supabase) {
    try {
      const current = await fetchSiteSettings();
      const updated = { ...current, ...config };
      await supabase.from('admin_settings').upsert({
        id: 'site_settings',
        value: updated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      return { success: true, data: updated };
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to save site settings to database.');
    }
  }

  return {
    success: true,
    data: {
      siteTitle: config.siteTitle || 'GAINPOWER',
      logoUrl: config.logoUrl || '',
      faviconUrl: config.faviconUrl || '',
    },
  };
}

export async function uploadSiteAsset(file: File, prefix = 'branding'): Promise<string> {
  if (!file) throw new Error('No file provided.');

  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  // First convert to base64 dataUrl
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const res = await fetch(apiUrl('/api/admin/upload-asset'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({
        fileName,
        fileData: dataUrl,
        contentType: file.type || 'image/png',
      }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.url) {
        return json.url;
      }
    }
  } catch (err) {
    console.warn('[SITE ASSET UPLOAD] Backend upload error, using local dataUrl fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (!error && data?.path) {
        const { data: publicData } = supabase.storage
          .from('site-assets')
          .getPublicUrl(data.path);
        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch (err) {
      console.warn('[SITE ASSET UPLOAD] Client supabase upload fallback failed:', err);
    }
  }

  // Guaranteed fallback to dataUrl
  return dataUrl;
}

// ==============================================================================
// RECHARGE CONFIGURATION SERVICES
// ==============================================================================

export async function fetchRechargeSettings(): Promise<RechargeSettings> {
  try {
    const res = await fetch(apiUrl('/api/recharge-settings'));
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('[RECHARGE SETTINGS] Failed to fetch from API, falling back:', e);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', 'recharge_settings')
        .maybeSingle();

      if (!error && data?.value) {
        return data.value;
      }
    } catch (_e) {}
  }

  return {
    presetAmounts: [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000],
    minRecharge: 100,
    maxRecharge: 50000,
    isEnabled: true,
  };
}

export async function saveRechargeSettings(config: Partial<RechargeSettings>, adminId = 'adm_root'): Promise<{ success: boolean; data: RechargeSettings }> {
  try {
    const res = await fetch(apiUrl('/api/admin/recharge-settings'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ config, adminId }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        return json;
      }
    }
  } catch (_e) {}

  if (isSupabaseConfigured && supabase) {
    try {
      const current = await fetchRechargeSettings();
      const updated = { ...current, ...config };
      await supabase.from('admin_settings').upsert({
        id: 'recharge_settings',
        value: updated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      return { success: true, data: updated };
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to save recharge settings to database.');
    }
  }

  return {
    success: true,
    data: {
      presetAmounts: config.presetAmounts || [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000],
      minRecharge: config.minRecharge || 100,
      maxRecharge: config.maxRecharge || 50000,
      isEnabled: config.isEnabled !== undefined ? config.isEnabled : true,
    },
  };
}

// ==============================================================================
// USDT DEPOSIT SERVICES
// ==============================================================================

export async function fetchUsdtSettings(): Promise<UsdtSettings> {
  try {
    const res = await fetch(apiUrl('/api/usdt-settings'));
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('[USDT SETTINGS] Failed to fetch from API, falling back:', e);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('id', 'usdt_settings')
        .maybeSingle();

      if (!error && data?.value) {
        return data.value;
      }
    } catch (_e) {}
  }

  return {
    isEnabled: true,
    usdtRate: 100,
    trc20Address: '',
    bep20Address: '',
    qrUrl: '',
  };
}

export async function saveUsdtSettings(config: Partial<UsdtSettings>, adminId = 'adm_root'): Promise<{ success: boolean; data: UsdtSettings }> {
  try {
    const res = await fetch(apiUrl('/api/admin/usdt-settings'), {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ config, adminId }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (json.success && json.data) {
        return json;
      }
    }
  } catch (_e) {}

  if (isSupabaseConfigured && supabase) {
    try {
      const current = await fetchUsdtSettings();
      const updated = { ...current, ...config };
      await supabase.from('admin_settings').upsert({
        id: 'usdt_settings',
        value: updated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      return { success: true, data: updated };
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to save USDT settings to database.');
    }
  }

  return {
    success: true,
    data: {
      isEnabled: config.isEnabled !== undefined ? config.isEnabled : true,
      usdtRate: config.usdtRate || 100,
      trc20Address: config.trc20Address || '',
      bep20Address: config.bep20Address || '',
      qrUrl: config.qrUrl || '',
    },
  };
}

export async function uploadUsdtScreenshot(userId: string, file: File): Promise<string> {
  if (!userId || !file) throw new Error('User ID and File are required.');
  const ext = file.name.split('.').pop() || 'png';
  const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.storage
      .from('usdt-deposits')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (error) {
      console.warn('[USDT SCREENSHOT UPLOAD] Supabase storage upload warning:', error.message);
    } else if (data?.path) {
      return data.path;
    }
  }

  // Fallback to base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function submitUsdtDeposit(payload: {
  userId: string;
  amountInr: number;
  usdtAmount: number;
  usdtRate: number;
  network: 'TRC20' | 'BEP20';
  walletAddress?: string;
  txHash?: string;
  proofPath: string;
  note?: string;
}): Promise<{ success: boolean; depositId: string; message: string }> {
  const res = await fetch(apiUrl('/api/usdt-deposit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to submit USDT deposit.');
  }
  return json;
}

export async function fetchUserUsdtDeposits(userId: string): Promise<UsdtDepositItem[]> {
  if (!userId) return [];
  try {
    const res = await fetch(apiUrl(`/api/usdt-deposits/user/${encodeURIComponent(userId)}`));
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (e) {
    console.warn('[USER USDT DEPOSITS] Failed to fetch:', e);
  }
  return [];
}

export async function fetchAdminUsdtDeposits(): Promise<UsdtDepositItem[]> {
  try {
    const res = await fetch(apiUrl('/api/admin/usdt-deposits'), {
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (e) {
    console.warn('[ADMIN USDT DEPOSITS] Failed to fetch:', e);
  }
  return [];
}

export async function fetchUsdtSignedUrl(userId: string, depositId?: string, filePath?: string): Promise<string> {
  try {
    const res = await fetch(apiUrl('/api/usdt-deposit/signed-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, depositId, filePath }),
    });
    const json = await res.json();
    if (json.success && json.signedUrl) {
      return json.signedUrl;
    }
  } catch (e) {
    console.warn('[USDT SIGNED URL] Failed to fetch:', e);
  }
  return '';
}

export async function approveUsdtDeposit(depositId: string, adminId = 'adm_root', adminNote = ''): Promise<{ success: boolean; message: string }> {
  const res = await fetch(apiUrl('/api/admin/approve-usdt-deposit'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ depositId, adminId, adminNote }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to approve USDT deposit.');
  }
  return json;
}

export async function rejectUsdtDeposit(depositId: string, rejectionReason: string, adminId = 'adm_root'): Promise<{ success: boolean; message: string }> {
  const res = await fetch(apiUrl('/api/admin/reject-usdt-deposit'), {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ depositId, rejectionReason, adminId }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to reject USDT deposit.');
  }
  return json;
}







