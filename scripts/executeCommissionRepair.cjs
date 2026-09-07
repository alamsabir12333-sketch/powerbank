const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  'https://evhwqlnymvoduclmzshz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function runCommissionAuditAndRepair() {
  console.log('=== STARTING REFERRAL COMMISSION AUDIT & REPAIR ===');

  const [profsRes, refsRes, depositsRes, paysRes, allRechargeTxsRes, allTxsRes, walRes, ledgerRes] = await Promise.all([
    supabase.from('profiles').select('id, user_id, username, phone, mobile, whatsapp_no, referral_code, membership_number, referred_by, created_at'),
    supabase.from('referrals').select('*'),
    supabase.from('deposit_transactions').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('wallet_transactions').select('*').eq('type', 'RECHARGE'),
    supabase.from('wallet_transactions').select('*'),
    supabase.from('wallets').select('*'),
    supabase.from('wallet_ledger').select('*'),
  ]);

  const allProfs = profsRes.data || [];
  const allRefs = refsRes.data || [];
  const allDeposits = depositsRes.data || [];
  const allPays = paysRes.data || [];
  const allRecharges = allRechargeTxsRes.data || [];
  const allTxs = allTxsRes.data || [];
  const allWallets = walRes.data || [];
  const allLedger = ledgerRes.data || [];

  const profileMap = new Map();
  for (const p of allProfs) {
    if (p.user_id) profileMap.set(p.user_id, p);
    if (p.id) profileMap.set(p.id, p);
  }

  // Robust function to find a user's parent inviter
  const findParent = (childId, visited = new Set()) => {
    if (!childId) return null;
    let parentId = null;
    let refRowId = null;
    let currentCommission = 0;

    // 1. Direct from referrals table
    const refRow = allRefs.find(r => r.referee_id === childId && r.referrer_id && r.referrer_id !== childId);
    if (refRow) {
      const p = profileMap.get(refRow.referrer_id);
      parentId = p?.user_id || p?.id || refRow.referrer_id;
      refRowId = refRow.id;
      currentCommission = Number(refRow.commission_earned || 0);
    }

    // 2. From profiles.referred_by
    if (!parentId) {
      const childProf = profileMap.get(childId);
      if (childProf && childProf.referred_by) {
        const refCode = String(childProf.referred_by).trim().toLowerCase();
        for (const p of allProfs) {
          const uid = p.user_id || p.id;
          if (!uid || uid === childId) continue;
          const code = String(p.referral_code || '').trim().toLowerCase();
          const memNo = String(p.membership_number || '').trim().toLowerCase();
          const phone = String(p.phone || p.mobile || p.whatsapp_no || '').trim().toLowerCase();
          const idStr = String(p.id || '').trim().toLowerCase();
          const uIdStr = String(p.user_id || '').trim().toLowerCase();

          if (code === refCode || memNo === refCode || phone === refCode || idStr === refCode || uIdStr === refCode) {
            parentId = uid;
            break;
          }
        }
      }
    }

    if (parentId && !visited.has(parentId) && parentId !== childId) {
      visited.add(parentId);
      return { referrerId: parentId, refRowId, currentCommission };
    }
    return null;
  };

  // Collect all verified successful topups
  // Rule: ONLY successful TOPUP/RECHARGE. Never plan purchase!
  const validTopups = [];
  const seenRefs = new Set();

  for (const d of allDeposits) {
    const s = String(d.status || '').toUpperCase();
    if (s === 'SUCCESS' || s === 'COMPLETED') {
      const traceno = String(d.traceno || d.order_id || d.merchant_order_id || d.id);
      if (traceno.startsWith('PUR-') || traceno.toLowerCase().includes('plan')) continue;
      if (!seenRefs.has(traceno)) {
        seenRefs.add(traceno);
        if (d.order_id) seenRefs.add(String(d.order_id));
        if (d.traceno) seenRefs.add(String(d.traceno));
        if (d.id) seenRefs.add(String(d.id));
        validTopups.push({
          userId: d.user_id,
          amount: Number(d.amount),
          traceno,
          source: 'deposit_transactions',
          createdAt: d.created_at || new Date().toISOString(),
        });
      }
    }
  }

  for (const p of allPays) {
    const s = String(p.status || '').toUpperCase();
    if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'PAID') {
      const traceno = String(p.order_id || p.utr_number || p.id);
      if (traceno.startsWith('PUR-') || traceno.toLowerCase().includes('plan')) continue;
      if (!seenRefs.has(traceno) && !seenRefs.has(String(p.id)) && !seenRefs.has(String(p.order_id))) {
        seenRefs.add(traceno);
        if (p.id) seenRefs.add(String(p.id));
        if (p.order_id) seenRefs.add(String(p.order_id));
        validTopups.push({
          userId: p.user_id,
          amount: Number(p.amount),
          traceno,
          source: 'payments',
          createdAt: p.created_at || new Date().toISOString(),
        });
      }
    }
  }

  for (const w of allRecharges) {
    const s = String(w.status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'SUCCESS') {
      const traceno = String(w.reference_id || w.id);
      if (traceno.startsWith('PUR-') || traceno.toLowerCase().includes('plan')) continue;
      if (!seenRefs.has(traceno) && !seenRefs.has(String(w.id))) {
        // Also check if reference_id matches any seen payment id
        let matched = false;
        for (const seen of seenRefs) {
          if (seen && traceno.includes(seen)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          seenRefs.add(traceno);
          validTopups.push({
            userId: w.user_id,
            amount: Number(w.amount),
            traceno,
            source: 'wallet_transactions',
            createdAt: w.created_at || new Date().toISOString(),
          });
        }
      }
    }
  }

  console.log(`Found ${validTopups.length} valid successful topups to verify.`);

  let creditedCount = 0;
  let totalCommissionCredited = 0;
  const userCreditMap = new Map();

  for (const topup of validTopups) {
    const { userId, amount, traceno, createdAt } = topup;
    if (!userId || isNaN(amount) || amount <= 0) continue;

    const visited = new Set([userId]);
    const l1 = findParent(userId, visited);
    const l2 = l1?.referrerId ? findParent(l1.referrerId, visited) : null;
    const l3 = l2?.referrerId ? findParent(l2.referrerId, visited) : null;

    const targets = [
      { tierNum: 1, info: l1, rate: 10 },
      { tierNum: 2, info: l2, rate: 5 },
      { tierNum: 3, info: l3, rate: 2 },
    ];

    for (const target of targets) {
      if (!target.info?.referrerId || target.info.referrerId === userId) continue;
      const referrerId = target.info.referrerId;
      const commission = +(amount * (target.rate / 100)).toFixed(2);
      if (commission <= 0) continue;

      const refId = `TOPUP-REF-L${target.tierNum}-${traceno}`;
      const commDesc = `L${target.tierNum} Referral Commission (${target.rate}%) from Topup #${traceno}`;

      // Check idempotency in allTxs and allLedger
      const alreadyCreditedTx = allTxs.some(tx => {
        if (tx.user_id !== referrerId) return false;
        const r = String(tx.reference_id || '');
        if (r === refId) return true;
        if (r.includes(traceno) && (r.includes(`L${target.tierNum}`) || r.includes(`l${target.tierNum}`) || r.includes(`T${target.tierNum}`))) return true;
        return false;
      });

      const alreadyCreditedLedger = allLedger.some(l => {
        if (l.user_id !== referrerId) return false;
        const r = String(l.reference_id || '');
        return r === refId || (r.includes(traceno) && r.includes(`L${target.tierNum}`));
      });

      if (alreadyCreditedTx || alreadyCreditedLedger) {
        continue;
      }

      // Fetch fresh wallet for referrer
      const { data: freshWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', referrerId)
        .maybeSingle();

      const curWithdraw = Number(
        freshWallet?.withdraw_balance !== undefined && freshWallet?.withdraw_balance !== null
          ? freshWallet.withdraw_balance
          : (freshWallet?.earned_balance || 0)
      );
      const curRecharge = Number(freshWallet?.recharge_balance || 0);
      const curTotalEarned = Number(freshWallet?.total_earned || 0);
      const curTeamComm = Number(freshWallet?.team_commission || 0);

      const newWithdraw = +(curWithdraw + commission).toFixed(2);
      const newAvail = +(curRecharge + newWithdraw).toFixed(2);
      const newTotalEarned = +(curTotalEarned + commission).toFixed(2);
      const newTeamComm = +(curTeamComm + commission).toFixed(2);
      const nowIso = new Date().toISOString();

      // 1. Update/insert wallet
      if (freshWallet) {
        const { error: walErr } = await supabase
          .from('wallets')
          .update({
            withdraw_balance: newWithdraw,
            earned_balance: newWithdraw,
            available_balance: newAvail,
            total_earned: newTotalEarned,
            team_commission: newTeamComm,
            updated_at: nowIso,
          })
          .eq('user_id', referrerId);

        if (walErr) {
          console.error(`Failed to update wallet for ${referrerId}:`, walErr.message);
          continue;
        }
      } else {
        const { error: insWalErr } = await supabase.from('wallets').insert({
          user_id: referrerId,
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
        if (insWalErr) {
          console.error(`Failed to insert wallet for ${referrerId}:`, insWalErr.message);
          continue;
        }
      }

      // 2. Insert wallet_transactions
      const txId = crypto.randomUUID();
      const { error: txErr } = await supabase.from('wallet_transactions').insert({
        id: txId,
        user_id: referrerId,
        type: 'COMMISSION',
        amount: commission,
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        reference_id: refId,
        description: commDesc,
        wallet_type: 'WITHDRAW',
        status: 'Completed',
        metadata: {
          rewardType: 'TOPUP_COMMISSION',
          tier: target.tierNum,
          type: 'COMMISSION',
          refId,
          depositUserId: userId,
          traceno,
          depositAmount: amount,
        },
        created_at: nowIso,
      });

      if (txErr) {
        console.error(`Failed to insert wallet_transactions for ${referrerId}:`, txErr.message);
      } else {
        allTxs.push({ user_id: referrerId, reference_id: refId, amount: commission });
      }

      // 3. Insert wallet_ledger
      const { error: ledErr } = await supabase.from('wallet_ledger').insert({
        id: crypto.randomUUID(),
        user_id: referrerId,
        wallet_type: 'WITHDRAW',
        transaction_type: 'REFERRAL_COMMISSION',
        amount: commission,
        direction: 'CREDIT',
        reference_type: 'REFERRAL_COMMISSION',
        reference_id: refId,
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        description: commDesc,
        created_at: nowIso,
      });

      if (ledErr) {
        console.warn(`Notice inserting ledger for ${referrerId}:`, ledErr.message);
      } else {
        allLedger.push({ user_id: referrerId, reference_id: refId, amount: commission });
      }

      // 4. Update or insert referrals row
      if (target.info.refRowId) {
        await supabase
          .from('referrals')
          .update({
            qualifying_recharge_done: true,
            status: 'ACTIVE',
            commission_earned: +(target.info.currentCommission + commission).toFixed(2),
            updated_at: nowIso,
          })
          .eq('id', target.info.refRowId);
      } else if (target.tierNum === 1) {
        await supabase.from('referrals').insert({
          referrer_id: referrerId,
          referee_id: userId,
          level: 1,
          bonus_amount: 0,
          status: 'ACTIVE',
          qualifying_recharge_done: true,
          commission_earned: commission,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      // 5. Notification
      await supabase.from('notifications').insert({
        user_id: referrerId,
        title: `L${target.tierNum} Referral Commission Earned! 💰`,
        message: `You received ₹${commission.toFixed(2)} (${target.rate}%) commission from a team member topup.`,
        type: 'EARNING',
        is_read: false,
        created_at: nowIso,
      });

      creditedCount++;
      totalCommissionCredited = +(totalCommissionCredited + commission).toFixed(2);

      const refProf = profileMap.get(referrerId);
      const refName = refProf?.username || refProf?.phone || referrerId;
      const childProf = profileMap.get(userId);
      const childName = childProf?.username || childProf?.phone || userId;

      const summary = userCreditMap.get(referrerId) || { name: refName, total: 0, items: [] };
      summary.total = +(summary.total + commission).toFixed(2);
      summary.items.push(`L${target.tierNum}: ₹${commission} from ${childName} (Topup ₹${amount})`);
      userCreditMap.set(referrerId, summary);

      console.log(`[CREDITED] ${refName}: +₹${commission} (L${target.tierNum}) from ${childName} #${traceno}. Withdraw: ${curWithdraw} -> ${newWithdraw}`);
    }
  }

  console.log('\n=== REPAIR EXECUTION SUMMARY ===');
  console.log(`Total transactions credited: ${creditedCount}`);
  console.log(`Total commission amount credited: ₹${totalCommissionCredited}`);
  for (const [uid, s] of userCreditMap) {
    console.log(`- ${s.name} (${uid}): +₹${s.total}`);
    for (const it of s.items) {
      console.log(`    ${it}`);
    }
  }
  console.log('=== AUDIT & REPAIR COMPLETE ===');
}

runCommissionAuditAndRepair().catch(console.error);
