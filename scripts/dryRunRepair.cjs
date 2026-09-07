const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  'https://evhwqlnymvoduclmzshz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function dryRunRepair() {
  const [profsRes, refsRes, depsRes, paysRes, txsRes, walsRes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('referrals').select('*'),
    supabase.from('deposit_transactions').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('wallet_transactions').select('*'),
    supabase.from('wallets').select('*'),
  ]);

  const allProfs = profsRes.data || [];
  const allRefs = refsRes.data || [];
  const allDeposits = depsRes.data || [];
  const allPays = paysRes.data || [];
  const allTxs = txsRes.data || [];
  const allWallets = walsRes.data || [];

  const profileMap = new Map();
  for (const p of allProfs) {
    if (p.user_id) profileMap.set(p.user_id, p);
    if (p.id) profileMap.set(p.id, p);
  }

  const findParent = (childId, visited = new Set()) => {
    if (!childId || visited.has(childId)) return null;
    visited.add(childId);

    // 1. Direct from referrals table
    const refRow = allRefs.find(r => r.referee_id === childId && r.referrer_id && r.referrer_id !== childId);
    if (refRow) {
      const p = profileMap.get(refRow.referrer_id);
      return { referrerId: p?.user_id || p?.id || refRow.referrer_id, refRowId: refRow.id };
    }

    // 2. From profiles.referred_by
    const childProf = profileMap.get(childId);
    if (childProf && childProf.referred_by) {
      const refCode = String(childProf.referred_by).trim().toLowerCase();
      for (const p of allProfs) {
        const uid = p.user_id || p.id;
        if (uid === childId) continue;
        const code = String(p.referral_code || '').trim().toLowerCase();
        const memNo = String(p.membership_number || '').trim().toLowerCase();
        const phone = String(p.phone || p.mobile || p.whatsapp_no || '').trim().toLowerCase();
        const idStr = String(p.id || '').trim().toLowerCase();
        const uIdStr = String(p.user_id || '').trim().toLowerCase();

        if (code === refCode || memNo === refCode || phone === refCode || idStr === refCode || uIdStr === refCode) {
          return { referrerId: uid, refRowId: null };
        }
      }
    }
    return null;
  };

  const topupList = [];
  const seenTracenos = new Set();

  for (const d of allDeposits) {
    const s = String(d.status || '').toUpperCase();
    if (s === 'SUCCESS' || s === 'COMPLETED') {
      const traceno = String(d.traceno || d.order_id || d.merchant_order_id || d.id);
      if (traceno.startsWith('PUR-') || traceno.toLowerCase().includes('plan')) continue;
      if (!seenTracenos.has(traceno)) {
        seenTracenos.add(traceno);
        topupList.push({
          userId: d.user_id,
          amount: Number(d.amount),
          traceno,
          source: 'deposit_transactions'
        });
      }
    }
  }

  for (const p of allPays) {
    const s = String(p.status || '').toUpperCase();
    if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'PAID') {
      const traceno = String(p.order_id || p.utr_number || p.id);
      if (traceno.startsWith('PUR-') || traceno.toLowerCase().includes('plan')) continue;
      if (!seenTracenos.has(traceno)) {
        seenTracenos.add(traceno);
        topupList.push({
          userId: p.user_id,
          amount: Number(p.amount),
          traceno,
          source: 'payments'
        });
      }
    }
  }

  for (const w of allTxs) {
    if (w.type !== 'RECHARGE') continue;
    const s = String(w.status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'SUCCESS') {
      const traceno = String(w.reference_id || w.id);
      if (traceno.startsWith('PUR-') || traceno.toLowerCase().includes('plan')) continue;
      if (!seenTracenos.has(traceno)) {
        seenTracenos.add(traceno);
        topupList.push({
          userId: w.user_id,
          amount: Number(w.amount),
          traceno,
          source: 'wallet_transactions'
        });
      }
    }
  }

  console.log('Total valid topups to check:', topupList.length);

  const pendingCredits = [];

  for (const topup of topupList) {
    const { userId, amount, traceno } = topup;
    if (!userId || isNaN(amount) || amount <= 0) continue;

    const visited = new Set();
    const l1 = findParent(userId, visited);
    const l2 = l1 && l1.referrerId ? findParent(l1.referrerId, visited) : null;
    const l3 = l2 && l2.referrerId ? findParent(l2.referrerId, visited) : null;

    const tiers = [
      { tier: 1, rate: 10, referrer: l1 && l1.referrerId },
      { tier: 2, rate: 5, referrer: l2 && l2.referrerId },
      { tier: 3, rate: 2, referrer: l3 && l3.referrerId },
    ];

    for (const t of tiers) {
      if (!t.referrer || t.referrer === userId) continue;
      const commission = +(amount * (t.rate / 100)).toFixed(2);
      if (commission <= 0) continue;

      const refId = 'TOPUP-REF-L' + t.tier + '-' + traceno;
      
      const alreadyCredited = allTxs.some(tx => {
        if (tx.user_id !== t.referrer) return false;
        const txRef = String(tx.reference_id || '');
        if (txRef === refId) return true;
        if (txRef.includes(traceno) && (txRef.includes('L' + t.tier) || txRef.includes('l' + t.tier) || txRef.includes('T' + t.tier) || txRef.includes('t' + t.tier))) return true;
        return false;
      });

      if (!alreadyCredited) {
        const refProf = profileMap.get(t.referrer);
        const childProf = profileMap.get(userId);
        pendingCredits.push({
          referrerId: t.referrer,
          referrerName: refProf ? (refProf.username || refProf.phone) : 'Unknown',
          childId: userId,
          childName: childProf ? (childProf.username || childProf.phone) : 'Unknown',
          tier: t.tier,
          rate: t.rate,
          topupAmount: amount,
          commission,
          traceno,
          refId
        });
      }
    }
  }

  console.log('Pending Missing Credits Count:', pendingCredits.length);
  console.log(JSON.stringify(pendingCredits, null, 2));

  const userSummary = new Map();
  for (const c of pendingCredits) {
    const cur = userSummary.get(c.referrerId) || { name: c.referrerName, totalComm: 0, items: [] };
    cur.totalComm = +(cur.totalComm + c.commission).toFixed(2);
    cur.items.push(c);
    userSummary.set(c.referrerId, cur);
  }

  console.log('\n--- PER-USER MISSING COMMISSION SUMMARY ---');
  for (const [uid, data] of userSummary) {
    const wal = allWallets.find(w => w.user_id === uid);
    console.log(`User: ${data.name} (${uid})`);
    console.log(`  Current Wallet: Withdraw=${wal && wal.withdraw_balance}, Avail=${wal && wal.available_balance}, TeamComm=${wal && wal.team_commission}`);
    console.log(`  Missing Commission: ₹${data.totalComm} across ${data.items.length} topup(s)`);
    console.log(`  New Wallet Would Be: Withdraw=${+((wal && wal.withdraw_balance || 0) + data.totalComm).toFixed(2)}, TeamComm=${+((wal && wal.team_commission || 0) + data.totalComm).toFixed(2)}`);
  }
}

dryRunRepair();
