// Supabase Edge Function: univepay-payment-callback
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

function md5(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = crypto.subtle.digestSync("MD5", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

serve(async (req) => {
  let body: any = {};
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    for (const [key, val] of params.entries()) {
      body[key] = val;
    }
  } else {
    body = await req.json().catch(() => ({}));
  }

  const transDate = body.TransDate || body.transDate || "";
  const merchno = body.Merchno || body.merchno || "";
  const amount = body.Amount || body.amount || "";
  const traceno = body.Traceno || body.traceno || "";
  const payCode = body.PayCode || body.payCode || "";
  const serialNo = body.SerialNo || body.serialNo || "";
  const status = (body.Status || body.status || "").toUpperCase();
  const signature = body.Signature || body.signature || "";
  const remark = body.Remark || body.remark || "";

  console.log(`[UNIVEPAY][CALLBACK] Traceno: ${traceno}, Status: ${status}, SerialNo: ${serialNo}, Merchno: ${merchno}, Amount: ${amount}`);

  const merchantNo = Deno.env.get("UNIVEPAY_MERCHANT_NO") || "";
  const secretKey = Deno.env.get("UNIVEPAY_SECRET") || "";

  // =========================================================================
  // PART 16 — SECRET MUST BE REQUIRED (FAIL CLOSED)
  // =========================================================================
  if (!secretKey) {
    console.error("[UNIVEPAY][CALLBACK] Fatal: UNIVEPAY_SECRET is missing from environment. Rejecting callback.");
    return new Response("SERVER_CONFIGURATION_ERROR", { status: 500 });
  }

  // =========================================================================
  // PART 15 — MERCHANT NUMBER VERIFICATION
  // =========================================================================
  if (merchantNo && merchno !== merchantNo) {
    console.error(`[UNIVEPAY][CALLBACK] Merchant mismatch! Expected: ${merchantNo}, Received: ${merchno}`);
    return new Response("MERCHANT_ERROR", { status: 400 });
  }

  // =========================================================================
  // PART 14 — REQUIRED FIELDS CHECK
  // =========================================================================
  if (!transDate || !merchno || !amount || !payCode || !serialNo || !status || !traceno || !signature) {
    console.error("[UNIVEPAY][CALLBACK] Missing required callback fields in payload.");
    return new Response("MISSING_REQUIRED_FIELDS", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // =========================================================================
  // PART 19 — TRACENO VERIFICATION (ORDER MUST EXIST)
  // =========================================================================
  const { data: dbOrder, error: orderErr } = await supabase
    .from("deposit_transactions")
    .select("*")
    .eq("traceno", traceno)
    .maybeSingle();

  if (orderErr || !dbOrder) {
    console.error(`[UNIVEPAY][CALLBACK] Order not found for Traceno: ${traceno}`);
    return new Response("ORDER_NOT_FOUND", { status: 400 });
  }

  // =========================================================================
  // PART 18 — AMOUNT VERIFICATION (NORMALIZED DECIMAL COMPARISON)
  // =========================================================================
  const callbackAmountNum = parseFloat(amount);
  const dbAmountNum = parseFloat(dbOrder.amount);

  if (isNaN(callbackAmountNum) || isNaN(dbAmountNum) || Math.abs(callbackAmountNum - dbAmountNum) > 0.001) {
    console.error(`[UNIVEPAY][CALLBACK] Amount mismatch! DB Amount: ${dbAmountNum}, Callback Amount: ${callbackAmountNum}`);
    return new Response("AMOUNT_ERROR", { status: 400 });
  }

  // =========================================================================
  // PART 17 — CALLBACK SIGNATURE VERIFICATION
  // Formula: Amount + Merchno + PayCode + SerialNo + Status + Traceno + TransDate + secretKey
  // =========================================================================
  const signString = `${amount}${merchno}${payCode}${serialNo}${status}${traceno}${transDate}${secretKey}`;
  const calculatedSignature = md5(signString);

  if (calculatedSignature.toUpperCase() !== signature.toUpperCase()) {
    console.error(`[UNIVEPAY][CALLBACK] Signature mismatch! Calculated: ${calculatedSignature}, Received: ${signature}`);
    return new Response("SIGNATURE_ERROR", { status: 400 });
  }

  console.log(`[UNIVEPAY][VERIFY] Merchant verified: OK, Order verified: OK, Amount verified: OK, Signature verified: OK`);

  // =========================================================================
  // PART 20 & 21 — STATUS VERIFICATION & ATOMIC SETTLEMENT
  // =========================================================================
  if (status === "SUCCESS") {
    const { data: settleResult, error: settleErr } = await supabase.rpc("complete_univepay_deposit_success", {
      p_traceno: traceno,
      p_gateway_serial_no: serialNo,
      p_gateway_order_id: null,
      p_payload: body,
      p_utr: remark || null,
    });

    if (settleErr) {
      console.error("[UNIVEPAY][SETTLEMENT] RPC settlement failed:", settleErr.message);
      return new Response("SETTLEMENT_ERROR", { status: 500 });
    }

    console.log(`[UNIVEPAY][SETTLEMENT] Traceno: ${traceno}, Settlement Result:`, settleResult);
  } else {
    console.warn(`[UNIVEPAY][CALLBACK] Received non-success status: ${status} for Traceno: ${traceno}`);
  }

  // PART 40 — CALLBACK RESPONSE
  return new Response("SUCCESS", {
    headers: { "Content-Type": "text/plain" },
    status: 200,
  });
});
