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

    const body = await req.json();
    const { amount, customerName, customerEmail, customerPhone, userId } = body;
    if (!amount || Number(amount) < 100) throw new Error("Minimum recharge is ₹100");

    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();

    const merchNo = config?.merchant_no || Deno.env.get("GATEWAY_MERCH_NO") || Deno.env.get("UNIVEPAY_MERCHANT_NO") || "C26854";
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || Deno.env.get("UNIVEPAY_SECRET") || "secret";
    const baseUrl = config?.base_url || Deno.env.get("GATEWAY_BASE_URL") || "https://ydpay.univepay.com";
    const notifyUrl = config?.notify_url && config.notify_url.trim() !== ""
      ? config.notify_url
      : (Deno.env.get("GATEWAY_NOTIFY_URL") || "https://gainpower-top-1.com/api/univepay/payment-callback");

    const requestedOrderId = body.orderId || body.traceno;
    const orderId = requestedOrderId || `DEP${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

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
        endpoint: "/Payment/GlobalPay",
        direction: "OUTBOUND",
        action: "CREATE_PAYIN",
        order_id: orderId,
        traceno: orderId,
        request_payload: payload,
        response_payload: result,
        status: result.status === "00" ? "SUCCESS" : "FAILED",
      });
    } catch (_e) {}

    if (result.status === "00" && result.payUrl) {
      try {
        if (requestedOrderId) {
          const { data: existing } = await supabase
            .from("deposit_transactions")
            .select("id")
            .or(`traceno.eq.${requestedOrderId},order_id.eq.${requestedOrderId},merchant_order_id.eq.${requestedOrderId}`)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("deposit_transactions")
              .update({
                pay_url: result.payUrl,
                raw_response: result,
                status: "PENDING",
                channel: "UNIVEPAY",
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("deposit_transactions").insert({
              order_id: orderId,
              traceno: orderId,
              merchant_order_id: orderId,
              user_id: userId && userId !== "00000000-0000-0000-0000-000000000000" ? userId : null,
              amount: Number(amount),
              currency: "INR",
              pay_code: "UPI",
              pay_url: result.payUrl,
              raw_response: result,
              status: "PENDING",
              channel: "UNIVEPAY",
            });
          }
        } else {
          await supabase.from("deposit_transactions").insert({
            order_id: orderId,
            traceno: orderId,
            merchant_order_id: orderId,
            user_id: userId && userId !== "00000000-0000-0000-0000-000000000000" ? userId : null,
            amount: Number(amount),
            currency: "INR",
            pay_code: "UPI",
            pay_url: result.payUrl,
            raw_response: result,
            status: "PENDING",
            channel: "UNIVEPAY",
          });
        }
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
