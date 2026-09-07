import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://evhwqlnymvoduclmzshz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const API_BASE = 'http://localhost:3000';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runReadOnlyAudit() {
  const report: Record<string, any> = {};

  console.log('=== STARTING 100% READ-ONLY MASTER AUDIT ===\n');

  // -------------------------------------------------------------
  // SECTION 1: APPLICATION / SERVER HEALTH
  // -------------------------------------------------------------
  try {
    const healthRes = await fetch(`${API_BASE}/api/health`);
    const healthJson = await healthRes.json();
    report.section1 = {
      httpStatus: healthRes.status,
      response: healthJson,
      port: process.env.PORT || 3000,
      supabaseConnected: healthJson.supabaseConnected,
      mode: healthJson.mode,
      paymentGateway: healthJson.paymentGateway,
    };
  } catch (e: any) {
    report.section1 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 2: AUTHENTICATION & DATABASE STRUCTURE
  // -------------------------------------------------------------
  try {
    const { data: profilesSample } = await sb.from('profiles').select('*').limit(3);
    const { data: walletsSample } = await sb.from('wallets').select('*').limit(3);
    const { data: securitySample } = await sb.from('user_security').select('*').limit(3);
    const { data: referralsSample } = await sb.from('referrals').select('*').limit(3);

    report.section2 = {
      sampleProfile: profilesSample?.[0] ? Object.keys(profilesSample[0]) : [],
      sampleWallet: walletsSample?.[0] ? Object.keys(walletsSample[0]) : [],
      sampleSecurity: securitySample?.[0] ? Object.keys(securitySample[0]) : [],
      referralsCount: referralsSample?.length,
    };
  } catch (e: any) {
    report.section2 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 3: REFERRAL SYSTEM (RULE 1 & RULE 2)
  // -------------------------------------------------------------
  try {
    const { data: adminSettings } = await sb.from('admin_settings').select('*');
    const settingsMap: Record<string, any> = {};
    adminSettings?.forEach(s => { settingsMap[s.id] = s.value; });

    // Look for registration reward setting vs streak claim reward setting
    const regReward = settingsMap['registration_reward'] || settingsMap['signup_bonus'] || settingsMap['welcome_bonus'] || null;
    const streakDays = settingsMap['consecutive_claim_days'] || settingsMap['streak_claim_days'] || 3;
    const streakReward = settingsMap['consecutive_claim_reward'] || settingsMap['streak_claim_reward'] || 20;

    // Check recent referrals
    const { data: recentRefs } = await sb.from('referrals').select('*').order('created_at', { ascending: false }).limit(5);

    report.section3 = {
      regRewardSetting: regReward,
      streakDaysSetting: streakDays,
      streakRewardSetting: streakReward,
      recentRefsSample: recentRefs,
    };
  } catch (e: any) {
    report.section3 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 4: WALLET MATHEMATICAL CONSISTENCY
  // -------------------------------------------------------------
  try {
    const { data: wallets } = await sb.from('wallets').select('*').limit(20);
    const { data: txs } = await sb.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(20);
    const { data: ledgers } = await sb.from('wallet_ledger').select('*').order('created_at', { ascending: false }).limit(20);

    // Verify consistency formula: total assets = recharge + withdraw (or earned)
    const walletMathChecks = wallets?.map(w => ({
      userId: w.user_id,
      recharge: Number(w.recharge_balance || 0),
      withdraw: Number(w.withdraw_balance || 0),
      available: Number(w.available_balance || 0),
      earned: Number(w.earned_balance || 0),
      expectedAvailable: Number(w.recharge_balance || 0) + Number(w.withdraw_balance || 0),
      isAvailableConsistent: Math.abs(Number(w.available_balance || 0) - (Number(w.recharge_balance || 0) + Number(w.withdraw_balance || 0))) < 0.01,
    }));

    report.section4 = {
      walletCountChecked: walletMathChecks?.length,
      consistentCount: walletMathChecks?.filter(w => w.isAvailableConsistent).length,
      sampleInconsistent: walletMathChecks?.filter(w => !w.isAvailableConsistent).slice(0, 3),
      txCount: txs?.length,
      ledgerCount: ledgers?.length,
      sampleTx: txs?.slice(0, 2),
      sampleLedger: ledgers?.slice(0, 2),
    };
  } catch (e: any) {
    report.section4 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 5 & 6: RECHARGE / TOPUP & USDT
  // -------------------------------------------------------------
  try {
    const configRes = await fetch(`${API_BASE}/api/admin/system-config-public`);
    let configJson = {};
    if (configRes.ok) {
      configJson = await configRes.json();
    }
    const { data: deposits } = await sb.from('deposit_transactions').select('*').order('created_at', { ascending: false }).limit(5);

    report.section5_6 = {
      publicConfig: configJson,
      recentDeposits: deposits?.map(d => ({
        id: d.id,
        user_id: d.user_id,
        amount: d.amount,
        status: d.status,
        type: d.type || d.channel,
        proof_url: d.proof_url || d.proof_image,
      })),
    };
  } catch (e: any) {
    report.section5_6 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 7: TRANSACTION HISTORY & NORMALIZATION
  // -------------------------------------------------------------
  try {
    // Check an existing user with transactions
    const { data: someTx } = await sb.from('wallet_transactions').select('user_id').limit(1);
    const sampleUserId = someTx?.[0]?.user_id;

    let apiTransactions = [];
    if (sampleUserId) {
      const txRes = await fetch(`${API_BASE}/api/user/transactions?userId=${sampleUserId}`);
      if (txRes.ok) {
        apiTransactions = await txRes.json();
      }
    }

    report.section7 = {
      sampleUserId,
      apiTxCount: Array.isArray(apiTransactions) ? apiTransactions.length : (apiTransactions as any)?.transactions?.length,
      sampleApiTx: Array.isArray(apiTransactions) ? apiTransactions.slice(0, 3) : (apiTransactions as any)?.transactions?.slice(0, 3),
    };
  } catch (e: any) {
    report.section7 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 8 & 9 & 10 & 11: PLANS, PURCHASES & CLAIMS
  // -------------------------------------------------------------
  try {
    const { data: activePlans } = await sb.from('plans').select('*').eq('is_active', true).limit(5);
    const { data: recentPurchases } = await sb.from('purchases').select('*').order('created_at', { ascending: false }).limit(5);

    report.section8_11 = {
      activePlansSample: activePlans?.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        daily_yield: p.daily_yield || p.daily_income,
        vip_level_required: p.vip_level_required || p.min_vip_level,
        purchase_limit: p.purchase_limit,
      })),
      recentPurchasesSample: recentPurchases?.map(p => ({
        id: p.id,
        user_id: p.user_id,
        plan_id: p.plan_id,
        price: p.price || p.amount,
        status: p.status,
        last_claim_at: p.last_claim_at,
        created_at: p.created_at,
      })),
    };
  } catch (e: any) {
    report.section8_11 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 12 & 13: CONSECUTIVE CLAIMS & DAILY CHECK-IN
  // -------------------------------------------------------------
  try {
    const checkinRes = await fetch(`${API_BASE}/api/fortune/checkin-status`);
    const checkinJson = await checkinRes.json();

    // Look for streak transactions
    const { data: streakTxs } = await sb.from('wallet_transactions')
      .select('*')
      .or('type.eq.REFERRAL_BONUS,description.ilike.%Streak%')
      .order('created_at', { ascending: false })
      .limit(5);

    report.section12_13 = {
      checkinStatusResponse: checkinJson,
      recentStreakTxs: streakTxs,
    };
  } catch (e: any) {
    report.section12_13 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 14 & 15: WITHDRAWAL & BANK ACCOUNTS
  // -------------------------------------------------------------
  try {
    const { data: withdrawals } = await sb.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(5);
    const { data: banks } = await sb.from('bank_accounts').select('*').limit(5);

    report.section14_15 = {
      recentWithdrawals: withdrawals?.map(w => ({
        id: w.id,
        user_id: w.user_id,
        amount: w.amount,
        fee: w.fee,
        net_amount: w.net_amount || w.actual_amount,
        status: w.status,
      })),
      bankAccountsSample: banks?.map(b => ({
        id: b.id,
        user_id: b.user_id,
        bank_name: b.bank_name,
        account_number: b.account_number ? '***' + b.account_number.slice(-4) : '',
        is_primary: b.is_primary || b.is_default,
      })),
    };
  } catch (e: any) {
    report.section14_15 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 16 & 17: GIFT CODES & MISSIONS
  // -------------------------------------------------------------
  try {
    const { data: giftCodes } = await sb.from('gift_codes').select('*');
    const { data: missions } = await sb.from('missions').select('*');

    report.section16_17 = {
      giftCodes: giftCodes?.map(g => ({
        code: g.code,
        amount: g.amount,
        is_active: g.is_active,
        claims_count: g.claims_count,
        wallet_type: g.wallet_type,
      })),
      missions: missions?.map(m => ({
        id: m.id,
        title: m.title,
        reward_amount: m.reward_amount,
        target_count: m.target_count || m.target,
        status: m.status || (m.is_active ? 'ACTIVE' : 'INACTIVE'),
      })),
    };
  } catch (e: any) {
    report.section16_17 = { error: e.message };
  }

  // -------------------------------------------------------------
  // SECTION 18 & 19 & 20: VIP, PREMIUM & BANNERS
  // -------------------------------------------------------------
  try {
    const { data: banners } = await sb.from('banners').select('*');
    report.section18_20 = {
      banners: banners?.map(b => ({
        id: b.id,
        title: b.title,
        image_url: b.image_url,
        link_url: b.link_url,
        priority: b.priority || b.sort_order,
      })),
    };
  } catch (e: any) {
    report.section18_20 = { error: e.message };
  }

  // Write out raw JSON report
  fs.writeFileSync('scripts/master_readonly_report.json', JSON.stringify(report, null, 2));
  console.log('=== MASTER READ-ONLY AUDIT COMPLETE. Report saved to scripts/master_readonly_report.json ===');
}

runReadOnlyAudit();
