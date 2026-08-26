// Supabase Edge Function: create-univepay-payment
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function md5(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = crypto.subtle.digestSync("MD5", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Dedicated function to construct exact Univepay Create Payment MD5 Signature:
 * Formula: Amount + Merchno + NotifyUrl + PayCode + Traceno + secretKey
 */
function generateUnivepayCreateSignature(
  amount: string,
  merchno: string,
  notifyUrl: string,
  payCode: string,
  traceno: string,
  secretKey: string
): string {
  const signString = `${amount}${merchno}${notifyUrl}${payCode}${traceno}${secretKey}`;
  return md5(signString);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========================================================================
    // PART 2 — AUTHENTICATION SECURITY: Determine user from Supabase JWT
    // =========================================================================
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    let authenticatedUserId: string | null = null;
    if (token) {
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (!authError && userData?.user?.id) {
        authenticatedUserId = userData.user.id;
      }
    }

    const requestJson = await req.json().catch(() => ({}));
    const { amount, payCode = "印度UPI-银台" } = requestJson;

    // Strict validation: Must be an authenticated user
    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized. Please login to continue." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return new Response(
        JSON.stringify({ success: false, error: "Minimum top up amount is ₹100" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // =========================================================================
    // PART 6 — TRACENO GENERATION: Server-side unique order number
    // =========================================================================
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const traceno = `${timestamp}${randomSuffix}`;
    const formattedAmount = numAmount.toFixed(2);

    // =========================================================================
    // PART 4 & 5 — DATABASE ORDER CREATION: Call RPC create_univepay_deposit_order
    // =========================================================================
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_univepay_deposit_order", {
      p_user_id: authenticatedUserId,
      p_amount: numAmount,
      p_traceno: traceno,
      p_pay_code: payCode,
    });

    if (rpcErr || (rpcResult && rpcResult.success === false)) {
      console.error("[UNIVEPAY][CREATE] RPC order creation failed:", rpcErr?.message || rpcResult?.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unable to create payment order. Please try again.",
          details: rpcErr?.message || rpcResult?.error,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // =========================================================================
    // PART 7 & 8 — UNIVEPAY GLOBALPAY & SIGNATURE
    // =========================================================================
    const merchantNo = Deno.env.get("UNIVEPAY_MERCHANT_NO") || "";
    const secretKey = Deno.env.get("UNIVEPAY_SECRET") || "";
    const depositUrl = Deno.env.get("UNIVEPAY_CREATE_DEPOSIT_URL") || "https://ydpay.univepay.com/Payment/GlobalPay";
    const appUrl = Deno.env.get("APP_URL") || "https://gainpower-top-1.com";
    const notifyUrl = `${supabaseUrl}/functions/v1/univepay-payment-callback`;
    const callbackUrl = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;

    if (!merchantNo || !secretKey) {
      console.error("[UNIVEPAY][CREATE] Missing UNIVEPAY_MERCHANT_NO or UNIVEPAY_SECRET");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment gateway temporarily unavailable. Please try again.",
          details: "Merchant credentials not configured.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    const signature = generateUnivepayCreateSignature(
      formattedAmount,
      merchantNo,
      notifyUrl,
      payCode,
      traceno,
      secretKey
    );

    // Structured server log without leaking secret
    console.log(`[UNIVEPAY][CREATE] Traceno: ${traceno}, Amount: ${formattedAmount}, Merchno: ${merchantNo}, PayCode: ${payCode}, Algorithm: MD5-UPPERCASE`);

    const requestBody = new URLSearchParams({
      Merchno: merchantNo,
      Amount: formattedAmount,
      Traceno: traceno,
      PayCode: payCode,
      NotifyUrl: notifyUrl,
      CallbackUrl: callbackUrl,
      Signature: signature,
    });

    let result: any = null;
    try {
      const response = await fetch(depositUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: requestBody.toString(),
      });
      const responseText = await response.text();
      if (responseText && responseText.trim().startsWith("{")) {
        result = JSON.parse(responseText);
      } else if (responseText && responseText.trim()) {
        result = { raw: responseText };
      }
    } catch (e: any) {
      console.error("[UNIVEPAY][CREATE] Network error communicating with Univepay:", e.message);
      result = null;
    }

    // =========================================================================
    // PART 9, 10 & 11 — GATEWAY RESPONSE VALIDATION & PAY URL
    // =========================================================================
    const isValidSuccessStatus = result && result.status === "00";
    const isValidPayUrl =
      result &&
      typeof result.payUrl === "string" &&
      (result.payUrl.startsWith("https://") || result.payUrl.startsWith("http://"));

    if (isValidSuccessStatus && isValidPayUrl) {
      await supabase
        .from("deposit_transactions")
        .update({
          pay_url: result.payUrl,
          gateway_order_id: result.payOrderid || result.orderId || null,
          gateway_response: result,
          updated_at: new Date().toISOString(),
        })
        .eq("traceno", traceno);

      console.log(`[UNIVEPAY][CREATE] Gateway order successfully created. Traceno: ${traceno}, GatewayOrderId: ${result.payOrderid}`);

      return new Response(
        JSON.stringify({
          success: true,
          status: "00",
          traceno,
          payUrl: result.payUrl,
          payOrderid: result.payOrderid || "",
          payAmount: result.payAmount || formattedAmount,
          payData: result.payData || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // On failure: update status to FAILED_GATEWAY_CREATION in database
    await supabase
      .from("deposit_transactions")
      .update({
        gateway_response: result,
        status: "FAILED_GATEWAY_CREATION",
        updated_at: new Date().toISOString(),
      })
      .eq("traceno", traceno);

    console.error(`[UNIVEPAY][CREATE] Gateway rejected or returned invalid response for Traceno: ${traceno}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Payment gateway temporarily unavailable. Please try again.",
        details: result?.msg || result?.message || result?.error || "Gateway returned invalid status",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error: any) {
    console.error("[UNIVEPAY][CREATE] Exception in create-univepay-payment handler:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Payment gateway temporarily unavailable. Please try again.",
        details: error.message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
