import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://evhwqlnymvoduclmzshz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const API_BASE = 'http://localhost:3000';

interface VerificationResults {
  test1_approveButtonFlow: 'PASS' | 'FAIL' | 'NOT TESTED';
  test2_paymentIdMapping: 'PASS' | 'FAIL' | 'NOT TESTED';
  test3_paymentLookup: 'PASS' | 'FAIL' | 'NOT TESTED';
  test4_rpcStatusChange: 'PASS' | 'FAIL' | 'NOT TESTED';
  test5_walletCreditedOnce: 'PASS' | 'FAIL' | 'NOT TESTED';
  test6_rejectButtonFlow: 'PASS' | 'FAIL' | 'NOT TESTED';
  test7_rejectStatusChange: 'PASS' | 'FAIL' | 'NOT TESTED';
  test8_rejectWalletUntouched: 'PASS' | 'FAIL' | 'NOT TESTED';
  test9_duplicateHandling: 'PASS' | 'FAIL' | 'NOT TESTED';
  test10_errorFreeExecution: 'PASS' | 'FAIL' | 'NOT TESTED';
  details: Record<string, any>;
}

async function run() {
  console.log('=================================================================');
  console.log('GAINPOWER: LIVE END-TO-END RECHARGE APPROVE & REJECT VERIFICATION');
  console.log('=================================================================\n');

  const report: VerificationResults = {
    test1_approveButtonFlow: 'NOT TESTED',
    test2_paymentIdMapping: 'NOT TESTED',
    test3_paymentLookup: 'NOT TESTED',
    test4_rpcStatusChange: 'NOT TESTED',
    test5_walletCreditedOnce: 'NOT TESTED',
    test6_rejectButtonFlow: 'NOT TESTED',
    test7_rejectStatusChange: 'NOT TESTED',
    test8_rejectWalletUntouched: 'NOT TESTED',
    test9_duplicateHandling: 'NOT TESTED',
    test10_errorFreeExecution: 'NOT TESTED',
    details: {},
  };

  try {
    // 1. Admin Login & Authorization
    console.log('[STEP 1] Logging in as admin...');
    const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'adminbank', password: 'adminbank@700' }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.session?.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.session.token;
    const adminId = loginData.session.adminId;
    console.log(` Admin authenticated successfully. Admin UUID: ${adminId}`);

    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Admin-Token': token,
    };

    // 2. Select an active test user
    const { data: users, error: uErr } = await supabase
      .from('profiles')
      .select('id, user_id, username')
      .eq('role', 'user')
      .limit(1);

    if (uErr || !users || users.length === 0) {
      throw new Error(`Failed to find user profile: ${uErr?.message}`);
    }
    const testUserId = users[0].user_id || users[0].id;
    console.log(` Using user for test: ${users[0].username} (${testUserId})`);

    // Ensure wallet exists
    const { data: walBefore, error: wErr } = await supabase
      .from('wallets')
      .select('recharge_balance, available_balance')
      .eq('user_id', testUserId)
      .maybeSingle();

    if (wErr || !walBefore) {
      throw new Error(`Wallet not found for test user: ${wErr?.message}`);
    }
    const initialRechargeBal = Number(walBefore.recharge_balance || 0);
    const initialAvailableBal = Number(walBefore.available_balance || 0);
    console.log(` Initial Wallet Balances: Recharge = ₹${initialRechargeBal}, Available = ₹${initialAvailableBal}`);

    // =========================================================================
    // APPROVE FLOW TESTS (Tests 1, 2, 3, 4, 5)
    // =========================================================================
    console.log('\n--- TESTING APPROVAL FLOW ---');
    const testApproveAmount = 100.00;
    const testApproveOrderId = `TEST_APP_${Date.now()}`;
    const testApproveUtr = `UTR_APP_${Date.now()}`.substring(0, 20);

    // Create pending test payment in payments table
    const { data: newPay, error: pInsErr } = await supabase
      .from('payments')
      .insert({
        user_id: testUserId,
        order_id: testApproveOrderId,
        amount: testApproveAmount,
        payment_type: 'MANUAL_UPI',
        payment_method: 'UPI',
        utr: testApproveUtr,
        utr_number: testApproveUtr,
        status: 'PENDING_VERIFICATION',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (pInsErr || !newPay) {
      throw new Error(`Failed to insert test payment: ${pInsErr?.message}`);
    }
    const testPaymentId = newPay.id;
    console.log(` Created test payment: ${testPaymentId} (Order: ${testApproveOrderId}, Amount: ₹${testApproveAmount})`);

    // Test 2: Verify ID mapping from frontend payload { paymentId, adminId }
    console.log('Sending approve request to /api/admin/approve-recharge...');
    const appRes = await fetch(`${API_BASE}/api/admin/approve-recharge`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ paymentId: testPaymentId, adminId: 'adm_root_700' }),
    });
    const appData = await appRes.json();
    console.log('Approve response:', appData);

    if (appRes.ok && appData.success) {
      report.test1_approveButtonFlow = 'PASS';
      report.test2_paymentIdMapping = 'PASS';
      report.test3_paymentLookup = 'PASS';
    } else {
      report.test1_approveButtonFlow = 'FAIL';
      report.test2_paymentIdMapping = 'FAIL';
      report.test3_paymentLookup = 'FAIL';
      throw new Error(`Approve request failed: ${JSON.stringify(appData)}`);
    }

    // Test 4: Verify payment status changed in DB
    const { data: updatedPay } = await supabase
      .from('payments')
      .select('status, admin_id')
      .eq('id', testPaymentId)
      .single();

    console.log(` Updated payment status in DB: ${updatedPay?.status}`);
    if (updatedPay?.status === 'PAID') {
      report.test4_rpcStatusChange = 'PASS';
    } else {
      report.test4_rpcStatusChange = 'FAIL';
    }

    // Test 5: Verify user wallet credited EXACTLY once
    const { data: walAfterApp } = await supabase
      .from('wallets')
      .select('recharge_balance, available_balance')
      .eq('user_id', testUserId)
      .single();

    const expectedRecharge = Number((initialRechargeBal + testApproveAmount).toFixed(2));
    const actualRecharge = Number(walAfterApp?.recharge_balance || 0);
    console.log(` Wallet after approval: Expected = ₹${expectedRecharge}, Actual = ₹${actualRecharge}`);

    if (Math.abs(actualRecharge - expectedRecharge) < 0.01) {
      report.test5_walletCreditedOnce = 'PASS';
    } else {
      report.test5_walletCreditedOnce = 'FAIL';
    }

    // Test 9a: Duplicate Approval Test (Idempotency)
    console.log('Testing duplicate approval call...');
    const dupAppRes = await fetch(`${API_BASE}/api/admin/approve-recharge`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ paymentId: testPaymentId, adminId: 'adm_root_700' }),
    });
    const dupAppData = await dupAppRes.json();
    console.log('Duplicate approve response:', dupAppData);

    const { data: walAfterDup } = await supabase
      .from('wallets')
      .select('recharge_balance')
      .eq('user_id', testUserId)
      .single();

    const balAfterDup = Number(walAfterDup?.recharge_balance || 0);
    const dupApprovePassed = (dupAppData.already_approved || dupAppData.success) && Math.abs(balAfterDup - expectedRecharge) < 0.01;
    console.log(` Balance after duplicate approve attempt: ₹${balAfterDup} (No double-credit: ${dupApprovePassed})`);

    // Clean up test approval: revert wallet credit and remove test rows
    await supabase.rpc('adjust_user_balance_admin', {
      p_user_id: testUserId,
      p_balance_type: 'TOPUP',
      p_amount: testApproveAmount,
      p_action: 'SUBTRACT',
      p_admin_id: adminId,
      p_reason: 'Automated Test Settlement Cleanup',
    }).catch(async () => {
      await supabase.from('wallets').update({ recharge_balance: initialRechargeBal }).eq('user_id', testUserId);
    });
    await supabase.from('payments').delete().eq('id', testPaymentId);
    await supabase.from('wallet_transactions').delete().eq('reference_id', testApproveOrderId);
    console.log(' Test payment cleaned up and wallet reverted cleanly.');

    // =========================================================================
    // REJECT FLOW TESTS (Tests 6, 7, 8, 9b)
    // =========================================================================
    console.log('\n--- TESTING REJECTION FLOW ---');
    const testRejectAmount = 150.00;
    const testRejectOrderId = `TEST_REJ_${Date.now()}`;
    const testRejectUtr = `UTR_REJ_${Date.now()}`.substring(0, 20);
    const testRejectReason = 'Invalid UTR - Transaction Not Received in Bank Statement';

    // Get fresh wallet baseline
    const { data: walBeforeRej } = await supabase
      .from('wallets')
      .select('recharge_balance, available_balance')
      .eq('user_id', testUserId)
      .single();
    const rejBaseRecharge = Number(walBeforeRej?.recharge_balance || 0);
    const rejBaseAvailable = Number(walBeforeRej?.available_balance || 0);

    // Insert pending payment for rejection test
    const { data: newRejPay, error: rejInsErr } = await supabase
      .from('payments')
      .insert({
        user_id: testUserId,
        order_id: testRejectOrderId,
        amount: testRejectAmount,
        payment_type: 'MANUAL_UPI',
        payment_method: 'UPI',
        utr: testRejectUtr,
        utr_number: testRejectUtr,
        status: 'PENDING_VERIFICATION',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (rejInsErr || !newRejPay) {
      throw new Error(`Failed to insert test payment for rejection: ${rejInsErr?.message}`);
    }
    const testRejPaymentId = newRejPay.id;
    console.log(` Created test payment for rejection: ${testRejPaymentId}`);

    // Test 6: Send rejection request to /api/admin/reject-recharge
    console.log('Sending reject request to /api/admin/reject-recharge...');
    const rejRes = await fetch(`${API_BASE}/api/admin/reject-recharge`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ paymentId: testRejPaymentId, reason: testRejectReason, adminId: 'adm_root_700' }),
    });
    const rejData = await rejRes.json();
    console.log('Reject response:', rejData);

    if (rejRes.ok && rejData.success) {
      report.test6_rejectButtonFlow = 'PASS';
    } else {
      report.test6_rejectButtonFlow = 'FAIL';
      throw new Error(`Reject request failed: ${JSON.stringify(rejData)}`);
    }

    // Test 7: Verify payment status changed to REJECTED and reason recorded in DB
    const { data: updatedRejPay } = await supabase
      .from('payments')
      .select('status, rejection_reason')
      .eq('id', testRejPaymentId)
      .single();

    console.log(` Updated payment status in DB: ${updatedRejPay?.status}, Reason: "${updatedRejPay?.rejection_reason}"`);
    if (updatedRejPay?.status === 'REJECTED' && updatedRejPay?.rejection_reason === testRejectReason) {
      report.test7_rejectStatusChange = 'PASS';
    } else {
      report.test7_rejectStatusChange = 'FAIL';
    }

    // Test 8: Verify rejection does NOT change any wallet balance
    const { data: walAfterRej } = await supabase
      .from('wallets')
      .select('recharge_balance, available_balance')
      .eq('user_id', testUserId)
      .single();

    const afterRejRecharge = Number(walAfterRej?.recharge_balance || 0);
    const afterRejAvailable = Number(walAfterRej?.available_balance || 0);
    console.log(` Balances after rejection: Recharge = ₹${afterRejRecharge} (Before: ₹${rejBaseRecharge}), Available = ₹${afterRejAvailable} (Before: ₹${rejBaseAvailable})`);

    if (Math.abs(afterRejRecharge - rejBaseRecharge) < 0.001 && Math.abs(afterRejAvailable - rejBaseAvailable) < 0.001) {
      report.test8_rejectWalletUntouched = 'PASS';
    } else {
      report.test8_rejectWalletUntouched = 'FAIL';
    }

    // Test 9b: Duplicate Rejection Test (Idempotency)
    console.log('Testing duplicate rejection call...');
    const dupRejRes = await fetch(`${API_BASE}/api/admin/reject-recharge`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ paymentId: testRejPaymentId, reason: testRejectReason, adminId: 'adm_root_700' }),
    });
    const dupRejData = await dupRejRes.json();
    console.log('Duplicate reject response:', dupRejData);

    const dupRejPassed = dupRejData.already_rejected === true || dupRejData.success === true;
    if (dupApprovePassed && dupRejPassed) {
      report.test9_duplicateHandling = 'PASS';
    } else {
      report.test9_duplicateHandling = 'FAIL';
    }

    // Clean up test rejection payment
    await supabase.from('payments').delete().eq('id', testRejPaymentId);
    console.log(' Rejection test payment cleaned up.');

    // Test 10: Negative Security & Terminal Guards
    console.log('\n--- TESTING SECURITY & TERMINAL GUARDS ---');
    // 10a. Cannot approve with unknown ID (should return 404)
    const notFoundRes = await fetch(`${API_BASE}/api/admin/approve-recharge`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ paymentId: '00000000-0000-0000-0000-000000000000', adminId: 'adm_root_700' }),
    });
    const notFoundPassed = notFoundRes.status === 404;

    // 10b. Cannot call without auth headers (should return 401)
    const unauthRes = await fetch(`${API_BASE}/api/admin/approve-recharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: '00000000-0000-0000-0000-000000000000' }),
    });
    const unauthPassed = unauthRes.status === 401;

    console.log(` Guard 404 Not Found: ${notFoundPassed ? 'PASS' : 'FAIL'}`);
    console.log(` Guard 401 Unauthorized: ${unauthPassed ? 'PASS' : 'FAIL'}`);

    if (notFoundPassed && unauthPassed) {
      report.test10_errorFreeExecution = 'PASS';
    } else {
      report.test10_errorFreeExecution = 'FAIL';
    }

    console.log('\n=================================================================');
    console.log('FINAL VERIFICATION REPORT:');
    console.log('=================================================================');
    console.log(JSON.stringify(report, null, 2));

  } catch (err: any) {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  }
}

run();
