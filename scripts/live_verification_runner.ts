import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://evhwqlnymvoduclmzshz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const API_BASE = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function registerUser(referrerCode: string = 'PB698435') {
  const phone = '91' + Math.floor(10000000 + Math.random() * 90000000);
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      password: 'Password123!',
      withdrawalPassword: '1234',
      referralCode: referrerCode,
    }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Register failed: ${JSON.stringify(data)}`);
  }
  return {
    userId: data.userId as string,
    profile: data.profile,
    wallet: data.wallet,
    referralCode: (data.profile?.referral_code || data.profile?.membership_number) as string,
  };
}

async function main() {
  console.log('===============================================================');
  console.log('STARTING LIVE SYSTEM VERIFICATION OF ALL EXACT REQUIREMENTS');
  console.log('===============================================================\n');

  let test1Passed = true;
  let test2Passed = true;
  let test3Passed = true;

  // Track exact IDs for reporting
  let test3UserAId = '';
  let test3UserBId = '';
  let test3RewardTxId = '';
  let test3RewardLedgerId = '';
  let test3RewardAmount = 0;

  // =========================================================================
  // 1. PLAN PURCHASE
  // =========================================================================
  console.log('--- 1. VERIFYING PLAN PURCHASE ---');
  try {
    const user1 = await registerUser();
    console.log(`Created User 1: ${user1.userId}`);

    // Set Topup = 200, Withdraw = 500 => Combined Usable = 700
    await supabase.from('wallets').update({
      recharge_balance: 200,
      withdraw_balance: 500,
      earned_balance: 500,
      available_balance: 700,
    }).eq('user_id', user1.userId);

    // Verify VIP0
    await supabase.from('profiles').update({ vip_level: 0 }).eq('user_id', user1.userId);

    // Create Temporary Test Plans
    const p600Id = crypto.randomUUID();
    const p800Id = crypto.randomUUID();
    const pProId = crypto.randomUUID();
    const pEvtId = crypto.randomUUID();

    await supabase.from('plans').insert([
      {
        id: p600Id,
        name: 'VIP Test Station 600',
        category: 'VIP',
        price: 600,
        earning_rate: 5,
        daily_earnings: 120,
        duration_days: 30,
        purchase_limit: 1,
        limit_per_user: 1,
        status: 'active',
      },
      {
        id: p800Id,
        name: 'VIP Test Station 800',
        category: 'VIP',
        price: 800,
        earning_rate: 7,
        daily_earnings: 168,
        duration_days: 30,
        purchase_limit: 1,
        limit_per_user: 1,
        status: 'active',
      },
      {
        id: pProId,
        name: 'PRO Test Station 100',
        category: 'PRO',
        price: 100,
        earning_rate: 10,
        daily_earnings: 240,
        duration_days: 15,
        purchase_limit: 5,
        limit_per_user: 5,
        status: 'active',
      },
      {
        id: pEvtId,
        name: 'EVENT Test Station 100',
        category: 'EVENT',
        price: 100,
        earning_rate: 15,
        daily_earnings: 360,
        duration_days: 7,
        purchase_limit: 5,
        limit_per_user: 5,
        status: 'active',
      },
    ]);

    // Test: ₹800 plan purchase must fail (700 usable < 800)
    const res800 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: p800Id }),
    });
    const json800 = await res800.json();
    console.log(`[1.1] ₹800 purchase response (expected fail): ${res800.status}`, json800.error);
    if (res800.status !== 400 || !json800.error?.includes('Insufficient combined wallet balance')) {
      console.error('FAIL: ₹800 purchase should have failed with Insufficient combined wallet balance');
      test1Passed = false;
    }

    // Verify wallet still has 200 topup, 500 withdraw
    const { data: walAfter800 } = await supabase.from('wallets').select('*').eq('user_id', user1.userId).single();
    if (Number(walAfter800.recharge_balance) !== 200 || Number(walAfter800.withdraw_balance) !== 500) {
      console.error('FAIL: Wallet deducted on ₹800 rejection');
      test1Passed = false;
    }

    // Test: VIP0 = ONLY VIP (PRO and EVENT must be rejected with 403)
    const resProVip0 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: pProId }),
    });
    const jsonProVip0 = await resProVip0.json();
    console.log(`[1.2] VIP0 purchasing PRO (expected 403): ${resProVip0.status}`, jsonProVip0.error);
    if (resProVip0.status !== 403) {
      console.error('FAIL: VIP0 purchasing PRO must return 403');
      test1Passed = false;
    }

    const resEvtVip0 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: pEvtId }),
    });
    const jsonEvtVip0 = await resEvtVip0.json();
    console.log(`[1.2] VIP0 purchasing EVENT (expected 403): ${resEvtVip0.status}`, jsonEvtVip0.error);
    if (resEvtVip0.status !== 403) {
      console.error('FAIL: VIP0 purchasing EVENT must return 403');
      test1Passed = false;
    }

    // Test: ₹600 plan purchase must succeed (uses Topup ₹200 + Withdraw ₹400 = ₹600)
    const res600 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: p600Id }),
    });
    const json600 = await res600.json();
    console.log(`[1.3] ₹600 purchase response (expected success): ${res600.status}`, json600.message || json600);
    if (!json600.success) {
      console.error('FAIL: ₹600 purchase should have succeeded', json600);
      test1Passed = false;
    }

    // Verify wallet deduction: Topup 200 -> 0, Withdraw 500 -> 100, Available 700 -> 100
    const { data: walAfter600 } = await supabase.from('wallets').select('*').eq('user_id', user1.userId).single();
    console.log(`[1.3] Balances after ₹600 purchase: Recharge=${walAfter600.recharge_balance}, Withdraw=${walAfter600.withdraw_balance}, Available=${walAfter600.available_balance}`);
    if (Number(walAfter600.recharge_balance) !== 0 || Number(walAfter600.withdraw_balance) !== 100 || Number(walAfter600.available_balance) !== 100) {
      console.error('FAIL: Balances after ₹600 purchase are incorrect', walAfter600);
      test1Passed = false;
    }

    // Test: Admin Purchase Limit = 1 -> second purchase of SAME plan must be rejected without deduction
    // Give user more balance first so balance isn't why it fails
    await supabase.from('wallets').update({
      recharge_balance: 1000,
      available_balance: 1100,
    }).eq('user_id', user1.userId);

    const res600Second = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: p600Id }),
    });
    const json600Second = await res600Second.json();
    console.log(`[1.4] Second purchase of same plan (limit=1) response: ${res600Second.status}`, json600Second.error);
    if (res600Second.status !== 400 || !json600Second.error?.includes('maximum purchase limit')) {
      console.error('FAIL: Second purchase of plan with limit=1 should have failed');
      test1Passed = false;
    }

    // Verify wallet was NOT deducted
    const { data: walAfterSecond } = await supabase.from('wallets').select('*').eq('user_id', user1.userId).single();
    if (Number(walAfterSecond.recharge_balance) !== 1000) {
      console.error('FAIL: Wallet was deducted on rejected second purchase', walAfterSecond);
      test1Passed = false;
    }

    // Test VIP1 = VIP + PRO:
    // First verify EVENT is locked for VIP1
    await supabase.from('profiles').update({ vip_level: 1 }).eq('user_id', user1.userId);

    const resEvtVip1 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: pEvtId }),
    });
    const jsonEvtVip1 = await resEvtVip1.json();
    console.log(`[1.5] VIP1 purchasing EVENT (expected 403): ${resEvtVip1.status}`, jsonEvtVip1.error);
    if (resEvtVip1.status !== 403) {
      console.error('FAIL: VIP1 purchasing EVENT must return 403');
      test1Passed = false;
    }

    // Now test VIP1 purchasing PRO (allowed)
    const resProVip1 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: pProId }),
    });
    const jsonProVip1 = await resProVip1.json();
    console.log(`[1.5] VIP1 purchasing PRO (expected success): ${resProVip1.status}`, jsonProVip1.message || jsonProVip1);
    if (!jsonProVip1.success) {
      console.error('FAIL: VIP1 should be able to purchase PRO plan');
      test1Passed = false;
    }

    // Test: VIP2 = VIP + PRO + EVENT (can buy EVENT)
    await supabase.from('profiles').update({ vip_level: 2 }).eq('user_id', user1.userId);

    const resEvtVip2 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1.userId, planId: pEvtId }),
    });
    const jsonEvtVip2 = await resEvtVip2.json();
    console.log(`[1.6] VIP2 purchasing EVENT (expected success): ${resEvtVip2.status}`, jsonEvtVip2.message || jsonEvtVip2);
    if (!jsonEvtVip2.success) {
      console.error('FAIL: VIP2 should be able to purchase EVENT plan');
      test1Passed = false;
    }

    // Cleanup test plans
    await supabase.from('plans').delete().in('id', [p600Id, p800Id, pProId, pEvtId]);
  } catch (err) {
    console.error('Error in Plan Purchase test:', err);
    test1Passed = false;
  }

  // =========================================================================
  // 2. DAILY CHECK-IN
  // =========================================================================
  console.log('\n--- 2. VERIFYING DAILY CHECK-IN ---');
  try {
    // Verify & Set Admin Settings in DB:
    // Day 1 = ₹5, Day 2 = ₹5, Day 3 = ₹5, Day 4 = ₹5, Day 5 = ₹5, Day 6 = ₹5, Day 7 = ₹100
    const { data: curSysRow } = await supabase.from('admin_settings').select('value').eq('id', 'system').single();
    const curVal = curSysRow?.value || {};
    const exactCheckInRewards = {
      day1: 5,
      day2: 5,
      day3: 5,
      day4: 5,
      day5: 5,
      day6: 5,
      day7: 100,
    };
    await supabase.from('admin_settings').update({
      value: {
        ...curVal,
        isDailyCheckInEnabled: true,
        dailyCheckInAmount: 5,
        dailyCheckInDay7Bonus: 100,
        checkInRewards: exactCheckInRewards,
      },
    }).eq('id', 'system');

    const { data: verifiedSys } = await supabase.from('admin_settings').select('value').eq('id', 'system').single();
    console.log('[2.1] Admin Check-in Config stored in DB:', verifiedSys.value.checkInRewards);

    // Create new test user for check-in
    const user2 = await registerUser();
    console.log(`Created User 2 for Check-in: ${user2.userId}`);

    // Fetch check-in status from API
    const resStatus = await fetch(`${API_BASE}/api/fortune/checkin-status?userId=${user2.userId}`);
    const jsonStatus = await resStatus.json();
    console.log('[2.2] /api/fortune/checkin-status response:', {
      todayReward: jsonStatus.todayReward,
      checkInRewards: jsonStatus.checkInRewards,
      hasCheckedInToday: jsonStatus.hasCheckedInToday,
    });
    if (jsonStatus.todayReward !== 5 || jsonStatus.checkInRewards?.day7 !== 100) {
      console.error('FAIL: Status endpoint did not return configured values');
      test2Passed = false;
    }

    // Initial wallet balance
    const { data: wal2Before } = await supabase.from('wallets').select('*').eq('user_id', user2.userId).single();
    const initialTopup = Number(wal2Before.recharge_balance);

    // Perform Check-in (Day 1)
    const resCheckIn = await fetch(`${API_BASE}/api/fortune/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user2.userId }),
    });
    const jsonCheckIn = await resCheckIn.json();
    console.log('[2.3] Check-in Day 1 response:', jsonCheckIn);
    if (!jsonCheckIn.success || jsonCheckIn.reward !== 5) {
      console.error('FAIL: Day 1 check-in reward was not ₹5');
      test2Passed = false;
    }

    // Verify wallet was actually credited with ₹5
    const { data: wal2After } = await supabase.from('wallets').select('*').eq('user_id', user2.userId).single();
    console.log(`[2.3] Wallet recharge balance before: ${initialTopup}, after: ${wal2After.recharge_balance}`);
    if (Number(wal2After.recharge_balance) !== initialTopup + 5) {
      console.error('FAIL: Wallet recharge balance did not increase by ₹5');
      test2Passed = false;
    }

    // Verify same-day duplicate check-in cannot pay twice
    const resDup = await fetch(`${API_BASE}/api/fortune/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user2.userId }),
    });
    const jsonDup = await resDup.json();
    console.log(`[2.4] Duplicate same-day check-in response status: ${resDup.status}`, jsonDup.error);
    const isDupRejected = resDup.status === 409 || resDup.status === 400 || !jsonDup.success;
    if (!isDupRejected || !jsonDup.error?.toLowerCase().includes('already checked in today')) {
      console.error('FAIL: Duplicate check-in was not rejected with error');
      test2Passed = false;
    }

    // Verify wallet balance remained exactly initialTopup + 5
    const { data: wal2AfterDup } = await supabase.from('wallets').select('*').eq('user_id', user2.userId).single();
    if (Number(wal2AfterDup.recharge_balance) !== initialTopup + 5) {
      console.error('FAIL: Duplicate check-in credited wallet a second time!');
      test2Passed = false;
    }
  } catch (err) {
    console.error('Error in Daily Check-in test:', err);
    test2Passed = false;
  }

  // =========================================================================
  // 3. CONSECUTIVE CLAIM REWARD — CRITICAL
  // =========================================================================
  console.log('\n--- 3. VERIFYING CONSECUTIVE CLAIM REWARD (CRITICAL) ---');
  try {
    // 3.1 Admin Configuration in DB: Streak Days = 3, Reward = ₹15
    const { data: refSetRow } = await supabase.from('admin_settings').select('value').eq('id', 'referral_settings').single();
    const curRefSet = refSetRow?.value || {};
    await supabase.from('admin_settings').update({
      value: {
        ...curRefSet,
        isReferralSystemEnabled: true,
        streakReward: {
          enabled: true,
          consecutiveDays: 3,
          rewardAmount: 15,
        },
      },
    }).eq('id', 'referral_settings');

    // 3.2 User A refers User B
    const userA = await registerUser();
    console.log(`Created User A (Referrer): ${userA.userId} with code ${userA.referralCode}`);
    test3UserAId = userA.userId;

    const userB = await registerUser(userA.referralCode);
    console.log(`Created User B (Referee): ${userB.userId} (referred by A)`);
    test3UserBId = userB.userId;

    // Verify referral relationship in DB
    const { data: refRow } = await supabase.from('referrals').select('*').eq('referee_id', userB.userId).single();
    console.log(`[3.2] Verified referral in DB: referrer_id=${refRow?.referrer_id}, referee_id=${refRow?.referee_id}`);
    if (refRow?.referrer_id !== userA.userId) {
      console.error('FAIL: User B is not linked to User A as referrer');
      test3Passed = false;
    }

    // Set User A's initial Withdraw wallet to 0
    await supabase.from('wallets').update({
      withdraw_balance: 0,
      earned_balance: 0,
      available_balance: 0,
    }).eq('user_id', userA.userId);

    // Create device plan and purchase for B with started_at and last_claimed_at 4 hours ago
    const devicePlanId = crypto.randomUUID();
    await supabase.from('plans').insert({
      id: devicePlanId,
      name: 'Claim Device Plan',
      category: 'VIP',
      price: 100,
      earning_rate: 10,
      daily_earnings: 240,
      duration_days: 30,
      purchase_limit: 5,
      status: 'active',
    });

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(now.getTime() + istOffset);
    const yesterdayStr = new Date(now.getTime() + istOffset - 86400000).toISOString().split('T')[0];
    const twoDaysAgoStr = new Date(now.getTime() + istOffset - 2 * 86400000).toISOString().split('T')[0];

    const fourHoursAgoIso = new Date(Date.now() - 4 * 3600 * 1000).toISOString();

    const { data: purchaseB } = await supabase.from('purchases').insert({
      id: crypto.randomUUID(),
      user_id: userB.userId,
      plan_id: devicePlanId,
      plan_name: 'Claim Device Plan',
      plan_category: 'VIP',
      amount: 100,
      hourly_rate: 10,
      earning_rate: 10,
      daily_earnings: 240,
      duration_days: 30,
      status: 'ACTIVE',
      started_at: fourHoursAgoIso,
      last_claimed_at: fourHoursAgoIso,
      last_settled_at: fourHoursAgoIso,
    }).select().single();

    // 3.3 Simulate Day 1 & Day 2 claims:
    // Day 1 claim: streak = 1 on twoDaysAgoStr
    // Day 2 claim: streak = 2 on yesterdayStr
    const streakKey = `streak_${userB.userId}`;
    await supabase.from('admin_settings').upsert({
      id: streakKey,
      value: {
        currentStreak: 2,
        lastClaimDate: yesterdayStr,
        rewardCredited: false,
      },
    });

    // Check User A before Day 3 claim
    const { data: walABefore } = await supabase.from('wallets').select('*').eq('user_id', userA.userId).single();
    console.log(`[3.3] User A Withdraw balance before Day 3 claim: ${walABefore.withdraw_balance}`);
    if (Number(walABefore.withdraw_balance) !== 0) {
      console.error('FAIL: User A should have 0 withdraw balance');
      test3Passed = false;
    }

    // Day 3: User B successfully claims Device Earnings via /api/earnings/claim
    const resClaimB = await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userB.userId }),
    });
    const jsonClaimB = await resClaimB.json();
    console.log('[3.4] User B claims Device Earnings on Day 3:', jsonClaimB);
    if (!jsonClaimB.success) {
      console.error('FAIL: User B Device Earnings claim failed', jsonClaimB);
      test3Passed = false;
    }

    // Wait for server async streak processing
    await new Promise((r) => setTimeout(r, 1500));

    // Verify User A receives EXACTLY ₹15 in Withdraw Wallet
    const { data: walAAfter } = await supabase.from('wallets').select('*').eq('user_id', userA.userId).single();
    console.log(`[3.5] User A Withdraw Balance after User B 3-day claim: ₹${walAAfter.withdraw_balance}`);
    if (Number(walAAfter.withdraw_balance) !== 15 || Number(walAAfter.available_balance) !== 15) {
      console.error('FAIL: User A did not receive exactly ₹15 in Withdraw Wallet', walAAfter);
      test3Passed = false;
    }
    test3RewardAmount = Number(walAAfter.withdraw_balance);

    // Verify Transaction in wallet_transactions for User A
    const streakRefId = `STRK-REF-${userB.userId}`;
    const { data: txA } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userA.userId)
      .eq('reference_id', streakRefId)
      .single();
    console.log('[3.6] User A wallet_transactions record:', {
      id: txA?.id,
      user_id: txA?.user_id,
      type: txA?.type,
      amount: txA?.amount,
      wallet_type: txA?.wallet_type,
      reference_id: txA?.reference_id,
      description: txA?.description,
    });
    test3RewardTxId = txA?.id || '';
    if (!txA || Number(txA.amount) !== 15 || txA.wallet_type !== 'WITHDRAW' || txA.type !== 'REFERRAL_BONUS') {
      console.error('FAIL: Transaction record missing or invalid', txA);
      test3Passed = false;
    }

    // Verify Ledger entry in wallet_ledger
    const { data: ledgerA } = await supabase
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', userA.userId)
      .eq('reference_id', streakRefId)
      .maybeSingle();
    console.log('[3.7] User A wallet_ledger record:', {
      id: ledgerA?.id,
      amount: ledgerA?.amount,
      direction: ledgerA?.direction,
      transaction_type: ledgerA?.transaction_type,
    });
    test3RewardLedgerId = ledgerA?.id || '';

    // Verify Idempotency: Duplicate claim on same day does NOT pay A twice
    // Update purchase so B has another hour to claim
    await supabase.from('purchases').update({
      last_claimed_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    }).eq('id', purchaseB.id);

    const resClaimBRetry = await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userB.userId }),
    });
    const jsonClaimBRetry = await resClaimBRetry.json();
    console.log('[3.8] User B same-day claim retry:', jsonClaimBRetry);
    await new Promise((r) => setTimeout(r, 1000));

    const { data: walAAfterRetry } = await supabase.from('wallets').select('*').eq('user_id', userA.userId).single();
    console.log(`[3.8] User A Withdraw Balance after same-day retry/refresh: ₹${walAAfterRetry.withdraw_balance}`);
    if (Number(walAAfterRetry.withdraw_balance) !== 15) {
      console.error('FAIL: User A was paid twice on same day retry');
      test3Passed = false;
    }

    // Verify Dynamic Config: Admin changes reward to ₹20 -> next qualifying streak pays ₹20
    await supabase.from('admin_settings').update({
      value: {
        ...curRefSet,
        isReferralSystemEnabled: true,
        streakReward: {
          enabled: true,
          consecutiveDays: 3,
          rewardAmount: 20, // CHANGED TO 20
        },
      },
    }).eq('id', 'referral_settings');

    const userC = await registerUser(userA.referralCode);
    await supabase.from('purchases').insert({
      id: crypto.randomUUID(),
      user_id: userC.userId,
      plan_id: devicePlanId,
      plan_name: 'Claim Device Plan C',
      plan_category: 'VIP',
      amount: 100,
      hourly_rate: 10,
      earning_rate: 10,
      daily_earnings: 240,
      duration_days: 30,
      status: 'ACTIVE',
      started_at: fourHoursAgoIso,
      last_claimed_at: fourHoursAgoIso,
      last_settled_at: fourHoursAgoIso,
    });

    // Simulate C at Day 2 streak yesterday
    await supabase.from('admin_settings').upsert({
      id: `streak_${userC.userId}`,
      value: {
        currentStreak: 2,
        lastClaimDate: yesterdayStr,
        rewardCredited: false,
      },
    });

    // User C claims today (Day 3)
    const resClaimC = await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userC.userId }),
    });
    const jsonClaimC = await resClaimC.json();
    console.log('[3.9] User C claims device earnings (Day 3 under ₹20 config):', jsonClaimC);
    await new Promise((r) => setTimeout(r, 1500));

    // A balance should now be 15 + 20 = 35
    const { data: walAAfterC } = await supabase.from('wallets').select('*').eq('user_id', userA.userId).single();
    console.log(`[3.9] User A Withdraw Balance after C qualifies under ₹20 config: ₹${walAAfterC.withdraw_balance}`);
    if (Number(walAAfterC.withdraw_balance) !== 35) {
      console.error('FAIL: User A did not receive ₹20 for C qualifying streak', walAAfterC);
      test3Passed = false;
    }

    // Verify Missed Day breaks streak
    const userD = await registerUser(userA.referralCode);
    await supabase.from('purchases').insert({
      id: crypto.randomUUID(),
      user_id: userD.userId,
      plan_id: devicePlanId,
      plan_name: 'Claim Device Plan D',
      plan_category: 'VIP',
      amount: 100,
      hourly_rate: 10,
      earning_rate: 10,
      daily_earnings: 240,
      duration_days: 30,
      status: 'ACTIVE',
      started_at: fourHoursAgoIso,
      last_claimed_at: fourHoursAgoIso,
      last_settled_at: fourHoursAgoIso,
    });

    // D missed yesterday (last claim was 2 days ago)
    await supabase.from('admin_settings').upsert({
      id: `streak_${userD.userId}`,
      value: {
        currentStreak: 2,
        lastClaimDate: twoDaysAgoStr,
        rewardCredited: false,
      },
    });

    // D claims today
    const resClaimD = await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userD.userId }),
    });
    const jsonClaimD = await resClaimD.json();
    console.log('[3.10] User D claims after missed day:', jsonClaimD);
    await new Promise((r) => setTimeout(r, 1500));

    const { data: streakD } = await supabase.from('admin_settings').select('value').eq('id', `streak_${userD.userId}`).single();
    console.log(`[3.10] User D streak after missing a day (expected reset to 1): ${streakD?.value?.currentStreak}`);
    if (streakD?.value?.currentStreak !== 1) {
      console.error('FAIL: Missed calendar day did not reset streak to 1', streakD?.value);
      test3Passed = false;
    }

    // Cleanup test plan
    await supabase.from('plans').delete().eq('id', devicePlanId);
  } catch (err) {
    console.error('Error in Consecutive Claim Reward test:', err);
    test3Passed = false;
  }

  console.log('\n===============================================================');
  console.log('FINAL SYSTEM VERIFICATION SUMMARY');
  console.log('===============================================================');
  console.log(`1. Plan Purchase: ${test1Passed ? 'PASS' : 'FAIL'}`);
  console.log(`2. Daily Check-in: ${test2Passed ? 'PASS' : 'FAIL'}`);
  console.log(`3. Consecutive Claim Reward: ${test3Passed ? 'PASS' : 'FAIL'}`);
  console.log('\nActual DB Records Used for User A -> User B 3-Day Test:');
  console.log(`- Referrer (User A) ID: ${test3UserAId}`);
  console.log(`- Referee (User B) ID: ${test3UserBId}`);
  console.log(`- Reward Credited: ₹${test3RewardAmount} into User A Withdraw Wallet`);
  console.log(`- Transaction ID in wallet_transactions: ${test3RewardTxId}`);
  console.log(`- Ledger ID in wallet_ledger: ${test3RewardLedgerId}`);
  console.log(`- Code Changes Made During Verification: YES (Fixed non-existent column topup_balance in server.ts line 3833)`);
}

main().catch(console.error);
