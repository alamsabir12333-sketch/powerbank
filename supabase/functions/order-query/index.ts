import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateSignature(params: Record<string, string>, secretKey: string): Promise<string> {
  const keys = Object.keys(params)
    .filter((k) => k !== "Signature" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort();
  const rawString = keys.map((k) => `${k}=${params[k]}`).join("&") + `&${secretKey}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(rawString));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * PROCESS REFERRAL COMMISSIONS (EDGE FUNCTION)
 * Authoritative 3-tier referral commission calculation for topups only.
 */
async function processReferralCommissions(
  supabase: any,
  userId: string,
  depositAmount: number,
  traceno: string
) {
  try {
    const cleanTrace = String(traceno || "").trim();
    const tLower = cleanTrace.toLowerCase();
    if (
      !cleanTrace ||
      tLower.startsWith("pur-") ||
      tLower.startsWith("plan-") ||
      tLower.startsWith("dev-") ||
      tLower.startsWith("claim-") ||
      tLower.startsWith("wth-") ||
      tLower.startsWith("checkin-") ||
      tLower.startsWith("bonus-") ||
      tLower.startsWith("signup-") ||
      tLower.includes("purchase") ||
      depositAmount <= 0
    ) {
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

      const refId = `TOPUP-REF-L${target.tierNum}-${cleanTrace}`;
      const legacyRefId = `TOPUP-T${target.tierNum}-${cleanTrace}`;
      const commDesc = `L${target.tierNum} Referral Commission (${tierConfig.percentage}%) from Topup #${cleanTrace}`;

      // ATOMIC POSTGRESQL SETTLEMENT VIA RPC (Dedicated referral_commission_settlements table)
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("settle_referral_commission", {
        p_reference_id: refId,
        p_topup_reference: cleanTrace,
        p_deposit_user_id: userId,
        p_deposit_amount: depositAmount,
        p_tier: target.tierNum,
        p_referrer_id: target.referrerId,
        p_commission_percentage: tierConfig.percentage,
        p_commission_amount: commission,
        p_description: commDesc,
        p_ref_row_id: target.refRowId || null,
      });

      if (rpcErr) {
        console.error(`[EDGE REFERRAL ATOMIC RPC ERROR] settle_referral_commission failed for ${refId}:`, rpcErr.message);
        continue;
      }

      if (rpcRes?.already_settled || !rpcRes?.settled) {
        console.log(`[EDGE REFERRAL SKIPPED] ${refId}: ${rpcRes?.reason || "ALREADY_SETTLED"}`);
        continue;
      }

      // User In-App Notification
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

      console.log(`[EDGE COMMISSION SETTLED] L${target.tierNum} Referrer ${target.referrerId} credited ₹${commission} for topup ${cleanTrace}`);
    }
  } catch (err: any) {
    console.error("[EDGE REFERRAL COMMISSION ERROR]", err.message);
  }
}

async function settleOrderDirectly(supabase: any, order: any, serialNo: string, rawResult: any) {
  const currentStatus = (order.status || "").toUpperCase();
  const effectiveTrace = String(order.order_id || order.traceno || order.merchant_order_id || serialNo || "TOPUP").trim();

  if (currentStatus === "SUCCESS" || currentStatus === "PAID" || currentStatus === "COMPLETED") {
    await processReferralCommissions(supabase, order.user_id, Number(order.amount), effectiveTrace);
    return { success: true, alreadyProcessed: true };
  }

  const userId = order.user_id;
  const depositAmount = Number(order.amount);
  if (!userId || isNaN(depositAmount) || depositAmount <= 0) {
    return { success: false, error: "INVALID_ORDER_DATA" };
  }

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

  // 1. Update deposit_transactions
  await supabase
    .from("deposit_transactions")
    .update({
      status: "SUCCESS",
      gateway_status: "SUCCESS",
      traceno: effectiveTrace,
      order_id: effectiveTrace,
      merchant_order_id: effectiveTrace,
      gateway_serial_no: serialNo || order.gateway_serial_no || null,
      serial_no: serialNo || order.serial_no || null,
      callback_received: true,
      signature_verified: true,
      raw_response: rawResult,
      completed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", order.id);

  // 2. Update wallet
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

  // 3. Update or insert wallet_transactions
  const { data: existingTx } = await supabase
    .from("wallet_transactions")
    .select("id")
    .or(`reference_id.eq.${effectiveTrace},reference_id.eq.${order.traceno}`)
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
      reference_id: effectiveTrace,
      description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
      wallet_type: "TOPUP",
      status: "Completed",
      created_at: nowIso,
    });
  }

  // 4. Insert wallet_ledger
  try {
    const { data: existingLed } = await supabase
      .from("wallet_ledger")
      .select("id")
      .or(`reference_id.eq.${effectiveTrace},reference_id.eq.${order.traceno}`)
      .maybeSingle();

    if (!existingLed) {
      await supabase.from("wallet_ledger").insert({
        user_id: userId,
        wallet_type: "RECHARGE",
        transaction_type: "DEPOSIT_SUCCESS",
        amount: depositAmount,
        direction: "CREDIT",
        reference_type: "DEPOSIT",
        reference_id: effectiveTrace,
        balance_before: currentRechargeBalance,
        balance_after: newRechargeBalance,
        description: `Topup Recharge of ₹${depositAmount} Credited to Recharge Wallet`,
        created_at: nowIso,
      });
    }
  } catch (_e) {}

  // 5. Insert notification
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Recharge Successful",
      message: `₹${depositAmount} has been added to your Topup Wallet.`,
      type: "RECHARGE",
      read: false,
      created_at: nowIso,
    });
  } catch (_e) {}

  // 6. Settle referral commissions
  await processReferralCommissions(supabase, userId, depositAmount, effectiveTrace);

  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY")!
    );

    const { orderId, traceno } = await req.json();
    const queryOrderId = String(orderId || traceno || "").trim();
    if (!queryOrderId) throw new Error("Order ID is required");

    // 1. Check local database record first
    const { data: dbDeposit } = await supabase
      .from("deposit_transactions")
      .select("*")
      .or(`traceno.eq.${queryOrderId},merchant_order_id.eq.${queryOrderId},order_id.eq.${queryOrderId},id.eq.${queryOrderId}`)
      .maybeSingle();

    if (dbDeposit && (dbDeposit.status === "SUCCESS" || dbDeposit.status === "PAID" || dbDeposit.status === "COMPLETED")) {
      const effectiveTrace = String(dbDeposit.order_id || dbDeposit.traceno || dbDeposit.merchant_order_id || queryOrderId).trim();
      await processReferralCommissions(supabase, dbDeposit.user_id, Number(dbDeposit.amount), effectiveTrace);

      return new Response(
        JSON.stringify({
          success: true,
          status: "SUCCESS",
          orderId: effectiveTrace,
          amount: dbDeposit.amount,
          creditedAt: dbDeposit.completed_at || dbDeposit.updated_at,
          data: dbDeposit,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Query Gateway API
    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();
    const merchNo = config?.merchant_no || Deno.env.get("GATEWAY_MERCH_NO") || Deno.env.get("UNIVEPAY_MERCHANT_NO") || "10001";
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || Deno.env.get("UNIVEPAY_SECRET") || "secret";
    const baseUrl = config?.base_url || Deno.env.get("GATEWAY_BASE_URL") || "https://ydpay.univepay.com";

    const payload: Record<string, string> = {
      Merchno: merchNo,
      Traceno: queryOrderId,
    };
    payload.Signature = await generateSignature(payload, secretKey);

    const gatewayRes = await fetch(`${baseUrl}/Payment/OrderQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    });

    const result = await gatewayRes.json().catch(() => ({ status: "99", msg: "Failed to parse gateway response" }));

    // Log Query Action
    try {
      await supabase.from("gateway_logs").insert({
        action: "ORDER_QUERY",
        order_id: queryOrderId,
        request_payload: payload,
        response_payload: result,
        status: result.status === "00" || result.status === "SUCCESS" ? "SUCCESS" : result.status,
      });
    } catch (_e) {}

    // 3. If gateway returned SUCCESS, process atomic deposit completion
    if ((result.status === "00" || result.status === "SUCCESS" || result.payStatus === "1") && dbDeposit && dbDeposit.status !== "SUCCESS") {
      await settleOrderDirectly(supabase, dbDeposit, result.serialNo || result.orderid || "", result);

      return new Response(
        JSON.stringify({
          success: true,
          status: "SUCCESS",
          orderId: queryOrderId,
          amount: Number(result.amount || dbDeposit?.amount || 0),
          data: result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: dbDeposit?.status || "PENDING",
        orderId: queryOrderId,
        gatewayStatus: result.status,
        data: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
