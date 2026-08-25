// Supabase Edge Function: univepay-withdrawal
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user via JWT
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
    const { amount, method = "UNIVEPAY_AUTO", bankName, bankCode, accountName, accountNumber, upiId } = requestJson;

    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized. Please login to continue." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return new Response(
        JSON.stringify({ success: false, error: "Minimum withdrawal amount is ₹100" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const traceno = `WTH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: wResult, error: wError } = await supabase.rpc("create_withdrawal_order", {
      p_user_id: authenticatedUserId,
      p_amount: numAmount,
      p_method: method,
      p_traceno: traceno,
      p_bank_name: bankName || null,
      p_bank_code: bankCode || null,
      p_account_name: accountName || null,
      p_account_number: accountNumber || null,
      p_upi_id: upiId || null,
    });

    if (wError || !wResult?.success) {
      return new Response(
        JSON.stringify({ success: false, error: wError?.message || wResult?.error || "Failed to create withdrawal order" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const merchantNo = Deno.env.get("UNIVEPAY_MERCHANT_NO") || "";
    const secretKey = Deno.env.get("UNIVEPAY_SECRET") || "";
    const withdrawalUrl = Deno.env.get("UNIVEPAY_CREATE_PAYOUT_URL") || Deno.env.get("UNIVEPAY_WITHDRAWAL_URL") || "https://ydpay.univepay.com/Payment/Cashout";
    const appUrl = Deno.env.get("APP_URL") || "https://powerbank.app";
    const notifyUrl = `${appUrl}/api/univepay/withdrawal-callback`;

    if (method === "UNIVEPAY_AUTO" && merchantNo && secretKey) {
      const formattedAmount = numAmount.toFixed(2);
      const acc = accountName || "Member";
      const card = accountNumber || upiId || "";

      // Signature: Account + Amount + CardNo + Merchno + Traceno + secretKey
      const signString = `${acc}${formattedAmount}${card}${merchantNo}${traceno}${secretKey}`;
      const signature = md5(signString);

      console.log(`[UNIVEPAY][WITHDRAWAL] Initiating auto-payout for Traceno: ${traceno}, Amount: ${formattedAmount}`);

      const requestBody = new URLSearchParams({
        Merchno: merchantNo,
        Traceno: traceno,
        Amount: formattedAmount,
        Account: acc,
        CardNo: card,
        BankCode: bankCode || "UPI",
        NotifyUrl: notifyUrl,
        Signature: signature,
      });

      const response = await fetch(withdrawalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: requestBody.toString(),
      });

      const result = await response.json().catch(() => null);
      console.log(`[UNIVEPAY][WITHDRAWAL] Gateway response for Traceno ${traceno}:`, result);

      await supabase
        .from("withdrawal_transactions")
        .update({
          gateway_status: result?.status || "PROCESSING",
          gateway_response: result,
          status: "PROCESSING",
          updated_at: new Date().toISOString(),
        })
        .eq("traceno", traceno);

      return new Response(
        JSON.stringify({
          success: true,
          traceno,
          method: "UNIVEPAY_AUTO",
          amount: numAmount,
          status: "PROCESSING",
          gatewayResponse: result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        traceno,
        method,
        amount: numAmount,
        status: "PENDING",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[UNIVEPAY][WITHDRAWAL] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
