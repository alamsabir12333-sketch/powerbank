import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

function verifySignature(params: Record<string, string>, secretKey: string, receivedSign: string): boolean {
  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase() !== "signature" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort();
  const rawString = keys.map((k) => `${k}=${params[k]}`).join("&") + `&${secretKey}`;
  const hash = createHash("md5");
  hash.update(rawString);
  const calculatedSign = hash.digest("hex").toUpperCase();
  return calculatedSign === (receivedSign || "").toUpperCase();
}

async function processReferralCommissions(supabase: any, userId: string, depositAmount: number, traceno: string) {
  try {
    if (!traceno || String(traceno).startsWith('PUR-')) {
      return;
    }

    let tiers = [
      { tier: 1, percentage: 10 },
      { tier: 2, percentage: 5 },
      { tier: 3, percentage: 2 },
    ];

    try {
      const { data: set } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("id", "referral_tiers")
        .maybeSingle();
      if (set?.value && Array.isArray(set.value)) {
        tiers = set.value;
      } else {
        const { data: refSet } = await supabase
          .from("admin_settings")
          .select("value")
          .eq("id", "referral_settings")
          .maybeSingle();
        if (refSet?.value?.topupTiers && Array.isArray(refSet.value.topupTiers)) {
          tiers = refSet.value.topupTiers;
        } else if (refSet?.value?.tiers && Array.isArray(refSet.value.tiers)) {
          tiers = refSet.value.tiers;
        } else if (refSet?.value?.commissionRates) {
          tiers = [
            { tier: 1, percentage: Number(refSet.value.commissionRates.level1 ?? 10) },
            { tier: 2, percentage: Number(refSet.value.commissionRates.level2 ?? 5) },
            { tier: 3, percentage: Number(refSet.value.commissionRates.level3 ?? 2) },
          ];
        }
      }
    } catch (_e) {}

    // Helper to find parent referrer
    const findParentReferrer = async (childId: string, visited: Set<string> = new Set()) => {
      if (!childId) return null;
      const { data: rRow } = await supabase
        .from("referrals")
        .select("*")
        .eq("referee_id", childId)
        .maybeSingle();

      if (rRow?.referrer_id && rRow.referrer_id !== childId && !visited.has(rRow.referrer_id)) {
        return { referrerId: rRow.referrer_id, refRowId: rRow.id, currentCommission: Number(rRow.commission_earned || 0) };
      }

      const { data: childProf } = await supabase
        .from("profiles")
        .select("referred_by")
        .or(`user_id.eq.${childId},id.eq.${childId}`)
        .maybeSingle();

      if (childProf?.referred_by) {
        const cleanRef = String(childProf.referred_by).trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
        const filterStr = isUUID
          ? `referral_code.ilike.${cleanRef},membership_number.ilike.${cleanRef},user_id.eq.${cleanRef},id.eq.${cleanRef}`
          : `referral_code.ilike.${cleanRef},membership_number.ilike.${cleanRef}`;
        const { data: pProf } = await supabase
          .from("profiles")
          .select("id, user_id")
          .or(filterStr)
          .maybeSingle();

        if (pProf) {
          const pId = pProf.user_id || pProf.id;
          if (pId && pId !== childId && !visited.has(pId)) {
            try {
              const { data: insRef } = await supabase.from("referrals").insert({
                referrer_id: pId,
                referee_id: childId,
                level: 1,
                bonus_amount: 0,
                status: "ACTIVE",
                qualifying_recharge_done: true,
                commission_earned: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).select("id").maybeSingle();
              return { referrerId: pId, refRowId: insRef?.id || null, currentCommission: 0 };
            } catch {
              return { referrerId: pId, refRowId: null, currentCommission: 0 };
            }
          }
        }
      }
      return null;
    };

    const visitedReferrers = new Set<string>([userId]);
    const l1Info = await findParentReferrer(userId, visitedReferrers);
    if (!l1Info?.referrerId) return;
    visitedReferrers.add(l1Info.referrerId);

    const l2Info = await findParentReferrer(l1Info.referrerId, visitedReferrers);
    if (l2Info?.referrerId) visitedReferrers.add(l2Info.referrerId);

    const l3Info = l2Info?.referrerId ? await findParentReferrer(l2Info.referrerId, visitedReferrers) : null;
    if (l3Info?.referrerId) visitedReferrers.add(l3Info.referrerId);

    const tierTargets = [
      { tierNum: 1, referrerId: l1Info.referrerId, refRowId: l1Info.refRowId, currentCommission: l1Info.currentCommission },
      { tierNum: 2, referrerId: l2Info?.referrerId || null, refRowId: l2Info?.refRowId || null, currentCommission: l2Info?.currentCommission || 0 },
      { tierNum: 3, referrerId: l3Info?.referrerId || null, refRowId: l3Info?.refRowId || null, currentCommission: l3Info?.currentCommission || 0 },
    ];

    const nowIso = new Date().toISOString();

    for (const target of tierTargets) {
      if (!target.referrerId || target.referrerId === userId) continue;
      const tierConfig = tiers.find((t) => t.tier === target.tierNum);
      if (!tierConfig || tierConfig.percentage <= 0) continue;

      const commission = +(depositAmount * (tierConfig.percentage / 100)).toFixed(2);
      if (commission <= 0) continue;

      const refId = `TOPUP-REF-L${target.tierNum}-${traceno}`;
      const commDesc = `L${target.tierNum} Referral Commission (${tierConfig.percentage}%) from Topup #${traceno}`;

      // Idempotency check in wallet_ledger and wallet_transactions
      const { data: existingLedger } = await supabase
        .from("wallet_ledger")
        .select("id")
        .eq("reference_id", refId)
        .maybeSingle();

      if (existingLedger) continue;

      const { data: existingTx } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("reference_id", refId)
        .maybeSingle();

      if (existingTx) continue;

      // Fetch Referrer Wallet
      const { data: refWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", target.referrerId)
        .maybeSingle();

      const curWithdraw = Number(refWallet?.withdraw_balance !== undefined && refWallet?.withdraw_balance !== null ? refWallet.withdraw_balance : (refWallet?.earned_balance || 0));
      const curRecharge = Number(refWallet?.recharge_balance || 0);
      const curTotalEarned = Number(refWallet?.total_earned || 0);
      const curTeamComm = Number(refWallet?.team_commission || 0);

      const newWithdraw = +(curWithdraw + commission).toFixed(2);
      const newAvail = +(curRecharge + newWithdraw).toFixed(2);
      const newTotalEarned = +(curTotalEarned + commission).toFixed(2);
      const newTeamComm = +(curTeamComm + commission).toFixed(2);

      // Update Referrer Wallet
      if (refWallet) {
        await supabase
          .from("wallets")
          .update({
            withdraw_balance: newWithdraw,
            earned_balance: newWithdraw,
            available_balance: newAvail,
            total_earned: newTotalEarned,
            team_commission: newTeamComm,
            updated_at: nowIso,
          })
          .eq("user_id", target.referrerId);
      } else {
        await supabase.from("wallets").insert({
          user_id: target.referrerId,
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
      }

      // Record in wallet_ledger (Valid wallet_type is 'DEVICE_EARNING')
      try {
        await supabase.from("wallet_ledger").insert({
          id: crypto.randomUUID(),
          user_id: target.referrerId,
          wallet_type: "DEVICE_EARNING",
          transaction_type: "REFERRAL_COMMISSION",
          amount: commission,
          direction: "CREDIT",
          reference_type: "REFERRAL_COMMISSION",
          reference_id: refId,
          balance_before: curWithdraw,
          balance_after: newWithdraw,
          description: commDesc,
          created_at: nowIso,
        });
      } catch (ledErr: any) {
        console.warn("[EDGE COMMISSION LEDGER NOTICE]", ledErr.message);
      }

      // Record in wallet_transactions (Valid type is 'TEAM_BONUS')
      await supabase.from("wallet_transactions").insert({
        id: crypto.randomUUID(),
        user_id: target.referrerId,
        type: "TEAM_BONUS",
        amount: commission,
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        reference_id: refId,
        description: commDesc,
        wallet_type: "WITHDRAW",
        status: "COMPLETED",
        metadata: {
          rewardType: "TOPUP_COMMISSION",
          tier: target.tierNum,
          type: "COMMISSION",
          refId,
          depositUserId: userId,
          traceno,
          depositAmount,
        },
        created_at: nowIso,
      });

      // Notify Referrer
      try {
        await supabase.from("notifications").insert({
          user_id: target.referrerId,
          title: `L${target.tierNum} Referral Commission Earned! 💰`,
          message: `You received ₹${commission.toFixed(2)} (${tierConfig.percentage}%) commission from a team member topup.`,
          type: "EARNING",
          read: false,
          created_at: nowIso,
        });
      } catch {}

      // Update referral record
      if (target.refRowId) {
        try {
          await supabase
            .from("referrals")
            .update({
              qualifying_recharge_done: true,
              status: "ACTIVE",
              commission_earned: +(target.currentCommission + commission).toFixed(2),
              updated_at: nowIso,
            })
            .eq("id", target.refRowId);
        } catch {}
      } else if (target.tierNum === 1) {
        try {
          await supabase.from("referrals").insert({
            referrer_id: target.referrerId,
            referee_id: userId,
            level: 1,
            bonus_amount: 0,
            status: "ACTIVE",
            qualifying_recharge_done: true,
            commission_earned: commission,
            created_at: nowIso,
            updated_at: nowIso,
          });
        } catch {}
      }
    }
  } catch (err: any) {
    console.error("[SETTLEMENT] Referral commission error:", err.message);
  }
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const bodyText = await req.text();
    let params: Record<string, string> = {};

    try {
      if (bodyText.startsWith("{")) {
        params = JSON.parse(bodyText);
      } else {
        params = Object.fromEntries(new URLSearchParams(bodyText));
      }
    } catch (_e) {
      params = {};
    }

    const orderId = params.Traceno || params.traceno || params.orderId || params.order_id || "";
    const status = (params.Status || params.status || "").toUpperCase();
    const serialNo = params.SerialNo || params.serialNo || params.serial_no || "";
    const signature = params.Signature || params.signature || "";
    const utr = params.Remark || params.remark || params.utr || params.UTR || "";

    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || Deno.env.get("UNIVEPAY_SECRET") || "secret";

    // Log the callback safely for audit
    try {
      await supabase.from("gateway_logs").insert({
        action: "WEBHOOK_CALLBACK",
        order_id: orderId,
        request_payload: { raw: bodyText, parsed: params },
        status: status || "RECEIVED",
      });
    } catch (_e) {}

    // Verify MD5 Signature
    const isValid = verifySignature(params, secretKey, signature);
    if (!isValid) {
      console.error("[CALLBACK] MD5 signature mismatch for order:", orderId);
      return new Response("INVALID_SIGNATURE", { status: 400 });
    }

    if (status === "SUCCESS" || status === "00" || status === "PAID") {
      if (!orderId) {
        console.error("[CALLBACK] Missing order ID in callback payload");
        return new Response("MISSING_ORDER_ID", { status: 400 });
      }

      // 1. Fetch deposit order by traceno or merchant_order_id
      const { data: order, error: fetchErr } = await supabase
        .from("deposit_transactions")
        .select("*")
        .or(`traceno.eq.${orderId},merchant_order_id.eq.${orderId}`)
        .maybeSingle();

      if (fetchErr || !order) {
        console.error(`[CALLBACK] Deposit order not found for ${orderId}:`, fetchErr?.message);
        return new Response("ORDER_NOT_FOUND", { status: 404 });
      }

      // 2. Idempotency Check: if already settled, return SUCCESS without duplicate credit
      const currentStatus = (order.status || "").toUpperCase();
      if (currentStatus === "SUCCESS" || currentStatus === "PAID" || currentStatus === "COMPLETED") {
        console.log(`[CALLBACK] Order ${orderId} already settled (${order.status}). Skipping duplicate credit.`);
        return new Response("SUCCESS", {
          headers: { "Content-Type": "text/plain" },
          status: 200,
        });
      }

      const userId = order.user_id;
      const depositAmount = Number(order.amount);
      if (!userId || isNaN(depositAmount) || depositAmount <= 0) {
        console.error(`[CALLBACK] Invalid order data for order ${orderId}`);
        return new Response("INVALID_ORDER_DATA", { status: 400 });
      }

      // 3. Fetch user wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const currentRechargeBalance = Number(wallet?.recharge_balance || 0);
      const currentWithdrawBalance = Number(wallet?.withdraw_balance || 0);
      const newRechargeBalance = +(currentRechargeBalance + depositAmount).toFixed(2);
      const newAvailableBalance = +(newRechargeBalance + currentWithdrawBalance).toFixed(2);
      const nowIso = new Date().toISOString();

      // 4. Update deposit_transactions record to SUCCESS
      const { error: updateOrderErr } = await supabase
        .from("deposit_transactions")
        .update({
          status: "SUCCESS",
          gateway_status: "SUCCESS",
          gateway_serial_no: serialNo || order.gateway_serial_no || null,
          serial_no: serialNo || order.serial_no || null,
          utr: utr || order.utr || null,
          callback_received: true,
          signature_verified: true,
          raw_response: params,
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", order.id);

      if (updateOrderErr) {
        console.error(`[CALLBACK] Failed to update deposit_transactions for ${orderId}:`, updateOrderErr.message);
        return new Response("DATABASE_UPDATE_ERROR", { status: 500 });
      }

      // 5. Update wallet (Credit Topup Wallet only; withdraw_balance unchanged)
      if (wallet) {
        await supabase
          .from("wallets")
          .update({
            recharge_balance: newRechargeBalance,
            available_balance: newAvailableBalance,
            updated_at: nowIso,
          })
          .eq("user_id", userId);
      } else {
        await supabase.from("wallets").insert({
          user_id: userId,
          recharge_balance: newRechargeBalance,
          withdraw_balance: 0,
          available_balance: newRechargeBalance,
          pending_balance: 0,
          total_earned: 0,
          total_withdrawn: 0,
        });
      }

      // 6. Update or insert wallet_transactions record
      const { data: existingTx } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("reference_id", order.traceno)
        .maybeSingle();

      if (existingTx) {
        await supabase
          .from("wallet_transactions")
          .update({
            status: "Completed",
            balance_before: currentRechargeBalance,
            balance_after: newRechargeBalance,
            description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
          })
          .eq("id", existingTx.id);
      } else {
        await supabase.from("wallet_transactions").insert({
          user_id: userId,
          type: "RECHARGE",
          amount: depositAmount,
          balance_before: currentRechargeBalance,
          balance_after: newRechargeBalance,
          reference_id: order.traceno,
          description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
          wallet_type: "TOPUP",
          status: "Completed",
          created_at: nowIso,
        });
      }

      // 7. Insert Immutable Financial Ledger Record (wallet_ledger)
      await supabase.from("wallet_ledger").insert({
        user_id: userId,
        wallet_type: "RECHARGE",
        transaction_type: "DEPOSIT_SUCCESS",
        amount: depositAmount,
        direction: "CREDIT",
        reference_type: "DEPOSIT",
        reference_id: order.traceno,
        balance_before: currentRechargeBalance,
        balance_after: newRechargeBalance,
        description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
        created_at: nowIso,
      });

      // 8. Insert In-App User Notification
      try {
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Recharge Successful",
          message: `₹${depositAmount} has been added to your Topup Wallet.`,
          type: "RECHARGE",
          read: false,
          created_at: nowIso,
        });
      } catch (notifErr: any) {
        console.warn("[CALLBACK] Failed to insert user notification:", notifErr.message);
      }

      // 9. Process Referral Commissions for eligible L1/L2/L3 referrers
      await processReferralCommissions(supabase, userId, depositAmount, order.traceno);

      console.log(`[CALLBACK] Successfully settled order ${order.traceno}: ₹${depositAmount} credited to user ${userId}.`);
    }

    return new Response("SUCCESS", {
      headers: { "Content-Type": "text/plain" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[CALLBACK] Handler error:", err.message);
    return new Response("ERROR", { status: 500 });
  }
});
