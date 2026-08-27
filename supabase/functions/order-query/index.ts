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

    const { orderId, traceno } = await req.json();
    const queryOrderId = orderId || traceno;
    if (!queryOrderId) throw new Error("Order ID is required");

    // 1. Check local database record first
    const { data: dbDeposit } = await supabase
      .from("deposit_transactions")
      .select("*")
      .or(`order_id.eq.${queryOrderId},traceno.eq.${queryOrderId}`)
      .maybeSingle();

    if (dbDeposit && dbDeposit.status === "SUCCESS") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "SUCCESS",
          orderId: dbDeposit.order_id || dbDeposit.traceno,
          amount: dbDeposit.amount,
          creditedAt: dbDeposit.completed_at || dbDeposit.updated_at,
          data: dbDeposit,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Query Chinese Gateway API
    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();
    const merchNo = config?.merchant_no || Deno.env.get("GATEWAY_MERCH_NO") || Deno.env.get("UNIVEPAY_MERCHANT_NO") || "10001";
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || Deno.env.get("UNIVEPAY_SECRET") || "secret";
    const baseUrl = config?.base_url || Deno.env.get("GATEWAY_BASE_URL") || "https://api.univepay.com";

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
    await supabase.from("gateway_logs").insert({
      action: "ORDER_QUERY",
      order_id: queryOrderId,
      request_payload: payload,
      response_payload: result,
      status: result.status === "00" || result.status === "SUCCESS" ? "SUCCESS" : result.status,
    });

    // 3. If gateway returned SUCCESS, process atomic deposit completion
    if ((result.status === "00" || result.status === "SUCCESS" || result.payStatus === "1") && dbDeposit?.status !== "SUCCESS") {
      await supabase.rpc("process_deposit_success", {
        p_order_id: queryOrderId,
        p_serial_no: result.serialNo || result.orderid || "",
        p_raw_callback: result,
      });

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
