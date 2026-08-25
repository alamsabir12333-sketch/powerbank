// Supabase Edge Function: univepay-balance-query
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

  const merchantNo = Deno.env.get("UNIVEPAY_MERCHANT_NO") || "";
  const secretKey = Deno.env.get("UNIVEPAY_SECRET") || "";
  const balanceUrl = Deno.env.get("UNIVEPAY_BALANCE_URL") || "https://ydpay.univepay.com/Payment/BalanceQuery";

  if (!merchantNo || !secretKey) {
    return new Response(
      JSON.stringify({
        merchantNo: merchantNo || "NOT_CONFIGURED",
        balance: 0,
        balanceCanUse: 0,
        retcode: "0000",
        retmsg: "Credentials not configured in environment",
        lastChecked: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Signature: Merchno + secretKey -> MD5 -> Uppercase
  const signString = `${merchantNo}${secretKey}`;
  const signature = md5(signString);

  try {
    const response = await fetch(balanceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        Merchno: merchantNo,
        Signature: signature,
      }).toString(),
    });

    const result = await response.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from("gateway_settings").upsert({
        id: "default",
        merchant_no: merchantNo,
        gateway_total_balance: Number(result.Balance || 0),
        gateway_available_balance: Number(result.Balance_CanUse || 0),
        gateway_connectivity: result.Retcode === "0000" ? "CONNECTED" : "DISCONNECTED",
        gateway_last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        merchantNo: result.Merchno || merchantNo,
        balance: Number(result.Balance || 0),
        balanceCanUse: Number(result.Balance_CanUse || 0),
        retcode: result.Retcode || "0000",
        retmsg: result.Retmsg || "Success",
        lastChecked: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message, merchantNo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
