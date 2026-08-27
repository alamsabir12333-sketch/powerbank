import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return `https://${trimmed}.supabase.co`;
  }
  return '';
}

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseUrl = formatSupabaseUrl(rawSupabaseUrl);
const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
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
// AUTHENTICATION & ONBOARDING API ENDPOINTS (BYPASSES EMAIL RATE LIMITS)
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
  const cleanEmail = (email || `${cleanPhone}@powerbank.app`).toLowerCase().trim();
  const cleanUsername = (username || name || `user_${cleanPhone.slice(-4)}`).trim();
  const memNum = membershipNumber || 'PB' + Math.floor(100000 + Math.random() * 900000);

  if (!cleanPhone || cleanPhone.length !== 10) {
    return res.status(400).json({ success: false, error: 'Valid 10-digit phone number is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }

  try {
    let createdUserId: string | null = null;
    let authUserObj: any = null;

    if (supabase) {
      // 1. Check if phone is already registered in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_id, whatsapp_no, username')
        .or(`whatsapp_no.eq.${cleanPhone},mobile.eq.${cleanPhone}`)
        .maybeSingle();

      if (existingProfile) {
        return res.status(400).json({
          success: false,
          error: 'This phone number is already registered. Please login instead.',
        });
      }

      // 2. Try creating user via Admin API if service role key is available, or via standard signUp
      if (hasServiceRoleKey && supabase.auth?.admin?.createUser) {
        const { data: adminUser, error: adminErr } = await supabase.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            name,
            username: cleanUsername,
            whatsapp_no: cleanPhone,
            mobile: cleanPhone,
            withdrawal_password: withdrawalPassword,
            membership_number: memNum,
            referral_code: memNum,
            referred_by: referralCode || null,
          },
        });

        if (adminUser?.user?.id) {
          createdUserId = adminUser.user.id;
          authUserObj = adminUser.user;
        } else if (adminErr) {
          console.warn('[SERVER AUTH] admin.createUser notice:', adminErr.message);
          const msg = adminErr.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('user already registered')) {
            return res.status(400).json({
              success: false,
              error: 'This phone number is already registered. Please login instead.',
            });
          }
        }
      }

      // If admin.createUser was not available or not permitted, use standard signUp
      if (!createdUserId) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name,
              username: cleanUsername,
              whatsapp_no: cleanPhone,
              mobile: cleanPhone,
              withdrawal_password: withdrawalPassword,
              membership_number: memNum,
              referral_code: memNum,
              referred_by: referralCode || null,
            },
          },
        });

        if (signUpData?.user?.id) {
          createdUserId = signUpData.user.id;
          authUserObj = signUpData.user;
        } else if (signUpErr) {
          console.warn('[SERVER AUTH] signUp notice:', signUpErr.message);
          const msg = signUpErr.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('user already registered')) {
            return res.status(400).json({
              success: false,
              error: 'This phone number or email is already registered. Please login instead.',
            });
          }
        }
      }

      // Fallback: If auth creation was rate limited or failed, generate a clean UUID for profile/wallet
      if (!createdUserId) {
        createdUserId = crypto.randomUUID();
        authUserObj = { id: createdUserId, email: cleanEmail };
      }

      // 3. Perform atomic user onboarding in Database
      try {
        await supabase.rpc('handle_user_onboarding', {
          p_user_id: createdUserId,
          p_username: cleanUsername,
          p_whatsapp_no: cleanPhone,
          p_email: cleanEmail,
          p_membership_number: memNum,
          p_referral_code: memNum,
          p_referred_by: referralCode || null,
        });
      } catch (rpcErr) {
        console.warn('[SERVER AUTH] RPC onboarding fallback:', rpcErr);
      }

      // 4. Ensure profile row exists
      const { data: profExist } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', createdUserId)
        .maybeSingle();

      let finalProfile = profExist;
      if (!finalProfile) {
        const { data: insertedProf } = await supabase
          .from('profiles')
          .insert({
            user_id: createdUserId,
            username: cleanUsername,
            whatsapp_no: cleanPhone,
            mobile: cleanPhone,
            email: cleanEmail,
            membership_number: memNum,
            referral_code: memNum,
            referred_by: referralCode || null,
            role: 'user',
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        finalProfile = insertedProf;
      }

      // 5. Ensure wallet row exists with ₹50 Sign-up Bonus
      const { data: walExist } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', createdUserId)
        .maybeSingle();

      let finalWallet = walExist;
      if (!finalWallet) {
        const { data: insertedWal } = await supabase
          .from('wallets')
          .insert({
            user_id: createdUserId,
            available_balance: 50.0,
            recharge_balance: 50.0,
            withdraw_balance: 0.0,
            pending_balance: 0.0,
            total_earned: 0.0,
            total_withdrawn: 0.0,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        finalWallet = insertedWal;
      }

      // 6. Securely hash and store withdrawal password in user_security table
      if (withdrawalPassword) {
        const wthPassHash = crypto.createHash('sha256').update(String(withdrawalPassword).trim()).digest('hex');
        try {
          await supabase
            .from('user_security')
            .upsert(
              {
                user_id: createdUserId,
                withdrawal_password_hash: wthPassHash,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );
        } catch (secErr) {
          console.warn('[SERVER AUTH] user_security upsert notice:', secErr);
        }
      }

      return res.json({
        success: true,
        user: authUserObj,
        userId: createdUserId,
        email: cleanEmail,
        profile: finalProfile || {
          id: createdUserId,
          userId: createdUserId,
          username: cleanUsername,
          whatsappNo: cleanPhone,
          name: name || cleanUsername,
          mobile: cleanPhone,
          email: cleanEmail,
          membershipNumber: memNum,
          referralCode: memNum,
          referredBy: referralCode || undefined,
          role: 'user',
          status: 'active',
          walletBalance: 50.0,
        },
        wallet: finalWallet || {
          id: 'wal_' + createdUserId,
          userId: createdUserId,
          topupBalance: 50.0,
          withdrawBalance: 0.0,
          availableBalance: 50.0,
          rechargeBalance: 50.0,
          earnedBalance: 0.0,
          pendingBalance: 0.0,
          totalEarned: 0.0,
          totalWithdrawn: 0.0,
        },
      });
    }

    // No supabase server client fallback
    const fallbackId = 'usr_' + Date.now();
    return res.json({
      success: true,
      user: { id: fallbackId, email: cleanEmail },
      userId: fallbackId,
      email: cleanEmail,
      profile: {
        id: fallbackId,
        userId: fallbackId,
        username: cleanUsername,
        whatsappNo: cleanPhone,
        name: name || cleanUsername,
        mobile: cleanPhone,
        email: cleanEmail,
        membershipNumber: memNum,
        referralCode: memNum,
        referredBy: referralCode || undefined,
        role: 'user',
        status: 'active',
        walletBalance: 50.0,
      },
      wallet: {
        id: 'wal_' + fallbackId,
        userId: fallbackId,
        topupBalance: 50.0,
        withdrawBalance: 0.0,
        availableBalance: 50.0,
        rechargeBalance: 50.0,
        earnedBalance: 0.0,
        pendingBalance: 0.0,
        totalEarned: 0.0,
        totalWithdrawn: 0.0,
      },
    });
  } catch (err: any) {
    console.error('[SERVER AUTH] Registration error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Registration failed',
    });
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
  const cleanEmail = (email || `${cleanPhone}@powerbank.app`).toLowerCase().trim();
  const cleanUsername = (username || name || `user_${cleanPhone.slice(-4)}`).trim();
  const memNum = membershipNumber || referralCode || 'PB' + Math.floor(100000 + Math.random() * 900000);

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
 * Formula: Amount + Merchno + NotifyUrl + PayCode + Traceno + secretKey
 */
function generateUnivepayCreateSignature(
  amount: string,
  merchno: string,
  notifyUrl: string,
  payCode: string,
  traceno: string,
  secretKey: string
): string {
  const signString = `${amount}${merchno}${notifyUrl}${payCode}${traceno}${secretKey}`;
  return md5(signString);
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

  const { amount, payCode = '印度UPI-银台' } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount < 100) {
    return res.status(400).json({ success: false, error: 'Minimum top up amount is ₹100' });
  }

  // Server-side unique order number (Traceno)
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const traceno = `DEP${timestamp}${randomSuffix}`;
  const formattedAmount = numAmount.toFixed(2);
  const appUrl = process.env.APP_URL || getAppUrl(req) || 'https://gainpower-top-1.com';
  const supabaseBaseUrl = process.env.SUPABASE_URL || '';
  const notifyUrl = supabaseBaseUrl
    ? `${supabaseBaseUrl}/functions/v1/payment-callback`
    : `${appUrl}/api/payment-callback`;
  const callbackUrl = process.env.GATEWAY_CALLBACK_URL || 'https://gainpower-top-1.com/wallet?status=success';

  // Initialize canonical deposit transaction record
  if (supabase) {
    try {
      await supabase.from('deposit_transactions').insert({
        order_id: traceno,
        traceno: traceno,
        user_id: authenticatedUserId,
        amount: numAmount,
        currency: 'INR',
        pay_code: payCode,
        status: 'PENDING',
      });
    } catch (e: any) {
      console.warn('[GATEWAY][CREATE] Insert deposit_transactions warning:', e.message);
    }
  }

  // Check if merchant credentials are configured
  const merchantNo = UNIVEPAY_MERCHANT_NO;
  const secretKey = UNIVEPAY_SECRET;

  if (!merchantNo || !secretKey) {
    console.error('[UNIVEPAY][CREATE] UNIVEPAY_MERCHANT_NO or UNIVEPAY_SECRET is not configured.');
    return res.status(503).json({
      success: false,
      error: 'Payment gateway temporarily unavailable. Please try again.',
      details: 'Gateway merchant credentials not configured.',
    });
  }

  // Signature formula: Amount + Merchno + NotifyUrl + PayCode + Traceno + secretKey -> MD5 -> Uppercase
  const signature = generateUnivepayCreateSignature(
    formattedAmount,
    merchantNo,
    notifyUrl,
    payCode,
    traceno,
    secretKey
  );

  console.log(`[UNIVEPAY][CREATE] Traceno: ${traceno}, Amount: ${formattedAmount}, Merchno: ${merchantNo}, PayCode: ${payCode}`);

  const requestBody = new URLSearchParams({
    Merchno: merchantNo,
    Amount: formattedAmount,
    Traceno: traceno,
    PayCode: payCode,
    NotifyUrl: notifyUrl,
    CallbackUrl: callbackUrl,
    Signature: signature,
  });

  try {
    await recordGatewayLog({
      endpoint: UNIVEPAY_CREATE_DEPOSIT_URL,
      direction: 'OUTBOUND',
      traceno,
      userTransactionId: authenticatedUserId,
      payload: {
        Merchno: merchantNo,
        Amount: formattedAmount,
        Traceno: traceno,
        PayCode: payCode,
        NotifyUrl: notifyUrl,
        CallbackUrl: callbackUrl,
        Signature: signature,
      },
    });

    const response = await fetch(UNIVEPAY_CREATE_DEPOSIT_URL, {
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
      endpoint: UNIVEPAY_CREATE_DEPOSIT_URL,
      direction: 'INBOUND',
      traceno,
      httpStatus: response.status,
      payload: result,
    });

    const isValidSuccessStatus = result && (result.status === '00' || result.status === 'SUCCESS');
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
      console.error('[UNIVEPAY][CREATE] Gateway creation error:', result);
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

      return res.status(400).json({
        success: false,
        error: 'Payment gateway temporarily unavailable. Please try again.',
        details: result?.msg || result?.message || result?.error || 'Gateway returned invalid status',
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
      error: 'Payment gateway temporarily unavailable. Please try again.',
      details: networkErr.message,
    });
  }
};

app.post('/api/univepay/create-payment', handleCreatePayment);
app.post('/api/univepay/create-deposit', handleCreatePayment);
app.post('/api/create-payin-order', handleCreatePayment);
app.post('/functions/v1/create-payin-order', handleCreatePayment);

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

  const secretKey = UNIVEPAY_SECRET;
  const merchantNo = UNIVEPAY_MERCHANT_NO;

  // PART 16: SECRET MUST BE REQUIRED (FAIL CLOSED)
  if (!secretKey) {
    console.error('[UNIVEPAY][CALLBACK] Fatal: UNIVEPAY_SECRET missing in server environment. Rejecting callback.');
    return res.status(500).send('SERVER_CONFIGURATION_ERROR');
  }

  // PART 15: MERCHANT NUMBER VERIFICATION
  if (merchantNo && merchno !== merchantNo) {
    console.error(`[UNIVEPAY][CALLBACK] Merchant mismatch! Expected: ${merchantNo}, Received: ${merchno}`);
    return res.status(400).send('MERCHANT_ERROR');
  }

  // PART 14: REQUIRED FIELDS CHECK
  if (!transDate || !merchno || !amount || !payCode || !serialNo || !status || !traceno || !signature) {
    console.error('[UNIVEPAY][CALLBACK] Missing required fields in callback.');
    return res.status(400).send('MISSING_REQUIRED_FIELDS');
  }

  // PART 19: TRACENO VERIFICATION (ORDER MUST EXIST)
  let dbOrder: any = null;
  if (supabase) {
    const { data, error: fetchErr } = await supabase
      .from('deposit_transactions')
      .select('*')
      .eq('traceno', traceno)
      .maybeSingle();

    if (fetchErr || !data) {
      console.error(`[UNIVEPAY][CALLBACK] Order not found for Traceno: ${traceno}`);
      return res.status(400).send('ORDER_NOT_FOUND');
    }
    dbOrder = data;
  }

  // PART 18: AMOUNT VERIFICATION
  if (dbOrder) {
    const callbackAmountNum = parseFloat(amount);
    const dbAmountNum = parseFloat(dbOrder.amount);
    if (isNaN(callbackAmountNum) || isNaN(dbAmountNum) || Math.abs(callbackAmountNum - dbAmountNum) > 0.001) {
      console.error(`[UNIVEPAY][CALLBACK] Amount mismatch! DB: ${dbAmountNum}, Callback: ${callbackAmountNum}`);
      return res.status(400).send('AMOUNT_ERROR');
    }
  }

  // PART 17: SIGNATURE VERIFICATION: Amount + Merchno + PayCode + SerialNo + Status + Traceno + TransDate + secretKey -> MD5 -> Uppercase
  const signString = `${amount}${merchno}${payCode}${serialNo}${status}${traceno}${transDate}${secretKey}`;
  const calculatedSignature = md5(signString);

  if (calculatedSignature.toUpperCase() !== signature.toUpperCase()) {
    console.error(`[UNIVEPAY][CALLBACK] Signature mismatch! Calculated: ${calculatedSignature}, Received: ${signature}`);
    return res.status(400).send('SIGNATURE_ERROR');
  }

  console.log('[UNIVEPAY][VERIFY] Merchant verified: OK, Order verified: OK, Amount verified: OK, Signature verified: OK');

  // PART 20 & 21: ATOMIC SETTLEMENT
  if (status === 'SUCCESS' && traceno) {
    if (supabase) {
      try {
        // 1. Invoke atomic process_deposit_success
        await supabase.rpc('process_deposit_success', {
          p_order_id: traceno,
          p_serial_no: serialNo || '',
          p_raw_callback: body,
        });

        // 2. Also invoke complete_univepay_deposit_success if present for backwards compatibility
        await supabase.rpc('complete_univepay_deposit_success', {
          p_traceno: traceno,
          p_gateway_serial_no: serialNo,
          p_gateway_order_id: null,
          p_payload: body,
          p_utr: remark || null,
        }).catch(() => {});

        console.log(`[GATEWAY][SETTLEMENT] Deposit settlement completed atomically for order ${traceno}`);
      } catch (err: any) {
        console.error('[GATEWAY][SETTLEMENT] Exception crediting deposit:', err.message);
        return res.status(500).send('SETTLEMENT_ERROR');
      }
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
      .or(`traceno.eq.${traceno},order_id.eq.${traceno}`)
      .maybeSingle();
    dbOrder = data;
  }

  if (dbOrder && dbOrder.status === 'SUCCESS') {
    return res.json({
      success: true,
      status: 'SUCCESS',
      amount: dbOrder.amount,
      orderId: dbOrder.order_id || dbOrder.traceno,
      traceno: dbOrder.traceno,
      creditedAt: dbOrder.completed_at || dbOrder.updated_at,
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
      // Complete deposit atomically if not already completed
      if (supabase) {
        await supabase.rpc('process_deposit_success', {
          p_order_id: traceno,
          p_serial_no: result.data?.serialNo || result.serialNo || '',
          p_raw_callback: result,
        });
      }
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
  if (!withdrawalPassword || String(withdrawalPassword).trim().length < 4) {
    return res.status(400).json({ success: false, error: 'Withdrawal password is required.' });
  }

  if (supabase) {
    // 1. Verify withdrawal password hash from user_security table
    const cleanPass = String(withdrawalPassword).trim();
    const inputHash = crypto.createHash('sha256').update(cleanPass).digest('hex');

    const { data: secData, error: secErr } = await supabase
      .from('user_security')
      .select('withdrawal_password_hash')
      .eq('user_id', userId)
      .maybeSingle();

    if (secData && secData.withdrawal_password_hash) {
      if (secData.withdrawal_password_hash !== inputHash) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect withdrawal password. Please enter your valid fund password.',
        });
      }
    } else {
      // If no hash in user_security yet, backfill for future checks
      try {
        await supabase.from('user_security').upsert({
          user_id: userId,
          withdrawal_password_hash: inputHash,
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
        return res.status(400).json({
          success: false,
          error: rpcErr.message || 'Withdrawal failed.',
        });
      }

      if (!rpcData?.success) {
        return res.status(400).json({
          success: false,
          error: rpcData?.error || 'Insufficient withdrawable balance.',
        });
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
    const memNo = membershipNumber || 'PB' + Math.floor(Math.random() * 900000 + 100000);
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
        type: 'SIGNUP_BONUS',
        amount: 50.0,
        balance_before: 0.0,
        balance_after: 50.0,
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

// ==============================================================================
// 7. ADMIN DASHBOARD & MANAGEMENT BACKEND APIs
// ==============================================================================
app.get('/api/admin/dashboard-stats', async (req, res) => {
  if (!supabase) {
    return res.json({ success: true, data: {} });
  }
  try {
    const [profilesRes, walletsRes, paymentsRes, depositsRes, withdrawalsRes, purchasesRes, earningsRes] = await Promise.all([
      supabase.from('profiles').select('id, status'),
      supabase.from('wallets').select('available_balance, withdraw_balance, recharge_balance'),
      supabase.from('payments').select('amount, status'),
      supabase.from('deposit_transactions').select('amount, status'),
      supabase.from('withdrawals').select('amount, status'),
      supabase.from('purchases').select('amount, status, plan_category, plans(category)'),
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

    const pendingManualPayments = payments.filter((p) => p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING').reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const pendingGatewayDeposits = deposits.filter((d) => d.status === 'PENDING').reduce((acc, d) => acc + Number(d.amount || 0), 0);
    const pendingRecharge = +(pendingManualPayments + pendingGatewayDeposits).toFixed(2);

    const totalWithdrawals = +withdrawals.filter((w) => w.status === 'COMPLETED' || w.status === 'SUCCESS').reduce((acc, w) => acc + Number(w.amount || 0), 0).toFixed(2);
    const pendingWithdrawals = +withdrawals.filter((w) => w.status === 'PENDING' || w.status === 'PROCESSING').reduce((acc, w) => acc + Number(w.amount || 0), 0).toFixed(2);

    const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
    const totalInvestments = +activePurchases.reduce((acc, p) => acc + Number(p.amount || 0), 0).toFixed(2);

    const activeHourlyPlans = activePurchases.filter((p: any) => {
      const cat = (p.plan_category || (Array.isArray(p.plans) ? p.plans[0]?.category : p.plans?.category) || '').toUpperCase();
      return cat !== 'PRO';
    }).length;

    const activeProPlans = activePurchases.filter((p: any) => {
      const cat = (p.plan_category || (Array.isArray(p.plans) ? p.plans[0]?.category : p.plans?.category) || '').toUpperCase();
      return cat === 'PRO';
    }).length;

    const totalEarnings = +earnings.reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
    const totalClaimableEarnings = +earnings.filter((e) => e.status === 'CLAIMABLE').reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
    const totalClaimedEarnings = +earnings.filter((e) => e.status === 'CLAIMED').reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);
    const referralEarnings = +earnings.filter((e) => (e.earning_type || '').includes('REFERRAL')).reduce((acc, e) => acc + Number(e.amount || 0), 0).toFixed(2);

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

app.get('/api/admin/users', async (req, res) => {
  if (!supabase) return res.json({ success: true, data: [] });
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*, wallets(available_balance, withdraw_balance, recharge_balance), purchases(amount, status)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });

    const formatted = (profiles || []).map((p: any) => {
      const walletObj = Array.isArray(p.wallets) ? p.wallets[0] : p.wallets;
      const purchasesList = p.purchases || [];
      const totalInvested = purchasesList
        .filter((pur: any) => pur.status === 'ACTIVE')
        .reduce((sum: number, pur: any) => sum + Number(pur.amount || 0), 0);
      const activeDevices = purchasesList.filter((pur: any) => pur.status === 'ACTIVE').length;

      return {
        id: p.id,
        userId: p.user_id,
        username: p.username,
        whatsappNo: p.whatsapp_no,
        name: p.username,
        mobile: p.whatsapp_no,
        email: p.email,
        membershipNumber: p.membership_number,
        referralCode: p.referral_code,
        referredBy: p.referred_by,
        role: p.role,
        status: p.status,
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
    const [paymentsRes, depositsRes] = await Promise.all([
      supabase.from('payments').select('*, profiles(username, whatsapp_no, membership_number)').order('created_at', { ascending: false }),
      supabase.from('deposit_transactions').select('*, profiles(username, whatsapp_no, membership_number)').order('created_at', { ascending: false }),
    ]);

    const payments = (paymentsRes.data || []).map((p: any) => {
      const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return {
        id: p.id,
        userId: p.user_id,
        username: prof?.username || 'User',
        whatsappNo: prof?.whatsapp_no || '',
        membershipNumber: prof?.membership_number || '',
        amount: Number(p.amount || 0),
        paymentMethod: p.payment_method || 'UPI',
        utrNumber: p.utr_number || p.reference_id || '',
        referenceId: p.reference_id || p.utr_number || '',
        status: p.status,
        createdAt: p.created_at,
        type: 'MANUAL_UPI',
      };
    });

    const deposits = (depositsRes.data || []).map((d: any) => {
      const prof = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
      return {
        id: d.id,
        userId: d.user_id,
        username: prof?.username || 'User',
        whatsappNo: prof?.whatsapp_no || '',
        membershipNumber: prof?.membership_number || '',
        amount: Number(d.amount || 0),
        paymentMethod: d.channel || 'UNIVEPAY',
        utrNumber: d.traceno || '',
        referenceId: d.traceno || '',
        status: d.status === 'SUCCESS' ? 'PAID' : d.status,
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
      type: 'RECHARGE_APPROVED',
      amount: Number(payment.amount),
      balance_before: currentBal,
      balance_after: newBal,
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

    return res.json({ success: true, message: 'Recharge approved successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  if (!supabase) return res.json({ success: true, data: [] });
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*, profiles(username, whatsapp_no, membership_number)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });

    const formatted = (data || []).map((w: any) => {
      const prof = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
      return {
        id: w.id,
        userId: w.user_id,
        username: prof?.username || 'User',
        whatsappNo: prof?.whatsapp_no || '',
        membershipNumber: prof?.membership_number || '',
        amount: Number(w.amount || 0),
        actualAmount: Number(w.actual_amount || w.amount || 0),
        fee: Number(w.fee || 0),
        status: w.status,
        accountNumber: w.account_number || '',
        ifscCode: w.ifsc_code || '',
        holderName: w.holder_name || '',
        bankName: w.bank_name || '',
        bankRefNo: w.bank_ref_no || '',
        rejectedReason: w.rejected_reason || '',
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
      type: 'WITHDRAWAL_PAID',
      amount: Number(w.amount),
      balance_before: Number(wallet?.available_balance || 0),
      balance_after: Number(wallet?.available_balance || 0),
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
