import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://evhwqlnymvoduclmzshz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const API_BASE = 'http://localhost:3000';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runDetailedEvidenceGathering() {
  console.log('--- SECTION 1: Health ---');
  const h = await (await fetch(`${API_BASE}/api/health`)).json();
  console.log('Health:', h);

  console.log('--- SECTION 2: Auth tables sample ---');
  const { data: userProfile } = await sb.from('profiles').select('id, user_id, phone, email, referral_code, referrer_id, vip_level').limit(1).single();
  const { data: userWallet } = await sb.from('wallets').select('*').eq('user_id', userProfile?.user_id).single();
  const { data: userSec } = await sb.from('user_security').select('*').eq('user_id', userProfile?.user_id).single();
  console.log('Sample User Profile:', userProfile);
  console.log('Sample User Wallet:', userWallet);
  console.log('Sample User Security:', { ...userSec, password_hash: '[REDACTED]', withdrawal_pin_hash: '[REDACTED]' });

  console.log('--- SECTION 3: Referrals ---');
  const { data: refSample } = await sb.from('referrals').select('*').limit(2);
  console.log('Referrals sample:', refSample);

  console.log('--- SECTION 5 & 14: Recharge & Withdrawal Settings ---');
  const sysConfig = await (await fetch(`${API_BASE}/api/admin/system-config-public`)).json();
  console.log('Public System Config:', {
    min_recharge: sysConfig.min_recharge || sysConfig.minRecharge,
    max_recharge: sysConfig.max_recharge || sysConfig.maxRecharge,
    recharge_presets: sysConfig.recharge_presets || sysConfig.rechargePresets,
    min_withdrawal: sysConfig.min_withdrawal || sysConfig.minWithdrawal,
    max_withdrawal: sysConfig.max_withdrawal || sysConfig.maxWithdrawal,
    withdrawal_fee_percent: sysConfig.withdrawal_fee_percent || sysConfig.withdrawalFeePercent,
    usdt_exchange_rate: sysConfig.usdt_exchange_rate || sysConfig.usdtRate,
    usdt_trc20_address: sysConfig.usdt_trc20_address || sysConfig.trc20Address,
    usdt_bep20_address: sysConfig.usdt_bep20_address || sysConfig.bep20Address,
  });

  console.log('--- SECTION 6: USDT Manual Deposit Sample ---');
  const { data: usdtSample } = await sb.from('deposit_transactions')
    .select('*')
    .ilike('payment_method', '%USDT%')
    .limit(1);
  console.log('USDT Deposit Sample:', usdtSample);

  console.log('--- SECTION 8: Plan Purchase Sample ---');
  const { data: plans } = await sb.from('plans').select('id, name, price, min_vip_level, purchase_limit, plan_type, is_active').limit(5);
  console.log('Plans:', plans);

  console.log('--- SECTION 9 & 10 & 11: Purchases, Device, Claims ---');
  const { data: purSample } = await sb.from('purchases').select('*').limit(2);
  console.log('Purchases sample:', purSample);

  console.log('--- SECTION 13: Checkin Status Sample ---');
  const checkinRes = await (await fetch(`${API_BASE}/api/fortune/checkin-status`)).json();
  console.log('Fortune Checkin config:', checkinRes);

  console.log('--- SECTION 14 & 15: Withdrawals & Bank Accounts ---');
  const { data: withSample } = await sb.from('withdrawals').select('*').limit(2);
  const { data: bankSample } = await sb.from('bank_accounts').select('*').limit(2);
  console.log('Withdrawals sample:', withSample);
  console.log('Bank Accounts sample:', bankSample);

  console.log('--- SECTION 16 & 17: Gift Codes & Missions ---');
  const { data: giftSample } = await sb.from('gift_codes').select('*').limit(2);
  const { data: missionSample } = await sb.from('missions').select('*').limit(2);
  console.log('Gift Codes sample:', giftSample);
  console.log('Missions sample:', missionSample);

  console.log('--- SECTION 20: Banners ---');
  const { data: bannerSample } = await sb.from('banners').select('*').limit(2);
  console.log('Banners sample:', bannerSample);
}

runDetailedEvidenceGathering();
