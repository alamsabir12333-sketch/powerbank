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

async function settleOrderDirectly(supabase: any, order: any, serialNo: string, rawResult: any) {
  const currentStatus = (order.status || "").toUpperCase();
  if (currentStatus === "SUCCESS" || currentStatus === "PAID" || currentStatus === "COMPLETED") {
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

  // 4. Insert wallet_ledger
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
    const queryOrderId = orderId || traceno;
    if (!queryOrderId) throw new Error("Order ID is required");

    // 1. Check local database record first
    const { data: dbDeposit } = await supabase
      .from("deposit_transactions")
      .select("*")
      .or(`traceno.eq.${queryOrderId},merchant_order_id.eq.${queryOrderId}`)
      .maybeSingle();

    if (dbDeposit && dbDeposit.status === "SUCCESS") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "SUCCESS",
          orderId: dbDeposit.traceno || dbDeposit.merchant_order_id,
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
