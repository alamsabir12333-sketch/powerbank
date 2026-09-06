import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://evhwqlnymvoduclmzshz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const API_BASE = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createTestUser(params: {
  userId: string;
  phone: string;
  vipLevel: number;
  rechargeBal: number;
  withdrawBal: number;
}) {
  const { userId, phone, vipLevel, rechargeBal, withdrawBal } = params;
  const username = 'test_' + phone;

  await supabase.from('users').insert({
    id: userId,
    phone,
    username,
    vip_level: vipLevel,
    status: 'ACTIVE',
  });

  await supabase.from('profiles').insert({
    id: crypto.randomUUID(),
    user_id: userId,
    phone,
    username,
    vip_level: vipLevel,
    role: 'user',
    status: 'active',
  });

  await supabase.from('wallets').insert({
    id: crypto.randomUUID(),
    user_id: userId,
    recharge_balance: rechargeBal,
    withdraw_balance: withdrawBal,
    earned_balance: withdrawBal,
    available_balance: Number((rechargeBal + withdrawBal).toFixed(2)),
  });
}

async function main() {
  console.log('=== STARTING LIVE VERIFICATION OF ALL 3 REQUIREMENTS ===\n');

  let p1Pass = true;
  let p2Pass = true;
  let p3Pass = true;

  // =========================================================================
  // 1. PLAN PURCHASE VERIFICATION
  // =========================================================================
  console.log('--- TEST 1: PLAN PURCHASE ---');
  const user1Id = crypto.randomUUID();
  const plan600Id = crypto.randomUUID();
  const plan800Id = crypto.randomUUID();
  const planProId = crypto.randomUUID();
  const planEventId = crypto.randomUUID();

  try {
    // 1.1 Create Test User with Topup: 200, Withdraw: 500 (Usable = 700)
    await createTestUser({
      userId: user1Id,
      phone: '98' + Math.floor(10000000 + Math.random() * 90000000),
      vipLevel: 0,
      rechargeBal: 200,
      withdrawBal: 500,
    });

    // Create Test Plans
    await supabase.from('plans').insert([
      {
        id: plan600Id,
        name: 'VIP Test Cabinet 600',
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
        id: plan800Id,
        name: 'VIP Test Cabinet 800',
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
        id: planProId,
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
        id: planEventId,
        name: 'EVENT Test Grid 100',
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

    // Test 1.1: ₹800 purchase must fail (Topup 200 + Withdraw 500 = 700 < 800)
    const res800 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: plan800Id }),
    });
    const json800 = await res800.json();
    console.log('[1.1] ₹800 Plan Purchase response status:', res800.status, json800.error);
    if (res800.status !== 400 || !json800.error?.includes('Insufficient combined wallet balance')) {
      console.error('FAIL: Expected 400 Insufficient combined wallet balance');
      p1Pass = false;
    }

    // Verify wallet still has 200 topup, 500 withdraw
    const { data: walAfter800 } = await supabase.from('wallets').select('*').eq('user_id', user1Id).single();
    if (Number(walAfter800.recharge_balance) !== 200 || Number(walAfter800.withdraw_balance) !== 500) {
      console.error('FAIL: Wallet was wrongly deducted on 800 failure', walAfter800);
      p1Pass = false;
    }

    // Test 1.2: VIP0 restrictions (VIP0 cannot buy PRO or EVENT)
    const resProVip0 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: planProId }),
    });
    const jsonProVip0 = await resProVip0.json();
    console.log('[1.2] VIP0 buying PRO response status:', resProVip0.status, jsonProVip0.error);
    if (resProVip0.status !== 403) {
      console.error('FAIL: VIP0 buying PRO should be 403');
      p1Pass = false;
    }

    const resEvtVip0 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: planEventId }),
    });
    const jsonEvtVip0 = await resEvtVip0.json();
    console.log('[1.2] VIP0 buying EVENT response status:', resEvtVip0.status, jsonEvtVip0.error);
    if (resEvtVip0.status !== 403) {
      console.error('FAIL: VIP0 buying EVENT should be 403');
      p1Pass = false;
    }

    // Test 1.3: ₹600 purchase must succeed using combined balance
    // Deducts ₹200 from Topup (becomes 0), ₹400 from Withdraw (becomes 100)
    const res600 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: plan600Id }),
    });
    const json600 = await res600.json();
    console.log('[1.3] ₹600 Plan Purchase response:', res600.status, json600.message || json600);
    if (!json600.success) {
      console.error('FAIL: ₹600 purchase failed', json600);
      p1Pass = false;
    }

    const { data: walAfter600 } = await supabase.from('wallets').select('*').eq('user_id', user1Id).single();
    console.log('[1.3] Wallet after ₹600 purchase:', {
      recharge_balance: walAfter600.recharge_balance,
      withdraw_balance: walAfter600.withdraw_balance,
      available_balance: walAfter600.available_balance,
    });
    if (Number(walAfter600.recharge_balance) !== 0 || Number(walAfter600.withdraw_balance) !== 100) {
      console.error('FAIL: Wallet deduction incorrect', walAfter600);
      p1Pass = false;
    }

    // Test 1.4: Second purchase of same plan with limit = 1 must fail
    // Give user more balance first to test limit rejection
    await supabase.from('wallets').update({
      recharge_balance: 1000,
      withdraw_balance: 0,
      available_balance: 1000,
    }).eq('user_id', user1Id);

    const res600Second = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: plan600Id }),
    });
    const json600Second = await res600Second.json();
    console.log('[1.4] Second ₹600 Plan Purchase (limit=1) response:', res600Second.status, json600Second.error);
    if (res600Second.status !== 400 || !json600Second.error?.includes('maximum purchase limit')) {
      console.error('FAIL: Second purchase did not trigger purchase limit');
      p1Pass = false;
    }

    // Verify wallet was NOT deducted
    const { data: walAfterSecond } = await supabase.from('wallets').select('*').eq('user_id', user1Id).single();
    if (Number(walAfterSecond.recharge_balance) !== 1000) {
      console.error('FAIL: Wallet deducted on rejected second purchase', walAfterSecond);
      p1Pass = false;
    }

    // Test 1.5: VIP 1 can buy PRO but NOT EVENT
    await supabase.from('profiles').update({ vip_level: 1 }).eq('user_id', user1Id);
    const resProVip1 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: planProId }),
    });
    const jsonProVip1 = await resProVip1.json();
    console.log('[1.5] VIP 1 buying PRO response:', resProVip1.status, jsonProVip1.message || jsonProVip1);
    if (!jsonProVip1.success) {
      console.error('FAIL: VIP 1 should be allowed to buy PRO', jsonProVip1);
      p1Pass = false;
    }

    const resEvtVip1 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: planEventId }),
    });
    const jsonEvtVip1 = await resEvtVip1.json();
    console.log('[1.5] VIP 1 buying EVENT response:', resEvtVip1.status, jsonEvtVip1.error);
    if (resEvtVip1.status !== 403) {
      console.error('FAIL: VIP 1 should be forbidden from buying EVENT');
      p1Pass = false;
    }

    // Test 1.6: VIP 2 can buy EVENT
    await supabase.from('profiles').update({ vip_level: 2 }).eq('user_id', user1Id);
    const resEvtVip2 = await fetch(`${API_BASE}/api/plans/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user1Id, planId: planEventId }),
    });
    const jsonEvtVip2 = await resEvtVip2.json();
    console.log('[1.6] VIP 2 buying EVENT response:', resEvtVip2.status, jsonEvtVip2.message || jsonEvtVip2);
    if (!jsonEvtVip2.success) {
      console.error('FAIL: VIP 2 should be allowed to buy EVENT', jsonEvtVip2);
      p1Pass = false;
    }

    console.log('Result for 1. PLAN PURCHASE:', p1Pass ? 'PASS' : 'FAIL');
  } catch (err) {
    console.error('Error during Test 1:', err);
    p1Pass = false;
  }

  // =========================================================================
  // 2. DAILY CHECK-IN VERIFICATION
  // =========================================================================
  console.log('\n--- TEST 2: DAILY CHECK-IN ---');
  const user2Id = crypto.randomUUID();

  try {
    // 2.1 Set & Verify Database Admin Settings for Day 1-7 Rewards
    const { data: sysSetRow } = await supabase.from('admin_settings').select('value').eq('id', 'system').maybeSingle();
    const curSys = sysSetRow?.value || {};
    const configuredRewards = {
      day1: 5,
      day2: 5,
      day3: 5,
      day4: 5,
      day5: 5,
      day6: 5,
      day7: 100,
    };
    await supabase.from('admin_settings').upsert({
      id: 'system',
      value: {
        ...curSys,
        isDailyCheckInEnabled: true,
        dailyCheckInAmount: 5,
        dailyCheckInDay7Bonus: 100,
        checkInRewards: configuredRewards,
      },
    });

    const { data: verifySys } = await supabase.from('admin_settings').select('value').eq('id', 'system').single();
    console.log('[2.1] System Checkin Settings in DB verified:', verifySys.value.checkInRewards);

    // Create Test User 2
    await createTestUser({
      userId: user2Id,
      phone: '97' + Math.floor(10000000 + Math.random() * 90000000),
      vipLevel: 1,
      rechargeBal: 0,
      withdrawBal: 0,
    });

    // 2.2 Status Endpoint Check
    const resStatus = await fetch(`${API_BASE}/api/fortune/checkin-status?userId=${user2Id}`);
    const jsonStatus = await resStatus.json();
    console.log('[2.2] /api/fortune/checkin-status response:', {
      todayReward: jsonStatus.todayReward,
      checkInRewards: jsonStatus.checkInRewards,
      hasCheckedInToday: jsonStatus.hasCheckedInToday,
    });
    if (jsonStatus.todayReward !== 5 || jsonStatus.hasCheckedInToday !== false) {
      console.error('FAIL: checkin status incorrect');
      p2Pass = false;
    }

    // 2.3 Perform Day 1 Check-In
    const resCheckIn1 = await fetch(`${API_BASE}/api/fortune/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user2Id }),
    });
    const jsonCheckIn1 = await resCheckIn1.json();
    console.log('[2.3] Check-in Day 1 response:', jsonCheckIn1);
    if (!jsonCheckIn1.success || jsonCheckIn1.reward !== 5) {
      console.error('FAIL: Checkin Day 1 reward not 5');
      p2Pass = false;
    }

    // Verify wallet credited with exactly ₹5 in Topup/Recharge wallet
    const { data: walCheckIn1 } = await supabase.from('wallets').select('*').eq('user_id', user2Id).single();
    console.log('[2.3] Wallet after checkin:', {
      recharge_balance: walCheckIn1.recharge_balance,
      withdraw_balance: walCheckIn1.withdraw_balance,
    });
    if (Number(walCheckIn1.recharge_balance) !== 5) {
      console.error('FAIL: Wallet recharge balance not 5 after checkin', walCheckIn1);
      p2Pass = false;
    }

    // 2.4 Duplicate same-day check-in must fail and not pay twice
    const resCheckInDup = await fetch(`${API_BASE}/api/fortune/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user2Id }),
    });
    const jsonCheckInDup = await resCheckInDup.json();
    console.log('[2.4] Duplicate same-day checkin response:', resCheckInDup.status, jsonCheckInDup.error);
    if (resCheckInDup.status !== 400 || !jsonCheckInDup.error?.includes('Already checked in today')) {
      console.error('FAIL: Duplicate checkin was not rejected');
      p2Pass = false;
    }

    // Verify wallet still exactly 5
    const { data: walCheckInDup } = await supabase.from('wallets').select('*').eq('user_id', user2Id).single();
    if (Number(walCheckInDup.recharge_balance) !== 5) {
      console.error('FAIL: Wallet credited twice on duplicate checkin', walCheckInDup);
      p2Pass = false;
    }

    console.log('Result for 2. DAILY CHECK-IN:', p2Pass ? 'PASS' : 'FAIL');
  } catch (err) {
    console.error('Error during Test 2:', err);
    p2Pass = false;
  }

  // =========================================================================
  // 3. CONSECUTIVE CLAIM REWARD VERIFICATION (A -> B 3-DAY LIVE TEST)
  // =========================================================================
  console.log('\n--- TEST 3: CONSECUTIVE CLAIM REWARD (A -> B) ---');
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();

  try {
    // 3.1 Configure Referral Settings in DB: Streak Days = 3, Reward = ₹15
    const { data: refSetRow } = await supabase.from('admin_settings').select('value').eq('id', 'referral_settings').maybeSingle();
    const currentRefSet = refSetRow?.value || {};
    await supabase.from('admin_settings').upsert({
      id: 'referral_settings',
      value: {
        ...currentRefSet,
        isReferralSystemEnabled: true,
        streakReward: {
          enabled: true,
          consecutiveDays: 3,
          rewardAmount: 15,
        },
      },
    });

    // 3.2 Create User A (Referrer) and User B (Referee)
    await createTestUser({
      userId: userAId,
      phone: '96' + Math.floor(10000000 + Math.random() * 90000000),
      vipLevel: 1,
      rechargeBal: 0,
      withdrawBal: 0,
    });
    await createTestUser({
      userId: userBId,
      phone: '95' + Math.floor(10000000 + Math.random() * 90000000),
      vipLevel: 1,
      rechargeBal: 1000,
      withdrawBal: 0,
    });

    // 3.3 Link Referral (A is referrer, B is referee)
    await supabase.from('referrals').insert({
      id: crypto.randomUUID(),
      referrer_id: userAId,
      referee_id: userBId,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    });

    // 3.4 Create an active purchase for B so B can claim device earnings
    const testDevicePlanId = crypto.randomUUID();
    await supabase.from('plans').insert({
      id: testDevicePlanId,
      name: 'Device For Earnings Claim',
      category: 'VIP',
      price: 100,
      duration_days: 30,
      earning_rate: 10,
      daily_earnings: 240,
      purchase_limit: 5,
      status: 'active',
    });

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(now.getTime() + istOffset);
    const todayStr = nowIst.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() + istOffset - 86400000).toISOString().split('T')[0];
    const twoDaysAgoStr = new Date(now.getTime() + istOffset - 2 * 86400000).toISOString().split('T')[0];

    const { data: purchaseB } = await supabase.from('purchases').insert({
      id: crypto.randomUUID(),
      user_id: userBId,
      plan_id: testDevicePlanId,
      plan_name: 'Device For Earnings Claim',
      plan_category: 'VIP',
      amount: 100,
      hourly_rate: 10,
      earning_rate: 10,
      daily_earnings: 240,
      duration_days: 30,
      status: 'ACTIVE',
      last_settled_at: new Date(now.getTime() - 3600000).toISOString(),
    }).select().single();

    // 3.5 Test Streak Claim Flow
    // Simulate B claimed on Day 1 (2 days ago), streak = 1
    // Simulate B claimed on Day 2 (yesterday), streak = 2
    const streakKey = `streak_${userBId}`;
    await supabase.from('admin_settings').upsert({
      id: streakKey,
      value: {
        currentStreak: 2,
        lastClaimDate: yesterdayStr,
        rewardCredited: false,
      },
    });

    // Verify A still has 0 balance before Day 3 claim
    const { data: walABefore } = await supabase.from('wallets').select('*').eq('user_id', userAId).single();
    console.log('[3.5] User A balance before Day 3 claim:', walABefore.withdraw_balance);
    if (Number(walABefore.withdraw_balance) !== 0) {
      console.error('FAIL: User A should have 0 before streak completes');
      p3Pass = false;
    }

    // Day 3: B claims device earnings via /api/earnings/claim
    const resClaimB = await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userBId }),
    });
    const jsonClaimB = await resClaimB.json();
    console.log('[3.6] User B claims device earnings (Day 3):', jsonClaimB);
    if (!jsonClaimB.success) {
      console.error('FAIL: User B claim earnings failed', jsonClaimB);
      p3Pass = false;
    }

    // Wait a brief moment for async streak processing
    await new Promise((r) => setTimeout(r, 1500));

    // Verify User A receives EXACTLY ₹15 in Withdraw Wallet!
    const { data: walAAfter } = await supabase.from('wallets').select('*').eq('user_id', userAId).single();
    console.log('[3.7] User A wallet after User B completes 3-day consecutive claim:', walAAfter);
    if (Number(walAAfter.withdraw_balance) !== 15 || Number(walAAfter.available_balance) !== 15) {
      console.error('FAIL: User A did not receive exactly ₹15 in withdraw wallet', walAAfter);
      p3Pass = false;
    }

    // Verify wallet_transactions record for A
    const { data: txA } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userAId)
      .eq('reference_id', `STRK-REF-${userBId}`)
      .single();
    console.log('[3.8] User A transaction record for streak bonus:', {
      id: txA?.id,
      user_id: txA?.user_id,
      amount: txA?.amount,
      wallet_type: txA?.wallet_type,
      reference_id: txA?.reference_id,
      description: txA?.description,
    });
    if (!txA || Number(txA.amount) !== 15 || txA.wallet_type !== 'WITHDRAW' || txA.type !== 'REFERRAL_BONUS') {
      console.error('FAIL: Transaction record invalid or missing', txA);
      p3Pass = false;
    }

    // 3.9 Verify idempotency: duplicate claim on same day does NOT pay A twice
    await supabase.from('purchases').update({
      last_settled_at: new Date(Date.now() - 3600000).toISOString(),
    }).eq('id', purchaseB.id);

    const resClaimB2 = await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userBId }),
    });
    await resClaimB2.json();
    await new Promise((r) => setTimeout(r, 1000));

    const { data: walAAfterRetry } = await supabase.from('wallets').select('*').eq('user_id', userAId).single();
    console.log('[3.9] User A wallet after same-day retry claim:', walAAfterRetry.withdraw_balance);
    if (Number(walAAfterRetry.withdraw_balance) !== 15) {
      console.error('FAIL: User A was paid twice on same day duplicate claim', walAAfterRetry);
      p3Pass = false;
    }

    // 3.10 Verify dynamic config change: If Admin changes reward to ₹20, next qualifying streak pays ₹20
    const userCId = crypto.randomUUID();
    await supabase.from('admin_settings').upsert({
      id: 'referral_settings',
      value: {
        ...currentRefSet,
        isReferralSystemEnabled: true,
        streakReward: {
          enabled: true,
          consecutiveDays: 3,
          rewardAmount: 20, // Admin changed to ₹20!
        },
      },
    });

    await createTestUser({
      userId: userCId,
      phone: '94' + Math.floor(10000000 + Math.random() * 90000000),
      vipLevel: 1,
      rechargeBal: 1000,
      withdrawBal: 0,
    });
    await supabase.from('referrals').insert({
      id: crypto.randomUUID(),
      referrer_id: userAId,
      referee_id: userCId,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    });

    await supabase.from('purchases').insert({
      id: crypto.randomUUID(),
      user_id: userCId,
      plan_id: testDevicePlanId,
      plan_name: 'Device For Earnings Claim C',
      plan_category: 'VIP',
      amount: 100,
      hourly_rate: 10,
      earning_rate: 10,
      daily_earnings: 240,
      duration_days: 30,
      status: 'ACTIVE',
      last_settled_at: new Date(Date.now() - 3600000).toISOString(),
    });

    // Simulate streak for C at 2 days ending yesterday
    await supabase.from('admin_settings').upsert({
      id: `streak_${userCId}`,
      value: {
        currentStreak: 2,
        lastClaimDate: yesterdayStr,
        rewardCredited: false,
      },
    });

    // C claims today (Day 3)
    await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userCId }),
    });
    await new Promise((r) => setTimeout(r, 1500));

    const { data: walAAfterC } = await supabase.from('wallets').select('*').eq('user_id', userAId).single();
    console.log('[3.10] User A wallet after C finishes streak with ₹20 config:', walAAfterC.withdraw_balance);
    if (Number(walAAfterC.withdraw_balance) !== 35) { // 15 + 20 = 35
      console.error('FAIL: User A did not receive dynamic ₹20 reward', walAAfterC);
      p3Pass = false;
    }

    // 3.11 Verify missed day resets streak to 1
    const userDId = crypto.randomUUID();
    await createTestUser({
      userId: userDId,
      phone: '93' + Math.floor(10000000 + Math.random() * 90000000),
      vipLevel: 1,
      rechargeBal: 1000,
      withdrawBal: 0,
    });
    await supabase.from('referrals').insert({
      id: crypto.randomUUID(),
      referrer_id: userAId,
      referee_id: userDId,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    });
    await supabase.from('purchases').insert({
      id: crypto.randomUUID(),
      user_id: userDId,
      plan_id: testDevicePlanId,
      plan_name: 'Device For Earnings Claim D',
      plan_category: 'VIP',
      amount: 100,
      hourly_rate: 10,
      earning_rate: 10,
      daily_earnings: 240,
      duration_days: 30,
      status: 'ACTIVE',
      last_settled_at: new Date(Date.now() - 3600000).toISOString(),
    });

    await supabase.from('admin_settings').upsert({
      id: `streak_${userDId}`,
      value: {
        currentStreak: 2,
        lastClaimDate: twoDaysAgoStr, // Missed yesterday!
        rewardCredited: false,
      },
    });

    await fetch(`${API_BASE}/api/earnings/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userDId }),
    });
    await new Promise((r) => setTimeout(r, 1500));

    const { data: streakD } = await supabase.from('admin_settings').select('value').eq('id', `streak_${userDId}`).single();
    console.log('[3.11] Streak record for user D after missed day:', streakD.value);
    if (streakD.value.currentStreak !== 1) {
      console.error('FAIL: Missed day did not reset streak to 1', streakD.value);
      p3Pass = false;
    }

    console.log('Result for 3. CONSECUTIVE CLAIM REWARD:', p3Pass ? 'PASS' : 'FAIL');
  } catch (err) {
    console.error('Error during Test 3:', err);
    p3Pass = false;
  }

  // Cleanup test plans
  await supabase.from('plans').delete().in('id', [plan600Id, plan800Id, planProId, planEventId]);

  console.log('\n=== FINAL VERIFICATION RESULTS ===');
  console.log('1. Plan Purchase:', p1Pass ? 'PASS' : 'FAIL');
  console.log('2. Daily Check-in:', p2Pass ? 'PASS' : 'FAIL');
  console.log('3. Consecutive Claim Reward:', p3Pass ? 'PASS' : 'FAIL');
  console.log('\nActual DB Records Used for A -> B 3-Day Test:');
  console.log('User A (Referrer ID):', userAId);
  console.log('User B (Referee ID):', userBId);
}

main().catch(console.error);
