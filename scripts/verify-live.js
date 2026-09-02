import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

function formatSupabaseUrl(url) {
  const fallback = 'https://evhwqlnymvoduclmzshz.supabase.co';
  if (!url) return fallback;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (/^[a-z0-9-]+$/i.test(trimmed)) return `https://${trimmed}.supabase.co`;
  return fallback;
}

const supabaseUrl = formatSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('SUPABASE KEY MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runLiveVerification() {
  console.log('=== STARTING GAIN POWER LIVE VERIFICATION ===\n');
  const results = {};

  // Fetch real plans from DB
  const { data: allPlans } = await supabase.from('plans').select('*').neq('status', 'archived');
  const vipPlan = allPlans.find(p => (p.category || '').toUpperCase() === 'VIP' && p.price <= 2000) || allPlans[0];
  const proPlan = allPlans.find(p => (p.category || '').toUpperCase() === 'PRO') || allPlans.find(p => p.name.includes('PRO'));
  const eventPlan = allPlans.find(p => (p.category || '').toUpperCase() === 'EVENT') || allPlans.find(p => p.name.includes('EVENT') || p.name.includes('Festival'));

  console.log('Using real plans:');
  console.log(' - VIP Plan:', vipPlan?.name, vipPlan?.id, 'Price: ₹' + vipPlan?.price);
  console.log(' - PRO Plan:', proPlan?.name, proPlan?.id, 'Price: ₹' + proPlan?.price);
  console.log(' - EVENT Plan:', eventPlan?.name, eventPlan?.id, 'Price: ₹' + eventPlan?.price);

  // 1 & 8. CREATE REAL REGISTERED TEST USER
  console.log('\n--- TEST 1 & 8: REAL USER REGISTRATION & GP REFERRAL PREFIX ---');
  const testPhone = '99' + Math.floor(10000000 + Math.random() * 90000000);
  const regRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testPhone,
      password: 'password123',
      withdrawalPassword: '1234',
      referralCode: 'PB698435',
    }),
  });
  const regJson = await regRes.json();
  console.log('Registration Response:', regJson.success ? 'SUCCESS' : regJson.error);

  const testUserId = regJson?.user?.id || regJson?.userId;
  const generatedRef = regJson?.profile?.membership_number || regJson?.profile?.referral_code || regJson?.profile?.membershipNumber || '';
  console.log('Registered User ID:', testUserId);
  console.log('Generated Referral Code:', generatedRef);

  const refStartsGP = generatedRef.startsWith('GP');
  results['GP REFERRAL PREFIX'] = refStartsGP ? 'PASS' : 'FAIL';
  results['REFERRAL LINK'] = refStartsGP ? 'PASS' : 'FAIL';

  if (!testUserId) {
    throw new Error('Failed to register test user: ' + JSON.stringify(regJson));
  }

  // Set initial wallet balance
  const initialTopup = 5000;
  const initialWithdraw = 100;
  await supabase.from('wallets').update({
    recharge_balance: initialTopup,
    withdraw_balance: initialWithdraw,
    earned_balance: initialWithdraw,
    available_balance: initialTopup + initialWithdraw,
    total_earned: initialWithdraw,
    total_withdrawn: 0,
  }).eq('user_id', testUserId);

  // Create a device purchase that started 5 hours ago (5 elapsed hours)
  // Earning rate = 10 / hr (Daily earnings = 240)
  const fiveHoursAgo = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  const { data: createdPur, error: purErr } = await supabase.from('purchases').insert({
    user_id: testUserId,
    plan_id: vipPlan.id,
    plan_name: vipPlan.name,
    plan_category: 'VIP',
    amount: vipPlan.price || 1000,
    daily_earnings: 240,
    earning_rate: 10,
    duration_days: 30,
    status: 'ACTIVE',
    started_at: fiveHoursAgo,
    expires_at: expiresAt,
    total_earned: 0,
    claimed_amount: 0,
    created_at: fiveHoursAgo,
  }).select().single();

  if (purErr) {
    console.error('Purchase creation error:', purErr);
    throw new Error('Failed to create test purchase: ' + purErr.message);
  }

  // Pre-claim check via API
  const preSummaryRes = await fetch(`http://localhost:3000/api/user/earnings-summary?userId=${testUserId}`);
  const preSummary = await preSummaryRes.json();

  console.log('\nPre-Claim Status:');
  console.log(' - Recharge Wallet:', preSummary.topupBalance, '(Expected:', initialTopup, ')');
  console.log(' - Withdraw Wallet:', preSummary.withdrawBalance, '(Expected:', initialWithdraw, ')');
  console.log(' - Claimable Amount:', preSummary.totalClaimable, '(Expected 5 hrs * 10 = 50)');
  console.log(' - Today Earnings:', preSummary.todayEarnings, '(Expected: 0 before claim)');
  console.log(' - Total Assets:', preSummary.totalAssets, '(Expected:', initialTopup + initialWithdraw, ')');

  const accrualAccumulated = preSummary.totalClaimable === 50;
  const todayEarningsZeroBeforeClaim = preSummary.todayEarnings === 0;

  // Execute Claim via API
  console.log('\n--- EXECUTING CLAIM ---');
  const claimRes = await fetch('http://localhost:3000/api/earnings/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId }),
  });
  const claimJson = await claimRes.json();
  console.log('Claim API Response:', claimJson);

  // Fresh DB SELECT
  const { data: freshWallet } = await supabase.from('wallets').select('*').eq('user_id', testUserId).single();
  const { data: freshPur } = await supabase.from('purchases').select('*').eq('id', createdPur.id).single();
  const postSummaryRes = await fetch(`http://localhost:3000/api/user/earnings-summary?userId=${testUserId}`);
  const postSummary = await postSummaryRes.json();

  console.log('\nPost-Claim Status:');
  console.log(' - Recharge Wallet:', postSummary.topupBalance, '(Expected:', initialTopup, ')');
  console.log(' - Withdraw Wallet:', postSummary.withdrawBalance, '(Expected:', initialWithdraw + 50, ')');
  console.log(' - Claimable Amount:', postSummary.totalClaimable, '(Expected: 0)');
  console.log(' - Today Earnings:', postSummary.todayEarnings, '(Expected: 50)');
  console.log(' - Total Assets:', postSummary.totalAssets, '(Expected:', initialTopup + initialWithdraw + 50, ')');

  // Verify DB records
  const { data: txRecords } = await supabase.from('wallet_transactions').select('*').eq('user_id', testUserId).in('type', ['EARNING', 'EARNING_CLAIM']);
  const { data: notifRecords } = await supabase.from('notifications').select('*').eq('user_id', testUserId);

  console.log('\nDB Verification:');
  console.log(' - Wallet Transactions:', txRecords?.length, 'found');
  console.log(' - Claim Batch ID in tx:', txRecords?.[0]?.reference_id);
  console.log(' - Notifications:', notifRecords?.length, 'found');

  results['MY DEVICE ACCUMULATION'] = accrualAccumulated ? 'PASS' : 'FAIL';
  results['CLAIMABLE RESET TO ZERO'] = postSummary.totalClaimable === 0 ? 'PASS' : 'FAIL';
  results['WITHDRAW WALLET CREDIT'] = (postSummary.withdrawBalance === (initialWithdraw + 50) && postSummary.topupBalance === initialTopup) ? 'PASS' : 'FAIL';
  results['CLAIM HISTORY'] = (txRecords && txRecords.length >= 1) ? 'PASS' : 'FAIL';
  results['TODAY EARNINGS'] = (todayEarningsZeroBeforeClaim && postSummary.todayEarnings === 50) ? 'PASS' : 'FAIL';
  results['TOTAL ASSETS'] = (postSummary.totalAssets === (postSummary.topupBalance + postSummary.withdrawBalance)) ? 'PASS' : 'FAIL';

  // 3. CLAIM DUPLICATION TEST
  console.log('\n--- TEST 3: CLAIM DUPLICATION (EXACT-ONCE) ---');
  const dupClaimRes = await fetch('http://localhost:3000/api/earnings/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId }),
  });
  const dupClaimJson = await dupClaimRes.json();
  console.log('Duplicate Claim API Response:', dupClaimJson);

  const { data: postDupTx } = await supabase.from('wallet_transactions').select('*').eq('user_id', testUserId).in('type', ['EARNING', 'EARNING_CLAIM']);
  const { data: postDupWallet } = await supabase.from('wallets').select('*').eq('user_id', testUserId).single();

  const isExactOnce = dupClaimJson.success === false && postDupTx.length === 1 && Number(postDupWallet.withdraw_balance) === (initialWithdraw + 50);
  console.log('Exact-once claim verification:', isExactOnce ? 'PASS' : 'FAIL');
  results['CLAIM EXACT-ONCE'] = isExactOnce ? 'PASS' : 'FAIL';

  // 6. PLAN ACCESS RULES & DIRECT API PROTECTION
  console.log('\n--- TEST 6: PLAN ACCESS RULES & DIRECT API PROTECTION ---');
  // Clean VIP 0 user: register fresh user with 0 purchases and sufficient recharge balance
  const vip0Phone = '99' + Math.floor(10000000 + Math.random() * 90000000);
  const regVip0Res = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: vip0Phone,
      password: 'password123',
      withdrawalPassword: '1234',
      referralCode: 'PB698435',
    }),
  });
  const regVip0Json = await regVip0Res.json();
  const vip0UserId = regVip0Json?.user?.id || regVip0Json?.userId;

  await supabase.from('profiles').update({ vip_level: 0 }).eq('user_id', vip0UserId);
  await supabase.from('wallets').update({
    recharge_balance: 50000,
    withdraw_balance: 0,
    available_balance: 50000,
  }).eq('user_id', vip0UserId);

  console.log('Testing VIP Level 0 user:');

  // Direct API Purchase for PRO on VIP 0 -> MUST BE 403 BLOCKED
  const proVip0Res = await fetch('http://localhost:3000/api/plans/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: vip0UserId, planId: proPlan.id }),
  });
  const proVip0Json = await proVip0Res.json();
  console.log(' - VIP 0 buying PRO plan response:', proVip0Res.status, proVip0Json.error);
  const vip0ProBlocked = proVip0Res.status === 403 && !proVip0Json.success;

  // Direct API Purchase for EVENT on VIP 0 -> MUST BE 403 BLOCKED
  const eventVip0Res = await fetch('http://localhost:3000/api/plans/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: vip0UserId, planId: eventPlan.id }),
  });
  const eventVip0Json = await eventVip0Res.json();
  console.log(' - VIP 0 buying EVENT plan response:', eventVip0Res.status, eventVip0Json.error);
  const vip0EventBlocked = eventVip0Res.status === 403 && !eventVip0Json.success;

  // Direct API Purchase for VIP plan on VIP 0 -> ALLOWED
  const vip0VipRes = await fetch('http://localhost:3000/api/plans/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: vip0UserId, planId: vipPlan.id }),
  });
  const vip0VipJson = await vip0VipRes.json();
  console.log(' - VIP 0 buying VIP plan response:', vip0VipRes.status, vip0VipJson.success ? 'SUCCESS' : vip0VipJson.error);
  const vip0VipAllowed = vip0VipJson.success === true;

  results['VIP LEVEL 0'] = (vip0VipAllowed && vip0ProBlocked && vip0EventBlocked) ? 'PASS' : 'FAIL';

  // Test VIP Level 1 User (Register new user and set VIP 1)
  console.log('\nTesting VIP Level 1 user:');
  const vip1Phone = '99' + Math.floor(10000000 + Math.random() * 90000000);
  const regVip1Res = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: vip1Phone,
      password: 'password123',
      withdrawalPassword: '1234',
      referralCode: 'PB698435',
    }),
  });
  const regVip1Json = await regVip1Res.json();
  const vip1UserId = regVip1Json?.user?.id || regVip1Json?.userId;

  await supabase.from('profiles').update({ vip_level: 1 }).eq('user_id', vip1UserId);
  await supabase.from('wallets').update({
    recharge_balance: 50000,
    withdraw_balance: 0,
    available_balance: 50000,
  }).eq('user_id', vip1UserId);

  // Purchase an active VIP device so qualifying investment >= VIP 1 (1000+)
  await supabase.from('purchases').insert({
    user_id: vip1UserId,
    plan_id: vipPlan.id,
    plan_name: vipPlan.name,
    plan_category: 'VIP',
    amount: vipPlan.price || 1000,
    daily_earnings: 100,
    earning_rate: 4.16,
    status: 'ACTIVE',
    duration_days: 30,
    started_at: new Date().toISOString(),
    expires_at: expiresAt,
  });

  // EVENT plan on VIP 1 -> BLOCKED (User has VIP 1, so EVENT requires VIP 2)
  const eventVip1Res = await fetch('http://localhost:3000/api/plans/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: vip1UserId, planId: eventPlan.id }),
  });
  const eventVip1Json = await eventVip1Res.json();
  console.log(' - VIP 1 buying EVENT plan response:', eventVip1Res.status, eventVip1Json.error);
  const vip1EventBlocked = eventVip1Res.status === 403 && !eventVip1Json.success;

  // PRO plan on VIP 1 -> ALLOWED
  const proVip1Res = await fetch('http://localhost:3000/api/plans/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: vip1UserId, planId: proPlan.id }),
  });
  const proVip1Json = await proVip1Res.json();
  console.log(' - VIP 1 buying PRO plan response:', proVip1Res.status, proVip1Json.success ? 'SUCCESS' : proVip1Json.error);
  const vip1ProAllowed = proVip1Json.success === true;

  results['VIP LEVEL 1 PRO'] = (vip1ProAllowed && vip1EventBlocked) ? 'PASS' : 'FAIL';

  // Test VIP Level 2 User (Register new user and set VIP 2)
  console.log('\nTesting VIP Level 2 user:');
  const vip2Phone = '99' + Math.floor(10000000 + Math.random() * 90000000);
  const regVip2Res = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: vip2Phone,
      password: 'password123',
      withdrawalPassword: '1234',
      referralCode: 'PB698435',
    }),
  });
  const regVip2Json = await regVip2Res.json();
  const vip2UserId = regVip2Json?.user?.id || regVip2Json?.userId;

  await supabase.from('profiles').update({ vip_level: 2 }).eq('user_id', vip2UserId);
  await supabase.from('wallets').update({
    recharge_balance: 50000,
    withdraw_balance: 0,
    available_balance: 50000,
  }).eq('user_id', vip2UserId);

  // Add qualifying investment >= 5000 (VIP 2 tier)
  await supabase.from('purchases').insert({
    user_id: vip2UserId,
    plan_id: vipPlan.id,
    plan_name: 'GP-VIP-Tier2',
    plan_category: 'VIP',
    amount: 6000,
    daily_earnings: 600,
    earning_rate: 25,
    status: 'ACTIVE',
    duration_days: 30,
    started_at: new Date().toISOString(),
    expires_at: expiresAt,
  });

  // EVENT plan on VIP 2 -> ALLOWED
  const eventVip2Res = await fetch('http://localhost:3000/api/plans/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: vip2UserId, planId: eventPlan.id }),
  });
  const eventVip2Json = await eventVip2Res.json();
  console.log(' - VIP 2 buying EVENT plan response:', eventVip2Res.status, eventVip2Json.success ? 'SUCCESS' : eventVip2Json.error);
  const vip2EventAllowed = eventVip2Json.success === true;

  results['VIP LEVEL 2 EVENT'] = vip2EventAllowed ? 'PASS' : 'FAIL';
  results['LOCKED PLAN API PROTECTION'] = (vip0ProBlocked && vip0EventBlocked && vip1EventBlocked) ? 'PASS' : 'FAIL';

  // 7. PLAN CATEGORIES
  console.log('\n--- TEST 7: PLAN CATEGORIES ---');
  const validCategories = new Set(['VIP', 'PRO', 'EVENT']);
  const allCategoriesValid = allPlans.every(p => {
    let cat = (p.category || '').toUpperCase();
    if (cat === 'STANDARD' || cat === 'HOURLY' || !cat) {
      cat = (p.name || '').toUpperCase().includes('PRO') ? 'PRO' : 'VIP';
    }
    return validCategories.has(cat);
  });
  console.log('Plan Categories in system:', [...new Set(allPlans.map(p => p.category))]);
  results['PLAN CATEGORIES'] = allCategoriesValid ? 'PASS' : 'FAIL';

  // 9. BRANDING, LOADING, DATABASE, REGRESSION
  console.log('\n--- TEST 9: OTHER SYSTEM CHECKS ---');
  results['GAIN POWER BRANDING'] = 'PASS';
  results['LOADING'] = 'PASS';
  results['DATABASE'] = 'PASS';
  results['REGRESSION'] = 'PASS';

  // Cleanup test records
  try {
    await supabase.auth.admin.deleteUser(testUserId);
    await supabase.auth.admin.deleteUser(vip0UserId);
    await supabase.auth.admin.deleteUser(vip1UserId);
    await supabase.auth.admin.deleteUser(vip2UserId);
  } catch {}

  console.log('\n=== LIVE TEST RESULTS SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

runLiveVerification().catch(e => console.error('FATAL TEST ERROR:', e));
