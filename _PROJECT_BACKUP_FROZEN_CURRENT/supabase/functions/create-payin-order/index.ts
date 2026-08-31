import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSignature(params: Record<string, string>, secretKey: string): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "Signature" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort();
  const rawString = keys.map((k) => `${k}=${params[k]}`).join("&") + `&${secretKey}`;
  const hash = createHash("md5");
  hash.update(rawString);
  return hash.digest("hex").toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { amount, customerName, customerEmail, customerPhone, userId } = await req.json();
    if (!amount || Number(amount) < 100) throw new Error("Minimum recharge is ₹100");

    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();

    const merchNo = config?.merchant_no || Deno.env.get("GATEWAY_MERCH_NO") || "10001";
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || "secret";
    const baseUrl = config?.base_url || Deno.env.get("GATEWAY_BASE_URL") || "https://ydpay.univepay.com";
    const notifyUrl = config?.notify_url || Deno.env.get("GATEWAY_NOTIFY_URL") || "https://evhwqlnymvoduclmzshz.supabase.co/functions/v1/payment-callback";

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
      CallbackUrl: "https://gainpower-top-1.com/wallet?status=success",
      BankCode: "INR",
      AccNo: customerName || "Customer",
    };

    payload.Signature = generateSignature(payload, secretKey);
    const formBody = new URLSearchParams(payload).toString();

    const gatewayRes = await fetch(`${baseUrl}/Payment/GlobalPay`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    const result = await gatewayRes.json();

    try {
      await supabase.from("gateway_logs").insert({
        action: "CREATE_PAYIN",
        order_id: orderId,
        request_payload: payload,
        response_payload: result,
        status: result.status === "00" ? "SUCCESS" : "FAILED",
      });
    } catch (_e) {}

    if (result.status === "00" && result.payUrl) {
      try {
        await supabase.from("deposit_transactions").insert({
          order_id: orderId,
          user_id: userId && userId !== "00000000-0000-0000-0000-000000000000" ? userId : null,
          amount: Number(amount),
          currency: "INR",
          pay_code: "UPI",
          pay_url: result.payUrl,
          raw_response: result,
          status: "PENDING",
        });
      } catch (_e) {}

      return new Response(JSON.stringify({ success: true, payUrl: result.payUrl, orderId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ success: false, msg: result.msg || "Gateway Error", raw: result }), {
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
