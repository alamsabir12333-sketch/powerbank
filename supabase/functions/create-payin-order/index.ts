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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY")!
    );

    const { amount, customerName, customerEmail, customerPhone, userId } = await req.json();
    if (!amount || Number(amount) < 100) throw new Error("Minimum recharge is ₹100");

    // Fetch config from gateway_settings or fallback to env
    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();

    const merchNo = config?.merchant_no || Deno.env.get("GATEWAY_MERCH_NO") || Deno.env.get("UNIVEPAY_MERCHANT_NO") || "10001";
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || Deno.env.get("UNIVEPAY_SECRET") || "secret";
    const baseUrl = config?.base_url || Deno.env.get("GATEWAY_BASE_URL") || "https://api.univepay.com";
    const notifyUrl = config?.notify_url || Deno.env.get("GATEWAY_NOTIFY_URL") || "https://api.univepay.com/callback";

    const orderId = `DEP${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    const payload: Record<string, string> = {
      Merchno: merchNo,
      Traceno: orderId,
      Amount: Number(amount).toFixed(2),
      Pname: customerName || "Customer",
      Pemail: customerEmail || "customer@example.com",
      Phone: customerPhone || "9876543210",
      CountryCode: "india",
      Currency: "INR",
      PayCode: "UPI",
      GoodsName: "Wallet TopUp",
      NotifyUrl: notifyUrl,
      CallbackUrl: `${notifyUrl}/redirect`,
      BankCode: "INR",
      AccNo: customerName || "Customer",
    };

    payload.Signature = await generateSignature(payload, secretKey);
    const formBody = new URLSearchParams(payload).toString();

    const gatewayRes = await fetch(`${baseUrl}/Payment/GlobalPay`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    const result = await gatewayRes.json().catch(() => ({ status: "99", msg: "Failed to parse gateway JSON" }));

    // Log request to gateway_logs
    await supabase.from("gateway_logs").insert({
      action: "CREATE_PAYIN",
      order_id: orderId,
      request_payload: payload,
      response_payload: result,
      status: result.status === "00" ? "SUCCESS" : "FAILED",
    });

    if (result.status === "00" && result.payUrl) {
      // Record transaction in deposit_transactions
      await supabase.from("deposit_transactions").insert({
        order_id: orderId,
        traceno: orderId,
        user_id: userId,
        amount: Number(amount),
        currency: "INR",
        pay_code: "UPI",
        pay_url: result.payUrl,
        raw_response: result,
        status: "PENDING",
      });

      return new Response(JSON.stringify({ success: true, payUrl: result.payUrl, orderId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ success: false, msg: result.msg || "Gateway Error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
