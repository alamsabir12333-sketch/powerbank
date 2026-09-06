import { DepositTransaction, WalletTransaction, TransactionType } from '../types';

/**
 * DisjointSet (Union-Find) with path compression for canonical identity clustering.
 */
class DisjointSet {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
    }
    const px = this.parent.get(x)!;
    if (px !== x) {
      const root = this.find(px);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) {
      this.parent.set(rootX, rootY);
    }
  }
}

/**
 * Validates if a token is a specific, unique transaction identifier.
 * Excludes generic wallet address strings, template strings, or short/empty strings.
 */
function isValidIdentifierToken(token: any): boolean {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  if (clean.length < 4) return false;
  // Exclude address/rate combinations like USDT:5.2632@95|TR7NH...
  if (clean.startsWith('USDT:') && clean.includes('@')) return false;
  if (clean.includes('|') && clean.includes('@')) return false;
  // Exclude all-zero UUIDs or generic words
  if (clean === '00000000-0000-0000-0000-000000000000') return false;
  if (clean === 'null' || clean === 'undefined' || clean === 'default') return false;
  return true;
}

export interface RawTransactionInputs {
  userId?: string;
  depositTransactions?: any[];
  payments?: any[];
  walletTransactions?: any[];
  walletLedger?: any[];
  withdrawals?: any[];
  purchases?: any[];
  earnings?: any[];
  giftClaims?: any[];
}

interface ClusteredEntity {
  source: 'deposit' | 'payment' | 'wallet_tx' | 'ledger' | 'withdrawal' | 'purchase' | 'earning' | 'gift';
  data: any;
}

/**
 * Builds canonical clusters from all raw database rows across all tables.
 */
function buildCanonicalClusters(inputs: RawTransactionInputs): Map<string, ClusteredEntity[]> {
  const ds = new DisjointSet();

  const addEntityTokens = (entityKey: string, userId: string, tokens: (string | null | undefined)[]) => {
    const userScope = userId || 'global';
    for (const rawToken of tokens) {
      if (!isValidIdentifierToken(rawToken)) continue;
      const clean = (rawToken as string).trim();
      const scopedToken = `${userScope}::${clean}`;
      ds.union(entityKey, scopedToken);

      // Strip common prefixes to unify cross-table references
      const prefixes = ['USDT_DEP-', 'USDT-', 'DEP-'];
      for (const prefix of prefixes) {
        if (clean.startsWith(prefix)) {
          const stripped = clean.slice(prefix.length);
          if (isValidIdentifierToken(stripped)) {
            ds.union(entityKey, `${userScope}::${stripped}`);
          }
        }
      }
    }
  };

  // 1. Process payments
  const payments = inputs.payments || [];
  for (const p of payments) {
    const entityKey = `PAYMENT_${p.id}`;
    const pUserId = p.user_id || inputs.userId || '';
    addEntityTokens(entityKey, pUserId, [
      p.id,
      p.order_id,
      p.utr,
      `USDT-${p.id}`,
      `USDT_DEP-${p.id}`,
      `DEP-${p.id}`,
      p.order_id ? `USDT-${p.order_id}` : null,
      p.order_id ? `USDT_DEP-${p.order_id}` : null,
      // If p.reference_id is a UUID or order number (not address template)
      p.reference_id && !p.reference_id.startsWith('USDT:') ? p.reference_id : null,
    ]);
  }

  // 2. Process deposit_transactions (Gateway Deposits)
  const deposits = inputs.depositTransactions || [];
  for (const d of deposits) {
    const entityKey = `DEP_${d.id}`;
    const dUserId = d.user_id || inputs.userId || '';
    addEntityTokens(entityKey, dUserId, [
      d.id,
      d.traceno,
      d.merchant_order_id,
      d.order_id,
      d.gateway_order_id,
      d.gateway_serial_no,
      d.raw_response?.payOrderid,
      d.raw_response?.orderId,
      d.raw_response?.traceno,
      d.utr,
    ]);
  }

  // Gateway Session Pairing:
  // When gateway recharge is initiated, TopUpPage inserts a placeholder row right before the edge function
  // creates the gateway session row within 15 seconds for the same user and amount.
  for (let i = 0; i < deposits.length; i++) {
    for (let j = i + 1; j < deposits.length; j++) {
      const a = deposits[i];
      const b = deposits[j];
      const uA = a.user_id || inputs.userId;
      const uB = b.user_id || inputs.userId;
      if (uA && uB && uA === uB && Number(a.amount) === Number(b.amount)) {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (Math.abs(timeA - timeB) <= 15000) {
          // If one has traceno and other has order_id or pay_url
          const aIsPlaceholder = Boolean(a.traceno && !a.pay_url);
          const bIsSession = Boolean(b.pay_url || b.order_id);
          const bIsPlaceholder = Boolean(b.traceno && !b.pay_url);
          const aIsSession = Boolean(a.pay_url || a.order_id);

          if ((aIsPlaceholder && bIsSession) || (bIsPlaceholder && aIsSession)) {
            ds.union(`DEP_${a.id}`, `DEP_${b.id}`);
          }
        }
      }
    }
  }

  // 3. Process wallet_transactions (supports both raw DB snake_case and shaped camelCase)
  const walletTxs = inputs.walletTransactions || [];
  for (const w of walletTxs) {
    const entityKey = `WTX_${w.id}`;
    const wUserId = w.user_id || w.userId || inputs.userId || '';
    const ref = w.reference_id || w.referenceId;
    const ord = w.order_id || w.orderId;
    const utr = w.utr;

    // Extract reference from description (e.g. #DEP2026... or #USDT...)
    const desc = String(w.description || '');
    let descRef: string | null = null;
    const hashMatch = desc.match(/#([A-Za-z0-9_-]+)/);
    if (hashMatch && hashMatch[1] && hashMatch[1] !== 'null') {
      descRef = hashMatch[1];
    }

    addEntityTokens(entityKey, wUserId, [
      w.id,
      ref,
      ord,
      utr,
      descRef,
    ]);
  }

  // Pair duplicate recharge wallet transactions created within 45s for the same user and amount
  for (let i = 0; i < walletTxs.length; i++) {
    for (let j = i + 1; j < walletTxs.length; j++) {
      const a = walletTxs[i];
      const b = walletTxs[j];
      const uA = a.user_id || a.userId || inputs.userId;
      const uB = b.user_id || b.userId || inputs.userId;
      const typeA = String(a.type || '').toUpperCase();
      const typeB = String(b.type || '').toUpperCase();
      if (uA && uB && uA === uB && typeA === 'RECHARGE' && typeB === 'RECHARGE' && Number(a.amount) === Number(b.amount)) {
        const timeA = new Date(a.created_at || a.createdAt).getTime();
        const timeB = new Date(b.created_at || b.createdAt).getTime();
        if (Math.abs(timeA - timeB) <= 45000) {
          const refA = a.reference_id || a.referenceId;
          const refB = b.reference_id || b.referenceId;
          if (!refA || !refB || refA.includes(refB) || refB.includes(refA)) {
            ds.union(`WTX_${a.id}`, `WTX_${b.id}`);
          }
        }
      }
    }
  }

  // 4. Process wallet_ledger
  const ledger = inputs.walletLedger || [];
  for (const l of ledger) {
    const entityKey = `LEDGER_${l.id}`;
    const lUserId = l.user_id || inputs.userId || '';
    addEntityTokens(entityKey, lUserId, [
      l.id,
      l.reference_id,
    ]);
  }

  // 5. Process withdrawals
  const withdrawals = inputs.withdrawals || [];
  for (const w of withdrawals) {
    const entityKey = `WITH_${w.id}`;
    const wUserId = w.user_id || inputs.userId || '';
    addEntityTokens(entityKey, wUserId, [
      w.id,
      w.traceno,
      w.order_id,
      w.bank_ref_no,
    ]);
  }

  // 6. Process purchases
  const purchases = inputs.purchases || [];
  for (const p of purchases) {
    const entityKey = `PUR_${p.id}`;
    const pUserId = p.user_id || inputs.userId || '';
    addEntityTokens(entityKey, pUserId, [
      p.id,
    ]);
  }

  // 7. Process earnings
  const earnings = inputs.earnings || [];
  for (const e of earnings) {
    const entityKey = `EARN_${e.id}`;
    const eUserId = e.user_id || inputs.userId || '';
    addEntityTokens(entityKey, eUserId, [
      e.id,
      e.claim_batch_id,
    ]);
  }

  // 8. Process gift code claims
  const giftClaims = inputs.giftClaims || [];
  for (const c of giftClaims) {
    const entityKey = `GIFT_${c.id}`;
    const cUserId = c.user_id || inputs.userId || '';
    const code = c.code || c.gift_code;
    addEntityTokens(entityKey, cUserId, [
      c.id,
      code ? `GIFT-${code}` : null,
    ]);
  }

  // Group entities by their root canonical cluster key
  const clusters = new Map<string, ClusteredEntity[]>();
  const addClustered = (entityKey: string, entity: ClusteredEntity) => {
    const root = ds.find(entityKey);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(entity);
  };

  payments.forEach(p => addClustered(`PAYMENT_${p.id}`, { source: 'payment', data: p }));
  deposits.forEach(d => addClustered(`DEP_${d.id}`, { source: 'deposit', data: d }));
  walletTxs.forEach(w => addClustered(`WTX_${w.id}`, { source: 'wallet_tx', data: w }));
  ledger.forEach(l => addClustered(`LEDGER_${l.id}`, { source: 'ledger', data: l }));
  withdrawals.forEach(w => addClustered(`WITH_${w.id}`, { source: 'withdrawal', data: w }));
  purchases.forEach(p => addClustered(`PUR_${p.id}`, { source: 'purchase', data: p }));
  earnings.forEach(e => addClustered(`EARN_${e.id}`, { source: 'earning', data: e }));
  giftClaims.forEach(c => addClustered(`GIFT_${c.id}`, { source: 'gift', data: c }));

  return clusters;
}

/**
 * Deduplicates and normalizes deposit / recharge transactions for Recharge History (TopUpPage).
 * Returns exactly one record per underlying recharge with authoritative status.
 */
export function normalizeDepositTransactions(inputs: RawTransactionInputs): DepositTransaction[] {
  const clusters = buildCanonicalClusters(inputs);
  const result: DepositTransaction[] = [];

  for (const [rootKey, items] of clusters.entries()) {
    // Filter to clusters representing a deposit/recharge
    const isRechargeCluster = items.some(it =>
      it.source === 'deposit' ||
      it.source === 'payment' ||
      (it.source === 'wallet_tx' && String(it.data.type || '').toUpperCase() === 'RECHARGE') ||
      (it.source === 'ledger' && String(it.data.transaction_type || '').toUpperCase().includes('RECHARGE'))
    );
    if (!isRechargeCluster) continue;

    // 1. Authoritative Status Resolution
    // Final positive state takes absolute precedence
    const allStatuses = items.map(it => String(it.data.status || '').toUpperCase());
    let canonicalStatus: DepositTransaction['status'] = 'PENDING';
    if (allStatuses.some(s => s === 'PAID' || s === 'SUCCESS' || s === 'COMPLETED' || s === 'APPROVED')) {
      canonicalStatus = 'PAID';
    } else if (allStatuses.some(s => s === 'FAILED' || s === 'REJECTED' || s === 'FAILED_GATEWAY_CREATION')) {
      canonicalStatus = 'FAILED';
    } else {
      canonicalStatus = 'PENDING';
    }

    // 2. Data Sources
    const payItem = items.find(it => it.source === 'payment')?.data;
    const depItem = items.find(it => it.source === 'deposit')?.data;
    const wtxItem = items.find(it => it.source === 'wallet_tx')?.data;

    // 3. Amount Resolution
    const amountVal = Number(
      payItem?.amount ??
      depItem?.amount ??
      wtxItem?.amount ??
      items.find(it => it.data.amount != null)?.data.amount ??
      0
    );

    // 4. Reference & Order Number Resolution
    // Prefer human-readable order IDs over raw internal UUIDs
    let traceno = '';
    if (depItem?.traceno) {
      traceno = depItem.traceno;
    } else if (depItem?.merchant_order_id) {
      traceno = depItem.merchant_order_id;
    } else if (payItem?.order_id) {
      traceno = payItem.order_id;
    } else if (depItem?.order_id) {
      traceno = depItem.order_id;
    } else if (wtxItem?.reference_id) {
      traceno = wtxItem.reference_id;
    } else {
      traceno = payItem?.id || depItem?.id || wtxItem?.id || rootKey;
    }

    // Normalizing referenceId for clean display
    if (traceno.startsWith('USDT_DEP-')) {
      traceno = traceno.replace('USDT_DEP-', 'USDT-');
    }

    // 5. Payment Channel & Method
    const isUsdt =
      Boolean(payItem) ||
      items.some(it =>
        String(it.data.channel || it.data.payment_method || it.data.method || it.data.reference_id || '').toUpperCase().includes('USDT')
      );
    const channel = isUsdt
      ? (payItem?.payment_method ? `USDT (${payItem.payment_method})` : 'USDT (TRC20)')
      : (depItem?.channel || depItem?.payment_method || 'UniVePay UPI Gateway');

    // 6. UTR / Serial / Bank Ref
    const utr =
      payItem?.utr ||
      depItem?.utr ||
      depItem?.gateway_serial_no ||
      wtxItem?.utr ||
      items.find(it => it.data.utr)?.data.utr;

    // 7. Pay URL (from gateway if still pending)
    const payUrl = depItem?.pay_url || items.find(it => it.data.pay_url)?.data.pay_url;

    // 8. Timestamps
    const earliestTime = items.reduce((acc, it) => {
      const d = new Date(it.data.created_at || it.data.claimed_at).getTime();
      return isNaN(d) ? acc : Math.min(acc, d);
    }, Infinity);

    const latestUpdateTime = items.reduce((acc, it) => {
      const d = new Date(it.data.updated_at || it.data.credited_at || it.data.created_at).getTime();
      return isNaN(d) ? acc : Math.max(acc, d);
    }, 0);

    const createdAt = earliestTime !== Infinity ? new Date(earliestTime).toISOString() : new Date().toISOString();
    const updatedAt = latestUpdateTime > 0 ? new Date(latestUpdateTime).toISOString() : undefined;

    // Primary ID
    const primaryId = payItem?.id || depItem?.id || wtxItem?.id || rootKey;
    const userId = payItem?.user_id || depItem?.user_id || wtxItem?.user_id || inputs.userId || '';

    result.push({
      id: primaryId,
      userId,
      username: 'User',
      traceno,
      amount: amountVal,
      currency: depItem?.currency || payItem?.currency || 'INR',
      payCode: depItem?.pay_code || '101',
      status: canonicalStatus,
      channel,
      paymentMethod: channel,
      payUrl,
      gatewayOrderId: depItem?.gateway_order_id || depItem?.order_id,
      gatewaySerialNo: depItem?.gateway_serial_no,
      utr,
      proofUrl: payItem?.proof_image_url || payItem?.proof_url || depItem?.proof_url,
      rejectionReason: payItem?.rejection_reason || depItem?.rejection_reason,
      adminNote: payItem?.admin_notes || payItem?.admin_note || depItem?.admin_note,
      createdAt,
      updatedAt: updatedAt || createdAt,
      creditedAt: payItem?.approved_at || depItem?.credited_at,
    });
  }

  // Sort latest first
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Deduplicates and normalizes wallet transactions across all categories for TransactionPage & /api/wallet/transactions.
 * Returns exactly one record per real-world event with authoritative status and correct ledger sign.
 */
export function normalizeWalletTransactions(inputs: RawTransactionInputs): WalletTransaction[] {
  const clusters = buildCanonicalClusters(inputs);
  const result: WalletTransaction[] = [];

  for (const [rootKey, items] of clusters.entries()) {
    // 1. Determine Canonical Transaction Type
    let txType: TransactionType = 'ADMIN_ADJUSTMENT';
    if (items.some(it => it.source === 'withdrawal')) {
      txType = 'WITHDRAWAL';
    } else if (items.some(it => it.source === 'purchase')) {
      const pur = items.find(it => it.source === 'purchase')?.data;
      txType = (pur?.plan_category || '').toUpperCase() === 'PRO' ? 'PRO_PLAN_PURCHASE' : 'PLAN_PURCHASE';
    } else if (items.some(it => it.source === 'deposit' || it.source === 'payment')) {
      txType = 'RECHARGE';
    } else if (items.some(it => it.source === 'earning')) {
      const earn = items.find(it => it.source === 'earning')?.data;
      txType = earn?.earning_type === 'REFERRAL' ? 'REFERRAL_BONUS' : 'EARNING_CLAIM';
    } else if (items.some(it => it.source === 'gift')) {
      txType = 'GIFT_CODE_REWARD';
    } else {
      const w = items.find(it => it.source === 'wallet_tx')?.data;
      const l = items.find(it => it.source === 'ledger')?.data;
      txType = (w?.type || l?.transaction_type || 'ADMIN_ADJUSTMENT') as TransactionType;
    }

    // Refine mapped type based on reference or description semantics
    const descConcat = items.map(it => String(it.data.description || '')).join(' ').toLowerCase();
    const refConcat = items.map(it => String(it.data.reference_id || it.data.traceno || it.data.order_id || '')).join(' ').toLowerCase();
    if (refConcat.includes('checkin') || descConcat.includes('check-in') || descConcat.includes('daily checkin')) {
      txType = 'DAILY_CHECKIN';
    } else if (refConcat.includes('signup') || descConcat.includes('signup bonus')) {
      txType = 'SIGNUP_BONUS';
    } else if (refConcat.includes('topup-ref-l') || descConcat.includes('referral commission') || descConcat.includes('team commission')) {
      txType = 'REFERRAL_BONUS';
    } else if (refConcat.includes('gift') || descConcat.includes('gift code')) {
      txType = 'GIFT_CODE_REWARD';
    } else if (refConcat.startsWith('clm-') || descConcat.includes('hourly yield') || descConcat.includes('device claim')) {
      txType = 'HOURLY_EARNING';
    }

    // 2. Authoritative Status Resolution
    const allStatuses = items.map(it => String(it.data.status || '').toUpperCase());
    let canonicalStatus: WalletTransaction['status'] = 'Pending';
    if (allStatuses.some(s => s === 'PAID' || s === 'SUCCESS' || s === 'COMPLETED' || s === 'APPROVED')) {
      canonicalStatus = 'Completed';
    } else if (allStatuses.some(s => s === 'FAILED' || s === 'REJECTED' || s === 'FAILED_GATEWAY_CREATION')) {
      canonicalStatus = 'Failed';
    } else {
      canonicalStatus = 'Pending';
    }

    // 3. Amount & Directional Sign
    const rawAmount = Number(
      items.find(it => it.data.amount != null)?.data.amount || 0
    );
    let amount = Math.abs(rawAmount);
    if (txType === 'WITHDRAWAL' || txType === 'PLAN_PURCHASE' || txType === 'PRO_PLAN_PURCHASE') {
      amount = -Math.abs(rawAmount);
    }

    // 4. Reference Identification
    const pay = items.find(it => it.source === 'payment')?.data;
    const dep = items.find(it => it.source === 'deposit')?.data;
    const wtx = items.find(it => it.source === 'wallet_tx')?.data;
    const wth = items.find(it => it.source === 'withdrawal')?.data;
    const pur = items.find(it => it.source === 'purchase')?.data;
    const ldg = items.find(it => it.source === 'ledger')?.data;

    let referenceId = '';
    const candidates: string[] = [];
    for (const it of items) {
      const d = it.data;
      if (d.order_id) candidates.push(d.order_id);
      if (d.orderId) candidates.push(d.orderId);
      if (d.traceno) candidates.push(d.traceno);
      if (d.merchant_order_id) candidates.push(d.merchant_order_id);
      if (d.reference_id) candidates.push(d.reference_id);
      if (d.referenceId) candidates.push(d.referenceId);
      if (d.bank_ref_no) candidates.push(d.bank_ref_no);
    }
    const cleanCandidates = candidates.filter(c => isValidIdentifierToken(c));

    // Prefer human-readable identifiers that don't start with raw prefix
    const preferred = cleanCandidates.find(c => !c.startsWith('USDT_DEP-') && !c.startsWith('USDT-') && (!c.includes('-') || c.startsWith('DEP') || c.startsWith('CHECKIN') || c.startsWith('SIGNUP')));
    if (preferred) {
      referenceId = preferred;
    } else if (cleanCandidates.length > 0) {
      let first = cleanCandidates[0];
      if (first.startsWith('USDT_DEP-')) first = first.replace('USDT_DEP-', 'USDT-');
      referenceId = first;
    } else {
      referenceId = pay?.id || dep?.id || wtx?.id || rootKey;
    }

    // 5. Payment Method & Description
    const isUsdt =
      Boolean(pay) ||
      items.some(it =>
        String(it.data.channel || it.data.payment_method || it.data.method || it.data.reference_id || it.data.referenceId || '').toUpperCase().includes('USDT')
      );
    const paymentMethod = isUsdt
      ? (pay?.payment_method ? `USDT (${pay.payment_method})` : 'USDT (TRC20)')
      : (dep?.channel || wth ? 'Bank Transfer' : wtx?.paymentMethod || 'UPI Gateway');

    let description =
      wtx?.description ||
      ldg?.description ||
      (txType === 'RECHARGE' ? `Recharge Order #${referenceId}` : undefined);

    if (isUsdt && (!description || description.includes('ADMIN_ADJUSTMENT'))) {
      description = `USDT Deposit #${referenceId}`;
    }

    const utr =
      pay?.utr ||
      dep?.utr ||
      wth?.bank_ref_no ||
      wtx?.utr ||
      items.find(it => it.data.utr)?.data.utr;

    // 6. Timestamps
    const earliestTime = items.reduce((acc, it) => {
      const d = new Date(it.data.created_at || it.data.createdAt || it.data.claimed_at).getTime();
      return isNaN(d) ? acc : Math.min(acc, d);
    }, Infinity);
    const createdAt = earliestTime !== Infinity ? new Date(earliestTime).toISOString() : new Date().toISOString();

    const primaryId = pay?.id || dep?.id || wtx?.id || wth?.id || pur?.id || rootKey;
    const userId = pay?.user_id || dep?.user_id || wtx?.user_id || wtx?.userId || wth?.user_id || pur?.user_id || inputs.userId || '';

    result.push({
      id: primaryId,
      userId,
      type: txType,
      amount,
      balanceBefore: Number(wtx?.balance_before ?? wtx?.balanceBefore ?? ldg?.balance_before ?? 0),
      balanceAfter: Number(wtx?.balance_after ?? wtx?.balanceAfter ?? ldg?.balance_after ?? 0),
      status: canonicalStatus,
      referenceId,
      description,
      paymentMethod,
      utr,
      orderId: pay?.order_id || pay?.orderId || dep?.order_id || dep?.orderId || wtx?.order_id || wtx?.orderId || referenceId,
      planName: pur?.plan_name || wtx?.plan_name || wtx?.planName,
      createdAt,
      usdtAmount: pay?.usdt_amount || wtx?.usdt_amount || wtx?.usdtAmount,
    });
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
