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
    // 1. Fetch referral linkages where this user is the referee
    const { data: refs, error: refErr } = await supabase
      .from("referrals")
      .select("*")
      .eq("referee_id", userId);

    if (refErr || !refs || refs.length === 0) return;

    // 2. Fetch admin percentage config if present
    let tiers = [
      { tier: 1, percentage: 10 },
      { tier: 2, percentage: 3 },
      { tier: 3, percentage: 1 },
    ];

    try {
      const { data: set } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("id", "referral_tiers")
        .maybeSingle();
      if (set?.value && Array.isArray(set.value)) {
        tiers = set.value;
      }
    } catch (_e) {}

    const nowIso = new Date().toISOString();

    for (const ref of refs) {
      const tierNum = Number(ref.level || 1);
      const tierConfig = tiers.find((t) => t.tier === tierNum);
      if (!tierConfig || tierConfig.percentage <= 0) continue;

      const commission = +(depositAmount * (tierConfig.percentage / 100)).toFixed(2);
      if (commission <= 0) continue;

      const refId = `TOPUP-REF-L${tierNum}-${traceno}`;

      // Idempotency: verify this commission reference was not already credited
      const { data: existingLedger } = await supabase
        .from("wallet_ledger")
        .select("id")
        .eq("reference_id", refId)
        .maybeSingle();

      if (existingLedger) continue;

      const referrerId = ref.referrer_id;
      if (!referrerId) continue;

      // Fetch Referrer Wallet
      const { data: refWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", referrerId)
        .maybeSingle();

      const curWithdraw = Number(refWallet?.withdraw_balance || 0);
      const curRecharge = Number(refWallet?.recharge_balance || 0);
      const newWithdraw = +(curWithdraw + commission).toFixed(2);
      const newAvail = +(curRecharge + newWithdraw).toFixed(2);

      // Update Referrer Wallet
      if (refWallet) {
        await supabase
          .from("wallets")
          .update({
            withdraw_balance: newWithdraw,
            available_balance: newAvail,
            updated_at: nowIso,
          })
          .eq("user_id", referrerId);
      } else {
        await supabase.from("wallets").insert({
          user_id: referrerId,
          recharge_balance: 0,
          withdraw_balance: newWithdraw,
          available_balance: newWithdraw,
          pending_balance: 0,
          total_earned: commission,
          total_withdrawn: 0,
        });
      }

      // Record in wallet_ledger
      await supabase.from("wallet_ledger").insert({
        user_id: referrerId,
        wallet_type: "WITHDRAW",
        transaction_type: "REFERRAL_COMMISSION",
        amount: commission,
        direction: "CREDIT",
        reference_type: "REFERRAL_COMMISSION",
        reference_id: refId,
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        description: `Level ${tierNum} Team Commission (${tierConfig.percentage}%) from Topup #${traceno}`,
        created_at: nowIso,
      });

      // Record in wallet_transactions
      await supabase.from("wallet_transactions").insert({
        user_id: referrerId,
        type: "COMMISSION",
        amount: commission,
        balance_before: curWithdraw,
        balance_after: newWithdraw,
        reference_id: refId,
        description: `Level ${tierNum} Team Commission (${tierConfig.percentage}%) from Topup #${traceno}`,
        wallet_type: "WITHDRAW",
        status: "Completed",
        created_at: nowIso,
      });

      // Notify Referrer
      await supabase.from("notifications").insert({
        user_id: referrerId,
        title: `Tier ${tierNum} Team Commission Earned! 💰`,
        message: `You received ₹${commission.toFixed(2)} (${tierConfig.percentage}%) commission from a team member recharge.`,
        type: "EARNING",
        read: false,
        created_at: nowIso,
      });

      // Update referral record
      await supabase
        .from("referrals")
        .update({
          qualifying_recharge_done: true,
          commission_earned: +((ref.commission_earned || 0) + commission).toFixed(2),
          updated_at: nowIso,
        })
        .eq("id", ref.id);
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
