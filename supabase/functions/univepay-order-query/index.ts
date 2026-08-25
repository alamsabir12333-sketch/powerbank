// Supabase Edge Function: univepay-order-query
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
    const { traceno } = await req.json().catch(() => ({}));
    if (!traceno) {
      return new Response(
        JSON.stringify({ success: false, error: "Traceno is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const merchantNo = Deno.env.get("UNIVEPAY_MERCHANT_NO") || "";
    const secretKey = Deno.env.get("UNIVEPAY_SECRET") || "";
    const queryUrl = Deno.env.get("UNIVEPAY_QUERY_DEPOSIT_URL") || "https://ydpay.univepay.com/Payment/OrderQuery";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check local order status
    const { data: dbOrder } = await supabase
      .from("deposit_transactions")
      .select("*")
      .eq("traceno", traceno)
      .maybeSingle();

    if (dbOrder && dbOrder.status === "SUCCESS") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "SUCCESS",
          amount: dbOrder.amount,
          traceno: dbOrder.traceno,
          alreadySettled: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!merchantNo || !secretKey) {
      return new Response(
        JSON.stringify({
          success: true,
          status: dbOrder ? dbOrder.status : "PENDING",
          data: dbOrder,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Exact Query Signature: Merchno + Traceno + secretKey
    const signString = `${merchantNo}${traceno}${secretKey}`;
    const signature = md5(signString);

    console.log(`[UNIVEPAY][QUERY] Querying gateway for Traceno: ${traceno}`);

    const response = await fetch(queryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        Merchno: merchantNo,
        Traceno: traceno,
        Signature: signature,
      }).toString(),
    });

    const result = await response.json().catch(() => null);
    console.log(`[UNIVEPAY][QUERY] Gateway Inquiry Response for Traceno ${traceno}:`, result);

    // 3. If Univepay inquiry confirms SUCCESS, settle through the SAME atomic RPC
    if (result?.data?.status === "SUCCESS" || result?.status === "SUCCESS") {
      const gatewayData = result.data || result;
      await supabase.rpc("complete_univepay_deposit_success", {
        p_traceno: traceno,
        p_gateway_serial_no: gatewayData.serialNo || null,
        p_gateway_order_id: gatewayData.orderId || null,
        p_payload: result,
        p_utr: null,
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: "SUCCESS",
          data: gatewayData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: result?.data?.status || (dbOrder ? dbOrder.status : "PENDING"),
        data: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[UNIVEPAY][QUERY] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
