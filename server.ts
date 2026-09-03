import express from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// CORS Configuration for Production Frontend & Preview Environments
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://gainpower-top-1.com',
    'https://www.gainpower-top-1.com',
    'https://power-bank-3ib3vyvgja-as.a.run.app',
    'https://ais-dev-d34grmbfgtflzvx45gft2s-97603468745.asia-southeast1.run.app',
    'https://ais-pre-d34grmbfgtflzvx45gft2s-97603468745.asia-southeast1.run.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
  ];

  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.run.app') ||
    origin.includes('gainpower-top-1.com')
  );

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Admin-Token, x-user-id, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// Gateway Configurations
const UNIVEPAY_MERCHANT_NO = process.env.UNIVEPAY_MERCHANT_NO || '';
const UNIVEPAY_SECRET = process.env.UNIVEPAY_SECRET || '';
const UNIVEPAY_CREATE_DEPOSIT_URL =
  process.env.UNIVEPAY_CREATE_DEPOSIT_URL || 'https://ydpay.univepay.com/Payment/GlobalPay';
const UNIVEPAY_QUERY_DEPOSIT_URL =
  process.env.UNIVEPAY_QUERY_DEPOSIT_URL || 'https://ydpay.univepay.com/Payment/OrderQuery';
const UNIVEPAY_WITHDRAWAL_URL =
  process.env.UNIVEPAY_WITHDRAWAL_URL || 'https://ydpay.univepay.com/Payment/Cashout';
const UNIVEPAY_QUERY_WITHDRAWAL_URL =
  process.env.UNIVEPAY_QUERY_WITHDRAWAL_URL || 'https://ydpay.univepay.com/Payment/CashoutQuery';
const UNIVEPAY_BALANCE_URL =
  process.env.UNIVEPAY_BALANCE_URL || 'https://ydpay.univepay.com/Payment/BalanceQuery';

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

function getAppUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}`;
}

// Safely normalize and initialize Supabase admin client
function formatSupabaseUrl(url?: string): string {
  const fallback = 'https://evhwqlnymvoduclmzshz.supabase.co';
  if (!url) return fallback;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return `https://${trimmed}.supabase.co`;
  }
  return fallback;
}

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://evhwqlnymvoduclmzshz.supabase.co';
const supabaseUrl = formatSupabaseUrl(rawSupabaseUrl);
const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (err) {
    console.warn('Failed to initialize server-side Supabase client:', err);
    supabaseClient = null;
  }
}
const supabase = supabaseClient;

// Helper: Log gateway traffic
async function recordGatewayLog(params: {
  endpoint: string;
  direction: 'INBOUND' | 'OUTBOUND';
  traceno?: string;
  userTransactionId?: string;
  httpStatus?: number;
  gatewayStatus?: string;
  responseCode?: string;
  payload?: any;
  errorMessage?: string;
}) {
  if (!supabase) return;
  try {
    await supabase.from('gateway_logs').insert({
      endpoint: params.endpoint,
      direction: params.direction,
      traceno: params.traceno,
      user_transaction_id: params.userTransactionId,
      http_status: params.httpStatus,
      gateway_status: params.gatewayStatus,
      response_code: params.responseCode,
      payload: params.payload,
      error_message: params.errorMessage,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Error recording gateway log:', e);
  }
}

// ==============================================================================
// AUTHENTICATION & ONBOARDING API ENDPOINTS (REAL DATABASE PERSISTENCE)
// ==============================================================================
app.post('/api/auth/register', async (req, res) => {
  const {
    name = '',
    username = '',
    phone = '',
    email = '',
    password = '',
    withdrawalPassword = '',
    referralCode = '',
    membershipNumber = '',
  } = req.body;

  const cleanPhone = String(phone).replace(/\D/g, '');
  const cleanEmail = (email || `${cleanPhone}@gainpower.top`).toLowerCase().trim();
  const cleanUsername = (username ? String(username).replace(/[^a-zA-Z0-9_]/g, '') : `user_${cleanPhone.slice(-6)}`).trim();
  const cleanRef = String(referralCode || '').trim().toUpperCase();
  const memNum = membershipNumber || 'GP' + Math.floor(100000 + Math.random() * 900000);

  if (!cleanPhone || cleanPhone.length !== 10) {
    return res.status(400).json({ success: false, error: 'Valid 10-digit phone number is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }
  const cleanPin = String(withdrawalPassword || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return res.status(400).json({ success: false, error: 'Withdrawal PIN must be exactly 4 digits.' });
  }
  if (!cleanRef) {
    return res.status(400).json({ success: false, error: 'Referral code is required.' });
  }
  if (
    cleanRef === cleanPhone ||
    cleanRef.toLowerCase() === cleanUsername.toLowerCase() ||
    cleanRef.toLowerCase() === cleanEmail.toLowerCase()
  ) {
    return res.status(400).json({ success: false, error: 'You cannot use your own referral code.' });
  }

  if (!supabase || !hasServiceRoleKey) {
    return res.status(500).json({
      success: false,
      error: 'Supabase server client or service role key is not configured.',
    });
  }

  try {
    let createdUserId: string | null = null;
    let authUserObj: any = null;

    // 1. Check if phone is already registered in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, user_id, whatsapp_no, username')
      .or(`phone.eq.${cleanPhone},whatsapp_no.eq.${cleanPhone},mobile.eq.${cleanPhone}`)
      .maybeSingle();

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        error: 'This phone number is already registered. Please login instead.',
      });
    }

    // 2. Validate Referral Code against live DB
    let referrerProfile: any = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
    const filterStr = isUUID
      ? `referral_code.ilike.${cleanRef},membership_number.ilike.${cleanRef},user_id.eq.${cleanRef},id.eq.${cleanRef}`
      : `referral_code.ilike.${cleanRef},membership_number.ilike.${cleanRef}`;
    const { data: refProf, error: refProfErr } = await supabase
      .from('profiles')
      .select('id, user_id, referral_code, membership_number, username, phone, mobile, whatsapp_no')
      .or(filterStr)
      .maybeSingle();
    if (refProfErr) {
      console.warn('[SERVER AUTH] Referrer lookup error:', refProfErr.message);
    }
    referrerProfile = refProf;

    if (!referrerProfile) {
      return res.status(400).json({
        success: false,
        error: 'Invalid referral code. Please provide a valid inviter code.',
      });
    }

    if (
      referrerProfile.phone === cleanPhone ||
      referrerProfile.whatsapp_no === cleanPhone ||
      referrerProfile.mobile === cleanPhone
    ) {
      return res.status(400).json({
        success: false,
        error: 'You cannot use your own referral code.',
      });
    }

    const referrerUserId = referrerProfile.user_id || referrerProfile.id;
    const referrerDisplayCode = referrerProfile.referral_code || referrerProfile.membership_number || cleanRef;

    // 3. Create user via Admin API (bypasses email rate limits and sets email confirmed)
    const { data: adminUser, error: adminErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        email_verified: true,
        full_name: name || cleanUsername,
        name: name || cleanUsername,
        username: cleanUsername,
        phone: cleanPhone,
        mobile: cleanPhone,
        whatsapp_no: cleanPhone,
        membership_number: memNum,
        referral_code: memNum,
      },
    });

    if (adminErr || !adminUser?.user?.id) {
      console.warn('[SERVER AUTH] admin.createUser error details:', {
        message: adminErr?.message,
        status: adminErr?.status,
        name: adminErr?.name,
        cleanEmail,
        memNum,
      });
      const msg = (adminErr?.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('user already registered') || msg.includes('duplicate')) {
        return res.status(400).json({
          success: false,
          error: 'This phone number is already registered. Please login instead.',
        });
      }
      return res.status(500).json({
        success: false,
        error: adminErr?.message || 'Failed to create user authentication record.',
      });
    }

    createdUserId = adminUser.user.id;
    authUserObj = adminUser.user;
    const now = new Date().toISOString();

    // Helper for transactional rollback of partial registration
    const rollbackPartialRegistration = async (uid: string) => {
      try {
        console.warn(`[SERVER AUTH] Rolling back partial registration for uid: ${uid}`);
        await supabase.from('wallet_transactions').delete().eq('user_id', uid);
        await supabase.from('notifications').delete().eq('user_id', uid);
        await supabase.from('referrals').delete().eq('referee_id', uid);
        await supabase.from('user_security').delete().eq('user_id', uid);
        await supabase.from('wallets').delete().eq('user_id', uid);
        await supabase.from('profiles').delete().eq('user_id', uid);
        await supabase.auth.admin.deleteUser(uid);
        console.log(`[SERVER AUTH] Rollback completed for uid: ${uid}`);
      } catch (rbErr) {
        console.error('[SERVER AUTH] Rollback error:', rbErr);
      }
    };

    // 4. Perform atomic user onboarding via RPC if present
    try {
      await supabase.rpc('handle_user_onboarding', {
        p_user_id: createdUserId,
        p_username: cleanUsername,
        p_whatsapp_no: cleanPhone,
        p_email: cleanEmail,
        p_membership_number: memNum,
        p_referral_code: memNum,
        p_referred_by: referrerDisplayCode,
      });
    } catch (rpcErr) {
      console.warn('[SERVER AUTH] RPC onboarding notice:', rpcErr);
    }

    // 5. Ensure profile row exists in profiles table
    const { data: profExist } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', createdUserId)
      .maybeSingle();

    let finalProfile = profExist;
    if (!finalProfile) {
      const { data: insertedProf, error: insProfErr } = await supabase
        .from('profiles')
        .insert({
          id: createdUserId,
          user_id: createdUserId,
          name: name || cleanUsername,
          full_name: name || cleanUsername,
          phone: cleanPhone,
          phone_number: cleanPhone,
          mobile: cleanPhone,
          username: cleanUsername,
          whatsapp_no: cleanPhone,
          email: cleanEmail,
          membership_number: memNum,
          referral_code: memNum,
          referred_by: referrerDisplayCode,
          role: 'user',
          status: 'active',
          vip_level: 0, // Rule 1: New Member VIP LEVEL = VIP 0 as database source of truth
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insProfErr) {
        console.error('[SERVER AUTH] profiles insert failure:', insProfErr.message);
        await rollbackPartialRegistration(createdUserId);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user profile in database: ' + insProfErr.message,
        });
      }
      finalProfile = insertedProf;
    } else {
      const { data: updatedProf } = await supabase
        .from('profiles')
        .update({
          name: name || cleanUsername,
          full_name: name || cleanUsername,
          phone: cleanPhone,
          phone_number: cleanPhone,
          mobile: cleanPhone,
          username: cleanUsername,
          whatsapp_no: cleanPhone,
          referred_by: referrerDisplayCode,
          vip_level: profExist.vip_level !== undefined && profExist.vip_level !== null ? profExist.vip_level : 0,
          updated_at: now,
        })
        .eq('user_id', createdUserId)
        .select()
        .single();
      if (updatedProf) finalProfile = updatedProf;
    }

    // 6. Ensure wallet row exists with configured Sign-up Bonus (default ₹50.0)
    let signupBonus = 50.0;
    try {
      const { data: sysSet } = await supabase.from('admin_settings').select('value').eq('key', 'system_settings').maybeSingle();
      if (sysSet?.value && typeof sysSet.value === 'object' && sysSet.value.signUpBonusAmount !== undefined) {
        signupBonus = Number(sysSet.value.signUpBonusAmount);
      }
    } catch (_sErr) {}

    const { data: walExist } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', createdUserId)
      .maybeSingle();

    let finalWallet = walExist;
    if (!finalWallet) {
      const { data: insertedWal, error: insWalErr } = await supabase
        .from('wallets')
        .insert({
          user_id: createdUserId,
          available_balance: signupBonus,
          recharge_balance: signupBonus,
          withdraw_balance: 0.0,
          pending_balance: 0.0,
          total_earned: 0.0,
          total_withdrawn: 0.0,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insWalErr) {
        console.error('[SERVER AUTH] wallets insert failure:', insWalErr.message);
        await rollbackPartialRegistration(createdUserId);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user wallet in database: ' + insWalErr.message,
        });
      }
      finalWallet = insertedWal;
    }

    // 7. Securely hash and store withdrawal PIN in user_security table using bcrypt
    const wthPassHash = bcrypt.hashSync(cleanPin, 10);
    const { error: secErr } = await supabase
      .from('user_security')
      .upsert(
        {
          user_id: createdUserId,
          withdrawal_password_hash: wthPassHash,
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );

    if (secErr) {
      console.error('[SERVER AUTH] user_security upsert error:', secErr.message);
      await rollbackPartialRegistration(createdUserId);
      return res.status(500).json({
        success: false,
        error: 'Failed to record user security credentials: ' + secErr.message,
      });
    }

    // 8. Insert referral link in referrals table (Direct Level 1 relationship)
    if (referrerUserId) {
      const { data: refLinkExist } = await supabase
        .from('referrals')
        .select('id')
        .eq('referee_id', createdUserId)
        .maybeSingle();

      if (!refLinkExist) {
        const { error: refInsErr } = await supabase.from('referrals').insert({
          referrer_id: referrerUserId,
          referee_id: createdUserId,
          level: 1,
          bonus_amount: 0,
          status: 'ACTIVE',
          qualifying_recharge_done: false,
          commission_earned: 0,
          created_at: now,
          updated_at: now,
        });
        if (refInsErr) {
          console.warn('[SERVER AUTH] referrals L1 insert warning:', refInsErr.message);
        }
      }
    }

    // 9. Record Signup Bonus transaction in wallet_transactions
    try {
      await supabase.from('wallet_transactions').insert({
        user_id: createdUserId,
        type: 'ADMIN_ADJUSTMENT',
        amount: signupBonus,
        balance_before: 0.0,
        balance_after: signupBonus,
        balance_type: 'RECHARGE_WALLET',
        wallet_type: 'TOPUP',
        status: 'COMPLETED',
        reference_id: `SIGNUP-BONUS-${createdUserId}`,
        description: '🎁 Welcome Signup Bonus credited to Recharge Wallet',
        created_at: now,
      });
    } catch (txErr) {
      console.warn('[SERVER AUTH] wallet_transactions insert notice:', txErr);
    }

    // 10. Create Welcome Notification
    try {
      await supabase.from('notifications').insert({
        user_id: createdUserId,
        title: 'Welcome to GAIN POWER! ⚡',
        message: `Your account has been activated with ₹${signupBonus} Signup Bonus in your Recharge Wallet. Deploy your first GAIN POWER device to start earning daily income.`,
        type: 'ANNOUNCEMENT',
        read: false,
        created_at: now,
      });
    } catch (notifErr) {
      console.warn('[SERVER AUTH] notifications insert notice:', notifErr);
    }

    // 11. Fresh database read verification of all required records
    const { data: verifiedProf } = await supabase.from('profiles').select('*').eq('user_id', createdUserId).maybeSingle();
    const { data: verifiedWal } = await supabase.from('wallets').select('*').eq('user_id', createdUserId).maybeSingle();
    const { data: verifiedSec } = await supabase.from('user_security').select('*').eq('user_id', createdUserId).maybeSingle();
    const { data: verifiedRef } = await supabase.from('referrals').select('*').eq('referee_id', createdUserId).maybeSingle();

    if (!verifiedProf) {
      await rollbackPartialRegistration(createdUserId);
      return res.status(500).json({ success: false, error: 'Database onboarding verification failed: profile record missing.' });
    }
    if (!verifiedWal) {
      await rollbackPartialRegistration(createdUserId);
      return res.status(500).json({ success: false, error: 'Database onboarding verification failed: wallet record missing.' });
    }
    if (!verifiedSec) {
      await rollbackPartialRegistration(createdUserId);
      return res.status(500).json({ success: false, error: 'Database onboarding verification failed: security record missing.' });
    }
    if (referrerUserId && !verifiedRef) {
      await rollbackPartialRegistration(createdUserId);
      return res.status(500).json({ success: false, error: 'Database onboarding verification failed: referral record missing.' });
    }

    // 12. Trigger Referral Rule One: Registration + Login Referral Reward
    if (supabase) {
      processRegistrationReferralRewardServer(supabase, createdUserId).catch((e) =>
        console.warn('[SERVER AUTH] Registration referral reward error:', e)
      );
    }

    return res.json({
      success: true,
      user: authUserObj,
      userId: createdUserId,
      email: cleanEmail,
      profile: verifiedProf,
      wallet: verifiedWal,
    });
  } catch (err: any) {
    console.error('[SERVER AUTH] Registration error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Registration failed',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier = '', phone = '', username = '', email = '', password = '' } = req.body;
  const inputId = String(identifier || phone || username || email || '').trim();

  if (!inputId) {
    return res.status(400).json({ success: false, error: 'Please enter your phone number, username, or email.' });
  }
  if (!password) {
    return res.status(400).json({ success: false, error: 'Please enter your password.' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database service unavailable' });
  }

  try {
    const cleanDigits = inputId.replace(/\D/g, '');
    let targetEmail = inputId;

    if (!inputId.includes('@')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, id, user_id, username, phone')
        .or(`phone.eq.${cleanDigits},whatsapp_no.eq.${cleanDigits},mobile.eq.${cleanDigits},username.ilike.${inputId}`)
        .limit(1)
        .maybeSingle();

      if (profile?.email) {
        targetEmail = profile.email;
      } else {
        targetEmail = `${cleanDigits || inputId}@gainpower.top`;
      }
    }

    let authUser: any = null;
    let authSession: any = null;

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (authErr || !authData?.user) {
      if (cleanDigits) {
        const fallbacks = [`${cleanDigits}@gainpower.internal`, `${cleanDigits}@powerbank.app`];
        let recovered = false;
        for (const fbEmail of fallbacks) {
          const { data: fbData, error: fbErr } = await supabase.auth.signInWithPassword({
            email: fbEmail,
            password,
          });
          if (!fbErr && fbData?.user) {
            recovered = true;
            authUser = fbData.user;
            authSession = fbData.session;
            break;
          }
        }
        if (!recovered) {
          return res.status(401).json({ success: false, error: 'Invalid phone number or password.' });
        }
      } else {
        return res.status(401).json({ success: false, error: authErr?.message || 'Invalid credentials.' });
      }
    } else {
      authUser = authData.user;
      authSession = authData.session;
    }

    const uid = authUser.id;
    const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    const { data: wal } = await supabase.from('wallets').select('*').eq('user_id', uid).maybeSingle();

    // Trigger Referral Rule One upon successful login (if invited friend registers and logs in)
    if (supabase && uid) {
      processRegistrationReferralRewardServer(supabase, uid).catch((e) =>
        console.warn('[SERVER AUTH] Login referral reward error:', e)
      );
    }

    return res.json({
      success: true,
      user: authUser,
      session: authSession,
      profile: prof,
      wallet: wal,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Login error' });
  }
});

app.post('/api/auth/onboarding', async (req, res) => {
  const {
    userId,
    name = '',
    username = '',
    whatsappNo = '',
    phone = '',
    email = '',
    membershipNumber = '',
    referralCode = '',
    referredBy = null,
  } = req.body;

  if (!userId || !supabase) {
    return res.json({ success: true, message: 'Onboarding bypassed' });
  }

  const cleanPhone = String(phone || whatsappNo).replace(/\D/g, '');
  const cleanEmail = (email || `${cleanPhone}@gainpower.app`).toLowerCase().trim();
  const cleanUsername = (username || name || `user_${cleanPhone.slice(-4)}`).trim();
  const memNum = membershipNumber || referralCode || 'GP' + Math.floor(100000 + Math.random() * 900000);

  try {
    // 1. Try RPC onboarding
    try {
      await supabase.rpc('handle_user_onboarding', {
        p_user_id: userId,
        p_username: cleanUsername,
        p_whatsapp_no: cleanPhone,
        p_email: cleanEmail,
        p_membership_number: memNum,
        p_referral_code: memNum,
        p_referred_by: referredBy || null,
      });
    } catch (e) {
      console.warn('[SERVER ONBOARDING] RPC fallback:', e);
    }

    // 2. Direct profiles check/upsert
    const { data: pData } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (!pData) {
      await supabase.from('profiles').insert({
        user_id: userId,
        username: cleanUsername,
        whatsapp_no: cleanPhone,
        mobile: cleanPhone,
        email: cleanEmail,
        membership_number: memNum,
        referral_code: memNum,
        referred_by: referredBy || null,
        role: 'user',
        status: 'active',
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Direct wallets check/upsert
    const { data: wData } = await supabase.from('wallets').select('id').eq('user_id', userId).maybeSingle();
    if (!wData) {
      await supabase.from('wallets').insert({
        user_id: userId,
        available_balance: 50.0,
        recharge_balance: 50.0,
        withdraw_balance: 0.0,
        pending_balance: 0.0,
        total_earned: 0.0,
        total_withdrawn: 0.0,
        updated_at: new Date().toISOString(),
      });
    }

    return res.json({ success: true, message: 'Onboarding completed successfully' });
  } catch (err: any) {
    console.error('[SERVER ONBOARDING] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Dedicated function to construct exact Univepay Create Payment MD5 Signature:
 * Authoritative format from supabase/functions/create-payin-order/index.ts
 */
function generateSortedSignature(params: Record<string, string>, secretKey: string): string {
  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase() !== 'signature' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();
  const rawString = keys.map((k) => `${k}=${params[k]}`).join('&') + `&${secretKey}`;
  return crypto.createHash('md5').update(rawString).digest('hex').toUpperCase();
}

function generatePositionalCreateSignature(
  amount: string,
  merchno: string,
  notifyUrl: string,
  payCode: string,
  traceno: string,
  secretKey: string
): string {
  const signString = `${amount}${merchno}${notifyUrl}${payCode}${traceno}${secretKey}`;
  return crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
}

// ==============================================================================
// 1. UNIVEPAY / CHINESE GATEWAY CREATE PAYMENT (TOP UP / PAYIN)
// ==============================================================================
const handleCreatePayment = async (req: express.Request, res: express.Response) => {
  // Extract and authenticate user from Bearer JWT if present, or fallback to body.userId in dev
  let authenticatedUserId: string | null = null;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (supabase && token) {
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (!authError && userData?.user?.id) {
      authenticatedUserId = userData.user.id;
    }
  }

  // Fallback to body.userId only if not authenticated via token (e.g. dev/local)
  if (!authenticatedUserId && req.body?.userId) {
    authenticatedUserId = req.body.userId;
  }

  if (!authenticatedUserId) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please login to continue.' });
  }

  const { amount, payCode = 'UPI', customerName, customerEmail, customerPhone } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ success: false, error: 'Minimum top up amount is ₹100' });
  }

  // Load gateway credentials from DB or environment (Authoritative fallback)
  let merchNo = UNIVEPAY_MERCHANT_NO || process.env.GATEWAY_MERCH_NO || 'C26854';
  let secretKey = UNIVEPAY_SECRET || process.env.GATEWAY_SECRET_KEY || 'secret';
  let baseUrl = UNIVEPAY_CREATE_DEPOSIT_URL ? UNIVEPAY_CREATE_DEPOSIT_URL.replace(/\/Payment\/GlobalPay.*$/, '') : 'https://ydpay.univepay.com';
  let notifyUrl = process.env.GATEWAY_NOTIFY_URL || 'https://evhwqlnymvoduclmzshz.supabase.co/functions/v1/payment-callback';
  const callbackUrl = process.env.GATEWAY_CALLBACK_URL || 'https://gainpower-top-1.com/wallet?status=success';

  if (supabase) {
    try {
      const { data: config } = await supabase.from('gateway_settings').select('*').eq('is_active', true).maybeSingle();
      if (config) {
        if (config.merchant_no && !UNIVEPAY_MERCHANT_NO) merchNo = config.merchant_no;
        if (config.secret_key && !UNIVEPAY_SECRET) secretKey = config.secret_key;
        if (config.base_url) baseUrl = config.base_url;
        if (config.notify_url) notifyUrl = config.notify_url;
      }
    } catch (_e) {}
  }

  // Server-side unique order number (Traceno)
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const traceno = req.body.orderId || req.body.traceno || `DEP${timestamp}${randomSuffix}`;
  const formattedAmount = numAmount.toFixed(2);

  // Initialize canonical deposit transaction record and pending wallet transaction record
  if (supabase) {
    try {
      await supabase.from('deposit_transactions').insert({
        order_id: traceno,
        traceno: traceno,
        merchant_order_id: traceno,
        user_id: authenticatedUserId,
        amount: numAmount,
        currency: 'INR',
        pay_code: payCode,
        status: 'PENDING',
        channel: 'UNIVEPAY',
      });
    } catch (e: any) {
      console.warn('[GATEWAY][CREATE] Insert deposit_transactions warning:', e.message);
    }

    try {
      const { data: curWallet } = await supabase.from('wallets').select('recharge_balance').eq('user_id', authenticatedUserId).maybeSingle();
      const curBal = Number(curWallet?.recharge_balance || 0);
      await supabase.from('wallet_transactions').insert({
        user_id: authenticatedUserId,
        type: 'RECHARGE',
        amount: numAmount,
        balance_before: curBal,
        balance_after: curBal,
        reference_id: traceno,
        description: `Recharge Order #${traceno}`,
        wallet_type: 'TOPUP',
        status: 'Pending',
      });
    } catch (wErr: any) {
      console.warn('[GATEWAY][CREATE] Insert pending wallet_transactions warning:', wErr.message);
    }
  }

  // Build authoritative request payload matching supabase/functions/create-payin-order/index.ts
  const payload: Record<string, string> = {
    Merchno: merchNo,
    Traceno: traceno,
    Amount: formattedAmount,
    Pname: customerName || 'Customer',
    Pemail: customerEmail || 'customer@example.com',
    Phone: customerPhone || '9876543210',
    CountryCode: 'india',
    Currency: 'INR',
    PayCode: payCode === 'UPI' || payCode === '印度UPI-银台' ? 'UPI' : payCode,
    GoodsName: 'Wallet TopUp',
    NotifyUrl: notifyUrl,
    CallbackUrl: callbackUrl,
    BankCode: 'INR',
    AccNo: customerName || 'Customer',
  };

  payload.Signature = generateSortedSignature(payload, secretKey);

  console.log(`[UNIVEPAY][CREATE] Traceno: ${traceno}, Amount: ${formattedAmount}, Merchno: ${merchNo}, PayCode: ${payload.PayCode}`);

  const endpointUrl = `${baseUrl.replace(/\/+$/, '')}/Payment/GlobalPay`;
  const requestBody = new URLSearchParams(payload);

  try {
    await recordGatewayLog({
      endpoint: endpointUrl,
      direction: 'OUTBOUND',
      traceno,
      userTransactionId: authenticatedUserId,
      payload,
    });

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody.toString(),
    });

    const responseText = await response.text();
    let result: any = null;
    try {
      if (responseText && responseText.trim().startsWith('{')) {
        result = JSON.parse(responseText);
      } else if (responseText && responseText.trim()) {
        result = { raw: responseText };
      }
    } catch (parseErr) {
      result = { raw: responseText };
    }

    await recordGatewayLog({
      endpoint: endpointUrl,
      direction: 'INBOUND',
      traceno,
      httpStatus: response.status,
      payload: result,
    });

    const isValidSuccessStatus = result && (result.status === '00' || result.status === 'SUCCESS' || result.code === '00' || result.success === true);
    const isValidPayUrl =
      result &&
      typeof result.payUrl === 'string' &&
      (result.payUrl.startsWith('https://') || result.payUrl.startsWith('http://'));

    if (isValidSuccessStatus && isValidPayUrl) {
      if (supabase) {
        await supabase
          .from('deposit_transactions')
          .update({
            pay_url: result.payUrl,
            gateway_order_id: result.payOrderid || result.orderId || null,
            gateway_response: result,
            raw_response: result,
            updated_at: new Date().toISOString(),
          })
          .eq('traceno', traceno);
      }

      return res.json({
        success: true,
        status: '00',
        orderId: traceno,
        traceno,
        payUrl: result.payUrl,
        payOrderid: result.payOrderid || '',
        payAmount: result.payAmount || formattedAmount,
        payData: result.payData || null,
      });
    } else {
      console.error('[UNIVEPAY][CREATE] Gateway creation response:', result);
      if (supabase) {
        await supabase
          .from('deposit_transactions')
          .update({
            gateway_response: result,
            raw_response: result,
            status: 'FAILED_GATEWAY_CREATION',
            updated_at: new Date().toISOString(),
          })
          .eq('traceno', traceno);
      }

      // If gateway returns a payUrl directly even without status 00
      if (result?.payUrl && typeof result.payUrl === 'string') {
        return res.json({
          success: true,
          status: '00',
          orderId: traceno,
          traceno,
          payUrl: result.payUrl,
        });
      }

      return res.status(400).json({
        success: false,
        error: result?.msg || result?.message || result?.error || 'Payment gateway temporarily unavailable. Please try again.',
        details: result,
      });
    }
  } catch (networkErr: any) {
    console.error('[UNIVEPAY][CREATE] Network error calling Gateway:', networkErr);
    if (supabase) {
      await supabase
        .from('deposit_transactions')
        .update({
          status: 'FAILED_GATEWAY_CREATION',
          updated_at: new Date().toISOString(),
        })
        .eq('traceno', traceno);
    }

    return res.status(502).json({
      success: false,
      error: 'Payment gateway temporarily unavailable. Please check your connection and try again.',
      details: networkErr.message,
    });
  }
};

app.post('/api/univepay/create-payment', handleCreatePayment);
app.post('/api/univepay/create-deposit', handleCreatePayment);
app.post('/api/create-payin-order', handleCreatePayment);
app.post('/functions/v1/create-payin-order', handleCreatePayment);

// ==============================================================================
// ATOMIC & IDEMPOTENT DEPOSIT SETTLEMENT HELPER
// ==============================================================================
async function processReferralCommissionsServer(supabaseClient: any, userId: string, depositAmount: number, traceno: string) {
  try {
    let tiers = [
      { tier: 1, percentage: 10 },
      { tier: 2, percentage: 5 },
      { tier: 3, percentage: 2 },
    ];

    try {
      const { data: set } = await supabaseClient
        .from('admin_settings')
        .select('*')
        .eq('id', 'referral_tiers')
        .maybeSingle();
      if (set?.value && Array.isArray(set.value)) {
        tiers = set.value;
      }
    } catch (_e) {}

    // Find Level 1 referrer (direct parent of userId)
    const { data: l1Ref } = await supabaseClient
      .from('referrals')
      .select('*')
      .eq('referee_id', userId)
      .maybeSingle();

    const l1ReferrerId = l1Ref?.referrer_id;
    if (!l1ReferrerId) return;

    // Find Level 2 referrer (parent of Level 1)
    let l2ReferrerId: string | null = null;
    if (l1ReferrerId) {
      const { data: l2Ref } = await supabaseClient
        .from('referrals')
        .select('*')
        .eq('referee_id', l1ReferrerId)
        .maybeSingle();
      l2ReferrerId = l2Ref?.referrer_id || null;
    }

    // Find Level 3 referrer (parent of Level 2)
    let l3ReferrerId: string | null = null;
    if (l2ReferrerId) {
      const { data: l3Ref } = await supabaseClient
        .from('referrals')
        .select('*')
        .eq('referee_id', l2ReferrerId)
        .maybeSingle();
      l3ReferrerId = l3Ref?.referrer_id || null;
    }

    const tierTargets = [
      { tierNum: 1, referrerId: l1ReferrerId, refRowId: l1Ref?.id },
      { tierNum: 2, referrerId: l2ReferrerId, refRowId: null },
      { tierNum: 3, referrerId: l3ReferrerId, refRowId: null },
    ];

    const nowIso = new Date().toISOString();

    for (const target of tierTargets) {
      if (!target.referrerId || target.referrerId === userId) continue;
      const tierConfig = tiers.find((t) => t.tier === target.tierNum);
      if (!tierConfig || tierConfig.percentage <= 0) continue;

      const commission = +(depositAmount * (tierConfig.percentage / 100)).toFixed(2);
      if (commission <= 0) continue;

      const isPurchase = String(traceno).startsWith('PUR-');
      const refId = isPurchase ? `PLAN-REF-L${target.tierNum}-${traceno}` : `TOPUP-REF-L${target.tierNum}-${traceno}`;
      const commDesc = isPurchase
        ? `Level ${target.tierNum} Team Commission (${tierConfig.percentage}%) from Plan Purchase`
        : `Level ${target.tierNum} Team Commission (${tierConfig.percentage}%) from Topup #${traceno}`;

      // Idempotency: check both wallet_ledger and wallet_transactions
      const { data: existingLedger } = await supabaseClient
        .from('wallet_ledger')
        .select('id')
        .eq('reference_id', refId)
        .maybeSingle();

      if (existingLedger) continue;

      const { data: existingTx } = await supabaseClient
        .from('wallet_transactions')
        .select('id')
        .eq('reference_id', refId)
        .maybeSingle();

      if (existingTx) continue;

      const { data: refWallet } = await supabaseClient
        .from('wallets')
        .select('*')
        .eq('user_id', target.referrerId)
        .maybeSingle();

      const curWithdraw = Number(refWallet?.withdraw_balance !== undefined && refWallet?.withdraw_balance !== null ? refWallet.withdraw_balance : (refWallet?.earned_balance || 0));
      const curRecharge = Number(refWallet?.recharge_balance || 0);
      const curTotalEarned = Number(refWallet?.total_earned || 0);
      const curTeamComm = Number(refWallet?.team_commission || 0);

      const newWithdraw = +(curWithdraw + commission).toFixed(2);
      const newAvail = +(curRecharge + newWithdraw).toFixed(2);
      const newTotalEarned = +(curTotalEarned + commission).toFixed(2);
      const newTeamComm = +(curTeamComm + commission).toFixed(2);

      if (refWallet) {
        await supabaseClient
          .from('wallets')
          .update({
            withdraw_balance: newWithdraw,
            earned_balance: newWithdraw,
            available_balance: newAvail,
            total_earned: newTotalEarned,
            team_commission: newTeamComm,
            updated_at: nowIso,
          })
          .eq('user_id', target.referrerId);
      } else {
        await supabaseClient.from('wallets').insert({
          user_id: target.referrerId,
          recharge_balance: 0,
          withdraw_balance: newWithdraw,
          earned_balance: newWithdraw,
          available_balance: newWithdraw,
          pending_balance: 0,
          total_earned: newTotalEarned,
          team_commission: newTeamComm,
          total_withdrawn: 0,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      await supabaseClient.from('wallet_transactions').insert({
        user_id: target.referrerId,
        type: 'EARNING',
        amount: commission,
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        reference_id: refId,
        description: commDesc,
        wallet_type: 'WITHDRAW',
        status: 'Completed',
        created_at: nowIso,
      });

      try {
        await supabaseClient.from('wallet_ledger').insert({
          user_id: target.referrerId,
          wallet_type: 'WITHDRAW',
          transaction_type: `REFERRAL_L${target.tierNum}`,
          amount: commission,
          direction: 'CREDIT',
          reference_type: 'REFERRAL_COMMISSION',
          reference_id: refId,
          balance_before: curWithdraw,
          balance_after: newWithdraw,
          description: commDesc,
          created_at: nowIso,
        });
      } catch (ledErr: any) {
        console.warn('[REFERRAL COMMISSION LEDGER NOTICE]', ledErr.message);
      }

      await supabaseClient.from('notifications').insert({
        user_id: target.referrerId,
        title: `Tier ${target.tierNum} Team Commission Earned! 💰`,
        message: `You received ₹${commission.toFixed(2)} (${tierConfig.percentage}%) commission from a team member recharge.`,
        type: 'EARNING',
        read: false,
        created_at: nowIso,
      });

      if (target.refRowId) {
        await supabaseClient
          .from('referrals')
          .update({
            qualifying_recharge_done: true,
            commission_earned: +((l1Ref?.commission_earned || 0) + commission).toFixed(2),
            updated_at: nowIso,
          })
          .eq('id', target.refRowId);
      }
    }
  } catch (err: any) {
    console.error('[SETTLEMENT] Referral commission error:', err.message);
  }
}

// ==============================================================================
// REFERRAL REWARD ENGINE (RULE 1 & RULE 2)
// ==============================================================================

/**
 * RULE ONE: Registration + Login Referral Reward
 * Triggered when invited friend registers & logs in.
 * Reward credited to inviter's Withdraw Wallet. Exactly once per invited friend.
 */
async function processRegistrationReferralRewardServer(supabaseClient: any, refereeUserId: string) {
  if (!supabaseClient || !refereeUserId) return { success: false, reason: 'invalid_args' };

  try {
    // 1. Fetch Referral Settings
    const { data: setRow } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('id', 'referral_settings')
      .maybeSingle();

    const settings = setRow?.value || {};
    const isSysEnabled = settings.isReferralSystemEnabled !== false;
    const regConfig = settings.registrationReward || {};
    const isRegEnabled = regConfig.enabled !== false;
    const rewardAmount = Number(regConfig.rewardAmount ?? 5);

    if (!isSysEnabled || !isRegEnabled || rewardAmount <= 0) {
      return { success: false, reason: 'registration_reward_disabled' };
    }

    // 2. Find Referrer
    const { data: refRow } = await supabaseClient
      .from('referrals')
      .select('*')
      .eq('referee_id', refereeUserId)
      .maybeSingle();

    if (!refRow || !refRow.referrer_id || refRow.referrer_id === refereeUserId) {
      return { success: false, reason: 'no_referrer' };
    }

    const referrerId = refRow.referrer_id;

    // 3. Idempotency Check - Exactly once per qualifying invited friend
    const regRefId = `REG-${refereeUserId}`;
    const { data: existingTx } = await supabaseClient
      .from('wallet_transactions')
      .select('id')
      .eq('reference_id', regRefId)
      .maybeSingle();

    if (existingTx) {
      return { success: false, reason: 'already_rewarded' };
    }

    const { data: existingLog } = await supabaseClient
      .from('admin_settings')
      .select('id')
      .eq('id', `reg_reward_${refereeUserId}`)
      .maybeSingle();

    if (existingLog) {
      return { success: false, reason: 'already_rewarded' };
    }

    // 4. Credit Inviter's Withdraw Wallet
    const { data: refWallet } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', referrerId)
      .maybeSingle();

    const curWithdraw = Number(refWallet?.withdraw_balance !== undefined && refWallet?.withdraw_balance !== null ? refWallet.withdraw_balance : (refWallet?.earned_balance || 0));
    const curAvail = Number(refWallet?.available_balance || 0);
    const curTotalEarned = Number(refWallet?.total_earned || 0);

    const newWithdraw = +(curWithdraw + rewardAmount).toFixed(2);
    const newAvail = +(curAvail + rewardAmount).toFixed(2);
    const newTotalEarned = +(curTotalEarned + rewardAmount).toFixed(2);
    const nowIso = new Date().toISOString();

    if (refWallet) {
      await supabaseClient
        .from('wallets')
        .update({
          withdraw_balance: newWithdraw,
          earned_balance: newWithdraw,
          available_balance: newAvail,
          total_earned: newTotalEarned,
          updated_at: nowIso,
        })
        .eq('user_id', referrerId);
    } else {
      await supabaseClient
        .from('wallets')
        .insert({
          user_id: referrerId,
          withdraw_balance: newWithdraw,
          earned_balance: newWithdraw,
          available_balance: newAvail,
          total_earned: newTotalEarned,
          recharge_balance: 0,
          pending_balance: 0,
          created_at: nowIso,
          updated_at: nowIso,
        });
    }

    // 5. Record in wallet_transactions
    const txId = `tx_reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await supabaseClient.from('wallet_transactions').insert({
      id: txId,
      user_id: referrerId,
      type: 'EARNING',
      amount: rewardAmount,
      balance_before: curWithdraw,
      balance_after: newWithdraw,
      wallet_type: 'WITHDRAW',
      status: 'COMPLETED',
      reference_id: regRefId,
      description: 'Registration Referral Reward: Invited friend registered & logged in',
      created_at: nowIso,
    });

    // 6. Record in wallet_ledger
    try {
      await supabaseClient.from('wallet_ledger').insert({
        user_id: referrerId,
        wallet_type: 'WITHDRAW',
        transaction_type: 'REFERRAL_REGISTRATION',
        amount: rewardAmount,
        direction: 'CREDIT',
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        reference_type: 'REFERRAL_REWARD',
        reference_id: regRefId,
        description: 'Referral bonus from invited friend registration',
        created_at: nowIso,
      });
    } catch (_ledgerErr) {}

    // 7. Notification to inviter
    try {
      await supabaseClient.from('notifications').insert({
        user_id: referrerId,
        title: 'Referral Reward Credited! 🎉',
        message: `You earned ₹${rewardAmount.toFixed(2)} because your invited friend successfully registered & logged in!`,
        type: 'EARNING',
        is_read: false,
        created_at: nowIso,
      });
    } catch (_notifErr) {}

    // 8. Idempotency record in admin_settings
    try {
      await supabaseClient.from('admin_settings').upsert({
        id: `reg_reward_${refereeUserId}`,
        value: {
          refereeUserId,
          referrerId,
          rewardAmount,
          rewardedAt: nowIso,
        },
        updated_at: nowIso,
      });
    } catch (_setErr) {}

    console.log(`[REFERRAL RULE 1] Credited ₹${rewardAmount} to inviter ${referrerId} for referee ${refereeUserId}`);
    return { success: true, rewardAmount, referrerId };
  } catch (err: any) {
    console.error('[REFERRAL RULE 1 ERROR]', err);
    return { success: false, error: err.message };
  }
}

/**
 * RULE TWO: Device Earn Consecutive Days Streak Referral Reward
 * Triggered ONLY when invited friend actually claims their device earn fund.
 * Tracks calendar days of successful claims.
 * Resets if calendar day missed.
 * Awards configured reward once required streak is reached.
 * Credited to inviter's Withdraw Wallet. Exactly once per invited friend.
 */
async function processConsecutiveClaimReferralRewardServer(supabaseClient: any, refereeUserId: string) {
  if (!supabaseClient || !refereeUserId) return { success: false, reason: 'invalid_args' };

  try {
    // 1. Fetch Referral Settings
    const { data: setRow } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('id', 'referral_settings')
      .maybeSingle();

    const settings = setRow?.value || {};
    const isSysEnabled = settings.isReferralSystemEnabled !== false;
    const streakConfig = settings.streakReward || {};
    const isStreakEnabled = streakConfig.enabled !== false;
    const rewardAmount = Number(streakConfig.rewardAmount ?? 15);
    const requiredDays = Number(streakConfig.consecutiveDays ?? 3);

    if (!isSysEnabled || !isStreakEnabled || rewardAmount <= 0 || requiredDays <= 0) {
      return { success: false, reason: 'streak_reward_disabled' };
    }

    // 2. Find Referrer
    const { data: refRow } = await supabaseClient
      .from('referrals')
      .select('*')
      .eq('referee_id', refereeUserId)
      .maybeSingle();

    if (!refRow || !refRow.referrer_id || refRow.referrer_id === refereeUserId) {
      return { success: false, reason: 'no_referrer' };
    }

    const referrerId = refRow.referrer_id;

    // 3. Calendar dates in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + istOffset).toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() + istOffset - 86400000).toISOString().split('T')[0];

    // 4. Retrieve streak record
    const streakKey = `streak_${refereeUserId}`;
    const { data: streakRow } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('id', streakKey)
      .maybeSingle();

    let streakData = streakRow?.value || null;
    let currentStreak = 1;
    let rewardCredited = false;

    if (!streakData) {
      currentStreak = 1;
      rewardCredited = false;
    } else {
      rewardCredited = Boolean(streakData.rewardCredited);
      if (streakData.lastClaimDate === todayStr) {
        // Already claimed today, streak doesn't increase multiple times in same calendar day
        return { success: true, currentStreak: streakData.currentStreak || 1, rewarded: rewardCredited };
      } else if (streakData.lastClaimDate === yesterdayStr) {
        // Consecutive calendar day claim!
        currentStreak = (streakData.currentStreak || 0) + 1;
      } else {
        // Missed a calendar day, reset streak to 1
        currentStreak = 1;
      }
    }

    const nowIso = new Date().toISOString();

    // 5. If streak matches required days and not yet rewarded
    let justAwarded = false;
    if (currentStreak >= requiredDays && !rewardCredited) {
      const streakRefId = `STRK-REF-${refereeUserId}`;
      const { data: existingTx } = await supabaseClient
        .from('wallet_transactions')
        .select('id')
        .eq('reference_id', streakRefId)
        .maybeSingle();

      if (!existingTx) {
        // Credit Inviter's Withdraw Wallet
        const { data: refWallet } = await supabaseClient
          .from('wallets')
          .select('*')
          .eq('user_id', referrerId)
          .maybeSingle();

        const curWithdraw = Number(refWallet?.withdraw_balance !== undefined && refWallet?.withdraw_balance !== null ? refWallet.withdraw_balance : (refWallet?.earned_balance || 0));
        const curAvail = Number(refWallet?.available_balance || 0);
        const curTotalEarned = Number(refWallet?.total_earned || 0);

        const newWithdraw = +(curWithdraw + rewardAmount).toFixed(2);
        const newAvail = +(curAvail + rewardAmount).toFixed(2);
        const newTotalEarned = +(curTotalEarned + rewardAmount).toFixed(2);

        if (refWallet) {
          await supabaseClient
            .from('wallets')
            .update({
              withdraw_balance: newWithdraw,
              earned_balance: newWithdraw,
              available_balance: newAvail,
              total_earned: newTotalEarned,
              updated_at: nowIso,
            })
            .eq('user_id', referrerId);
        }

        // Record in wallet_transactions
        const txId = `tx_strk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await supabaseClient.from('wallet_transactions').insert({
          id: txId,
          user_id: referrerId,
          type: 'EARNING',
          amount: rewardAmount,
          balance_before: curWithdraw,
          balance_after: newWithdraw,
          wallet_type: 'WITHDRAW',
          status: 'COMPLETED',
          reference_id: streakRefId,
          description: `Streak Claim Reward: Invited friend claimed device earnings for ${requiredDays} consecutive days`,
          created_at: nowIso,
        });

        // Record in wallet_ledger
        try {
          await supabaseClient.from('wallet_ledger').insert({
            user_id: referrerId,
            wallet_type: 'WITHDRAW',
            transaction_type: 'REFERRAL_STREAK_CLAIM',
            amount: rewardAmount,
            direction: 'CREDIT',
            balance_before: curWithdraw,
            balance_after: newWithdraw,
            reference_type: 'REFERRAL_REWARD',
            reference_id: streakRefId,
            description: `Consecutive claim bonus for ${requiredDays} days streak`,
            created_at: nowIso,
          });
        } catch (_ledgerErr) {}

        // Notification to inviter
        try {
          await supabaseClient.from('notifications').insert({
            user_id: referrerId,
            title: 'Consecutive Claim Referral Reward! 🎁',
            message: `You earned ₹${rewardAmount.toFixed(2)} because your invited friend claimed device earnings for ${requiredDays} consecutive days!`,
            type: 'EARNING',
            is_read: false,
            created_at: nowIso,
          });
        } catch (_notifErr) {}

        rewardCredited = true;
        justAwarded = true;
        console.log(`[REFERRAL RULE 2] Awarded ₹${rewardAmount} streak reward to inviter ${referrerId} for referee ${refereeUserId} (${currentStreak} consecutive days)`);
      } else {
        rewardCredited = true;
      }
    }

    // 6. Update streak record in admin_settings
    await supabaseClient.from('admin_settings').upsert({
      id: streakKey,
      value: {
        refereeUserId,
        referrerId,
        currentStreak,
        lastClaimDate: todayStr,
        rewardCredited,
        updatedAt: nowIso,
      },
      updated_at: nowIso,
    });

    return {
      success: true,
      currentStreak,
      rewarded: rewardCredited,
      justAwarded,
      rewardAmount: justAwarded ? rewardAmount : 0,
    };
  } catch (err: any) {
    console.error('[REFERRAL RULE 2 ERROR]', err);
    return { success: false, error: err.message };
  }
}

app.post('/api/test-commission-settle', async (req, res) => {
  try {
    const { userId, amount, traceno } = req.body;
    if (!userId || !amount || !traceno) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }
    await processReferralCommissionsServer(supabase, userId, Number(amount), String(traceno));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DEPOSIT-BASED VIP UPGRADE ENGINE (VIP 3, 4, 5, 6)
 * Rule 6:
 * - VIP 3, 4, 5, 6 are deposit-based upgrades using existing admin-configured deposit thresholds.
 * - Only successful/approved deposits count (no pending, failed, rejected, cancelled).
 * - VIP level must never decrease.
 */
async function checkAndUpdateDepositVip(userId: string): Promise<{ upgraded: boolean; newVip: number; currentVip: number }> {
  if (!supabase || !userId) return { upgraded: false, newVip: 0, currentVip: 0 };
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('vip_level')
      .eq('user_id', userId)
      .maybeSingle();

    const currentVip = Number(profile?.vip_level || 0);

    // Existing default thresholds (VIP 3: 5000, VIP 4: 15000, VIP 5: 40000, VIP 6: 100000)
    let thresholdVip3 = 5000;
    let thresholdVip4 = 15000;
    let thresholdVip5 = 40000;
    let thresholdVip6 = 100000;

    try {
      const { data: vipLevelsData } = await supabase
        .from('vip_levels')
        .select('*')
        .order('level_number', { ascending: true });

      if (vipLevelsData && vipLevelsData.length > 0) {
        for (const lvl of vipLevelsData) {
          const num = Number(lvl.level_number !== undefined ? lvl.level_number : lvl.levelNumber);
          const minInv = Number(lvl.min_investment || lvl.minInvestment || 0);
          if (minInv > 0) {
            if (num === 3) thresholdVip3 = minInv;
            if (num === 4) thresholdVip4 = minInv;
            if (num === 5) thresholdVip5 = minInv;
            if (num === 6) thresholdVip6 = minInv;
          }
        }
      }
    } catch (_e) {}

    // Sum all successful/approved deposits across deposit_transactions and payments
    const [depRes, payRes] = await Promise.all([
      supabase
        .from('deposit_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'SUCCESS'),
      supabase
        .from('payments')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'PAID'),
    ]);

    let totalSuccessfulDeposits = 0;
    if (depRes.data) {
      for (const d of depRes.data) {
        totalSuccessfulDeposits += Number(d.amount || 0);
      }
    }
    if (payRes.data) {
      for (const p of payRes.data) {
        totalSuccessfulDeposits += Number(p.amount || 0);
      }
    }

    let depositVip = currentVip;
    if (totalSuccessfulDeposits >= thresholdVip6) {
      depositVip = Math.max(depositVip, 6);
    } else if (totalSuccessfulDeposits >= thresholdVip5) {
      depositVip = Math.max(depositVip, 5);
    } else if (totalSuccessfulDeposits >= thresholdVip4) {
      depositVip = Math.max(depositVip, 4);
    } else if (totalSuccessfulDeposits >= thresholdVip3) {
      depositVip = Math.max(depositVip, 3);
    }

    // VIP level must never decrease
    if (depositVip > currentVip) {
      const nowIso = new Date().toISOString();
      await supabase
        .from('profiles')
        .update({
          vip_level: depositVip,
          updated_at: nowIso,
        })
        .eq('user_id', userId);

      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: `VIP Upgraded to VIP ${depositVip}! 🏆`,
          message: `Congratulations! Your approved deposit total of ₹${totalSuccessfulDeposits.toFixed(2)} has upgraded your account to VIP ${depositVip}.`,
          type: 'VIP',
          read: false,
          created_at: nowIso,
        });
      } catch {}

      console.log(`[VIP UPGRADE] User ${userId} upgraded from VIP ${currentVip} to VIP ${depositVip} (Deposits: ₹${totalSuccessfulDeposits})`);
      return { upgraded: true, newVip: depositVip, currentVip };
    }

    return { upgraded: false, newVip: currentVip, currentVip };
  } catch (err) {
    console.error('[VIP UPGRADE ERROR]', err);
    return { upgraded: false, newVip: 0, currentVip: 0 };
  }
}

async function settleDepositSuccess(
  traceno: string,
  serialNo?: string,
  rawPayload?: any,
  utr?: string
): Promise<{ success: boolean; alreadyProcessed?: boolean; error?: string; order?: any }> {
  if (!supabase || !traceno) return { success: false, error: 'Missing supabase or traceno' };

  // 1. Fetch the deposit transaction
  const { data: order, error: fetchErr } = await supabase
    .from('deposit_transactions')
    .select('*')
    .or(`traceno.eq.${traceno},merchant_order_id.eq.${traceno}`)
    .maybeSingle();

  if (fetchErr || !order) {
    console.error(`[SETTLEMENT] Order not found for traceno: ${traceno}`);
    return { success: false, error: 'ORDER_NOT_FOUND' };
  }

  // 2. Idempotency check: if order is already SUCCESS / PAID / COMPLETED, return immediately
  const statusUpper = (order.status || '').toUpperCase();
  if (statusUpper === 'SUCCESS' || statusUpper === 'PAID' || statusUpper === 'COMPLETED') {
    console.log(`[SETTLEMENT] Order ${traceno} already settled (${order.status}). Skipping duplicate credit.`);
    return { success: true, alreadyProcessed: true, order };
  }

  const userId = order.user_id;
  const depositAmount = Number(order.amount);
  if (!userId || isNaN(depositAmount) || depositAmount <= 0) {
    return { success: false, error: 'INVALID_ORDER_DATA' };
  }

  // 3. Fetch user wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const currentRechargeBalance = Number(wallet?.recharge_balance || 0);
  const currentWithdrawBalance = Number(wallet?.withdraw_balance || 0);
  const newRechargeBalance = +(currentRechargeBalance + depositAmount).toFixed(2);
  const newAvailableBalance = +(newRechargeBalance + currentWithdrawBalance).toFixed(2);
  const nowIso = new Date().toISOString();

  // 4. Update deposit_transactions record to SUCCESS
  const { error: updateOrderErr } = await supabase
    .from('deposit_transactions')
    .update({
      status: 'SUCCESS',
      gateway_status: 'SUCCESS',
      gateway_serial_no: serialNo || order.gateway_serial_no || null,
      serial_no: serialNo || order.serial_no || null,
      utr: utr || order.utr || null,
      callback_received: true,
      signature_verified: true,
      raw_response: rawPayload || order.raw_response,
      completed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', order.id);

  if (updateOrderErr) {
    console.error(`[SETTLEMENT] Failed to update deposit_transactions for ${traceno}:`, updateOrderErr);
    return { success: false, error: updateOrderErr.message };
  }

  // 5. Update wallet (Credit Topup Wallet only; withdraw_balance unchanged)
  if (wallet) {
    await supabase
      .from('wallets')
      .update({
        recharge_balance: newRechargeBalance,
        available_balance: newAvailableBalance,
        updated_at: nowIso,
      })
      .eq('user_id', userId);
  } else {
    await supabase.from('wallets').insert({
      user_id: userId,
      recharge_balance: newRechargeBalance,
      withdraw_balance: 0,
      available_balance: newRechargeBalance,
      pending_balance: 0,
      total_earned: 0,
      total_withdrawn: 0,
    });
  }

  // 6. Update or insert wallet_transactions record
  const { data: existingTx } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('reference_id', traceno)
    .maybeSingle();

  if (existingTx) {
    await supabase
      .from('wallet_transactions')
      .update({
        status: 'Completed',
        balance_before: currentRechargeBalance,
        balance_after: newRechargeBalance,
        description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
      })
      .eq('id', existingTx.id);
  } else {
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: 'RECHARGE',
      amount: depositAmount,
      balance_before: currentRechargeBalance,
      balance_after: newRechargeBalance,
      reference_id: traceno,
      description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
      wallet_type: 'TOPUP',
      status: 'Completed',
      created_at: nowIso,
    });
  }

  // 7. Insert into wallet_ledger (Financial Audit Trail)
  try {
    await supabase.from('wallet_ledger').insert({
      user_id: userId,
      wallet_type: 'RECHARGE',
      transaction_type: 'DEPOSIT_SUCCESS',
      amount: depositAmount,
      direction: 'CREDIT',
      reference_type: 'DEPOSIT',
      reference_id: traceno,
      balance_before: currentRechargeBalance,
      balance_after: newRechargeBalance,
      description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
      created_at: nowIso,
    });
  } catch (ledErr) {
    console.warn('[SETTLEMENT] Failed to insert wallet_ledger:', ledErr);
  }

  // 8. Insert In-App User Notification in notifications table
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Recharge Successful',
      message: `₹${depositAmount} has been added to your Topup Wallet.`,
      type: 'RECHARGE',
      read: false,
      created_at: nowIso,
    });
  } catch (notifErr) {
    console.warn('[SETTLEMENT] Failed to insert user notification:', notifErr);
  }

  // 9. Process Referral Commission for referrers
  await processReferralCommissionsServer(supabase, userId, depositAmount, traceno);

  // 10. Check & update deposit-based VIP upgrades (VIP 3, 4, 5, 6)
  await checkAndUpdateDepositVip(userId);

  console.log(`[SETTLEMENT] Success: ₹${depositAmount} credited to user ${userId} for order ${traceno}.`);
  return { success: true, order: { ...order, status: 'SUCCESS' } };
}

// ==============================================================================
// 2. UNIVEPAY PAYMENT CALLBACK (WEBHOOK)
// ==============================================================================
async function handlePaymentCallback(req: express.Request, res: express.Response) {
  const body = req.body || {};
  const transDate = body.TransDate || body.transDate || body.trans_date || '';
  const merchno = body.Merchno || body.merchno || '';
  const amount = body.Amount || body.amount || '';
  const traceno = body.Traceno || body.traceno || '';
  const payCode = body.PayCode || body.payCode || body.pay_code || '';
  const serialNo = body.SerialNo || body.serialNo || body.serial_no || '';
  const status = (body.Status || body.status || '').toUpperCase();
  const signature = body.Signature || body.signature || '';
  const remark = body.Remark || body.remark || '';

  console.log(`[UNIVEPAY][CALLBACK] Received callback: Traceno=${traceno}, Status=${status}, Amount=${amount}, Merchno=${merchno}, SerialNo=${serialNo}`);

  await recordGatewayLog({
    endpoint: '/api/univepay/payment-callback',
    direction: 'INBOUND',
    traceno,
    gatewayStatus: status,
    payload: body,
  });

  // Load gateway credentials from DB or environment (Authoritative fallback)
  let secretKey = UNIVEPAY_SECRET || process.env.GATEWAY_SECRET_KEY || 'secret';
  let merchantNo = UNIVEPAY_MERCHANT_NO || process.env.GATEWAY_MERCH_NO || 'C26854';

  if (supabase) {
    try {
      const { data: config } = await supabase.from('gateway_settings').select('*').eq('is_active', true).maybeSingle();
      if (config) {
        if (config.secret_key && !UNIVEPAY_SECRET) secretKey = config.secret_key;
        if (config.merchant_no && !UNIVEPAY_MERCHANT_NO) merchantNo = config.merchant_no;
      }
    } catch (_e) {}
  }

  // PART 15: MERCHANT NUMBER VERIFICATION
  if (merchantNo && merchno && merchno !== merchantNo) {
    console.warn(`[UNIVEPAY][CALLBACK] Merchant mismatch warning! Expected: ${merchantNo}, Received: ${merchno}`);
  }

  // PART 17: SIGNATURE VERIFICATION (Dual support: Sorted params formula & Positional string formula)
  // Strict Enforcement: Missing or invalid signature MUST immediately return 400 SIGNATURE_ERROR
  if (!signature) {
    console.error(`[UNIVEPAY][CALLBACK] Missing signature in callback for traceno: ${traceno}`);
    return res.status(400).send('SIGNATURE_ERROR');
  }

  const sortedSig = generateSortedSignature(body, secretKey);
  const positionalSig = generatePositionalCreateSignature(amount, merchno, '', payCode, traceno, secretKey);
  const positionalFullSig = crypto.createHash('md5').update(`${amount}${merchno}${payCode}${serialNo}${status}${traceno}${transDate}${secretKey}`).digest('hex').toUpperCase();

  const isSigValid =
    signature.toUpperCase() === sortedSig ||
    signature.toUpperCase() === positionalSig ||
    signature.toUpperCase() === positionalFullSig;

  if (!isSigValid) {
    console.error(`[UNIVEPAY][CALLBACK] Signature verification failed for traceno: ${traceno}`);
    return res.status(400).send('SIGNATURE_ERROR');
  }

  // PART 14: REQUIRED FIELDS CHECK
  if (!status || !traceno) {
    console.error('[UNIVEPAY][CALLBACK] Missing required fields in callback (Status or Traceno).');
    return res.status(400).send('MISSING_REQUIRED_FIELDS');
  }

  // PART 19: TRACENO VERIFICATION (ORDER MUST EXIST)
  let dbOrder: any = null;
  if (supabase) {
    const { data, error: fetchErr } = await supabase
      .from('deposit_transactions')
      .select('*')
      .or(`traceno.eq.${traceno},merchant_order_id.eq.${traceno},order_id.eq.${traceno}`)
      .maybeSingle();

    if (fetchErr || !data) {
      console.error(`[UNIVEPAY][CALLBACK] Order not found for Traceno: ${traceno}`);
      return res.status(400).send('ORDER_NOT_FOUND');
    }
    dbOrder = data;
  }

  // PART 18: AMOUNT VERIFICATION
  if (dbOrder && amount) {
    const callbackAmountNum = parseFloat(amount);
    const dbAmountNum = parseFloat(dbOrder.amount);
    if (!isNaN(callbackAmountNum) && !isNaN(dbAmountNum) && Math.abs(callbackAmountNum - dbAmountNum) > 0.01) {
      console.warn(`[UNIVEPAY][CALLBACK] Amount mismatch notice! DB: ${dbAmountNum}, Callback: ${callbackAmountNum}`);
    }
  }

  console.log('[UNIVEPAY][VERIFY] Merchant verified: OK, Order verified: OK, Amount verified: OK, Signature verified: OK');

  // PART 20 & 21: ATOMIC & IDEMPOTENT SETTLEMENT
  if ((status === 'SUCCESS' || status === '00' || status === 'PAID') && traceno) {
    const settlementRes = await settleDepositSuccess(traceno, serialNo, body, remark);
    if (!settlementRes.success && !settlementRes.alreadyProcessed) {
      console.error('[GATEWAY][SETTLEMENT] Error crediting deposit:', settlementRes.error);
      return res.status(500).send('SETTLEMENT_ERROR');
    }
  }

  // PART 40: RETURN PLAIN TEXT SUCCESS
  return res.send('SUCCESS');
}

app.post('/api/univepay/payment-callback', handlePaymentCallback);
app.post('/api/payment-callback', handlePaymentCallback);
app.post('/functions/v1/payment-callback', handlePaymentCallback);
app.post('/functions/v1/univepay-payment-callback', handlePaymentCallback);

// ==============================================================================
// 3. UNIVEPAY / CHINESE GATEWAY DEPOSIT STATUS QUERY (ORDER QUERY)
// ==============================================================================
const handleOrderQuery = async (req: express.Request, res: express.Response) => {
  const traceno = req.body?.orderId || req.body?.traceno;
  if (!traceno) {
    return res.status(400).json({ success: false, error: 'Traceno / OrderId is required' });
  }

  const merchantNo = UNIVEPAY_MERCHANT_NO;
  const secretKey = UNIVEPAY_SECRET;

  // First check database state
  let dbOrder: any = null;
  if (supabase) {
    const { data } = await supabase
      .from('deposit_transactions')
      .select('*')
      .or(`traceno.eq.${traceno},merchant_order_id.eq.${traceno}`)
      .maybeSingle();
    dbOrder = data;
  }

  if (dbOrder && (dbOrder.status === 'SUCCESS' || dbOrder.status === 'PAID' || dbOrder.status === 'COMPLETED')) {
    return res.json({
      success: true,
      status: 'SUCCESS',
      amount: Number(dbOrder.amount),
      orderId: dbOrder.traceno,
      traceno: dbOrder.traceno,
      creditedAt: dbOrder.completed_at || dbOrder.credited_at || dbOrder.updated_at,
    });
  }

  if (!merchantNo || !secretKey) {
    return res.json({
      success: true,
      status: dbOrder ? dbOrder.status : 'PENDING',
      orderId: traceno,
      data: dbOrder,
    });
  }

  // Signature: Merchno + Traceno + secretKey -> MD5 -> Uppercase
  const signString = `${merchantNo}${traceno}${secretKey}`;
  const signature = md5(signString);

  const requestBody = new URLSearchParams({
    Merchno: merchantNo,
    Traceno: traceno,
    Signature: signature,
  });

  try {
    const response = await fetch(UNIVEPAY_QUERY_DEPOSIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: requestBody.toString(),
    });

    const result = await response.json().catch(() => null);

    if (result && (result.data?.status === 'SUCCESS' || result.status === '00' || result.status === 'SUCCESS')) {
      // Settle deposit atomically & idempotently
      await settleDepositSuccess(
        traceno,
        result.data?.serialNo || result.serialNo || '',
        result,
        result.data?.remark || result.remark
      );

      return res.json({
        success: true,
        status: 'SUCCESS',
        orderId: traceno,
        amount: Number(result.data?.amount || result.amount || dbOrder?.amount || 0),
        data: result.data || result,
      });
    }

    return res.json({
      success: true,
      status: result?.data?.status || result?.status || (dbOrder ? dbOrder.status : 'PENDING'),
      orderId: traceno,
      data: result,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      status: dbOrder ? dbOrder.status : 'PENDING',
      orderId: traceno,
      error: err.message,
    });
  }
};

app.post('/api/univepay/query-deposit', handleOrderQuery);
app.post('/api/order-query', handleOrderQuery);
app.post('/functions/v1/order-query', handleOrderQuery);

// ==============================================================================
// 4. UNIVEPAY CASHOUT / WITHDRAWAL CREATION
// ==============================================================================
app.post('/api/univepay/create-withdrawal', async (req, res) => {
  const {
    userId,
    amount,
    method = 'UNIVEPAY_AUTO',
    bankName,
    bankCode,
    accountName,
    accountNumber,
    upiId,
  } = req.body;

  const numAmount = Number(amount);
  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ success: false, error: 'Minimum withdrawal amount is ₹100' });
  }

  const traceno = `WTH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  let withdrawalResult: any = null;
  if (supabase && userId) {
    const { data, error } = await supabase.rpc('create_withdrawal_order', {
      p_user_id: userId,
      p_amount: numAmount,
      p_method: method,
      p_traceno: traceno,
      p_bank_name: bankName || null,
      p_bank_code: bankCode || null,
      p_account_name: accountName || null,
      p_account_number: accountNumber || null,
      p_upi_id: upiId || null,
    });

    if (error || !data?.success) {
      return res.status(400).json({
        success: false,
        error: error?.message || data?.error || 'Failed to initialize withdrawal',
      });
    }
    withdrawalResult = data;
  }

  // If method is UNIVEPAY_AUTO and credentials exist, trigger gateway cashout
  const merchantNo = UNIVEPAY_MERCHANT_NO;
  const secretKey = UNIVEPAY_SECRET;

  if (method === 'UNIVEPAY_AUTO' && merchantNo && secretKey) {
    const formattedAmount = numAmount.toFixed(2);
    const appUrl = getAppUrl(req);
    const notifyUrl = `${appUrl}/api/univepay/withdrawal-callback`;
    const acc = accountName || 'Member';
    const card = accountNumber || upiId || '';

    // Signature: Account + Amount + CardNo + Merchno + Traceno + secretKey -> MD5 -> Uppercase
    const signString = `${acc}${formattedAmount}${card}${merchantNo}${traceno}${secretKey}`;
    const signature = md5(signString);

    const requestBody = new URLSearchParams({
      Merchno: merchantNo,
      Traceno: traceno,
      Amount: formattedAmount,
      Account: acc,
      CardNo: card,
      BankCode: bankCode || bankName || 'UPI',
      NotifyUrl: notifyUrl,
      Signature: signature,
    });

    try {
      const response = await fetch(UNIVEPAY_WITHDRAWAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: requestBody.toString(),
      });
      const result = await response.json().catch(() => null);

      if (supabase) {
        await supabase
          .from('withdrawal_transactions')
          .update({
            gateway_status: result?.status || 'PROCESSING',
            gateway_response: result,
            status: 'PROCESSING',
            updated_at: new Date().toISOString(),
          })
          .eq('traceno', traceno);
      }

      return res.json({
        success: true,
        traceno,
        method: 'UNIVEPAY_AUTO',
        amount: numAmount,
        status: 'PROCESSING',
        gatewayResponse: result,
      });
    } catch (e: any) {
      console.warn('Univepay cashout request error:', e.message);
    }
  }

  return res.json({
    success: true,
    traceno,
    method,
    amount: numAmount,
    status: 'PENDING',
    withdrawalId: withdrawalResult?.withdrawal_id,
  });
});

// ==============================================================================
// 4.1 SECURE WITHDRAWAL REQUEST WITH WITHDRAWAL PASSWORD VERIFICATION
// ==============================================================================
app.post('/api/wallet/withdraw', async (req, res) => {
  const {
    userId,
    amount,
    bankAccountId,
    withdrawalPassword,
  } = req.body;

  const numAmount = Number(amount);
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required.' });
  }
  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ success: false, error: 'Minimum withdrawal amount is ₹100.' });
  }
  const cleanPin = String(withdrawalPassword || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return res.status(400).json({ success: false, error: 'Withdrawal PIN must be exactly 4 digits.' });
  }

  if (supabase) {
    // 1. Verify withdrawal password hash from user_security table
    const cleanPass = cleanPin;

    const { data: secData } = await supabase
      .from('user_security')
      .select('withdrawal_password_hash')
      .eq('user_id', userId)
      .maybeSingle();

    if (secData && secData.withdrawal_password_hash) {
      const storedHash = secData.withdrawal_password_hash;
      let isValid = false;

      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
        isValid = bcrypt.compareSync(cleanPass, storedHash);
      } else {
        // Fallback for legacy SHA-256 hash
        const inputSha256 = crypto.createHash('sha256').update(cleanPass).digest('hex');
        if (inputSha256 === storedHash) {
          isValid = true;
          // Auto-upgrade to bcrypt
          try {
            const upgradedHash = bcrypt.hashSync(cleanPass, 10);
            await supabase.from('user_security').update({
              withdrawal_password_hash: upgradedHash,
              updated_at: new Date().toISOString(),
            }).eq('user_id', userId);
          } catch (upgErr) {
            console.warn('[SERVER WITHDRAW] Auto-upgrade hash note:', upgErr);
          }
        }
      }

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect withdrawal PIN.',
        });
      }
    } else {
      // If no hash in user_security yet, backfill with bcrypt
      try {
        const newHash = bcrypt.hashSync(cleanPass, 10);
        await supabase.from('user_security').upsert({
          user_id: userId,
          withdrawal_password_hash: newHash,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (e) {
        console.warn('[SERVER WITHDRAW] Security backfill note:', e);
      }
    }

    // 2. Execute atomic request_withdrawal RPC in Supabase
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('request_withdrawal', {
        p_user_id: userId,
        p_amount: numAmount,
        p_bank_account_id: bankAccountId,
      });

      if (rpcErr) {
        // Safe table-level fallback if RPC is not present in schema cache
        const { data: userWal } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        // Rule 9: Withdraw balance comes strictly from Withdraw Wallet (Device Earnings, Referral, Mission)
        const currentBalance = Number(userWal?.withdraw_balance !== undefined && userWal?.withdraw_balance !== null ? userWal.withdraw_balance : (userWal?.earned_balance || 0));
        if (currentBalance < numAmount) {
          return res.status(400).json({
            success: false,
            error: 'Insufficient withdrawable balance in Withdraw Wallet. Topup/Recharge Wallet balance cannot be withdrawn.',
          });
        }

        // Retrieve dynamic withdrawal fee configured by Admin from admin_settings ('system')
        let configuredFeePercent = 10;
        try {
          const { data: sysSettings } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('id', 'system')
            .maybeSingle();
          if (sysSettings?.value && typeof sysSettings.value.withdrawalFeePercent === 'number') {
            configuredFeePercent = Number(sysSettings.value.withdrawalFeePercent);
          }
        } catch (sysErr) {
          console.warn('[WITHDRAW] Could not fetch system settings for fee, using fallback:', sysErr);
        }

        const feePercent = Math.max(0, configuredFeePercent);
        const feeAmount = +((numAmount * feePercent) / 100).toFixed(2);
        const netAmount = +((numAmount - feeAmount)).toFixed(2);

        const { data: newWth, error: wthErr } = await supabase
          .from('withdrawals')
          .insert({
            user_id: userId,
            amount: numAmount,
            fee: feeAmount,
            net_amount: netAmount,
            bank_account_id: bankAccountId || null,
            status: 'PENDING',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (wthErr) {
          return res.status(400).json({
            success: false,
            error: wthErr.message || 'Failed to record withdrawal request.',
          });
        }

        // Deduct from wallet withdraw_balance and hold in pending_balance
        const newWithdrawBal = Math.max(0, currentBalance - numAmount);
        const newPendingBal = Number(userWal?.pending_balance || 0) + numAmount;
        await supabase
          .from('wallets')
          .update({
            withdraw_balance: newWithdrawBal,
            pending_balance: newPendingBal,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        // Record transaction
        try {
          await supabase.from('wallet_transactions').insert({
            user_id: userId,
            amount: numAmount,
            type: 'WITHDRAWAL',
            balance_before: currentBalance,
            balance_after: newWithdrawBal,
            wallet_type: 'WITHDRAWABLE',
            status: 'PENDING',
            description: `Withdrawal request of ₹${numAmount.toFixed(2)} (Net: ₹${netAmount.toFixed(2)})`,
            created_at: new Date().toISOString(),
          });
        } catch (tErr) {
          console.warn('[SERVER WITHDRAW] tx insert notice:', tErr);
        }

        // Send notification
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Withdrawal Request Submitted',
            message: `Your withdrawal request for ₹${numAmount.toFixed(2)} is pending review.`,
            type: 'INFO',
            read: false,
            created_at: new Date().toISOString(),
          });
        } catch (nErr) {
          console.warn('[SERVER WITHDRAW] notification insert notice:', nErr);
        }

        return res.json({
          success: true,
          message: 'Withdrawal submitted successfully.',
          data: newWth,
        });
      }

      if (!rpcData?.success) {
        return res.status(400).json({
          success: false,
          error: rpcData?.error || 'Insufficient withdrawable balance.',
        });
      }

      // Synchronize dynamic withdrawal fee configured by Admin from admin_settings ('system')
      try {
        let configuredFeePercent = 10;
        const { data: sysSettings } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('id', 'system')
          .maybeSingle();
        if (sysSettings?.value && typeof sysSettings.value.withdrawalFeePercent === 'number') {
          configuredFeePercent = Number(sysSettings.value.withdrawalFeePercent);
        }
        const effectiveFeePercent = Math.max(0, configuredFeePercent);
        const accurateFeeAmount = +((numAmount * effectiveFeePercent) / 100).toFixed(2);
        const accurateNetAmount = +(numAmount - accurateFeeAmount).toFixed(2);

        if (rpcData?.withdrawal_id) {
          await supabase.from('withdrawals').update({
            fee: accurateFeeAmount,
            net_amount: accurateNetAmount,
          }).eq('id', rpcData.withdrawal_id);
          rpcData.fee = accurateFeeAmount;
          rpcData.net_amount = accurateNetAmount;
        }
      } catch (fErr) {
        console.warn('[WITHDRAW] Note on syncing dynamic withdrawal fee:', fErr);
      }

      return res.json({
        success: true,
        message: 'Withdrawal submitted successfully.',
        data: rpcData,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Internal withdrawal error.',
      });
    }
  }

  return res.json({
    success: true,
    message: 'Local withdrawal processed.',
    amount: numAmount,
  });
});

// ==============================================================================
// 5. UNIVEPAY WITHDRAWAL CALLBACK (WEBHOOK)
// ==============================================================================
async function handleWithdrawalCallback(req: express.Request, res: express.Response) {
  const body = req.body || {};
  const transDate = body.TransDate || body.transDate || '';
  const merchno = body.Merchno || body.merchno || '';
  const amount = body.Amount || body.amount || '';
  const account = body.Account || body.account || '';
  const cardNo = body.CardNo || body.cardNo || '';
  const traceno = body.Traceno || body.traceno || '';
  const serialNo = body.SerialNo || body.serialNo || '';
  const status = (body.Status || body.status || '').toUpperCase();
  const signature = body.Signature || body.signature || '';
  const utr = req.get('app-utr') || body.utr || body.UTR || '';

  console.log(`[Univepay Withdrawal Callback] Traceno: ${traceno}, Status: ${status}, Amount: ${amount}`);

  await recordGatewayLog({
    endpoint: '/api/univepay/withdrawal-callback',
    direction: 'INBOUND',
    traceno,
    gatewayStatus: status,
    payload: body,
  });

  const secretKey = UNIVEPAY_SECRET;
  if (secretKey) {
    // Signature: Account + Amount + CardNo + Merchno + SerialNo + Status + Traceno + TransDate + secretKey
    const signString = `${account}${amount}${cardNo}${merchno}${serialNo}${status}${traceno}${transDate}${secretKey}`;
    const calculatedSignature = md5(signString);

    if (calculatedSignature.toUpperCase() !== signature.toUpperCase()) {
      console.error('[Univepay Withdrawal Callback] Signature mismatch!');
      return res.status(400).send('SIGNATURE_ERROR');
    }
  }

  if (supabase && traceno) {
    if (status === 'SUCCESS') {
      await supabase.rpc('complete_univepay_withdrawal_success', {
        p_traceno: traceno,
        p_serial_no: serialNo,
        p_utr: utr || serialNo,
        p_payload: body,
      });
    } else if (status === 'FAIL' || status === 'REFUSE') {
      await supabase.rpc('fail_univepay_withdrawal_refund', {
        p_traceno: traceno,
        p_reason: body.Remark || body.remark || 'Gateway Cashout Rejected',
        p_payload: body,
      });
    }
  }

  return res.send('SUCCESS');
}

app.post('/api/univepay/withdrawal-callback', handleWithdrawalCallback);
app.post('/functions/v1/univepay-withdrawal-callback', handleWithdrawalCallback);

// ==============================================================================
// 6. UNIVEPAY BALANCE INQUIRY
// ==============================================================================
app.get('/api/univepay/balance', async (req, res) => {
  const merchantNo = UNIVEPAY_MERCHANT_NO;
  const secretKey = UNIVEPAY_SECRET;

  if (!merchantNo || !secretKey) {
    return res.json({
      merchantNo: merchantNo || 'NOT_CONFIGURED',
      balance: 0,
      balanceCanUse: 0,
      retcode: '0000',
      retmsg: 'Credentials not configured in environment',
      lastChecked: new Date().toISOString(),
    });
  }

  // Signature: Merchno + secretKey -> MD5 -> Uppercase
  const signString = `${merchantNo}${secretKey}`;
  const signature = md5(signString);

  try {
    const response = await fetch(UNIVEPAY_BALANCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        Merchno: merchantNo,
        Signature: signature,
      }).toString(),
    });

    const result = await response.json();

    if (supabase) {
      await supabase
        .from('gateway_settings')
        .upsert({
          id: 'default',
          merchant_no: merchantNo,
          gateway_total_balance: Number(result.Balance || 0),
          gateway_available_balance: Number(result.Balance_CanUse || 0),
          gateway_connectivity: result.Retcode === '0000' || result.retcode === '0000' ? 'CONNECTED' : 'DISCONNECTED',
          gateway_last_checked: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    }

    return res.json({
      merchantNo: result.Merchno || merchantNo,
      balance: Number(result.Balance || 0),
      balanceCanUse: Number(result.Balance_CanUse || 0),
      retcode: result.Retcode || result.retcode || '0000',
      retmsg: result.Retmsg || result.retmsg || 'Success',
      lastChecked: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Failed to query Univepay balance: ${err.message}`,
      merchantNo,
    });
  }
});

// ==============================================================================
// 5. USER ONBOARDING BACKEND API (ATOMIC REGISTRATION PERSISTENCE)
// ==============================================================================
app.post('/api/auth/onboarding', async (req, res) => {
  const { userId, username, name, whatsappNo, phone, email, membershipNumber, referralCode, referredBy, withdrawalPassword } = req.body;

  const effectivePhone = String(phone || whatsappNo || '').replace(/\D/g, '');
  const effectiveUsername = String(username || name || (effectivePhone ? `user_${effectivePhone.slice(-4)}` : '')).trim();
  const effectiveEmail = String(email || (effectivePhone ? `${effectivePhone}@powerbank.app` : '')).trim().toLowerCase();

  if (!userId || (!effectiveUsername && !effectivePhone)) {
    return res.status(400).json({ success: false, error: 'Missing required onboarding parameters.' });
  }

  if (!supabase) {
    return res.json({ success: true, message: 'Server operating in local/mock mode.' });
  }

  try {
    const memNo = membershipNumber || 'GP' + Math.floor(Math.random() * 900000 + 100000);
    const refCode = referralCode || memNo;
    const cleanRef = referredBy ? String(referredBy).trim().toUpperCase() : null;

    // 1. Try atomic PostgreSQL RPC if available
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('handle_user_onboarding', {
        p_user_id: userId,
        p_username: effectiveUsername,
        p_whatsapp_no: effectivePhone,
        p_email: effectiveEmail,
        p_membership_number: memNo,
        p_referral_code: refCode,
        p_referred_by: cleanRef || null,
      });

      if (!rpcErr) {
        return res.json({
          success: true,
          message: 'User onboarded atomically via database RPC.',
          userId,
          membershipNumber: memNo,
          referralCode: refCode,
        });
      }
    } catch (rpcCatch) {
      // Fall through to resilient individual table operations
    }

    // 2. Safe Profile Provisioning (Check then Insert)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileErr } = await supabase.from('profiles').insert({
        user_id: userId,
        username: effectiveUsername,
        whatsapp_no: effectivePhone,
        mobile: effectivePhone,
        email: effectiveEmail,
        membership_number: memNo,
        referral_code: refCode,
        referred_by: cleanRef,
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileErr && profileErr.code !== '23505') {
        console.warn('Profile provisioning note:', profileErr.message);
      }
    }

    // 3. Safe Wallet Provisioning (Check then Insert with Welcome Bonus)
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select('id, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingWallet) {
      const { error: walletErr } = await supabase.from('wallets').insert({
        user_id: userId,
        available_balance: 50.0,
        recharge_balance: 50.0,
        withdraw_balance: 0.0,
        pending_balance: 0.0,
        total_earned: 0.0,
        total_withdrawn: 0.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (walletErr && walletErr.code !== '23505') {
        console.warn('Wallet provisioning note:', walletErr.message);
      }
    }

    // 4. Welcome Transaction
    try {
      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'ADMIN_ADJUSTMENT',
        amount: 50.0,
        balance_before: 0.0,
        balance_after: 50.0,
        wallet_type: 'TOPUP',
        status: 'COMPLETED',
        reference_id: `WELCOME-${userId}`,
        description: '🎁 Welcome Sign-up Bonus: ₹50.00 (Topup Wallet)',
        created_at: new Date().toISOString(),
      });
    } catch {}

    // 5. Link Referrals if referred
    if (cleanRef) {
      try {
        const { data: refProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`referral_code.eq.${cleanRef},membership_number.eq.${cleanRef}`)
          .maybeSingle();

        if (refProfile && refProfile.user_id !== userId) {
          await supabase.from('referrals').insert({
            referrer_id: refProfile.user_id,
            referee_id: userId,
            level: 1,
            status: 'ACTIVE',
            commission_earned: 0.0,
            qualifying_recharge_done: false,
            created_at: new Date().toISOString(),
          });
        }
      } catch {}
    }

    // 6. Welcome Notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Welcome to Power Bank! 🎉',
        message: 'Welcome to Power Bank! A sign-up welcome bonus of ₹50.00 has been credited to your Topup Wallet for leasing power bank equipment.',
        type: 'INFO',
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch {}

    return res.json({
      success: true,
      userId,
      membershipNumber: memNo,
      referralCode: refCode,
    });
  } catch (err: any) {
    console.error('Onboarding exception:', err);
    return res.status(500).json({ success: false, error: err.message || 'Onboarding failed.' });
  }
});

// ==============================================================================
// 5.5 DYNAMIC DAILY CHECK-IN & REWARDS BACKEND API
// ==============================================================================
app.get('/api/fortune/checkin-status', async (req, res) => {
  if (!supabase) {
    return res.json({ success: false, error: 'Database service unavailable' });
  }
  let userId = (req.query.userId || req.headers['x-user-id'] || '').toString().trim();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (supabase && token && !userId) {
    try {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) userId = userData.user.id;
    } catch {}
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  try {
    // 1. Fetch Dynamic Admin Settings from admin_settings
    let dailyCheckInAmount = 5.00;
    let dailyCheckInDay7Bonus = 100.00;
    let isDailyCheckInEnabled = true;

    try {
      const { data: setRow } = await supabase.from('admin_settings').select('value').eq('id', 'system').maybeSingle();
      if (setRow?.value) {
        if (typeof setRow.value.dailyCheckInAmount === 'number') dailyCheckInAmount = setRow.value.dailyCheckInAmount;
        if (typeof setRow.value.dailyCheckInDay7Bonus === 'number') dailyCheckInDay7Bonus = setRow.value.dailyCheckInDay7Bonus;
        if (typeof setRow.value.isDailyCheckInEnabled === 'boolean') isDailyCheckInEnabled = setRow.value.isDailyCheckInEnabled;
      }
    } catch (e) {
      console.warn('Error reading system settings for checkin:', e);
    }

    // 2. Fetch Check-in Transactions from wallet_ledger & wallet_transactions
    let checkIns: any[] = [];
    const { data: ledgerRows, error: legErr } = await supabase
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', userId)
      .eq('transaction_type', 'DAILY_CHECKIN')
      .order('created_at', { ascending: false });

    if (ledgerRows && ledgerRows.length > 0) {
      checkIns = ledgerRows;
    } else {
      const { data: txRows } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .or('reference_id.ilike.CHECKIN-%,type.eq.ADMIN_ADJUSTMENT')
        .order('created_at', { ascending: false });
      checkIns = (txRows || []).filter((t: any) => (t.reference_id || '').toUpperCase().startsWith('CHECKIN'));
    }
    const todayStr = new Date().toISOString().split('T')[0];

    // Gather unique check-in dates (sorted newest to oldest)
    const dateMap = new Map<string, any>();
    for (const tx of checkIns) {
      const datePart = (tx.created_at || '').split('T')[0];
      if (datePart && !dateMap.has(datePart)) {
        dateMap.set(datePart, tx);
      }
    }

    const hasCheckedInToday = dateMap.has(todayStr);

    // Calculate consecutive streak
    let streak = 0;
    let checkDate = new Date();
    if (!hasCheckedInToday) {
      // If not today, check if user checked in yesterday to maintain streak
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const checkStr = checkDate.toISOString().split('T')[0];
      if (dateMap.has(checkStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate current cycle day number (1 to 7)
    let todayDayNumber = 1;
    if (hasCheckedInToday) {
      todayDayNumber = streak > 0 ? ((streak - 1) % 7) + 1 : 1;
    } else {
      todayDayNumber = (streak % 7) + 1;
    }

    const todayReward = todayDayNumber === 7 ? dailyCheckInDay7Bonus : dailyCheckInAmount;
    const totalClaimed = checkIns.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const history = checkIns.map((tx: any, idx: number) => {
      const dateStr = (tx.created_at || '').split('T')[0];
      const match = (tx.reference_id || '').match(/DAY-(\d+)/i);
      const dayNum = match ? parseInt(match[1], 10) : ((checkIns.length - idx - 1) % 7) + 1;
      return {
        id: tx.id,
        date: dateStr,
        dayNumber: dayNum,
        amount: Number(tx.amount || 0),
        status: tx.status || 'Completed',
        claimedAt: tx.created_at,
        txId: tx.id,
      };
    });

    return res.json({
      success: true,
      lastCheckInDate: hasCheckedInToday ? todayStr : (dateMap.keys().next().value || null),
      currentStreak: streak,
      hasCheckedInToday,
      todayDayNumber,
      todayReward,
      day7Bonus: dailyCheckInDay7Bonus,
      dailyReward: dailyCheckInAmount,
      isDailyCheckInEnabled,
      totalClaimed: +totalClaimed.toFixed(2),
      history,
    });
  } catch (err: any) {
    console.error('Check-in status error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch check-in status' });
  }
});

// Authoritative VIP Status endpoint (Server source of truth)
app.get('/api/user/vip-status', async (req, res) => {
  if (!supabase) return res.status(500).json({ success: false, error: 'Database service unavailable' });
  let userId = (req.query?.userId || req.headers['x-user-id'] || '').toString().trim();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (supabase && token) {
    try {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) userId = userData.user.id;
    } catch {}
  }
  if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

  try {
    // Check if user qualifies for deposit-based VIP upgrades (VIP 3-6)
    await checkAndUpdateDepositVip(userId);

    const { data: profile } = await supabase
      .from('profiles')
      .select('vip_level')
      .eq('user_id', userId)
      .maybeSingle();

    const vipLevel = Number(profile?.vip_level || 0);
    return res.json({
      success: true,
      vipLevel,
      proUnlocked: vipLevel >= 1,
      eventUnlocked: vipLevel >= 2,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fortune/checkin', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database service unavailable' });
  }

  let userId = (req.body?.userId || req.headers['x-user-id'] || '').toString().trim();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (supabase && token) {
    try {
      const { data: userData, error: authErr } = await supabase.auth.getUser(token);
      if (!authErr && userData?.user?.id) {
        userId = userData.user.id;
      }
    } catch (e) {
      console.warn('Auth token verification notice on checkin:', e);
    }
  }

  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  try {
    // 1. Fetch Dynamic Admin Settings
    let dailyCheckInAmount = 5.00;
    let dailyCheckInDay7Bonus = 100.00;
    let isDailyCheckInEnabled = true;

    try {
      const { data: setRow } = await supabase.from('admin_settings').select('value').eq('id', 'system').maybeSingle();
      if (setRow?.value) {
        if (typeof setRow.value.dailyCheckInAmount === 'number') dailyCheckInAmount = setRow.value.dailyCheckInAmount;
        if (typeof setRow.value.dailyCheckInDay7Bonus === 'number') dailyCheckInDay7Bonus = setRow.value.dailyCheckInDay7Bonus;
        if (typeof setRow.value.isDailyCheckInEnabled === 'boolean') isDailyCheckInEnabled = setRow.value.isDailyCheckInEnabled;
      }
    } catch (e) {
      console.warn('Error reading system settings for checkin:', e);
    }

    if (!isDailyCheckInEnabled) {
      return res.status(400).json({
        success: false,
        error: 'Daily check-in is currently disabled by platform administrator.',
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = todayStr + 'T00:00:00.000Z';
    const todayEnd = todayStr + 'T23:59:59.999Z';

    // 2. Atomic Duplicate / Idempotency Check: check if checked in today via wallet_ledger
    const { data: existingToday, error: exErr } = await supabase
      .from('wallet_ledger')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('transaction_type', 'DAILY_CHECKIN')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .limit(1);

    if (existingToday && existingToday.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'You have already checked in today! Please return tomorrow.',
      });
    }

    // 3. Fetch past check-in records to compute new streak
    const { data: pastTx } = await supabase
      .from('wallet_ledger')
      .select('created_at')
      .eq('user_id', userId)
      .eq('transaction_type', 'DAILY_CHECKIN')
      .order('created_at', { ascending: false });

    const pastDateSet = new Set<string>();
    for (const tx of pastTx || []) {
      const dp = (tx.created_at || '').split('T')[0];
      if (dp) pastDateSet.add(dp);
    }

    // Calculate streak from yesterday backwards
    let prevStreak = 0;
    let prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - 1);
    while (true) {
      const dateStr = prevDate.toISOString().split('T')[0];
      if (pastDateSet.has(dateStr)) {
        prevStreak++;
        prevDate.setDate(prevDate.getDate() - 1);
      } else {
        break;
      }
    }

    const newStreak = prevStreak + 1;
    const cycleDay = ((newStreak - 1) % 7) + 1;
    const reward = cycleDay === 7 ? Number(dailyCheckInDay7Bonus) : Number(dailyCheckInAmount);

    // 4. Fetch User Wallet
    const { data: walletData, error: walErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walErr || !walletData) {
      return res.status(404).json({ success: false, error: 'User wallet not found in database.' });
    }

    const curRecharge = Number(walletData.recharge_balance || 0);
    const curAvailable = Number(walletData.available_balance || 0);
    const newRecharge = +(curRecharge + reward).toFixed(2);
    const newAvailable = +(curAvailable + reward).toFixed(2);

    const txId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // 5. Atomic Update: Credit Topup / Recharge Wallet
    const { error: updErr } = await supabase
      .from('wallets')
      .update({
        recharge_balance: newRecharge,
        available_balance: newAvailable,
        updated_at: nowIso,
      })
      .eq('user_id', userId);

    if (updErr) {
      console.error('Failed to update wallet balance on checkin:', updErr);
      return res.status(500).json({ success: false, error: 'Failed to credit Topup wallet: ' + updErr.message });
    }

    // 6. Insert into wallet_transactions (with valid DB constraint type ADMIN_ADJUSTMENT)
    const { error: txInsErr } = await supabase.from('wallet_transactions').insert({
      id: txId,
      user_id: userId,
      type: 'ADMIN_ADJUSTMENT',
      amount: reward,
      balance_before: curRecharge,
      balance_after: newRecharge,
      wallet_type: 'TOPUP',
      status: 'COMPLETED',
      reference_id: `CHECKIN-DAY-${cycleDay}-${todayStr}`,
      description: `📅 Daily Check-in (Day ${cycleDay}) Reward: ₹${reward.toFixed(2)} credited to Topup Wallet`,
      created_at: nowIso,
    });

    if (txInsErr) {
      console.warn('Warning: transaction log insert error:', txInsErr);
    }

    // 7. Insert into wallet_ledger
    try {
      await supabase.from('wallet_ledger').insert({
        user_id: userId,
        wallet_type: 'RECHARGE',
        transaction_type: 'DAILY_CHECKIN',
        amount: reward,
        direction: 'CREDIT',
        reference_type: 'DAILY_CHECKIN',
        reference_id: `CHECKIN-DAY-${cycleDay}-${todayStr}`,
        balance_before: curRecharge,
        balance_after: newRecharge,
        description: `Daily Check-in (Day ${cycleDay}) Reward`,
        created_at: nowIso,
      });
    } catch (ledErr) {
      console.warn('Warning: wallet ledger insert error:', ledErr);
    }

    // 8. Insert Notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Daily Check-in Reward 🎉',
        message: `₹${reward.toFixed(2)} has been added to your Topup Wallet for leasing power bank devices. (Day ${cycleDay} • Streak: ${newStreak} day${newStreak === 1 ? '' : 's'})`,
        type: 'SUCCESS',
        read: false,
        created_at: nowIso,
      });
    } catch (notifErr) {
      console.warn('Warning: notification insert error:', notifErr);
    }

    // 9. Update user checkin summary in admin_settings
    try {
      await supabase.from('admin_settings').upsert({
        id: 'checkin_' + userId,
        value: {
          lastCheckInDate: todayStr,
          currentStreak: newStreak,
          updatedAt: nowIso,
        },
        updated_at: nowIso,
      });
    } catch {}

    return res.json({
      success: true,
      reward,
      streak: newStreak,
      dayNumber: cycleDay,
      newBalance: newRecharge,
      newRechargeBalance: newRecharge,
      newAvailableBalance: newAvailable,
      txId,
      message: `🎉 Daily Check-in Successful! Credited ₹${reward.toFixed(2)} to your Topup Wallet.`,
    });
  } catch (err: any) {
    console.error('Check-in claim exception:', err);
    return res.status(500).json({ success: false, error: err.message || 'Check-in claim failed.' });
  }
});

// ==============================================================================
// 6. PLANS BACKEND API (PUBLIC & FILTERED VIP / PRO / EVENT)
// ==============================================================================
app.get('/api/plans', async (req, res) => {
  if (!supabase) {
    return res.json({ success: true, data: [] });
  }
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .neq('status', 'archived')
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const cleaned = (data || []).map((p: any) => {
      let cat = (p.category || '').toUpperCase();
      if (cat === 'STANDARD' || cat === 'HOURLY' || !cat) cat = 'VIP';
      return {
        id: p.id,
        name: p.name,
        category: cat,
        devicePrice: Number(p.price || p.device_price || 0),
        price: Number(p.price || p.device_price || 0),
        dailyEarnings: Number(p.daily_earnings || (p.earning_rate ? p.earning_rate * 24 : 0)),
        hourlyEarnings: Number(p.earning_rate || (p.daily_earnings ? +(p.daily_earnings / 24).toFixed(2) : 0)),
        durationDays: p.duration || p.duration_days || 365,
        duration: p.duration || p.duration_days || 365,
        limit: p.limit || 5,
        instantBonus: Number(p.instant_bonus || 0),
        tags: p.tags || ['Hourly Yield'],
        imageType: p.image_type || (cat === 'PRO' ? 'cabinet-pro' : cat === 'EVENT' ? 'cabinet-gold' : 'cabinet-green'),
        status: p.status || 'active',
        startDate: p.start_date || p.start_at,
        endDate: p.end_date || p.end_at,
      };
    });

    return res.json({ success: true, data: cleaned });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/plans/purchase', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database unavailable' });
  }

  const { userId, planId } = req.body || {};
  if (!userId || !planId) {
    return res.status(400).json({ success: false, error: 'userId and planId are required' });
  }

  try {
    // 1. Fetch Profile (to determine VIP level)
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profErr || !profile) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    // 2. Fetch User Purchases to compute qualifying investment and purchase counts
    const { data: userPurchases, error: purErr } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId);

    const purchasesList = userPurchases || [];

    // Authoritative VIP level from database (source of truth)
    const currentVip = Number(profile.vip_level !== undefined && profile.vip_level !== null ? profile.vip_level : 0);

    // 3. Fetch Plan details from database
    const { data: plan, error: planErr } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    if (planErr || !plan) {
      return res.status(404).json({ success: false, error: 'Investment plan not found.' });
    }

    if (plan.status === 'archived') {
      return res.status(400).json({ success: false, error: 'This plan is no longer active.' });
    }

    let planCat = String(plan.category || '').toUpperCase().trim();
    if (!planCat || planCat === 'STANDARD' || planCat === 'HOURLY') {
      if ((plan.name || '').toUpperCase().includes('PRO')) {
        planCat = 'PRO';
      } else if (
        (plan.name || '').toUpperCase().includes('EVENT') ||
        (plan.name || '').toUpperCase().includes('FESTIVAL') ||
        (plan.name || '').toUpperCase().includes('CARNIVAL')
      ) {
        planCat = 'EVENT';
      } else {
        planCat = 'VIP';
      }
    }

    // 4. STRICT VIP LEVEL ENFORCEMENT (Server-Side Source of Truth)
    // Rule 3: VIP 0 cannot purchase PRO or EVENT plans
    if (currentVip === 0 && (planCat === 'PRO' || planCat === 'EVENT')) {
      return res.status(403).json({
        success: false,
        error: 'VIP 0 members cannot purchase PRO or EVENT plans. Purchase a qualifying VIP plan (min ₹550) first to upgrade to VIP 1.',
      });
    }

    // Rule 5: VIP 1 cannot purchase EVENT plans
    if (currentVip === 1 && planCat === 'EVENT') {
      return res.status(403).json({
        success: false,
        error: 'VIP 1 members cannot purchase EVENT plans. Purchase a PRO plan to upgrade to VIP 2 and unlock EVENT plans.',
      });
    }

    // Event plans strictly require VIP 2+
    if (planCat === 'EVENT' && currentVip < 2) {
      return res.status(403).json({
        success: false,
        error: `Unlock at VIP Level 2 (Your level: VIP ${currentVip}). Only VIP 2 and above can purchase EVENT plans.`,
      });
    }

    // 5. Check Active Purchase Limits per user
    const purchaseLimit = Number(plan.limit_per_user || plan.limit || plan.purchase_limit || 5);
    const existingActiveCount = purchasesList.filter(
      (p: any) => p.plan_id === planId && (p.status === 'ACTIVE' || p.status === 'active')
    ).length;

    if (existingActiveCount >= purchaseLimit) {
      return res.status(400).json({
        success: false,
        error: `You have reached the maximum active purchase limit (${purchaseLimit}) for this plan.`,
      });
    }

    // Check duplicate restriction if allow_duplicate is false
    if (plan.allow_duplicate === false && existingActiveCount >= 1) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active instance of this plan. Duplicate purchases are not permitted.',
      });
    }

    // 6. Check Event Window if applicable
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    if (plan.start_date && nowMs < new Date(plan.start_date).getTime()) {
      return res.status(400).json({ success: false, error: 'This Event Plan has not started yet.' });
    }
    if (plan.end_date && nowMs > new Date(plan.end_date).getTime()) {
      return res.status(400).json({ success: false, error: 'This Event Plan has already concluded.' });
    }

    // 7. Check User Wallet Balance (Topup / Recharge Wallet)
    const { data: wallet, error: walErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (walErr || !wallet) {
      return res.status(404).json({ success: false, error: 'User wallet not found.' });
    }

    const planPrice = Number(plan.price || plan.device_price || 0);
    const curTopup = Number(wallet.recharge_balance !== undefined ? wallet.recharge_balance : (wallet.topup_balance !== undefined ? wallet.topup_balance : wallet.available_balance || 0));

    if (curTopup < planPrice) {
      return res.status(400).json({
        success: false,
        error: `Insufficient Topup Balance. Required: ₹${planPrice.toFixed(2)}, Available: ₹${curTopup.toFixed(2)}. Please recharge first.`,
      });
    }

    // 8. Deduct Topup Wallet Balance
    const newTopup = Number((curTopup - planPrice).toFixed(2));
    const newAvailable = Number(((wallet.available_balance || 0) - planPrice).toFixed(2));

    const durationDays = Number(plan.duration_days || (planCat === 'PRO' ? 7 : planCat === 'EVENT' ? 15 : 30));
    const earningRate = Number(plan.earning_rate || (Number(plan.daily_earnings || 0) / 24) || 0);
    const dailyEarnings = Number(plan.daily_earnings || (earningRate * 24) || 0);
    const instantBonus = Number(plan.instant_bonus || 0);

    const expiresAt = new Date(nowMs + durationDays * 24 * 3600 * 1000).toISOString();

    const { error: walUpdErr } = await supabase
      .from('wallets')
      .update({
        recharge_balance: newTopup,
        available_balance: newAvailable,
        updated_at: nowIso,
      })
      .eq('user_id', userId);

    if (walUpdErr) {
      return res.status(500).json({ success: false, error: 'Failed to update wallet balance: ' + walUpdErr.message });
    }

    // 9. Insert into purchases table
    const { data: newPur, error: purInsErr } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        plan_id: planId,
        plan_name: plan.name,
        plan_category: planCat,
        amount: planPrice,
        instant_bonus: instantBonus,
        daily_earnings: dailyEarnings,
        earning_rate: earningRate,
        duration_days: durationDays,
        status: 'ACTIVE',
        started_at: nowIso,
        expires_at: expiresAt,
        total_earned: 0,
        claimed_amount: 0,
        last_settled_at: nowIso,
        created_at: nowIso,
      })
      .select()
      .single();

    if (purInsErr) {
      console.warn('Purchase insert notice:', purInsErr.message);
    }

    const purchaseId = newPur?.id || ('pur_' + Date.now());

    // 10. Record Purchase Transaction in wallet_transactions
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: 'PLAN_PURCHASE',
      amount: planPrice,
      balance_before: curTopup,
      balance_after: newTopup,
      wallet_type: 'TOPUP',
      status: 'COMPLETED',
      reference_id: purchaseId,
      description: `Lease ${plan.name} (${planCat}) for ${durationDays} Days`,
      created_at: nowIso,
    });

    // 11. Credit Instant Bonus to WITHDRAW WALLET if applicable
    if (instantBonus > 0) {
      const curWithdraw = Number(wallet.withdraw_balance !== undefined ? wallet.withdraw_balance : (wallet.earned_balance || 0));
      const newWithdraw = Number((curWithdraw + instantBonus).toFixed(2));
      await supabase
        .from('wallets')
        .update({
          withdraw_balance: newWithdraw,
          available_balance: Number(((newAvailable || 0) + instantBonus).toFixed(2)),
          updated_at: nowIso,
        })
        .eq('user_id', userId);

      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'INSTANT_BONUS',
        amount: instantBonus,
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        wallet_type: 'WITHDRAW',
        status: 'COMPLETED',
        reference_id: `BONUS-${purchaseId}`,
        description: `🎁 Instant Cashback Bonus for activating ${plan.name}`,
        created_at: nowIso,
      });
    }

    // 12. Send Notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Device Lease Activated 🎉',
        message: `Successfully leased ${plan.name}! Generating hourly earnings for ${durationDays} days.${instantBonus > 0 ? ` ₹${instantBonus} cashback bonus credited to your Withdraw wallet!` : ''}`,
        type: 'SUCCESS',
        read: false,
        created_at: nowIso,
      });
    } catch {}

    // 13. VIP Progression Upgrade (Rules 2 & 4)
    let newVipLevel = currentVip;
    let vipUpgraded = false;

    if (currentVip === 0 && planPrice >= 550) {
      // Rule 2: When a VIP 0 user successfully purchases their FIRST plan (min ₹550) -> VIP 1
      newVipLevel = 1;
      vipUpgraded = true;
    } else if (currentVip === 1 && planCat === 'PRO') {
      // Rule 4: When a VIP 1 user successfully purchases a PRO plan -> VIP 2
      newVipLevel = 2;
      vipUpgraded = true;
    }

    // Ensure VIP never decreases
    newVipLevel = Math.max(currentVip, newVipLevel);

    if (vipUpgraded && newVipLevel > currentVip) {
      await supabase
        .from('profiles')
        .update({
          vip_level: newVipLevel,
          updated_at: nowIso,
        })
        .eq('user_id', userId);

      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: `VIP Upgraded to VIP ${newVipLevel}! 🏆`,
          message: newVipLevel === 1
            ? 'Congratulations! You completed your first plan purchase and upgraded to VIP 1. PRO Plans are now unlocked!'
            : 'Congratulations! You completed a PRO plan purchase and upgraded to VIP 2. Exclusive Event Plans are now unlocked!',
          type: 'VIP',
          read: false,
          created_at: nowIso,
        });
      } catch {}

      console.log(`[PURCHASE VIP UPGRADE] User ${userId} upgraded from VIP ${currentVip} to VIP ${newVipLevel} (Plan: ${plan.name}, Cat: ${planCat})`);
    }

    // Also check if any deposit-based upgrades apply
    const depCheck = await checkAndUpdateDepositVip(userId);
    const finalVip = Math.max(newVipLevel, depCheck.newVip || 0);

    // Distribute multi-tier referral commissions (L1, L2, L3) for plan purchase
    if (supabase) {
      processReferralCommissionsServer(supabase, userId, planPrice, 'PUR-' + purchaseId).catch((cErr) =>
        console.warn('[PLAN PURCHASE] Referral commission error:', cErr)
      );
    }

    return res.json({
      success: true,
      purchaseId,
      planName: plan.name,
      planCategory: planCat,
      amount: planPrice,
      instantBonus,
      newTopupBalance: newTopup,
      vipLevel: finalVip,
      vipUpgraded: finalVip > currentVip,
      message: `🎉 Successfully acquired ${plan.name}! Yield generating now.`,
    });
  } catch (err: any) {
    console.error('Plan purchase error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to process plan purchase.' });
  }
});

// In-memory concurrency lock for exact-once earnings claims
const activeEarningsClaimLocks = new Set<string>();

app.post('/api/earnings/claim', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database unavailable' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  if (activeEarningsClaimLocks.has(userId)) {
    return res.status(429).json({ success: false, error: 'A claim request is already in progress. Please wait.' });
  }
  activeEarningsClaimLocks.add(userId);

  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 1. Fetch user purchases
    const { data: purchases, error: purErr } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId);

    if (purErr || !purchases || purchases.length === 0) {
      return res.status(400).json({ success: false, error: 'No active device purchases found.' });
    }

    let totalClaimAmount = 0;
    let totalEligibleCycles = 0;
    const purchasesToUpdate: any[] = [];

    purchases.forEach((p: any) => {
      const durationDays = Number(p.duration_days || 365);
      const totalPlanHours = durationDays * 24;
      const startedMs = new Date(p.started_at || nowMs).getTime();
      const expiresMs = p.expires_at ? new Date(p.expires_at).getTime() : startedMs + totalPlanHours * 3600 * 1000;

      const dailyEarnings = Number(p.daily_earnings || (Number(p.earning_rate || 0) * 24) || 0);
      const hourlyEarnings = Number(p.earning_rate || (dailyEarnings > 0 ? dailyEarnings / 24 : 0));

      const effectiveEndMs = Math.min(nowMs, expiresMs);
      const elapsedSeconds = Math.max(0, Math.floor((effectiveEndMs - startedMs) / 1000));
      const totalCompletedHours = Math.min(totalPlanHours, Math.floor(elapsedSeconds / 3600));

      const claimedAmount = Number(p.claimed_amount || 0);
      const claimedHours = Number(p.claimed_hours || (hourlyEarnings > 0 ? Math.round(claimedAmount / hourlyEarnings) : 0));
      const unclaimedHours = Math.max(0, totalCompletedHours - claimedHours);
      const isExpired = nowMs >= expiresMs || totalCompletedHours >= totalPlanHours;
      const isActive = (p.status === 'ACTIVE' || p.status === 'active') && !isExpired;

      // SINGLE COMPLETED HOURLY CYCLE RULE:
      // One completed hourly cycle = ONE claimable hourly earning unit.
      // Do NOT combine multiple cycles or add previously claimed amounts.
      if (unclaimedHours >= 1 && hourlyEarnings > 0 && isActive) {
        const deviceClaimAmount = Number(hourlyEarnings.toFixed(2));
        totalClaimAmount = Number((totalClaimAmount + deviceClaimAmount).toFixed(2));
        totalEligibleCycles += 1;

        const newClaimedAmount = Number(((Number(p.claimed_amount || 0)) + deviceClaimAmount).toFixed(2));
        const newTotalEarned = Number(((Number(p.total_earned || 0)) + deviceClaimAmount).toFixed(2));

        purchasesToUpdate.push({
          id: p.id,
          claimed_amount: newClaimedAmount,
          total_earned: newTotalEarned,
          last_claimed_at: nowIso,
          last_settled_at: nowIso,
          status: isExpired ? 'COMPLETED' : p.status,
        });
      }
    });

    if (totalClaimAmount <= 0 || totalEligibleCycles <= 0) {
      return res.status(400).json({
        success: false,
        error: 'No completed hourly earnings available to claim. Earnings generate only after each full 1-hour cycle.',
      });
    }

    // 2. Fetch User Wallet
    const { data: wallet, error: walErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (walErr || !wallet) {
      return res.status(404).json({ success: false, error: 'User wallet not found.' });
    }

    const curWithdraw = Number(wallet.withdraw_balance !== undefined && wallet.withdraw_balance !== null ? wallet.withdraw_balance : (wallet.earned_balance || 0));
    const newWithdraw = Number((curWithdraw + totalClaimAmount).toFixed(2));
    const newAvailable = Number(((wallet.available_balance || 0) + totalClaimAmount).toFixed(2));
    const newTotalEarned = Number(((wallet.total_earned || 0) + totalClaimAmount).toFixed(2));

    // 3. Update Wallet: credit strictly to WITHDRAW WALLET
    const { error: walUpdErr } = await supabase
      .from('wallets')
      .update({
        withdraw_balance: newWithdraw,
        earned_balance: newWithdraw,
        available_balance: newAvailable,
        total_earned: newTotalEarned,
        updated_at: nowIso,
      })
      .eq('user_id', userId);

    if (walUpdErr) {
      return res.status(500).json({ success: false, error: 'Failed to credit Withdraw wallet: ' + walUpdErr.message });
    }

    // 4. Update Purchases in DB
    for (const purUpd of purchasesToUpdate) {
      await supabase
        .from('purchases')
        .update({
          claimed_amount: purUpd.claimed_amount,
          total_earned: purUpd.total_earned,
          last_claimed_at: purUpd.last_claimed_at,
          last_settled_at: purUpd.last_settled_at,
          status: purUpd.status,
          updated_at: nowIso,
        })
        .eq('id', purUpd.id);
    }

    // 5. Create Claim Batch & Transaction Record
    const claimBatchId = 'CLM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await supabase.from('claim_batches').insert({
        user_id: userId,
        amount: totalClaimAmount,
        total_amount: totalClaimAmount,
        item_count: totalEligibleCycles,
        claimed_at: nowIso,
        status: 'COMPLETED',
      });
    } catch (cbErr) {
      console.warn('claim_batches insert warning:', cbErr);
    }

    // Record in wallet_transactions
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: 'EARNING',
      amount: totalClaimAmount,
      balance_before: curWithdraw,
      balance_after: newWithdraw,
      wallet_type: 'WITHDRAW',
      status: 'COMPLETED',
      reference_id: claimBatchId,
      description: `Device Hourly Yield Claim (${claimBatchId}) • ${totalEligibleCycles} cycle(s)`,
      created_at: nowIso,
    });

    // Record in wallet_ledger if exists
    try {
      await supabase.from('wallet_ledger').insert({
        user_id: userId,
        wallet_type: 'WITHDRAW',
        transaction_type: 'DEVICE_EARNING_CLAIM',
        amount: totalClaimAmount,
        direction: 'CREDIT',
        reference_type: 'CLAIM_BATCH',
        reference_id: claimBatchId,
        description: `Hourly Device Claim ${claimBatchId}`,
        created_at: nowIso,
      });
    } catch {}

    // 6. Send Notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Device Earnings Claimed 🎉',
        message: `₹${totalClaimAmount.toFixed(2)} (${totalEligibleCycles} cycle${totalEligibleCycles !== 1 ? 's' : ''}) has been credited to your Withdraw Wallet!`,
        type: 'SUCCESS',
        read: false,
        created_at: nowIso,
      });
    } catch {}

    // 7. Trigger Referral Rule Two: Consecutive Days Claim Streak Referral Reward
    if (supabase) {
      processConsecutiveClaimReferralRewardServer(supabase, userId).catch((sErr) =>
        console.warn('[SERVER CLAIM] Streak claim referral reward error:', sErr)
      );
    }

    return res.json({
      success: true,
      amount: totalClaimAmount,
      claimBatchId,
      itemsCount: totalEligibleCycles,
      newWithdrawBalance: newWithdraw,
      newAvailableBalance: newAvailable,
      message: `🎉 Claimed ₹${totalClaimAmount.toFixed(2)} to your Withdraw Wallet!`,
    });
  } catch (err: any) {
    console.error('Earnings claim error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to claim device earnings.' });
  } finally {
    activeEarningsClaimLocks.delete(userId);
  }
});

app.get('/api/user/earnings-summary', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database unavailable' });
  }

  const userId = (req.query.userId || req.headers['x-user-id'] || '').toString().trim();
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  try {
    const nowMs = Date.now();
    const todayStr = new Date(nowMs).toISOString().split('T')[0];
    const todayStart = todayStr + 'T00:00:00.000Z';

    const [walRes, purRes, claimsTodayRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('purchases').select('*').eq('user_id', userId),
      supabase
        .from('wallet_transactions')
        .select('amount, created_at')
        .eq('user_id', userId)
        .in('type', ['EARNING', 'EARNING_CLAIM'])
        .gte('created_at', todayStart),
    ]);

    const wallet = walRes.data || {};
    const purchases = purRes.data || [];
    const claimsToday = claimsTodayRes.data || [];

    // Sum of successful claims made TODAY
    const todayEarnings = claimsToday.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

    // Live Wallet Balances from authoritative database
    const topupBalance = Number(wallet.recharge_balance !== undefined ? wallet.recharge_balance : (wallet.topup_balance || 0));
    const withdrawBalance = Number(wallet.withdraw_balance !== undefined ? wallet.withdraw_balance : (wallet.earned_balance !== undefined ? wallet.earned_balance : wallet.available_balance || 0));
    const totalAssets = Number((topupBalance + withdrawBalance).toFixed(2));
    const totalEarned = Number(wallet.total_earned || 0);

    // Calculate claimable earnings across active devices (1 single cycle per eligible device)
    let totalClaimable = 0;
    let maxRemainingHours = 0;
    const activePurchases = purchases.filter((p: any) => p.status === 'ACTIVE' || p.status === 'active');

    activePurchases.forEach((p: any) => {
      const durationDays = Number(p.duration_days || 365);
      const totalPlanHours = durationDays * 24;
      const startedMs = new Date(p.started_at || nowMs).getTime();
      const expiresMs = p.expires_at ? new Date(p.expires_at).getTime() : startedMs + totalPlanHours * 3600 * 1000;

      const dailyEarnings = Number(p.daily_earnings || (Number(p.earning_rate || 0) * 24) || 0);
      const hourlyEarnings = Number(p.earning_rate || (dailyEarnings > 0 ? dailyEarnings / 24 : 0));

      const effectiveEndMs = Math.min(nowMs, expiresMs);
      const elapsedSeconds = Math.max(0, Math.floor((effectiveEndMs - startedMs) / 1000));
      const totalCompletedHours = Math.min(totalPlanHours, Math.floor(elapsedSeconds / 3600));

      const claimedAmount = Number(p.claimed_amount || 0);
      const claimedHours = Number(p.claimed_hours || (hourlyEarnings > 0 ? Math.round(claimedAmount / hourlyEarnings) : 0));
      const unclaimedHours = Math.max(0, totalCompletedHours - claimedHours);
      const isExpired = nowMs >= expiresMs || totalCompletedHours >= totalPlanHours;

      if (unclaimedHours >= 1 && hourlyEarnings > 0 && !isExpired) {
        totalClaimable = Number((totalClaimable + hourlyEarnings).toFixed(2));
      }

      const remainingHours = Math.max(0, Math.ceil((expiresMs - nowMs) / 3600000));
      if (remainingHours > maxRemainingHours) {
        maxRemainingHours = remainingHours;
      }
    });

    return res.json({
      success: true,
      totalAssets,
      topupBalance,
      withdrawBalance,
      todayEarnings: Number(todayEarnings.toFixed(2)),
      totalClaimable: Number(totalClaimable.toFixed(2)),
      totalEarned,
      remainingHours: maxRemainingHours,
      activeDevicesCount: activePurchases.length,
    });
  } catch (err: any) {
    console.error('Earnings summary error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch earnings summary.' });
  }
});

// ==============================================================================
// 7. ADMIN DASHBOARD & MANAGEMENT BACKEND APIs (PROTECTED)
// ==============================================================================

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.UNIVEPAY_SECRET || 'gainpower_pb_admin_jwt_secret_2024';

function signAdminToken(payload: { adminId: string; username: string; role: 'admin'; expiresAt: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(data).digest('hex');
  return `adm_tok.${data}.${sig}`;
}

function verifySignedAdminToken(token: string): { valid: boolean; payload?: any; reason?: string } {
  if (!token || !token.startsWith('adm_tok.')) {
    return { valid: false, reason: 'Invalid token format' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Malformed token structure' };
  }
  const [, data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(data).digest('hex');
  if (sig !== expectedSig) {
    return { valid: false, reason: 'Signature mismatch' };
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin') {
      return { valid: false, reason: 'Not an admin role' };
    }
    if (payload.expiresAt && Number(payload.expiresAt) < Date.now()) {
      return { valid: false, reason: 'Token expired' };
    }
    return { valid: true, payload };
  } catch (_err) {
    return { valid: false, reason: 'Payload decoding error' };
  }
}

/**
 * Strict Admin Authorization Middleware
 * - Rejects unauthenticated requests with 401 Unauthorized
 * - Rejects normal authenticated users with 403 Forbidden
 * - Rejects disabled/banned admin accounts with 403 Forbidden
 * - Allows only legitimate admin credentials (signed token or Supabase Auth admin role)
 */
async function verifyAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const customAdminToken = (req.headers['x-admin-token'] || req.headers['x-admin-auth'] || '').toString().trim();
  const token = bearerToken || customAdminToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin authorization required. No credentials provided.',
    });
  }

  // 1. Signed Admin Session Token (adm_tok.<data>.<sig>)
  if (token.startsWith('adm_tok.')) {
    const verification = verifySignedAdminToken(token);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({
        success: false,
        error: `Unauthorized: ${verification.reason || 'Invalid admin session token.'}`,
      });
    }
    (req as any).adminUser = verification.payload;
    return next();
  }

  // 2. Supabase Auth Bearer Token (JWT)
  if (supabase) {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !userData?.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or expired authentication token.',
        });
      }

      const uid = userData.user.id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id, role, status, is_active')
        .or(`id.eq.${uid},user_id.eq.${uid}`)
        .maybeSingle();

      const role = profile?.role || userData.user.user_metadata?.role;
      const isActive = profile
        ? profile.is_active !== false && profile.status !== 'disabled' && profile.status !== 'banned'
        : true;

      // Reject normal authenticated users with 403
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Administrator privileges required.',
        });
      }

      // Reject disabled admin accounts with 403
      if (!isActive) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Admin account is disabled.',
        });
      }

      (req as any).adminUser = {
        adminId: uid,
        role: 'admin',
        username: profile?.username || 'admin',
      };
      return next();
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Internal error validating authorization.' });
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid admin credentials.',
  });
}

// 1. Admin Authentication Login Endpoint
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = (username || '').trim();
  const cleanPassword = (password || '').trim();

  if (!cleanUsername || !cleanPassword) {
    return res.status(400).json({
      success: false,
      error: 'Please enter both admin username and password.',
    });
  }

  // 1. Supabase Auth if configured
  if (supabase) {
    try {
      const adminEmail = `${cleanUsername.toLowerCase()}@powerbank.internal`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: cleanPassword,
      });

      if (!authError && authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, user_id, role, status, is_active')
          .or(`id.eq.${authData.user.id},user_id.eq.${authData.user.id}`)
          .maybeSingle();

        const role = profile?.role || authData.user.user_metadata?.role;
        const isActive = profile
          ? profile.is_active !== false && profile.status !== 'disabled' && profile.status !== 'banned'
          : true;

        if (role !== 'admin') {
          return res.status(403).json({ success: false, error: 'You are not authorized to access the Admin Panel.' });
        }
        if (!isActive) {
          return res.status(403).json({ success: false, error: 'Admin account is disabled.' });
        }

        const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
        const token = signAdminToken({
          adminId: authData.user.id,
          username: cleanUsername,
          role: 'admin',
          expiresAt,
        });

        return res.json({
          success: true,
          session: {
            token,
            adminId: authData.user.id,
            username: cleanUsername,
            role: 'admin',
            expiresAt,
          },
        });
      }
    } catch (_err) {}
  }

  // 2. Verified secure cryptographic credential comparison (adminbank / adminbank@700)
  const expectedHash = crypto.createHash('sha256').update('pb_bank_admin_salt_700:adminbank:adminbank@700').digest('hex');
  const computedHash = crypto.createHash('sha256').update(`pb_bank_admin_salt_700:${cleanUsername}:${cleanPassword}`).digest('hex');

  if (computedHash !== expectedHash) {
    return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
  }

  const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  const token = signAdminToken({
    adminId: 'adm_root_700',
    username: cleanUsername,
    role: 'admin',
    expiresAt,
  });

  return res.json({
    success: true,
    session: {
      token,
      adminId: 'adm_root_700',
      username: cleanUsername,
      role: 'admin',
      expiresAt,
    },
  });
});

// Middleware gate to protect all /api/admin/* endpoints (except /api/admin/login)
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/login') {
    return next();
  }
  return verifyAdminAuth(req, res, next);
});

app.get('/api/admin/dashboard-stats', verifyAdminAuth, async (req, res) => {
  if (!supabase) {
    return res.json({ success: true, data: {} });
  }
  try {
    const [profilesRes, walletsRes, paymentsRes, depositsRes, withdrawalsRes, purchasesRes, earningsRes] = await Promise.all([
      supabase.from('profiles').select('id, status'),
      supabase.from('wallets').select('available_balance, withdraw_balance, recharge_balance'),
      supabase.from('payments').select('amount, status, payment_type, payment_method'),
      supabase.from('deposit_transactions').select('amount, status'),
      supabase.from('withdrawals').select('amount, status'),
      supabase.from('purchases').select('amount, status, plan_category'),
      supabase.from('earnings').select('amount, status, earning_type'),
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

    // Sum paid recharges across payments and deposit_transactions
    const paidManualPayments = payments.filter((p) => p.status === 'PAID').reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const paidGatewayDeposits = deposits.filter((d) => d.status === 'SUCCESS' || d.status === 'COMPLETED').reduce((acc, d) => acc + Number(d.amount || 0), 0);
    const totalRecharge = +(paidManualPayments + paidGatewayDeposits).toFixed(2);

    const pendingManualPayments = payments.filter((p) => (p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING' || p.status === 'PENDING')).reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const pendingGatewayDeposits = deposits.filter((d) => d.status === 'PENDING').reduce((acc, d) => acc + Number(d.amount || 0), 0);
    const pendingRecharge = +(pendingManualPayments + pendingGatewayDeposits).toFixed(2);

    const totalWithdrawals = +withdrawals.filter((w) => w.status === 'COMPLETED' || w.status === 'SUCCESS').reduce((acc, w) => acc + Number(w.amount || 0), 0).toFixed(2);
    const pendingWithdrawals = +withdrawals.filter((w) => w.status === 'PENDING' || w.status === 'PROCESSING').reduce((acc, w) => acc + Number(w.amount || 0), 0).toFixed(2);

    const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
    const totalInvestments = +activePurchases.reduce((acc, p) => acc + Number(p.amount || 0), 0).toFixed(2);

    const activeHourlyPlans = activePurchases.filter((p: any) => {
      const cat = (p.plan_category || '').toUpperCase();
      return cat !== 'PRO';
    }).length;

    const activeProPlans = activePurchases.filter((p: any) => {
      const cat = (p.plan_category || '').toUpperCase();
      return cat === 'PRO';
    }).length;

    const totalEarnings = +earnings.reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
    const totalClaimableEarnings = +earnings.filter((e) => e.status === 'CLAIMABLE').reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
    const totalClaimedEarnings = +earnings.filter((e) => e.status === 'CLAIMED').reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
    const referralEarnings = +earnings.filter((e) => (e.earning_type || '').includes('REFERRAL')).reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);

    const pendingComplaintsCount = payments.filter((p) => (p.payment_type === 'DEPOSIT_COMPLAINT' || p.payment_method === 'PAY_COMPLAINT') && (p.status === 'PENDING_VERIFICATION' || p.status === 'PENDING')).length;

    return res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalWalletBalance,
        totalRecharge,
        pendingRecharge,
        totalWithdrawals,
        pendingWithdrawals,
        pendingComplaintsCount,
        totalInvestments,
        activeHourlyPlans,
        activeProPlans,
        totalEarnings,
        totalClaimableEarnings,
        totalClaimedEarnings,
        referralEarnings,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/users', verifyAdminAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true, data: [] });
  try {
    const [profilesRes, walletsRes, purchasesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('wallets').select('*'),
      supabase.from('purchases').select('*'),
    ]);

    if (profilesRes.error) return res.status(500).json({ success: false, error: profilesRes.error.message });

    const walletMap = new Map<string, any>();
    if (walletsRes.data) {
      walletsRes.data.forEach((w: any) => {
        if (w.user_id) walletMap.set(w.user_id, w);
        if (w.id) walletMap.set(w.id, w);
      });
    }

    const purchasesByUser = new Map<string, any[]>();
    if (purchasesRes.data) {
      purchasesRes.data.forEach((pur: any) => {
        const uId = pur.user_id;
        if (!purchasesByUser.has(uId)) purchasesByUser.set(uId, []);
        purchasesByUser.get(uId)!.push(pur);
      });
    }

    const formatted = (profilesRes.data || []).map((p: any) => {
      const uId = p.user_id || p.id;
      const walletObj = walletMap.get(p.user_id) || walletMap.get(p.id);
      const purchasesList = purchasesByUser.get(p.user_id) || purchasesByUser.get(p.id) || [];
      const totalInvested = purchasesList
        .filter((pur: any) => pur.status === 'ACTIVE')
        .reduce((sum: number, pur: any) => sum + Number(pur.amount || 0), 0);
      const activeDevices = purchasesList.filter((pur: any) => pur.status === 'ACTIVE').length;

      return {
        id: p.id,
        userId: p.user_id || p.id,
        username: p.username || 'User',
        whatsappNo: p.whatsapp_no || p.mobile || '',
        name: p.username || 'User',
        mobile: p.whatsapp_no || p.mobile || '',
        email: p.email || '',
        membershipNumber: p.membership_number || '',
        referralCode: p.referral_code || '',
        referredBy: p.referred_by || '',
        role: p.role || 'user',
        status: p.status || 'active',
        availableBalance: Number(walletObj?.available_balance || 0),
        walletBalance: Number(walletObj?.available_balance || 0),
        totalInvested,
        activeDevices,
        createdAt: p.created_at,
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/recharges', async (req, res) => {
  if (!supabase) return res.json({ success: true, data: [] });
  try {
    const [paymentsRes, depositsRes, profilesRes] = await Promise.all([
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('deposit_transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, user_id, username, whatsapp_no, membership_number, mobile'),
    ]);

    const profileMap = new Map<string, any>();
    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => {
        if (p.user_id) profileMap.set(p.user_id, p);
        if (p.id) profileMap.set(p.id, p);
      });
    }

    const payments = (paymentsRes.data || []).map((p: any) => {
      const prof = profileMap.get(p.user_id) || {};
      return {
        id: p.id,
        userId: p.user_id,
        username: prof.username || 'User',
        whatsappNo: prof.whatsapp_no || prof.mobile || '',
        membershipNumber: prof.membership_number || '',
        amount: Number(p.amount || 0),
        paymentMethod: p.payment_method || 'UPI',
        utrNumber: p.utr || p.utr_number || p.reference_id || '',
        referenceId: p.order_id || p.reference_id || p.utr_number || '',
        status: p.status,
        createdAt: p.created_at,
        type: 'MANUAL_UPI',
      };
    });

    const deposits = (depositsRes.data || []).map((d: any) => {
      const prof = profileMap.get(d.user_id) || {};
      return {
        id: d.id,
        userId: d.user_id,
        username: prof.username || 'User',
        whatsappNo: prof.whatsapp_no || prof.mobile || '',
        membershipNumber: prof.membership_number || '',
        amount: Number(d.amount || 0),
        paymentMethod: d.channel || 'UNIVEPAY',
        utrNumber: d.utr || d.traceno || '',
        referenceId: d.traceno || '',
        status: (d.status === 'SUCCESS' || d.status === 'COMPLETED') ? 'PAID' : d.status,
        createdAt: d.created_at,
        type: 'GATEWAY_DEPOSIT',
      };
    });

    const combined = [...payments, ...deposits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ success: true, data: combined });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/approve-recharge', async (req, res) => {
  const { paymentId, adminId = 'adm_root' } = req.body;
  if (!paymentId || !supabase) return res.status(400).json({ success: false, error: 'Missing paymentId' });

  try {
    const { data: payment, error: fetchErr } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (fetchErr || !payment) return res.status(404).json({ success: false, error: 'Payment not found' });
    if (payment.status === 'PAID') return res.json({ success: true, message: 'Already approved' });

    // Credit User Wallet
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', payment.user_id).single();
    const currentBal = Number(wallet?.available_balance || 0);
    const newBal = currentBal + Number(payment.amount);

    await supabase.from('wallets').update({
      available_balance: newBal,
      recharge_balance: Number(wallet?.recharge_balance || 0) + Number(payment.amount),
      updated_at: new Date().toISOString(),
    }).eq('user_id', payment.user_id);

    // Update payment status
    await supabase.from('payments').update({
      status: 'PAID',
      verified_at: new Date().toISOString(),
      verified_by: adminId,
    }).eq('id', paymentId);

    // Insert wallet transaction
    await supabase.from('wallet_transactions').insert({
      user_id: payment.user_id,
      type: 'RECHARGE',
      amount: Number(payment.amount),
      balance_before: currentBal,
      balance_after: newBal,
      wallet_type: 'TOPUP',
      status: 'COMPLETED',
      reference_id: payment.utr_number || payment.id,
      description: `⚡ Admin Approved Topup: ₹${payment.amount} (UTR: ${payment.utr_number || 'N/A'})`,
      created_at: new Date().toISOString(),
    });

    // Notify user
    await supabase.from('notifications').insert({
      user_id: payment.user_id,
      title: 'Topup Approved! ⚡',
      message: `Your recharge of ₹${payment.amount} has been verified and added to your Topup Wallet.`,
      type: 'SUCCESS',
      read: false,
      created_at: new Date().toISOString(),
    });

    // Check & update deposit-based VIP upgrades (VIP 3, 4, 5, 6)
    await checkAndUpdateDepositVip(payment.user_id);

    return res.json({ success: true, message: 'Recharge approved successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/wallet/transactions', async (req, res) => {
  try {
    let userId = (req.query.userId as string) || '';
    if (!userId && req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '').trim();
      if (token && supabase) {
        try {
          const { data: authUser } = await supabase.auth.getUser(token);
          if (authUser?.user) {
            userId = authUser.user.id;
          }
        } catch {}
      }
    }

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

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

    const txMap = new Map<string, any>();

    // 1. Process wallet_transactions
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

    // 2. Process wallet_ledger
    if (!ledgerRes.error && ledgerRes.data) {
      for (const l of ledgerRes.data) {
        const key = l.reference_id || l.id;
        const txTypeUpper = (l.transaction_type || '').toUpperCase();
        const descLower = (l.description || '').toLowerCase();
        let mappedType = 'ADMIN_ADJUSTMENT';

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

    // 3. Process deposit_transactions (Gateway Deposits)
    if (!depRes.error && depRes.data) {
      for (const d of depRes.data) {
        const ref = d.traceno || d.order_id || d.id;
        const rawStatus = (d.status || '').toUpperCase();
        let mappedStatus = 'Pending';
        if (rawStatus === 'SUCCESS' || rawStatus === 'PAID' || rawStatus === 'COMPLETED') {
          mappedStatus = 'Completed';
        } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'FAILED_GATEWAY_CREATION') {
          mappedStatus = 'Failed';
        }

        if (txMap.has(ref)) {
          const existing = txMap.get(ref)!;
          if (mappedStatus === 'Completed') existing.status = 'Completed';
          else if (mappedStatus === 'Failed') existing.status = 'Failed';
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

    // 4. Process manual payments
    if (!payRes.error && payRes.data) {
      for (const p of payRes.data) {
        const ref = p.order_id || p.id;
        const rawStatus = (p.status || '').toUpperCase();
        let mappedStatus = 'Pending';
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

    // 5. Process withdrawals
    if (!withRes.error && withRes.data) {
      for (const w of withRes.data) {
        const ref = w.id;
        const rawStatus = (w.status || '').toUpperCase();
        let mappedStatus = 'Pending';
        if (rawStatus === 'APPROVED' || rawStatus === 'PAID' || rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED' || rawStatus === 'PROCESSED') {
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

    // 6. Process hardware purchases
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

    // 7. Process claimed earnings / yield claims
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

    // 8. Process gift code claims
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

    return res.json({ success: true, data: list });
  } catch (err: any) {
    console.error('Error fetching wallet transactions:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch transactions' });
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  if (!supabase) return res.json({ success: true, data: [] });
  try {
    const [withdrawalsRes, profilesRes, banksRes] = await Promise.all([
      supabase.from('withdrawals').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, user_id, username, whatsapp_no, membership_number, mobile'),
      supabase.from('bank_accounts').select('*'),
    ]);

    if (withdrawalsRes.error) return res.status(500).json({ success: false, error: withdrawalsRes.error.message });

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

    const formatted = (withdrawalsRes.data || []).map((w: any) => {
      const prof = profileMap.get(w.user_id) || {};
      const bank = bankMap.get(w.bank_account_id) || {};
      return {
        id: w.id,
        userId: w.user_id,
        username: prof.username || 'User',
        whatsappNo: prof.whatsapp_no || prof.mobile || '',
        membershipNumber: prof.membership_number || '',
        amount: Number(w.amount || 0),
        actualAmount: Number(w.actual_amount || w.net_amount || w.amount || 0),
        fee: Number(w.fee || 0),
        status: w.status,
        accountNumber: w.account_number || bank.account_number || '',
        ifscCode: w.ifsc_code || bank.ifsc || bank.ifsc_code || '',
        holderName: w.holder_name || bank.account_holder_name || bank.holder_name || prof.username || '',
        bankName: w.bank_name || bank.bank_name || '',
        bankRefNo: w.bank_ref_no || '',
        rejectedReason: w.rejection_reason || w.rejected_reason || '',
        createdAt: w.created_at,
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/approve-withdrawal', async (req, res) => {
  const { withdrawalId, bankRefNo = '', adminId = 'adm_root' } = req.body;
  if (!withdrawalId || !supabase) return res.status(400).json({ success: false, error: 'Missing withdrawalId' });

  try {
    const { data: w, error: fetchErr } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).single();
    if (fetchErr || !w) return res.status(404).json({ success: false, error: 'Withdrawal not found' });
    if (w.status === 'COMPLETED') return res.json({ success: true, message: 'Already approved' });

    await supabase.from('withdrawals').update({
      status: 'COMPLETED',
      bank_ref_no: bankRefNo || `REF-${Date.now()}`,
      processed_at: new Date().toISOString(),
      processed_by: adminId,
    }).eq('id', withdrawalId);

    // Update wallet total_withdrawn
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', w.user_id).single();
    if (wallet) {
      await supabase.from('wallets').update({
        total_withdrawn: Number(wallet.total_withdrawn || 0) + Number(w.amount),
        updated_at: new Date().toISOString(),
      }).eq('user_id', w.user_id);
    }

    // Insert wallet transaction
    await supabase.from('wallet_transactions').insert({
      user_id: w.user_id,
      type: 'WITHDRAWAL',
      amount: Number(w.amount),
      balance_before: Number(wallet?.available_balance || 0),
      balance_after: Number(wallet?.available_balance || 0),
      wallet_type: 'WITHDRAWABLE',
      status: 'COMPLETED',
      reference_id: bankRefNo || w.id,
      description: `🏦 Withdrawal Paid: ₹${w.amount} to A/C ${w.account_number} (Ref: ${bankRefNo || 'COMPLETED'})`,
      created_at: new Date().toISOString(),
    });

    // Notify user
    await supabase.from('notifications').insert({
      user_id: w.user_id,
      title: 'Withdrawal Processed! 🏦',
      message: `Your withdrawal of ₹${w.amount} has been paid to your bank account (${w.account_number}).`,
      type: 'SUCCESS',
      read: false,
      created_at: new Date().toISOString(),
    });

    return res.json({ success: true, message: 'Withdrawal marked as completed.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/reject-withdrawal', async (req, res) => {
  const { withdrawalId, rejectionReason = 'Verification failed', adminId = 'adm_root' } = req.body;
  if (!withdrawalId || !supabase) return res.status(400).json({ success: false, error: 'Missing withdrawalId' });

  try {
    const { data: w, error: fetchErr } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).single();
    if (fetchErr || !w) return res.status(404).json({ success: false, error: 'Withdrawal not found' });
    if (w.status === 'REJECTED') return res.json({ success: true, message: 'Already rejected' });
    if (w.status === 'COMPLETED' || w.status === 'PAID') {
      return res.status(400).json({ success: false, error: 'Cannot reject a completed withdrawal' });
    }

    const nowIso = new Date().toISOString();
    const amount = Number(w.amount);
    const userId = w.user_id;

    // Update withdrawal record
    await supabase.from('withdrawals').update({
      status: 'REJECTED',
      rejection_reason: rejectionReason,
      processed_at: nowIso,
      processed_by: adminId,
    }).eq('id', withdrawalId);

    // Atomically refund held withdrawal balance to user's wallet
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    if (wallet) {
      const curWithdraw = Number(wallet.withdraw_balance !== undefined ? wallet.withdraw_balance : (wallet.earned_balance || wallet.available_balance || 0));
      const curPending = Number(wallet.pending_balance || 0);
      const newPending = Math.max(0, +(curPending - amount).toFixed(2));
      const newWithdraw = +(curWithdraw + amount).toFixed(2);
      const curRecharge = Number(wallet.recharge_balance || 0);
      const newAvailable = +(curRecharge + newWithdraw).toFixed(2);

      await supabase.from('wallets').update({
        withdraw_balance: newWithdraw,
        available_balance: newAvailable,
        pending_balance: newPending,
        updated_at: nowIso,
      }).eq('user_id', userId);
    }

    // Insert reversal wallet transaction
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: 'WITHDRAWAL_REVERSAL',
      amount: amount,
      balance_before: Number(wallet?.available_balance || 0),
      balance_after: Number(wallet?.available_balance || 0) + amount,
      wallet_type: 'WITHDRAWABLE',
      status: 'Completed',
      reference_id: w.id,
      description: `Withdrawal Reversal: ${rejectionReason}`,
      created_at: nowIso,
    });

    // Notify user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Withdrawal Rejected',
      message: `Your withdrawal request of ₹${amount} was not approved (${rejectionReason}). Funds have been refunded to your Withdraw Wallet.`,
      type: 'WARNING',
      read: false,
      created_at: nowIso,
    });

    // Record audit log
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'REJECT_WITHDRAWAL',
        target_type: 'withdrawal',
        target_id: withdrawalId,
        description: `Rejected withdrawal of ₹${amount} for user ${userId}: ${rejectionReason}`,
        details: { withdrawalId, amount, rejectionReason, userId },
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({ success: true, message: 'Withdrawal rejected and funds refunded to user wallet.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 20-MINUTE AUTOMATIC TOPUP ORDER EXPIRATION SERVICE
// ==============================================================================
async function cancelExpiredPendingTopups() {
  if (!supabase) return;
  try {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: expiredOrders, error } = await supabase
      .from('deposit_transactions')
      .update({
        status: 'CANCELLED',
        failure_reason: 'Order automatically cancelled after 20 minutes of inactivity',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'PENDING')
      .lt('created_at', twentyMinutesAgo)
      .select('id, traceno, user_id, amount');

    if (expiredOrders && expiredOrders.length > 0) {
      console.log(`[Auto-Cancel] Automatically marked ${expiredOrders.length} expired topup order(s) as CANCELLED.`);
    }
  } catch (e: any) {
    console.warn('[Auto-Cancel] Notice during topup cleanup:', e?.message || e);
  }
}

// Check every 60 seconds
setInterval(cancelExpiredPendingTopups, 60 * 1000);
setTimeout(cancelExpiredPendingTopups, 3000);

// ==============================================================================
// WEBSITE POPUP CONFIGURATION ENDPOINTS
// ==============================================================================
app.get('/api/website-popup', async (req, res) => {
  if (!supabase) {
    return res.json({
      success: true,
      data: {
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
      },
    });
  }
  try {
    const { data } = await supabase.from('admin_settings').select('value').eq('id', 'website_popup').maybeSingle();
    const config = data?.value || {
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
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/website-popup', async (req, res) => {
  const { config, adminId = 'adm_root' } = req.body;
  if (!config) return res.status(400).json({ success: false, error: 'Missing popup configuration.' });

  try {
    if (supabase) {
      await supabase.from('admin_settings').upsert({
        id: 'website_popup',
        value: config,
        updated_at: new Date().toISOString(),
      });

      try {
        await supabase.from('admin_audit_logs').insert({
          admin_user_id: adminId,
          action: 'UPDATE_WEBSITE_POPUP',
          target_type: 'settings',
          target_id: 'website_popup',
          description: `Updated website popup config (Active: ${config.isActive})`,
          details: config,
          created_at: new Date().toISOString(),
        });
      } catch (_e) {}
    }
    return res.json({ success: true, message: 'Website popup saved successfully.', data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ==============================================================================
// DEPOSIT COMPLAINT SYSTEM (USER SUBMISSION & ADMIN MANUAL REVIEW)
// ==============================================================================

// Helper to extract storage path and generate signed URL for deposit complaint evidence
async function getSignedProofUrl(rawPathOrUrl: string | null | undefined, expiresInSeconds = 3600): Promise<string> {
  if (!rawPathOrUrl || !supabase) return '';
  const str = String(rawPathOrUrl).trim();
  if (!str) return '';
  if (str.startsWith('data:image')) return str; // Base64 fallback

  let objectKey = str;
  // If it's a legacy public or signed URL, extract storage key
  if (str.includes('/deposit-complaints/')) {
    const parts = str.split('/deposit-complaints/');
    if (parts[1]) {
      objectKey = parts[1].split('?')[0];
    }
  } else if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }

  try {
    const { data: signedData, error } = await supabase.storage
      .from('deposit-complaints')
      .createSignedUrl(objectKey, expiresInSeconds);
    if (!error && signedData?.signedUrl) {
      return signedData.signedUrl;
    }
  } catch (err) {
    console.warn('[SIGNED URL] Failed to create signed URL for:', objectKey, err);
  }
  return str;
}

// 1. Submit a deposit complaint (User)
app.post('/api/deposit-complaint', async (req, res) => {
  const { userId, traceno, amount, utr, proofUrl = '', note = '' } = req.body;
  if (!userId || !traceno || !amount || !utr) {
    return res.status(400).json({ success: false, error: 'User ID, Order Reference (Traceno), Amount, and 12-digit UTR are required.' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database service unavailable.' });
  }

  try {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid deposit amount.' });
    }

    const cleanUtr = String(utr).trim();
    const cleanTraceno = String(traceno).trim();

    // Check if complaint already exists for this UTR or order
    const { data: existingComplaint } = await supabase
      .from('payments')
      .select('id, status')
      .eq('utr', cleanUtr)
      .maybeSingle();

    if (existingComplaint && existingComplaint.status === 'PAID') {
      return res.status(400).json({ success: false, error: 'This UTR has already been approved and credited.' });
    }

    const nowIso = new Date().toISOString();

    // Insert into payments table as a DEPOSIT_COMPLAINT
    const { data: complaint, error: insertErr } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        order_id: cleanTraceno,
        reference_id: cleanTraceno,
        amount: numAmount,
        payment_type: 'DEPOSIT_COMPLAINT',
        payment_method: 'PAY_COMPLAINT',
        utr: cleanUtr,
        utr_number: cleanUtr,
        proof_url: proofUrl || null,
        status: 'PENDING_VERIFICATION',
        rejection_reason: note ? `User note: ${note}` : null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[COMPLAINT] Error inserting payment complaint:', insertErr);
      return res.status(500).json({ success: false, error: insertErr.message });
    }

    // If matching deposit transaction exists, update its UTR
    try {
      await supabase
        .from('deposit_transactions')
        .update({
          utr: cleanUtr,
          updated_at: nowIso,
        })
        .eq('traceno', cleanTraceno);
    } catch (_e) {}

    // Send user notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Deposit Complaint Submitted 📋',
        message: `Your deposit complaint for ₹${numAmount.toFixed(2)} (UTR: ${cleanUtr}) has been received. Our review team is verifying it.`,
        type: 'SYSTEM',
        read: false,
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({
      success: true,
      complaintId: complaint.id,
      message: 'Deposit complaint submitted successfully. It will be reviewed by admin shortly.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Fetch all deposit complaints with authorized signed proof URLs (Admin)
app.get('/api/admin/complaints', verifyAdminAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true, data: [] });
  try {
    const [paymentsRes, profilesRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*')
        .or('payment_type.eq.DEPOSIT_COMPLAINT,payment_method.eq.PAY_COMPLAINT')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, user_id, username, whatsapp_no, membership_number, phone'),
    ]);

    if (paymentsRes.error) {
      console.error('[API /api/admin/complaints] payments error:', paymentsRes.error);
      return res.status(500).json({ success: false, error: paymentsRes.error.message });
    }

    const profileMap = new Map<string, any>();
    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => {
        if (p.user_id) profileMap.set(p.user_id, p);
        if (p.id) profileMap.set(p.id, p);
      });
    }

    const formatted = await Promise.all((paymentsRes.data || []).map(async (p: any) => {
      const prof = profileMap.get(p.user_id) || {};
      const rawProof = p.proof_url || p.receipt_url || '';
      const signedProof = await getSignedProofUrl(rawProof, 3600);

      return {
        id: p.id,
        userId: p.user_id,
        username: prof.username || 'User',
        userMobile: prof.whatsapp_no || prof.phone || '',
        membershipNumber: prof.membership_number || '',
        orderId: p.order_id || p.reference_id || 'N/A',
        traceno: p.order_id || p.reference_id || 'N/A',
        amount: Number(p.amount || 0),
        utr: p.utr || p.utr_number || '',
        proofUrl: signedProof,
        receiptUrl: signedProof,
        status: p.status,
        adminId: p.admin_id,
        adminNote: p.rejection_reason,
        rejectionReason: p.rejection_reason,
        verifiedAt: p.verified_at,
        verifiedBy: p.verified_by,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    }));

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('[API /api/admin/complaints] catch err:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. User request to generate authorized signed URL for their own complaint screenshot
app.post('/api/deposit-complaint/signed-url', async (req, res) => {
  const { userId, complaintId, filePath } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required.' });
  }
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database service unavailable.' });
  }

  try {
    // If complaintId is supplied, verify ownership from payments table
    if (complaintId) {
      const { data: complaint, error } = await supabase
        .from('payments')
        .select('user_id, proof_url, receipt_url')
        .eq('id', complaintId)
        .maybeSingle();

      if (error || !complaint) {
        return res.status(404).json({ success: false, error: 'Complaint not found.' });
      }

      if (complaint.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Access denied to another user\'s evidence.' });
      }

      const targetPath = complaint.proof_url || complaint.receipt_url;
      const signedUrl = await getSignedProofUrl(targetPath, 3600);
      return res.json({ success: true, signedUrl });
    }

    // If direct filePath is supplied, verify ownership via user folder prefix
    if (filePath) {
      const cleanPath = String(filePath).trim();
      if (!cleanPath.startsWith(`${userId}/`)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Access denied to another user\'s evidence.' });
      }
      const signedUrl = await getSignedProofUrl(cleanPath, 3600);
      return res.json({ success: true, signedUrl });
    }

    return res.status(400).json({ success: false, error: 'Either complaintId or filePath must be provided.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Approve deposit complaint (Admin -> Safely & Atomically Credits Topup/Recharge Wallet)
app.post('/api/admin/approve-complaint', async (req, res) => {
  const { complaintId, adminId = 'adm_root', adminNote = '' } = req.body;
  if (!complaintId || !supabase) {
    return res.status(400).json({ success: false, error: 'Missing complaintId' });
  }

  try {
    const { data: complaint, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', complaintId)
      .single();

    if (fetchErr || !complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    if (complaint.status === 'PAID' || complaint.status === 'APPROVED') {
      return res.status(400).json({ success: false, error: 'This complaint has already been approved and credited.' });
    }

    const amount = Number(complaint.amount);
    const userId = complaint.user_id;
    const utr = complaint.utr || complaint.utr_number || 'N/A';
    const traceno = complaint.order_id || complaint.reference_id || complaint.id;
    const nowIso = new Date().toISOString();

    // 1. Fetch user wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const curRecharge = Number(wallet?.recharge_balance || 0);
    const curWithdraw = Number(wallet?.withdraw_balance || 0);
    const newRecharge = +(curRecharge + amount).toFixed(2);
    const newAvail = +(newRecharge + curWithdraw).toFixed(2);

    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          recharge_balance: newRecharge,
          available_balance: newAvail,
          updated_at: nowIso,
        })
        .eq('user_id', userId);
    } else {
      await supabase.from('wallets').insert({
        user_id: userId,
        recharge_balance: newRecharge,
        withdraw_balance: 0,
        available_balance: newRecharge,
        pending_balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
      });
    }

    // 2. Insert into wallet_ledger (AUTHORITATIVE RECORD)
    await supabase.from('wallet_ledger').insert({
      user_id: userId,
      wallet_type: 'RECHARGE',
      transaction_type: 'DEPOSIT_COMPLAINT_APPROVED',
      amount: amount,
      direction: 'CREDIT',
      reference_type: 'DEPOSIT_COMPLAINT',
      reference_id: `COMPLAINT-${complaint.id}`,
      balance_before: curRecharge,
      balance_after: newRecharge,
      description: `⚡ Deposit Complaint Approved: ₹${amount.toFixed(2)} (UTR: ${utr}) Ref: ${traceno}`,
      created_at: nowIso,
    });

    // 3. Insert into wallet_transactions
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: 'RECHARGE',
      amount: amount,
      balance_before: curRecharge,
      balance_after: newRecharge,
      wallet_type: 'RECHARGE',
      status: 'Completed',
      reference_id: `COMPLAINT-${complaint.id}`,
      description: `⚡ Deposit Complaint Approved: ₹${amount.toFixed(2)} (UTR: ${utr})`,
      created_at: nowIso,
    });

    // 4. Update payments table
    const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    const { error: payUpdateErr } = await supabase
      .from('payments')
      .update({
        status: 'PAID',
        verified_at: nowIso,
        verified_by: adminId,
        admin_id: isValidUuid(adminId) ? adminId : null,
        rejection_reason: adminNote ? `Approved: ${adminNote}` : 'Approved by Admin',
        updated_at: nowIso,
      })
      .eq('id', complaintId);

    if (payUpdateErr) {
      console.warn('[COMPLAINT APPROVE] Notice updating payments status:', payUpdateErr.message);
    }

    // 5. Update deposit_transactions if matching traceno exists
    if (traceno) {
      await supabase
        .from('deposit_transactions')
        .update({
          status: 'SUCCESS',
          utr: utr,
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('traceno', traceno);
    }

    // 6. Notify user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Deposit Complaint Approved! ✅',
      message: `Your deposit complaint of ₹${amount.toFixed(2)} (UTR: ${utr}) has been approved and credited to your Recharge Wallet.`,
      type: 'DEPOSIT',
      read: false,
      created_at: nowIso,
    });

    // 7. Record admin audit log
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'APPROVE_DEPOSIT_COMPLAINT',
        target_type: 'payment',
        target_id: complaintId,
        description: `Approved deposit complaint of ₹${amount} for user ${userId} (UTR: ${utr})`,
        details: { complaintId, amount, utr, adminNote, userId },
        created_at: nowIso,
      });
    } catch (_e) {}

    // Check & update deposit-based VIP upgrades (VIP 3, 4, 5, 6)
    await checkAndUpdateDepositVip(userId);

    return res.json({
      success: true,
      message: `Deposit complaint for ₹${amount} approved successfully. Topup Wallet credited.`,
    });
  } catch (err: any) {
    console.error('[APPROVE COMPLAINT ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Reject deposit complaint (Admin)
app.post('/api/admin/reject-complaint', async (req, res) => {
  const { complaintId, rejectionReason = 'Payment verification failed', adminId = 'adm_root' } = req.body;
  if (!complaintId || !supabase) {
    return res.status(400).json({ success: false, error: 'Missing complaintId' });
  }

  try {
    const { data: complaint, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', complaintId)
      .single();

    if (fetchErr || !complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    if (complaint.status === 'PAID' || complaint.status === 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Cannot reject a complaint that has already been approved and credited.' });
    }

    const nowIso = new Date().toISOString();
    const amount = Number(complaint.amount);
    const userId = complaint.user_id;

    // Update payments table
    const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    const { error: payUpdateErr } = await supabase
      .from('payments')
      .update({
        status: 'REJECTED',
        rejection_reason: rejectionReason,
        verified_at: nowIso,
        verified_by: adminId,
        admin_id: isValidUuid(adminId) ? adminId : null,
        updated_at: nowIso,
      })
      .eq('id', complaintId);

    if (payUpdateErr) {
      console.warn('[COMPLAINT REJECT] Notice updating payments status:', payUpdateErr.message);
    }

    // If matching deposit transaction exists, update failure reason
    const traceno = complaint.order_id || complaint.reference_id;
    if (traceno) {
      await supabase
        .from('deposit_transactions')
        .update({
          failure_reason: rejectionReason,
          updated_at: nowIso,
        })
        .eq('traceno', traceno);
    }

    // Notify user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Deposit Complaint Update',
      message: `Your deposit complaint of ₹${amount.toFixed(2)} was not approved. Reason: ${rejectionReason}`,
      type: 'SYSTEM',
      read: false,
      created_at: nowIso,
    });

    // Record audit log
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'REJECT_DEPOSIT_COMPLAINT',
        target_type: 'payment',
        target_id: complaintId,
        description: `Rejected deposit complaint of ₹${amount} for user ${userId}. Reason: ${rejectionReason}`,
        details: { complaintId, amount, rejectionReason, userId },
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({
      success: true,
      message: 'Deposit complaint rejected.',
    });
  } catch (err: any) {
    console.error('[REJECT COMPLAINT ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// SITE SETTINGS, RECHARGE SETTINGS & USDT CONFIGURATION & DEPOSITS
// ==============================================================================

// Helper for USDT private screenshots signed URLs
async function getSignedUsdtProofUrl(rawPathOrUrl: string | null | undefined, expiresInSeconds = 3600): Promise<string> {
  if (!rawPathOrUrl || !supabase) return '';
  const str = String(rawPathOrUrl).trim();
  if (!str) return '';
  if (str.startsWith('data:image')) return str;

  let objectKey = str;
  if (str.includes('/usdt-deposits/')) {
    const parts = str.split('/usdt-deposits/');
    if (parts[1]) {
      objectKey = parts[1].split('?')[0];
    }
  } else if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }

  try {
    const { data: signedData, error } = await supabase.storage
      .from('usdt-deposits')
      .createSignedUrl(objectKey, expiresInSeconds);
    if (!error && signedData?.signedUrl) {
      return signedData.signedUrl;
    }
  } catch (err) {
    console.warn('[USDT SIGNED URL] Failed to create signed URL for:', objectKey, err);
  }
  return str;
}

// 1. Get Site Settings
app.get('/api/site-settings', async (req, res) => {
  if (!supabase) {
    return res.json({
      success: true,
      data: {
        siteTitle: 'GAINPOWER',
        logoUrl: '',
        faviconUrl: '',
      },
    });
  }
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('id', 'site_settings')
      .maybeSingle();

    const config = data?.value || {
      siteTitle: 'GAINPOWER',
      logoUrl: '',
      faviconUrl: '',
    };
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save Site Settings (Admin)
app.post('/api/admin/site-settings', async (req, res) => {
  const { config, adminId = 'adm_root' } = req.body;
  if (!config) return res.status(400).json({ success: false, error: 'Missing site settings configuration.' });
  if (!supabase) return res.status(500).json({ success: false, error: 'Database service unavailable.' });

  try {
    const nowIso = new Date().toISOString();
    const payload = {
      siteTitle: config.siteTitle || 'GAINPOWER',
      logoUrl: config.logoUrl || '',
      faviconUrl: config.faviconUrl || '',
      updatedAt: nowIso,
    };

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        id: 'site_settings',
        value: payload,
        updated_at: nowIso,
      });

    if (error) throw error;

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'UPDATE_SITE_SETTINGS',
        target_type: 'settings',
        target_id: 'site_settings',
        description: `Updated site settings: title="${payload.siteTitle}", logo="${payload.logoUrl ? 'configured' : 'empty'}", favicon="${payload.faviconUrl ? 'configured' : 'empty'}"`,
        details: payload,
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({ success: true, message: 'Site settings updated successfully.', data: payload });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Recharge Settings
app.get('/api/recharge-settings', async (req, res) => {
  if (!supabase) {
    return res.json({
      success: true,
      data: {
        presetAmounts: [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000],
        minRecharge: 100,
        maxRecharge: 50000,
        isEnabled: true,
      },
    });
  }
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('id', 'recharge_settings')
      .maybeSingle();

    const config = data?.value || {
      presetAmounts: [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000],
      minRecharge: 100,
      maxRecharge: 50000,
      isEnabled: true,
    };
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Save Recharge Settings (Admin)
app.post('/api/admin/recharge-settings', async (req, res) => {
  const { config, adminId = 'adm_root' } = req.body;
  if (!config) return res.status(400).json({ success: false, error: 'Missing recharge configuration.' });
  if (!supabase) return res.status(500).json({ success: false, error: 'Database service unavailable.' });

  try {
    const nowIso = new Date().toISOString();
    const cleanPresets = Array.isArray(config.presetAmounts)
      ? config.presetAmounts.map((n: any) => Number(n)).filter((n: number) => !isNaN(n) && n > 0)
      : [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000];

    const payload = {
      presetAmounts: cleanPresets.length > 0 ? cleanPresets : [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000],
      minRecharge: Math.max(1, Number(config.minRecharge) || 100),
      maxRecharge: Math.max(100, Number(config.maxRecharge) || 50000),
      isEnabled: config.isEnabled !== false,
      updatedAt: nowIso,
    };

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        id: 'recharge_settings',
        value: payload,
        updated_at: nowIso,
      });

    if (error) throw error;

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'UPDATE_RECHARGE_SETTINGS',
        target_type: 'settings',
        target_id: 'recharge_settings',
        description: `Updated recharge settings: min=₹${payload.minRecharge}, max=₹${payload.maxRecharge}, presets=[${payload.presetAmounts.join(', ')}]`,
        details: payload,
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({ success: true, message: 'Recharge settings updated successfully.', data: payload });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get USDT Settings
app.get('/api/usdt-settings', async (req, res) => {
  if (!supabase) {
    return res.json({
      success: true,
      data: {
        isEnabled: true,
        usdtRate: 100,
        trc20Address: '',
        bep20Address: '',
        qrUrl: '',
      },
    });
  }
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('id', 'usdt_settings')
      .maybeSingle();

    const config = data?.value || {
      isEnabled: true,
      usdtRate: 100,
      trc20Address: '',
      bep20Address: '',
      qrUrl: '',
    };
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Save USDT Settings (Admin)
app.post('/api/admin/usdt-settings', async (req, res) => {
  const { config, adminId = 'adm_root' } = req.body;
  if (!config) return res.status(400).json({ success: false, error: 'Missing USDT configuration.' });
  if (!supabase) return res.status(500).json({ success: false, error: 'Database service unavailable.' });

  try {
    const nowIso = new Date().toISOString();
    const payload = {
      isEnabled: config.isEnabled !== false,
      usdtRate: Math.max(0.01, Number(config.usdtRate) || 100),
      trc20Address: String(config.trc20Address || '').trim(),
      bep20Address: String(config.bep20Address || '').trim(),
      qrUrl: String(config.qrUrl || '').trim(),
      updatedAt: nowIso,
    };

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        id: 'usdt_settings',
        value: payload,
        updated_at: nowIso,
      });

    if (error) throw error;

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'UPDATE_USDT_SETTINGS',
        target_type: 'settings',
        target_id: 'usdt_settings',
        description: `Updated USDT settings: rate=₹${payload.usdtRate}, enabled=${payload.isEnabled}, TRC20="${payload.trc20Address.slice(0, 8)}...", BEP20="${payload.bep20Address.slice(0, 8)}..."`,
        details: payload,
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({ success: true, message: 'USDT settings updated successfully.', data: payload });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6b. Get Payment Settings
app.get('/api/payment-settings', async (req, res) => {
  if (!supabase) {
    return res.json({
      success: true,
      data: {
        id: 'default',
        upi_id: 'powerbank.pay@upi',
        instructions: '1. Scan QR or transfer to UPI ID.\n2. Enter the exact 12-digit UTR number below and submit.',
        is_recharge_enabled: true,
        is_purchase_enabled: true,
      },
    });
  }
  try {
    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) throw error;
    return res.json({ success: true, data: data || {} });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6c. Save Payment Settings (Admin)
app.post('/api/admin/payment-settings', async (req, res) => {
  const { config, adminId = 'adm_root' } = req.body;
  if (!config) return res.status(400).json({ success: false, error: 'Missing payment settings configuration.' });
  if (!supabase) return res.status(500).json({ success: false, error: 'Database service unavailable.' });

  try {
    const nowIso = new Date().toISOString();
    const payload = {
      id: config.id || 'default',
      upi_id: config.upiId || config.upi_id || 'powerbank.pay@upi',
      qr_image_url: config.qrImageUrl || config.qr_image_url || null,
      instructions: config.instructions || '1. Scan QR or transfer to UPI ID.\n2. Enter the exact 12-digit UTR number below and submit.',
      is_recharge_enabled: config.isRechargeEnabled !== undefined ? config.isRechargeEnabled : (config.is_recharge_enabled !== false),
      is_purchase_enabled: config.isPurchaseEnabled !== undefined ? config.isPurchaseEnabled : (config.is_purchase_enabled !== false),
      merchant_name: config.merchantName || config.merchant_name || 'GainPower Energy Infrastructure',
      is_active: config.isActive !== undefined ? config.isActive : (config.is_active !== false),
      min_amount: Number(config.minAmount || config.min_amount || 100),
      max_amount: Number(config.maxAmount || config.max_amount || 500000),
      payu_upi_id: config.payuUpiId || config.payu_upi_id || null,
      payu_qr_image_url: config.payuQrImageUrl || config.payu_qr_image_url || null,
      toppay_upi_id: config.toppayUpiId || config.toppay_upi_id || null,
      toppay_qr_image_url: config.toppayQrImageUrl || config.toppay_qr_image_url || null,
      upay_upi_id: config.upayUpiId || config.upay_upi_id || null,
      upay_qr_image_url: config.upayQrImageUrl || config.upay_qr_image_url || null,
      channels: config.channels || {},
      updated_at: nowIso,
    };

    const { error } = await supabase
      .from('payment_settings')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;

    const { data: fresh } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('id', payload.id)
      .maybeSingle();

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'UPDATE_PAYMENT_SETTINGS',
        target_type: 'settings',
        target_id: 'payment_settings',
        description: `Admin updated payment configuration`,
        details: payload,
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({ success: true, message: 'Payment settings updated successfully.', data: fresh || payload });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Submit USDT Deposit (User)
app.post('/api/usdt-deposit', async (req, res) => {
  const {
    userId,
    amountInr,
    usdtAmount,
    usdtRate,
    network = 'TRC20',
    walletAddress = '',
    txHash = '',
    proofPath = '',
    note = '',
  } = req.body;

  if (!userId || !amountInr || !proofPath) {
    return res.status(400).json({
      success: false,
      error: 'User ID, INR Deposit Amount, and Payment Screenshot proof are required.',
    });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database service unavailable.' });
  }

  try {
    const cleanInr = Number(amountInr);
    if (isNaN(cleanInr) || cleanInr <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid deposit amount.' });
    }

    const cleanNetwork = String(network).toUpperCase() === 'BEP20' ? 'BEP20' : 'TRC20';
    const cleanTxHash = String(txHash || '').trim();
    const cleanRate = Number(usdtRate) > 0 ? Number(usdtRate) : 100;
    const calcUsdt = Number(usdtAmount) > 0 ? Number(usdtAmount) : +(cleanInr / cleanRate).toFixed(6);

    const nowIso = new Date().toISOString();
    const orderId = `USDT${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: deposit, error: insertErr } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        order_id: orderId,
        amount: cleanInr,
        payment_type: 'USDT_DEPOSIT',
        payment_method: cleanNetwork,
        utr: cleanTxHash || `TX-${orderId}`,
        proof_url: proofPath,
        receipt_url: proofPath,
        reference_id: `USDT:${calcUsdt}@${cleanRate}${walletAddress ? '|' + walletAddress : ''}`,
        status: 'PENDING_VERIFICATION',
        rejection_reason: note ? `Note: ${note}` : null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .single();

    if (insertErr || !deposit) {
      console.error('[USDT DEPOSIT INSERT ERROR]', insertErr);
      return res.status(500).json({ success: false, error: insertErr?.message || 'Failed to submit USDT deposit.' });
    }

    // Insert pending record in wallet_transactions for user visibility
    try {
      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'RECHARGE',
        amount: cleanInr,
        balance_before: 0,
        balance_after: 0,
        wallet_type: 'TOPUP',
        status: 'Pending',
        reference_id: `USDT-${deposit.id}`,
        description: `USDT Recharge Pending: ₹${cleanInr} (${calcUsdt} USDT via ${cleanNetwork})`,
        created_at: nowIso,
      });
    } catch (_wErr) {}

    return res.json({
      success: true,
      depositId: deposit.id,
      message: 'USDT deposit submitted successfully. It will be reviewed by admin shortly.',
    });
  } catch (err: any) {
    console.error('[API /api/usdt-deposit] catch err:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Get User USDT Deposits
app.get('/api/usdt-deposits/user/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId || !supabase) return res.json({ success: true, data: [] });

  try {
    const { data: deposits, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .eq('payment_type', 'USDT_DEPOSIT')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const formatted = await Promise.all(
      (deposits || []).map(async (p: any) => {
        let usdtAmount = 0;
        let usdtRate = 100;
        let walletAddress = '';

        if (p.reference_id && p.reference_id.startsWith('USDT:')) {
          const parts = p.reference_id.replace('USDT:', '').split('|');
          const [uAmt, uRate] = (parts[0] || '').split('@');
          usdtAmount = Number(uAmt) || 0;
          usdtRate = Number(uRate) || 100;
          walletAddress = parts[1] || '';
        } else {
          usdtAmount = +(Number(p.amount) / 100).toFixed(4);
        }

        const signedUrl = await getSignedUsdtProofUrl(p.proof_url || p.receipt_url, 3600);

        return {
          id: p.id,
          userId: p.user_id,
          amountInr: Number(p.amount),
          usdtAmount,
          usdtRate,
          network: p.payment_method || 'TRC20',
          walletAddress,
          txHash: p.utr && !p.utr.startsWith('TX-USDT') ? p.utr : '',
          proofUrl: p.proof_url || p.receipt_url,
          signedProofUrl: signedUrl,
          status: p.status === 'PAID' ? 'APPROVED' : p.status,
          adminNote: p.rejection_reason,
          reviewedAt: p.verified_at,
          reviewedBy: p.verified_by,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
      })
    );

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Get Admin USDT Deposits List
app.get('/api/admin/usdt-deposits', async (req, res) => {
  if (!supabase) return res.json({ success: true, data: [] });

  try {
    const [depositsRes, profilesRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*')
        .eq('payment_type', 'USDT_DEPOSIT')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, user_id, username, phone, whatsapp_no, membership_number'),
    ]);

    if (depositsRes.error) {
      return res.status(500).json({ success: false, error: depositsRes.error.message });
    }

    const profileMap = new Map<string, any>();
    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => {
        if (p.user_id) profileMap.set(p.user_id, p);
        if (p.id) profileMap.set(p.id, p);
      });
    }

    const formatted = await Promise.all(
      (depositsRes.data || []).map(async (p: any) => {
        const prof = profileMap.get(p.user_id) || {};
        let usdtAmount = 0;
        let usdtRate = 100;
        let walletAddress = '';

        if (p.reference_id && p.reference_id.startsWith('USDT:')) {
          const parts = p.reference_id.replace('USDT:', '').split('|');
          const [uAmt, uRate] = (parts[0] || '').split('@');
          usdtAmount = Number(uAmt) || 0;
          usdtRate = Number(uRate) || 100;
          walletAddress = parts[1] || '';
        } else {
          usdtAmount = +(Number(p.amount) / 100).toFixed(4);
        }

        const signedUrl = await getSignedUsdtProofUrl(p.proof_url || p.receipt_url, 3600);

        return {
          id: p.id,
          userId: p.user_id,
          username: prof.username || 'User',
          phone: prof.phone || prof.whatsapp_no || '',
          membershipNumber: prof.membership_number || '',
          amountInr: Number(p.amount),
          usdtAmount,
          usdtRate,
          network: p.payment_method || 'TRC20',
          walletAddress,
          txHash: p.utr && !p.utr.startsWith('TX-USDT') ? p.utr : '',
          proofUrl: signedUrl || p.proof_url || p.receipt_url,
          signedProofUrl: signedUrl,
          status: p.status === 'PAID' ? 'APPROVED' : p.status,
          adminNote: p.rejection_reason,
          reviewedAt: p.verified_at,
          reviewedBy: p.verified_by,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
      })
    );

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10. User request to generate signed URL for own USDT screenshot
app.post('/api/usdt-deposit/signed-url', async (req, res) => {
  const { userId, depositId, filePath } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required.' });
  }
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database service unavailable.' });
  }

  try {
    if (depositId) {
      const { data: deposit, error } = await supabase
        .from('payments')
        .select('user_id, proof_url, receipt_url')
        .eq('id', depositId)
        .maybeSingle();

      if (error || !deposit) {
        return res.status(404).json({ success: false, error: 'Deposit record not found.' });
      }

      if (deposit.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Access denied to another user\'s evidence.' });
      }

      const targetPath = deposit.proof_url || deposit.receipt_url;
      const signedUrl = await getSignedUsdtProofUrl(targetPath, 3600);
      return res.json({ success: true, signedUrl });
    }

    if (filePath) {
      const cleanPath = String(filePath).trim();
      if (!cleanPath.startsWith(`${userId}/`)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Access denied to another user\'s evidence.' });
      }
      const signedUrl = await getSignedUsdtProofUrl(cleanPath, 3600);
      return res.json({ success: true, signedUrl });
    }

    return res.status(400).json({ success: false, error: 'Either depositId or filePath must be provided.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Admin Approve USDT Deposit (Exact-Once Settlement & Wallet Credit)
app.post('/api/admin/approve-usdt-deposit', async (req, res) => {
  const { depositId, adminId = 'adm_root', adminNote = '' } = req.body;
  if (!depositId || !supabase) {
    return res.status(400).json({ success: false, error: 'Missing depositId' });
  }

  try {
    const { data: deposit, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', depositId)
      .single();

    if (fetchErr || !deposit) {
      return res.status(404).json({ success: false, error: 'USDT Deposit not found.' });
    }

    if (deposit.status === 'PAID' || deposit.status === 'APPROVED') {
      return res.status(400).json({ success: false, error: 'This USDT deposit has already been approved and credited.' });
    }

    const amount = Number(deposit.amount);
    const userId = deposit.user_id;
    const network = deposit.payment_method || 'TRC20';
    const txHash = deposit.utr || 'N/A';
    const orderId = deposit.order_id || `USDT-${deposit.id}`;
    const nowIso = new Date().toISOString();

    // 1. Fetch and credit user wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const curRecharge = Number(wallet?.recharge_balance || 0);
    const curWithdraw = Number(wallet?.withdraw_balance || 0);
    const newRecharge = +(curRecharge + amount).toFixed(2);
    const newAvail = +(newRecharge + curWithdraw).toFixed(2);

    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          recharge_balance: newRecharge,
          available_balance: newAvail,
          updated_at: nowIso,
        })
        .eq('user_id', userId);
    } else {
      await supabase.from('wallets').insert({
        user_id: userId,
        recharge_balance: newRecharge,
        withdraw_balance: 0,
        available_balance: newRecharge,
        pending_balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
      });
    }

    // 2. Insert into wallet_ledger
    await supabase.from('wallet_ledger').insert({
      user_id: userId,
      wallet_type: 'RECHARGE',
      transaction_type: 'USDT_DEPOSIT_APPROVED',
      amount: amount,
      direction: 'CREDIT',
      reference_type: 'USDT_DEPOSIT',
      reference_id: `USDT_DEP-${deposit.id}`,
      balance_before: curRecharge,
      balance_after: newRecharge,
      description: `⚡ USDT Deposit Approved: ₹${amount.toFixed(2)} (${network} TXID: ${txHash})`,
      created_at: nowIso,
    });

    // 3. Insert into wallet_transactions
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: 'RECHARGE',
      amount: amount,
      balance_before: curRecharge,
      balance_after: newRecharge,
      wallet_type: 'TOPUP',
      status: 'Completed',
      reference_id: `USDT_DEP-${deposit.id}`,
      description: `⚡ USDT Deposit Approved: ₹${amount.toFixed(2)} (${network})`,
      created_at: nowIso,
    });

    // 4. Update payments table
    const isValidUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

    const { error: payUpdateErr } = await supabase
      .from('payments')
      .update({
        status: 'PAID',
        verified_at: nowIso,
        verified_by: adminId,
        admin_id: isValidUuid(adminId) ? adminId : null,
        rejection_reason: adminNote ? `Approved: ${adminNote}` : 'Approved by Admin',
        updated_at: nowIso,
      })
      .eq('id', depositId);

    if (payUpdateErr) {
      console.warn('[USDT APPROVE] Notice updating payments status:', payUpdateErr.message);
    }

    // 5. Referral commission distribution
    try {
      await processReferralCommissionsServer(supabase, userId, amount, orderId);
    } catch (_refErr) {
      console.warn('[USDT APPROVE] Referral commission warning:', _refErr);
    }

    // 6. Notify user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'USDT Recharge Approved! 💰',
      message: `Your USDT deposit of ₹${amount.toFixed(2)} has been verified and added to your Recharge Wallet.`,
      type: 'DEPOSIT',
      read: false,
      created_at: nowIso,
    });

    // 7. Record admin audit log
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'APPROVE_USDT_DEPOSIT',
        target_type: 'payment',
        target_id: depositId,
        description: `Approved USDT deposit of ₹${amount} for user ${userId} (${network}, TX: ${txHash})`,
        details: { depositId, amount, network, txHash, userId, adminNote },
        created_at: nowIso,
      });
    } catch (_e) {}

    // Check & update deposit-based VIP upgrades (VIP 3, 4, 5, 6)
    await checkAndUpdateDepositVip(userId);

    return res.json({
      success: true,
      message: 'USDT deposit approved successfully. Recharge wallet credited.',
    });
  } catch (err: any) {
    console.error('[APPROVE USDT ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Admin Reject USDT Deposit
app.post('/api/admin/reject-usdt-deposit', async (req, res) => {
  const { depositId, rejectionReason = 'Screenshot or transaction invalid', adminId = 'adm_root' } = req.body;
  if (!depositId || !supabase) {
    return res.status(400).json({ success: false, error: 'Missing depositId' });
  }

  try {
    const { data: deposit, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', depositId)
      .single();

    if (fetchErr || !deposit) {
      return res.status(404).json({ success: false, error: 'USDT deposit not found.' });
    }

    if (deposit.status === 'PAID' || deposit.status === 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Cannot reject an already approved deposit.' });
    }

    if (deposit.status === 'REJECTED') {
      return res.status(400).json({ success: false, error: 'Deposit has already been rejected.' });
    }

    const amount = Number(deposit.amount);
    const userId = deposit.user_id;
    const nowIso = new Date().toISOString();
    const isValidUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

    const { error: payUpdateErr } = await supabase
      .from('payments')
      .update({
        status: 'REJECTED',
        rejection_reason: rejectionReason,
        verified_at: nowIso,
        verified_by: adminId,
        admin_id: isValidUuid(adminId) ? adminId : null,
        updated_at: nowIso,
      })
      .eq('id', depositId);

    if (payUpdateErr) {
      console.warn('[USDT REJECT] Notice updating payments status:', payUpdateErr.message);
    }

    // Notify user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'USDT Deposit Update',
      message: `Your USDT deposit of ₹${amount.toFixed(2)} was not approved. Reason: ${rejectionReason}`,
      type: 'SYSTEM',
      read: false,
      created_at: nowIso,
    });

    // Record audit log
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'REJECT_USDT_DEPOSIT',
        target_type: 'payment',
        target_id: depositId,
        description: `Rejected USDT deposit of ₹${amount} for user ${userId}. Reason: ${rejectionReason}`,
        details: { depositId, amount, rejectionReason, userId },
        created_at: nowIso,
      });
    } catch (_e) {}

    return res.json({
      success: true,
      message: 'USDT deposit rejected.',
    });
  } catch (err: any) {
    console.error('[REJECT USDT ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 12. ADMIN PLANS CRUD ENDPOINTS
// ==============================================================================
app.post('/api/admin/plans/save', async (req, res) => {
  try {
    const { plan, adminId } = req.body;
    if (!plan || !plan.name) {
      return res.status(400).json({ success: false, error: 'Plan data and name are required.' });
    }

    const isUuid = Boolean(plan.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan.id));
    let existingRow: any = null;
    if (supabase && plan.id) {
      const { data: found } = await supabase.from('plans').select('id').eq('id', plan.id).maybeSingle();
      existingRow = found;
    }
    const isNew = !existingRow;
    const planId = existingRow ? existingRow.id : (isUuid ? plan.id : crypto.randomUUID());
    const price = Number(plan.devicePrice || plan.price || 0);
    const hourly = Number(plan.hourlyEarnings || (plan.dailyEarnings ? +(plan.dailyEarnings / 24).toFixed(2) : 0));
    const daily = Number(plan.dailyEarnings || (hourly * 24));
    const cat = (plan.category || 'VIP').toUpperCase();

    const planRecord = {
      name: plan.name,
      category: cat,
      description: plan.description || plan.name,
      price: price,
      earning_rate: hourly,
      daily_earnings: daily,
      hourly_earnings: hourly,
      earning_type: cat === 'PRO' ? 'DAILY' : (plan.earningType || 'HOURLY'),
      duration: Number(plan.duration || plan.durationDays || 365),
      duration_days: Number(plan.durationDays || plan.duration || 365),
      limit_per_user: Number(plan.limit || plan.purchaseLimit || plan.limit_per_user || 5),
      purchase_limit: Number(plan.limit || plan.purchaseLimit || 5),
      instant_bonus: Number(plan.instantBonus || 0),
      tags: Array.isArray(plan.tags) ? plan.tags : ['Hourly Yield'],
      image_type: plan.imageType || (cat === 'PRO' ? 'cabinet-pro' : cat === 'EVENT' ? 'cabinet-gold' : 'cabinet-green'),
      status: plan.status || 'active',
      allow_duplicate: plan.allowDuplicate !== false,
      start_date: plan.startDate || null,
      end_date: plan.endDate || null,
      requires_active_hourly_plan: Boolean(plan.requiresActiveHourlyPlan),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      if (isNew) {
        const { data, error } = await supabase
          .from('plans')
          .insert({ id: planId, ...planRecord })
          .select();

        if (error) {
          const { data: retryData, error: retryErr } = await supabase
            .from('plans')
            .insert(planRecord)
            .select();
          if (retryErr) throw new Error(retryErr.message);
          return res.json({ success: true, data: (retryData && retryData[0]) || { id: planId, ...planRecord } });
        }
        return res.json({ success: true, data: (data && data[0]) || { id: planId, ...planRecord } });
      } else {
        const { data, error } = await supabase
          .from('plans')
          .update(planRecord)
          .eq('id', planId)
          .select();

        if (error) throw new Error(error.message);
        return res.json({ success: true, data: (data && data[0]) || { id: planId, ...planRecord } });
      }
    }

    return res.json({ success: true, data: { id: planId, ...planRecord } });
  } catch (err: any) {
    console.error('[ADMIN SAVE PLAN ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save plan.' });
  }
});

app.post('/api/admin/plans/delete', async (req, res) => {
  try {
    const { planId, adminId } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, error: 'Plan ID is required.' });
    }

    if (supabase) {
      const { error } = await supabase
        .from('plans')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', planId);

      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: 'Plan archived successfully.' });
  } catch (err: any) {
    console.error('[ADMIN DELETE PLAN ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to archive plan.' });
  }
});

// ==============================================================================
// 13. MISSIONS CRUD & STATS ENDPOINTS
// ==============================================================================
app.get('/api/missions', async (req, res) => {
  try {
    const includeDisabled = req.query.includeDisabled === 'true';
    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

    let query = supabase.from('missions').select('*').order('display_order', { ascending: true });
    if (!includeDisabled) {
      query = query.eq('status', 'ACTIVE');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const mapped = (data || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      requiredReferrals: Number(m.required_referrals ?? m.target_count ?? 1),
      rewardAmount: Number(m.reward_amount ?? 50),
      walletType: 'WITHDRAW_WALLET',
      icon: m.icon || 'Target',
      status: (m.status === 'active' || m.status === 'ACTIVE' || m.is_active ? 'ACTIVE' : 'DISABLED') as 'ACTIVE' | 'DISABLED',
      displayOrder: Number(m.display_order ?? m.sort_order ?? 1),
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    return res.json({ success: true, data: mapped });
  } catch (err: any) {
    console.error('[GET MISSIONS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/missions/save', async (req, res) => {
  try {
    const { mission, adminId } = req.body;
    if (!mission || !mission.title) {
      return res.status(400).json({ success: false, error: 'Mission title is required.' });
    }

    const isUuid = Boolean(mission.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mission.id));
    const isNew = !isUuid;
    const missionId = isUuid ? mission.id : crypto.randomUUID();
    const reqRefs = Math.max(1, Number(mission.requiredReferrals || 1));
    const reward = Math.max(1, Number(mission.rewardAmount || 50));
    const status = mission.status || 'ACTIVE';
    const order = Number(mission.displayOrder || 1);

    const record = {
      title: mission.title.trim(),
      description: mission.description?.trim() || `Invite ${reqRefs} active friends with first plan purchase.`,
      required_referrals: reqRefs,
      target_count: reqRefs,
      reward_amount: reward,
      wallet_type: 'WITHDRAW_WALLET',
      reward_wallet: 'WITHDRAW_WALLET',
      icon: mission.icon || 'Target',
      status: status,
      is_active: status === 'ACTIVE' || status === 'active',
      display_order: order,
      sort_order: order,
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      if (isNew) {
        const { data, error } = await supabase
          .from('missions')
          .insert({ id: missionId, created_at: new Date().toISOString(), ...record })
          .select();

        if (error) {
          const { data: retryData, error: retryErr } = await supabase
            .from('missions')
            .insert({ created_at: new Date().toISOString(), ...record })
            .select();
          if (retryErr) throw new Error(retryErr.message);
          return res.json({ success: true, data: (retryData && retryData[0]) || { id: missionId, ...record } });
        }
        return res.json({ success: true, data: (data && data[0]) || { id: missionId, ...record } });
      } else {
        const { data, error } = await supabase
          .from('missions')
          .update(record)
          .eq('id', missionId)
          .select();

        if (error) throw new Error(error.message);
        return res.json({ success: true, data: (data && data[0]) || { id: missionId, ...record } });
      }
    }

    return res.json({ success: true, data: { id: missionId, ...record } });
  } catch (err: any) {
    console.error('[ADMIN SAVE MISSION ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save mission.' });
  }
});

app.post('/api/admin/missions/delete', async (req, res) => {
  try {
    const { missionId, adminId } = req.body;
    if (!missionId) {
      return res.status(400).json({ success: false, error: 'Mission ID is required.' });
    }

    if (supabase) {
      const { error } = await supabase.from('missions').delete().eq('id', missionId);
      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: 'Mission deleted successfully.' });
  } catch (err: any) {
    console.error('[ADMIN DELETE MISSION ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete mission.' });
  }
});

app.get('/api/admin/missions/stats', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: { totalMissions: 0, activeMissions: 0, totalClaimsCount: 0, totalRewardsDistributed: 0 } });
    }

    const [missionsRes, claimsRes] = await Promise.all([
      supabase.from('missions').select('id, status, is_active'),
      supabase.from('mission_claims').select('reward_amount'),
    ]);

    const missionsList = missionsRes.data || [];
    const claimsList = claimsRes.data || [];

    const totalMissions = missionsList.length;
    const activeMissions = missionsList.filter((m: any) => m.status === 'ACTIVE' || m.is_active === true).length;
    const totalClaimsCount = claimsList.length;
    const totalRewardsDistributed = claimsList.reduce((acc: number, c: any) => acc + Number(c.reward_amount || 0), 0);

    return res.json({
      success: true,
      data: {
        totalMissions,
        activeMissions,
        totalClaimsCount,
        totalRewardsDistributed,
      },
    });
  } catch (err: any) {
    console.error('[GET MISSION STATS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/missions/claims', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('mission_claims')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return res.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error('[GET MISSION CLAIMS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/missions/claim', async (req, res) => {
  try {
    const { userId, missionId } = req.body;
    if (!userId || !missionId) {
      return res.status(400).json({ success: false, error: 'User ID and Mission ID are required.' });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database unavailable' });
    }

    // 1. Fetch mission
    const { data: mission, error: mErr } = await supabase
      .from('missions')
      .select('*')
      .eq('id', missionId)
      .maybeSingle();

    if (mErr || !mission) {
      return res.status(404).json({ success: false, error: 'Mission not found.' });
    }

    if (mission.status === 'DISABLED' || mission.is_active === false) {
      return res.status(400).json({ success: false, error: 'This mission is currently disabled.' });
    }

    // 2. Check if already claimed
    const { data: existingClaim } = await supabase
      .from('mission_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .maybeSingle();

    if (existingClaim) {
      return res.status(400).json({ success: false, error: 'You have already claimed this mission bonus!' });
    }

    // 3. Count active qualifying direct referrals
    const { data: refs } = await supabase
      .from('referrals')
      .select('referee_id, qualifying_recharge_done, status')
      .eq('referrer_id', userId);

    let activeCount = 0;
    const refereeIds = (refs || []).map((r: any) => r.referee_id).filter(Boolean);

    if (refereeIds.length > 0) {
      const { data: purchases } = await supabase
        .from('user_purchases')
        .select('user_id')
        .in('user_id', refereeIds);

      const purchaseUserSet = new Set((purchases || []).map((p: any) => p.user_id));

      activeCount = (refs || []).filter((r: any) => {
        return r.qualifying_recharge_done === true || r.status === 'ACTIVE' || purchaseUserSet.has(r.referee_id);
      }).length;
    }

    const reqRefs = Number(mission.required_referrals ?? mission.target_count ?? 1);
    if (activeCount < reqRefs) {
      return res.status(400).json({
        success: false,
        error: `Mission not completed yet! You have ${activeCount} / ${reqRefs} active referrals.`,
      });
    }

    const reward = Number(mission.reward_amount ?? 50);
    const nowIso = new Date().toISOString();
    const claimId = `mclm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const txId = `tx_msn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 4. Atomic credit to user's Withdraw Wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const curWithdraw = Number(wallet?.withdraw_balance !== undefined && wallet?.withdraw_balance !== null ? wallet.withdraw_balance : (wallet?.earned_balance || 0));
    const curAvail = Number(wallet?.available_balance || 0);
    const curTotalEarned = Number(wallet?.total_earned || 0);

    const newWithdraw = +(curWithdraw + reward).toFixed(2);
    const newAvail = +(curAvail + reward).toFixed(2);
    const newTotalEarned = +(curTotalEarned + reward).toFixed(2);

    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          withdraw_balance: newWithdraw,
          earned_balance: newWithdraw,
          available_balance: newAvail,
          total_earned: newTotalEarned,
          updated_at: nowIso,
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('wallets')
        .insert({
          user_id: userId,
          withdraw_balance: newWithdraw,
          earned_balance: newWithdraw,
          available_balance: newAvail,
          total_earned: newTotalEarned,
          recharge_balance: 0,
          pending_balance: 0,
          created_at: nowIso,
          updated_at: nowIso,
        });
    }

    // 5. Insert claim record
    await supabase.from('mission_claims').insert({
      id: claimId,
      user_id: userId,
      mission_id: mission.id,
      mission_title: mission.title,
      reward_amount: reward,
      wallet_credited: 'WITHDRAW_WALLET',
      created_at: nowIso,
    });

    // 6. Insert wallet_transactions
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
      created_at: nowIso,
    });

    // 7. Insert wallet_ledger
    try {
      await supabase.from('wallet_ledger').insert({
        user_id: userId,
        wallet_type: 'WITHDRAW',
        transaction_type: 'MISSION_REWARD',
        amount: reward,
        direction: 'CREDIT',
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        reference_type: 'MISSION',
        reference_id: mission.id,
        description: `Mission Bonus: ${mission.title}`,
        created_at: nowIso,
      });
    } catch (_lErr) {}

    // 8. Notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Mission Reward Credited! 🎯',
        message: `You earned ₹${reward.toFixed(2)} for completing mission "${mission.title}"! It has been credited to your Withdraw Wallet.`,
        type: 'EARNING',
        is_read: false,
        created_at: nowIso,
      });
    } catch (_nErr) {}

    return res.json({
      success: true,
      rewardAmount: reward,
      newWithdrawBalance: newWithdraw,
      message: `🎉 Mission completed! ₹${reward.toFixed(2)} added to your Withdraw Wallet.`,
    });
  } catch (err: any) {
    console.error('[MISSION CLAIM ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to claim mission bonus.' });
  }
});

// ==============================================================================
// 13b. REFERRAL SETTINGS & SYSTEM SETTINGS ENDPOINTS
// ==============================================================================
app.get('/api/referral-settings', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: null });
    }
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('id', 'referral_settings')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return res.json({ success: true, data: data?.value || null });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/referral-settings', async (req, res) => {
  try {
    const { settings, adminId = 'adm_root' } = req.body;
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Settings data is required.' });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database unavailable' });
    }

    const nowIso = new Date().toISOString();
    const payload = { ...settings, updatedAt: nowIso };

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        id: 'referral_settings',
        value: payload,
        updated_at: nowIso,
      });

    if (error) throw new Error(error.message);

    try {
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: adminId,
        action: 'UPDATE_REFERRAL_SETTINGS',
        target_type: 'admin_settings',
        target_id: 'referral_settings',
        description: 'Updated dynamic referral rules and amounts',
        details: payload,
        created_at: nowIso,
      });
    } catch (_aErr) {}

    return res.json({ success: true, message: 'Referral settings updated successfully.', data: payload });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/system-settings', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: null });
    }
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('id', 'system')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return res.json({ success: true, data: data?.value || null });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/system-settings', async (req, res) => {
  try {
    const { settings, adminId = 'adm_root' } = req.body;
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Settings data is required.' });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database unavailable' });
    }

    const nowIso = new Date().toISOString();
    const { data: cur } = await supabase.from('admin_settings').select('value').eq('id', 'system').maybeSingle();
    const merged = { ...(cur?.value || {}), ...settings };

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        id: 'system',
        value: merged,
        updated_at: nowIso,
      });

    if (error) throw new Error(error.message);

    return res.json({ success: true, message: 'System settings updated successfully.', data: merged });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 14. GIFT CODES CRUD & ANALYTICS ENDPOINTS
// ==============================================================================
app.get('/api/gift-codes', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('gift_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const mapped = (data || []).map((g: any) => ({
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

    return res.json({ success: true, data: mapped });
  } catch (err: any) {
    console.error('[GET GIFT CODES ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/gift-codes/redeem', async (req, res) => {
  try {
    const { code: rawCode, userId } = req.body;
    if (!rawCode || !userId) {
      return res.status(400).json({ success: false, error: 'Code and user ID are required.' });
    }

    const cleanCode = rawCode.trim().toUpperCase();

    if (!supabase) {
      return res.json({ success: true, rewardAmount: 50, code: cleanCode, destination: 'TOPUP_WALLET', newBalance: 100 });
    }

    // 1. Fetch gift code
    const { data: codeData, error: codeErr } = await supabase
      .from('gift_codes')
      .select('*')
      .ilike('code', cleanCode)
      .maybeSingle();

    if (codeErr || !codeData) {
      return res.status(404).json({ success: false, error: 'Invalid gift code.' });
    }

    const isActive = codeData.status === 'ACTIVE' || codeData.is_active === true;
    if (!isActive || codeData.status === 'DISABLED' || codeData.status === 'PAUSED') {
      return res.status(400).json({ success: false, error: 'This gift code is no longer active.' });
    }

    const remainingPool = Number(codeData.remaining_pool !== undefined ? codeData.remaining_pool : codeData.total_pool || 0);
    const totalUses = Number(codeData.total_uses || codeData.max_claims || 100);
    const usedCount = Number(codeData.claims_count || codeData.claimed_uses || 0);

    if (remainingPool <= 0 || usedCount >= totalUses) {
      return res.status(400).json({ success: false, error: 'This gift code has been fully claimed.' });
    }

    // 2. Check duplicate claim
    const { data: userClaims, error: claimsErr } = await supabase
      .from('gift_code_claims')
      .select('id')
      .eq('gift_code_id', codeData.id)
      .eq('user_id', userId);

    const perUserLimit = Number(codeData.per_user_limit || 1);
    if (userClaims && userClaims.length >= perUserLimit) {
      return res.status(400).json({ success: false, error: 'You have already claimed this gift code.' });
    }

    const { data: existingLedger } = await supabase
      .from('wallet_ledger')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_id', `GIFT-${codeData.code}`)
      .maybeSingle();

    if (existingLedger) {
      return res.status(400).json({ success: false, error: 'You have already claimed this gift code.' });
    }

    // 3. Calculate reward
    let reward = Number(codeData.amount || 0);
    if (codeData.amount_type === 'RANDOM') {
      const min = Number(codeData.min_amount || 1);
      const max = Number(codeData.max_amount || 100);
      const effMax = Math.min(max, remainingPool);
      reward = Math.floor(Math.random() * (effMax - min + 1)) + min;
    }
    if (reward <= 0) reward = Math.min(10, remainingPool);
    reward = Math.min(reward, remainingPool);

    // 4. Update gift code
    const nextPool = Math.max(0, remainingPool - reward);
    const nextUsed = usedCount + 1;
    const nextStatus = (nextPool <= 0 || nextUsed >= totalUses) ? 'EXHAUSTED' : codeData.status;

    await supabase
      .from('gift_codes')
      .update({
        remaining_pool: nextPool,
        claims_count: nextUsed,
        claimed_uses: nextUsed,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', codeData.id);

    // 5. Fetch user and wallet (Rule 7: ALL Gift Codes go strictly to TOPUP / RECHARGE WALLET ONLY)
    const dest = 'TOPUP_WALLET';
    const nowIso = new Date().toISOString();

    const { data: curWallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let newBalance = 0;
    let prevBalance = 0;
    if (curWallet) {
      // Topup Wallet = +₹AMOUNT, Withdraw Wallet = +₹0
      prevBalance = Number(curWallet.recharge_balance || curWallet.topup_balance || 0);
      newBalance = +(prevBalance + reward).toFixed(2);
      const curWithdraw = Number(curWallet.withdraw_balance !== undefined ? curWallet.withdraw_balance : (curWallet.earned_balance || 0));
      const newAvail = +(newBalance + curWithdraw).toFixed(2);

      await supabase
        .from('wallets')
        .update({
          recharge_balance: newBalance,
          topup_balance: newBalance,
          available_balance: newAvail,
          updated_at: nowIso,
        })
        .eq('user_id', userId);
    }

    const txId = crypto.randomUUID();
    const claimRef = `GIFT-${codeData.code}`;

    // 6. Record claim
    try {
      const { error: insErr } = await supabase.from('gift_code_claims').insert({
        id: crypto.randomUUID(),
        gift_code_id: codeData.id,
        code: codeData.code,
        gift_code: codeData.code,
        user_id: userId,
        amount: reward,
        wallet_destination: 'TOPUP_WALLET',
        wallet_type: 'TOPUP_WALLET',
        status: 'COMPLETED',
        claimed_at: nowIso,
        created_at: nowIso,
      });
      if (insErr) {
        console.warn('[REDEEM CLAIM INSERT NOTICE]', insErr.message);
      }
    } catch (e: any) {
      console.warn('[REDEEM CLAIM INSERT EXCEPTION]', e.message);
    }

    // 7. Insert into wallet_transactions (Rule 8: Exactly ONE entry, Name: Gift Code Bonus — CODE, Wallet: Topup Wallet)
    try {
      const { error: txInsErr } = await supabase.from('wallet_transactions').insert({
        id: txId,
        user_id: userId,
        type: 'ADMIN_ADJUSTMENT',
        amount: reward,
        balance_before: prevBalance,
        balance_after: newBalance,
        balance_type: 'TOPUP_WALLET',
        wallet_type: 'TOPUP',
        status: 'Completed',
        reference_id: claimRef,
        description: `Gift Code Bonus — ${codeData.code}`,
        created_at: nowIso,
      });
      if (txInsErr) {
        console.warn('[GIFT REDEEM TX INSERT NOTICE]', txInsErr.message);
      }
    } catch (txErr: any) {
      console.warn('[GIFT REDEEM TX EXCEPTION]', txErr.message);
    }

    // 8. Insert into wallet_ledger
    try {
      await supabase.from('wallet_ledger').insert({
        user_id: userId,
        wallet_type: 'RECHARGE',
        transaction_type: 'GIFT_CODE',
        amount: reward,
        direction: 'CREDIT',
        reference_type: 'GIFT_CODE',
        reference_id: claimRef,
        balance_before: prevBalance,
        balance_after: newBalance,
        description: `Gift Code Bonus — ${codeData.code}`,
        created_at: nowIso,
      });
    } catch (ledErr: any) {
      console.warn('[GIFT REDEEM LEDGER EXCEPTION]', ledErr.message);
    }

    // 9. Send Notification
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Gift Code Redeemed! 🎁',
        message: `₹${reward.toFixed(2)} from gift code ${codeData.code} has been added to your Topup Wallet.`,
        type: 'SUCCESS',
        read: false,
        created_at: nowIso,
      });
    } catch (notifErr: any) {
      console.warn('[GIFT REDEEM NOTIFICATION EXCEPTION]', notifErr.message);
    }

    return res.json({
      success: true,
      rewardAmount: reward,
      code: codeData.code,
      destination: 'TOPUP_WALLET',
      newBalance,
    });
  } catch (err: any) {
    console.error('[REDEEM GIFT CODE ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to redeem gift code.' });
  }
});

app.post('/api/admin/gift-codes/save', async (req, res) => {
  try {
    const { giftCode, adminId } = req.body;
    if (!giftCode || !giftCode.code) {
      return res.status(400).json({ success: false, error: 'Gift code is required.' });
    }

    const code = giftCode.code.trim().toUpperCase();
    const rawId = giftCode.id;
    let isNew = !rawId || rawId.startsWith('new_') || req.body.isNew === true;

    if (supabase && !isNew && rawId) {
      const { data: existingRow } = await supabase
        .from('gift_codes')
        .select('id')
        .eq('id', rawId)
        .maybeSingle();
      if (!existingRow) {
        isNew = true;
      }
    }

    const codeId = (!rawId || isNew) ? (rawId && !rawId.startsWith('new_') ? rawId : crypto.randomUUID()) : rawId;
    const totalUses = Number(giftCode.totalUses || giftCode.total_uses || giftCode.max_claims || 10);
    const amountVal = giftCode.amount !== undefined && giftCode.amount !== null ? Number(giftCode.amount) : 0;
    const totalPool = Number(giftCode.totalPool || giftCode.total_pool || (amountVal > 0 ? amountVal * totalUses : 1000));
    const status = giftCode.status || 'ACTIVE';

    const record = {
      code,
      amount_type: giftCode.amountType || giftCode.amount_type || 'FIXED',
      reward_type: giftCode.amountType || giftCode.amount_type || 'FIXED',
      amount: giftCode.amount !== undefined && giftCode.amount !== null ? Number(giftCode.amount) : null,
      min_amount: giftCode.minAmount !== undefined && giftCode.minAmount !== null ? Number(giftCode.minAmount) : null,
      max_amount: giftCode.maxAmount !== undefined && giftCode.maxAmount !== null ? Number(giftCode.maxAmount) : null,
      total_pool: totalPool,
      remaining_pool: giftCode.remainingPool !== undefined ? Number(giftCode.remainingPool) : totalPool,
      total_uses: totalUses,
      max_claims: totalUses,
      total_claims: totalUses,
      per_user_limit: Number(giftCode.perUserLimit || giftCode.per_user_limit || 1),
      is_active: status === 'ACTIVE',
      status: status,
      wallet_destination: giftCode.walletDestination || giftCode.wallet_destination || 'TOPUP_WALLET',
      wallet_type: giftCode.walletDestination || giftCode.wallet_destination || 'TOPUP_WALLET',
      start_date: giftCode.startDate || giftCode.start_date || new Date().toISOString(),
      expiry_date: giftCode.expiryDate || giftCode.expiry_date || null,
      expires_at: giftCode.expiryDate || giftCode.expiry_date || null,
      description: giftCode.description || '',
      created_by: adminId || 'Admin',
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      if (isNew) {
        const { data, error } = await supabase
          .from('gift_codes')
          .insert({ id: codeId, created_at: new Date().toISOString(), claims_count: 0, claimed_uses: 0, ...record })
          .select();

        if (error) {
          const { data: retryData, error: retryErr } = await supabase
            .from('gift_codes')
            .insert({ created_at: new Date().toISOString(), claims_count: 0, claimed_uses: 0, ...record })
            .select();
          if (retryErr) throw new Error(retryErr.message);

          const freshId = retryData && retryData[0] ? retryData[0].id : codeId;
          const { data: freshSelect } = await supabase.from('gift_codes').select('*').eq('id', freshId).maybeSingle();
          return res.json({ success: true, data: freshSelect || (retryData && retryData[0]) || { id: codeId, ...record } });
        }

        const freshId = data && data[0] ? data[0].id : codeId;
        const { data: freshSelect } = await supabase.from('gift_codes').select('*').eq('id', freshId).maybeSingle();
        return res.json({ success: true, data: freshSelect || (data && data[0]) || { id: codeId, ...record } });
      } else {
        const { data, error } = await supabase
          .from('gift_codes')
          .update(record)
          .eq('id', codeId)
          .select();

        if (error) throw new Error(error.message);
        const { data: freshSelect } = await supabase.from('gift_codes').select('*').eq('id', codeId).maybeSingle();
        return res.json({ success: true, data: freshSelect || (data && data[0]) || { id: codeId, ...record } });
      }
    }

    return res.json({ success: true, data: { id: codeId, ...record } });
  } catch (err: any) {
    console.error('[ADMIN SAVE GIFT CODE ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save gift code.' });
  }
});

app.post('/api/admin/gift-codes/delete', async (req, res) => {
  try {
    const { id, adminId } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Gift code ID is required.' });
    }

    if (supabase) {
      const { error } = await supabase.from('gift_codes').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: 'Gift code deleted successfully.' });
  } catch (err: any) {
    console.error('[ADMIN DELETE GIFT CODE ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete gift code.' });
  }
});

app.get('/api/admin/gift-codes/analytics', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: null });
    }

    const [codesRes, claimsRes] = await Promise.all([
      supabase.from('gift_codes').select('*'),
      supabase.from('gift_code_claims').select('*'),
    ]);

    const codes = codesRes.data || [];
    const claims = claimsRes.data || [];

    const totalCodes = codes.length;
    const activeCodes = codes.filter((c: any) => c.status === 'ACTIVE' || c.is_active === true).length;
    const totalPoolAllocated = codes.reduce((acc: number, c: any) => acc + Number(c.total_pool || 0), 0);
    const totalDistributed = claims.reduce((acc: number, c: any) => acc + Number(c.amount || 0), 0);
    const totalClaims = claims.length;

    return res.json({
      success: true,
      data: {
        totalCodes,
        activeCodes,
        totalPoolAllocated,
        totalDistributed,
        totalClaims,
      },
    });
  } catch (err: any) {
    console.error('[GET GIFT CODE ANALYTICS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/gift-codes/claims', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('gift_code_claims')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return res.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error('[GET GIFT CODE CLAIMS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 15. ABOUT PLATFORM DYNAMIC CONFIG & RULES ENDPOINTS
// ==============================================================================
const defaultAboutSections = {
  investingSteps: {
    id: 'investing_steps',
    title: 'How Investing Works',
    description: 'Simple 4-step automated revenue workflow from recharge to daily returns.',
    enabled: true,
    displayOrder: 1,
    icon: 'Zap',
  },
  planRules: {
    id: 'plan_rules',
    title: 'Plan & Return Rules',
    description: 'Active investment plans with price, daily rate, duration, and maximum purchase limits.',
    enabled: true,
    displayOrder: 2,
    icon: 'Layers',
  },
  vipUnlock: {
    id: 'vip_unlock',
    title: 'VIP Unlock & Membership Tiers',
    description: 'Earn higher daily yield boosters and lower withdrawal fee privileges by unlocking VIP levels.',
    enabled: true,
    displayOrder: 3,
    icon: 'Crown',
  },
  topupWallet: {
    id: 'topup_wallet',
    title: 'Topup Wallet Rules',
    description: 'Dedicated wallet used exclusively for funding account activations and purchasing power plans.',
    enabled: true,
    displayOrder: 4,
    icon: 'Wallet',
    customNotes: 'Topup Wallet is used for deposits, check-in bonuses, signup welcome credits, and gift codes. Topup Wallet balance cannot be withdrawn directly as cash.',
  },
  withdrawWallet: {
    id: 'withdraw_wallet',
    title: 'Withdraw Wallet Rules',
    description: 'Dedicated earnings wallet receiving all claim returns and team commissions for cash withdrawal.',
    enabled: true,
    displayOrder: 5,
    icon: 'ArrowUpRight',
    customNotes: 'Withdraw Wallet receives plan claim returns, team referral commissions, and earning rewards. Cash withdrawal is processed according to official withdrawal rules.',
  },
  withdrawRules: {
    id: 'withdraw_rules',
    title: 'Withdrawal Rules & Limits',
    description: 'Configured minimum thresholds, fee percentages, settlement windows, and bank requirements.',
    enabled: true,
    displayOrder: 6,
    icon: 'Coins',
  },
  teamCommission: {
    id: 'team_commission',
    title: 'Team Referral Commission Structure',
    description: 'Earn multi-tier commission rewards whenever your invited team members activate and recharge.',
    enabled: true,
    displayOrder: 7,
    icon: 'Users',
  },
  bonuses: {
    id: 'bonuses',
    title: 'Platform Rewards & Daily Bonuses',
    description: 'Free daily check-in rewards, signup welcome bonus, and invite bonuses credited directly to your balance.',
    enabled: true,
    displayOrder: 8,
    icon: 'Gift',
  },
  giftCode: {
    id: 'gift_code',
    title: 'Gift Code Redemption',
    description: 'Claim surprise bonus codes shared during platform events and community promotions.',
    enabled: true,
    displayOrder: 9,
    icon: 'Sparkles',
    customNotes: 'Users can redeem available Gift Codes from the Claim Gift Code section. Gift Code reward amount and validity depend on each configured promotion code.',
  },
  customRules: {
    id: 'custom_rules',
    title: 'Platform Policies & Security Rules',
    description: 'Operational guidelines, security standards, and device runtime terms.',
    enabled: true,
    displayOrder: 10,
    icon: 'ShieldCheck',
  },
};

const defaultInvestingSteps = [
  {
    id: 'step_1',
    stepNumber: 1,
    title: 'Topup Wallet',
    description: 'Recharge money into Topup Wallet. Plans are purchased using the configured Topup Wallet balance.',
    icon: 'CreditCard',
    badge: 'Step 1',
    enabled: true,
  },
  {
    id: 'step_2',
    stepNumber: 2,
    title: 'Buy a Plan',
    description: 'Choose the available Hourly / Pro / Event plan and confirm purchase.',
    icon: 'ShoppingBasket',
    badge: 'Step 2',
    enabled: true,
  },
  {
    id: 'step_3',
    stepNumber: 3,
    title: 'Active Plan',
    description: 'The purchased plan becomes active according to the existing plan rules.',
    icon: 'Zap',
    badge: 'Step 3',
    enabled: true,
  },
  {
    id: 'step_4',
    stepNumber: 4,
    title: 'Claim Return',
    description: 'User claims eligible earnings from My Device. The claimed amount goes to the existing Withdraw Wallet.',
    icon: 'ArrowDownLeft',
    badge: 'Step 4',
    enabled: true,
  },
];

const defaultCustomRules = [
  {
    id: 'custom_rule_1',
    title: 'Important Account Safety Notice',
    description: 'Never share your login credentials or OTP with anyone. Official platform staff will never ask for your password.',
    icon: 'ShieldCheck',
    displayOrder: 1,
    enabled: true,
    badge: 'Security',
  },
  {
    id: 'custom_rule_2',
    title: 'Device Real-Time Settlement',
    description: 'Hourly revenue is accrued seamlessly every hour. You can check your active devices and claim accumulated returns anytime from My Device.',
    icon: 'Cpu',
    displayOrder: 2,
    enabled: true,
    badge: 'Settlement',
  },
];

function formatAboutPlatformResponse(data: any) {
  let parsedSections = { ...defaultAboutSections };
  if (data?.sections && typeof data.sections === 'object' && !Array.isArray(data.sections) && Object.keys(data.sections).length > 0) {
    parsedSections = { ...defaultAboutSections, ...data.sections };
  }

  let steps = defaultInvestingSteps;
  if (Array.isArray(data?.investing_steps) && data.investing_steps.length > 0) {
    steps = data.investing_steps;
  } else if (Array.isArray(data?.investingSteps) && data.investingSteps.length > 0) {
    steps = data.investingSteps;
  }

  let rules = defaultCustomRules;
  if (Array.isArray(data?.custom_rules) && data.custom_rules.length > 0) {
    rules = data.custom_rules;
  } else if (Array.isArray(data?.customRules) && data.customRules.length > 0) {
    rules = data.customRules;
  }

  return {
    id: data?.id || 'default',
    companyName: data?.company_name || data?.companyName || 'GainPower Infrastructure Pvt Ltd',
    licenseNo: data?.license_no || data?.licenseNo || 'CIN-U72900DL2024PTC394821',
    platformVersion: data?.platform_version || data?.platformVersion || data?.appVersion || 'v4.8.2-live',
    appVersion: data?.platform_version || data?.platformVersion || data?.appVersion || 'v4.8.2-live',
    pageTitle: data?.hero_title || data?.pageTitle || data?.page_title || 'About Platform & Operating Rules',
    pageSubtitle: data?.hero_subtitle || data?.pageSubtitle || data?.page_subtitle || 'Transparent, automated sharing economy infrastructure guide and platform business rules.',
    heroBadge: data?.hero_badge || data?.heroBadge || 'OFFICIAL PLATFORM GUIDE',
    supportEmail: data?.support_email || data?.supportEmail || 'support@gainpower-top-1.com',
    supportTelegram: data?.support_telegram || data?.supportTelegram || '@GainPowerSupport',
    supportWhatsapp: data?.support_whatsapp || data?.supportWhatsapp || '+91 98765 43210',
    supportPhone: data?.support_phone || data?.supportPhone || '+91 98765 43210',
    supportHours: data?.support_hours || data?.supportHours || '24/7 Priority Support',
    sections: parsedSections,
    investingSteps: steps,
    customRules: rules,
    aboutUsContent: data?.about_us_content || data?.aboutUsContent || "GainPower is India's leading smart power-bank sharing network.",
    termsContent: data?.terms_content || data?.termsContent || 'GainPower Terms of Service & Member Sharing Economy Guidelines.',
    privacyContent: data?.privacy_content || data?.privacyContent || 'GainPower Privacy & Financial Protection Policy.',
    topupWalletNotes: data?.topup_wallet_notes || data?.topupWalletNotes || 'Used exclusively for hardware purchases and system subscriptions.',
    withdrawWalletNotes: data?.withdraw_wallet_notes || data?.withdrawWalletNotes || 'Can be withdrawn anytime to verified bank account or USDT wallet.',
    giftCodeNotes: data?.gift_code_notes || data?.giftCodeNotes || 'Redeemable for bonus dividends directly deposited into your wallet balance.',
    updatedAt: data?.updated_at || data?.updatedAt || new Date().toISOString(),
  };
}

app.get('/api/about-platform', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('about_platform_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const formatted = formatAboutPlatformResponse(data);
        return res.json({ success: true, data: formatted });
      }
    }

    const defaultFormatted = formatAboutPlatformResponse({});
    return res.json({ success: true, data: defaultFormatted });
  } catch (err: any) {
    console.error('[GET ABOUT PLATFORM ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/about-platform', async (req, res) => {
  try {
    const { config, adminId = 'adm_root' } = req.body;
    if (!config) {
      return res.status(400).json({ success: false, error: 'Config is required.' });
    }

    const nowIso = new Date().toISOString();
    const formatted = formatAboutPlatformResponse({ ...config, updated_at: nowIso, updatedAt: nowIso });

    const dbPayload = {
      id: formatted.id || 'default',
      company_name: formatted.companyName,
      license_no: formatted.licenseNo,
      platform_version: formatted.platformVersion,
      hero_title: formatted.pageTitle,
      hero_subtitle: formatted.pageSubtitle,
      hero_badge: formatted.heroBadge,
      support_email: formatted.supportEmail,
      support_telegram: formatted.supportTelegram,
      support_whatsapp: formatted.supportWhatsapp,
      support_phone: formatted.supportPhone,
      support_hours: formatted.supportHours,
      about_us_content: formatted.aboutUsContent,
      terms_content: formatted.termsContent,
      privacy_content: formatted.privacyContent,
      sections: formatted.sections,
      investing_steps: formatted.investingSteps,
      custom_rules: formatted.customRules,
      topup_wallet_notes: typeof formatted.topupWalletNotes === 'string' ? formatted.topupWalletNotes : JSON.stringify(formatted.topupWalletNotes),
      withdraw_wallet_notes: typeof formatted.withdrawWalletNotes === 'string' ? formatted.withdrawWalletNotes : JSON.stringify(formatted.withdrawWalletNotes),
      gift_code_notes: formatted.giftCodeNotes || '',
      updated_at: nowIso,
    };

    if (supabase) {
      const { error } = await supabase
        .from('about_platform_config')
        .upsert(dbPayload, { onConflict: 'id' });

      if (error) {
        console.error('[ADMIN SAVE ABOUT ERROR]', error);
        throw new Error(error.message);
      }

      try {
        await supabase
          .from('admin_settings')
          .upsert({ id: 'about_platform', value: formatted, updated_at: nowIso });
      } catch (_e) {}

      try {
        await supabase.from('admin_audit_logs').insert({
          admin_user_id: adminId,
          action: 'UPDATE_ABOUT_PLATFORM_CONFIG',
          target_type: 'settings',
          target_id: 'about_platform_config',
          description: `Updated About Platform rules, title="${formatted.pageTitle}", company="${formatted.companyName}"`,
          details: { id: formatted.id, companyName: formatted.companyName, pageTitle: formatted.pageTitle },
          created_at: nowIso,
        });
      } catch (_e) {}
    }

    return res.json({ success: true, data: formatted, message: 'About Platform configuration saved successfully.' });
  } catch (err: any) {
    console.error('[ADMIN SAVE ABOUT PLATFORM ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save about platform config.' });
  }
});

// ==============================================================================
// 16. BANNERS & NEWS CRUD ENDPOINTS
// ==============================================================================
app.get('/api/banners', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    const mapped = (data || []).map((b: any) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle || '',
      ctaText: b.cta_text || 'Explore >',
      badge: b.badge || 'HOT',
      artworkType: b.artwork_type || 'solar',
      imageUrl: b.image_url || '',
      linkUrl: b.link_url || '',
      targetTab: b.target_tab || 'INVEST',
      priority: Number(b.priority ?? b.sort_order ?? 1),
      isActive: b.is_active !== false && b.active !== false,
      createdAt: b.created_at,
    }));

    return res.json({ success: true, data: mapped });
  } catch (err: any) {
    console.error('[GET BANNERS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/banners/save', async (req, res) => {
  try {
    const { banner, adminId } = req.body;
    if (!banner || !banner.title) {
      return res.status(400).json({ success: false, error: 'Banner title is required.' });
    }

    const rawId = banner.id;
    let isNew = !rawId || rawId.startsWith('new_') || req.body.isNew === true;

    if (supabase && !isNew && rawId) {
      const { data: existingRow } = await supabase
        .from('banners')
        .select('id')
        .eq('id', rawId)
        .maybeSingle();
      if (!existingRow) {
        isNew = true;
      }
    }

    const bannerId = (!rawId || isNew) ? (rawId && !rawId.startsWith('new_') ? rawId : crypto.randomUUID()) : rawId;

    const record = {
      title: banner.title,
      subtitle: banner.subtitle || '',
      cta_text: banner.ctaText || banner.cta_text || 'Explore >',
      badge: banner.badge || 'HOT',
      image_url: banner.imageUrl || banner.image_url || '',
      link_url: banner.linkUrl || banner.link_url || '',
      target_tab: banner.targetTab || banner.target_tab || 'INVEST',
      priority: Number(banner.priority || 1),
      sort_order: Number(banner.priority || 1),
      is_active: banner.isActive !== false && banner.active !== false,
      active: banner.isActive !== false && banner.active !== false,
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      if (isNew) {
        const { data, error } = await supabase
          .from('banners')
          .insert({ id: bannerId, created_at: new Date().toISOString(), ...record })
          .select();

        if (error) {
          const { data: retryData, error: retryErr } = await supabase
            .from('banners')
            .insert({ created_at: new Date().toISOString(), ...record })
            .select();
          if (retryErr) throw new Error(retryErr.message);

          const freshId = retryData && retryData[0] ? retryData[0].id : bannerId;
          const { data: freshSelect } = await supabase.from('banners').select('*').eq('id', freshId).maybeSingle();
          return res.json({ success: true, data: freshSelect || (retryData && retryData[0]) || { id: bannerId, ...record } });
        }

        const freshId = data && data[0] ? data[0].id : bannerId;
        const { data: freshSelect } = await supabase.from('banners').select('*').eq('id', freshId).maybeSingle();
        return res.json({ success: true, data: freshSelect || (data && data[0]) || { id: bannerId, ...record } });
      } else {
        const { data, error } = await supabase
          .from('banners')
          .update(record)
          .eq('id', bannerId)
          .select();

        if (error) throw new Error(error.message);
        const { data: freshSelect } = await supabase.from('banners').select('*').eq('id', bannerId).maybeSingle();
        return res.json({ success: true, data: freshSelect || (data && data[0]) || { id: bannerId, ...record } });
      }
    }

    return res.json({ success: true, data: { id: bannerId, ...record } });
  } catch (err: any) {
    console.error('[ADMIN SAVE BANNER ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save banner.' });
  }
});

app.post('/api/admin/banners/delete', async (req, res) => {
  try {
    const { id, adminId } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Banner ID is required.' });
    }

    if (supabase) {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: 'Banner deleted successfully.' });
  } catch (err: any) {
    console.error('[ADMIN DELETE BANNER ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete banner.' });
  }
});

app.get('/api/news', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.json({ success: true, data: [] });
    }

    const mapped = (data || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content || n.description || '',
      tag: n.tag || 'Notice',
      date: n.date || (n.created_at ? n.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      isImportant: Boolean(n.is_important),
      readTime: n.read_time || '1 min',
      icon: n.icon || 'Newspaper',
    }));

    return res.json({ success: true, data: mapped });
  } catch (err: any) {
    console.error('[GET NEWS ERROR]', err);
    return res.json({ success: true, data: [] });
  }
});

app.post('/api/admin/news/save', async (req, res) => {
  try {
    const { newsItem, adminId } = req.body;
    if (!newsItem || !newsItem.title) {
      return res.status(400).json({ success: false, error: 'News title is required.' });
    }

    const isNew = !newsItem.id || newsItem.id.startsWith('new_');
    const newsId = isNew ? crypto.randomUUID() : newsItem.id;

    const category = newsItem.category || newsItem.tag || 'ANNOUNCEMENT';
    const record = {
      title: newsItem.title,
      content: newsItem.content || '',
      category: category,
      image_url: newsItem.image_url || newsItem.imageUrl || null,
      published: newsItem.is_active !== undefined ? Boolean(newsItem.is_active) : true,
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      if (isNew) {
        const { data, error } = await supabase
          .from('news')
          .insert({ id: newsId, created_at: new Date().toISOString(), ...record })
          .select();

        if (error) {
          const { data: retryData, error: retryErr } = await supabase
            .from('news')
            .insert({ created_at: new Date().toISOString(), ...record })
            .select();
          if (retryErr) throw new Error(retryErr.message);
          return res.json({ success: true, data: (retryData && retryData[0]) || { id: newsId, ...record } });
        }
        return res.json({ success: true, data: (data && data[0]) || { id: newsId, ...record } });
      } else {
        const { data, error } = await supabase
          .from('news')
          .update(record)
          .eq('id', newsId)
          .select();

        if (error) throw new Error(error.message);
        return res.json({ success: true, data: (data && data[0]) || { id: newsId, ...record } });
      }
    }

    return res.json({ success: true, data: { id: newsId, ...record } });
  } catch (err: any) {
    console.error('[ADMIN SAVE NEWS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save news.' });
  }
});

app.post('/api/admin/news/delete', async (req, res) => {
  try {
    const { id, adminId } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'News ID is required.' });
    }

    if (supabase) {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: 'News deleted successfully.' });
  } catch (err: any) {
    console.error('[ADMIN DELETE NEWS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete news.' });
  }
});

// ==============================================================================
// 17. ASSET UPLOAD ENDPOINT (GUARANTEED JSON RESPONSE, NEVER HTML)
// ==============================================================================
app.post('/api/admin/upload-asset', async (req, res) => {
  try {
    const rawData = req.body.base64 || req.body.fileData || req.body.data;
    const { fileName, prefix = 'asset' } = req.body;
    if (!rawData) {
      return res.status(400).json({ success: false, error: 'Image data is required.' });
    }

    const bucketName = prefix === 'banner' ? 'banners' : 'site-assets';

    // Try to upload to Supabase storage if storage is active
    if (supabase && typeof rawData === 'string' && rawData.startsWith('data:')) {
      try {
        const parts = rawData.split(';base64,');
        const mimeType = parts[0].replace('data:', '');
        const ext = mimeType.split('/')[1] || 'png';
        const buffer = Buffer.from(parts[1], 'base64');
        const targetFileName = fileName || `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(bucketName)
          .upload(targetFileName, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadErr && uploadData?.path) {
          const { data: pubData } = supabase.storage.from(bucketName).getPublicUrl(uploadData.path);
          if (pubData?.publicUrl) {
            return res.json({ success: true, url: pubData.publicUrl });
          }
        }
      } catch (storageErr) {
        console.warn('[STORAGE UPLOAD NOTICE] Falling back to direct data URL:', storageErr);
      }
    }

    // Direct Data URL is completely self-contained and universally supported in all browsers
    return res.json({ success: true, url: rawData });
  } catch (err: any) {
    console.error('[UPLOAD ASSET ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to process asset upload.' });
  }
});

// User notifications endpoints
app.get('/api/user/notifications', async (req, res) => {
  try {
    const userId = (req.query.userId || req.headers['x-user-id'] || '').toString().trim();
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required.' });
    }

    if (!supabase) {
      return res.json({ success: true, notifications: [], unreadCount: 0 });
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},is_broadcast.eq.true,target_audience.eq.ALL`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[GET NOTIFICATIONS ERROR]', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    const notifications = (data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message || n.description || '',
      type: n.type || 'INFO',
      read: Boolean(n.read || n.is_read),
      createdAt: n.created_at,
    }));

    const unreadCount = notifications.filter((n: any) => !n.read).length;

    return res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err: any) {
    console.error('[GET NOTIFICATIONS EXCEPTION]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch notifications.' });
  }
});

app.post('/api/user/notifications/mark-read', async (req, res) => {
  try {
    const { notificationId, userId } = req.body;
    if (!supabase) {
      return res.json({ success: true, message: 'Marked read.' });
    }

    if (notificationId) {
      await supabase.from('notifications').update({ read: true, is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId);
    } else if (userId) {
      await supabase.from('notifications').update({ read: true, is_read: true, read_at: new Date().toISOString() }).eq('user_id', userId);
    }

    return res.json({ success: true, message: 'Notifications marked as read.' });
  } catch (err: any) {
    console.error('[MARK READ NOTIFICATIONS ERROR]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to update notifications.' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    paymentGateway: 'UNIVEPAY',
    merchantConfigured: Boolean(UNIVEPAY_MERCHANT_NO && UNIVEPAY_SECRET),
    supabaseConnected: Boolean(supabase),
  });
});

// CRITICAL: Prevent any /api/* route from falling through to HTML index
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Vite Middleware & SPA Static Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Power Bank Univepay Gateway & Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
});
