import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifySignature(params: Record<string, string>, secretKey: string, receivedSign: string): Promise<boolean> {
  const keys = Object.keys(params)
    .filter((k) => k !== "Signature" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort();
  const rawString = keys.map((k) => `${k}=${params[k]}`).join("&") + `&${secretKey}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(rawString));
  const calculatedSign = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return calculatedSign === receivedSign;
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY")!
    );

    const bodyText = await req.text();
    const params = Object.fromEntries(new URLSearchParams(bodyText));

    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || Deno.env.get("UNIVEPAY_SECRET") || "secret";

    // Log webhook payload
    await supabase.from("gateway_logs").insert({
      action: "WEBHOOK_CALLBACK",
      order_id: params.Traceno || params.order_id,
      request_payload: params,
      status: params.Status,
    });

    const isValid = await verifySignature(params, secretKey, params.Signature);
    if (!isValid) return new Response("SIGNATURE_FAILED", { status: 400 });

    if (params.Status === "SUCCESS") {
      await supabase.rpc("process_deposit_success", {
        p_order_id: params.Traceno || params.order_id,
        p_serial_no: params.SerialNo || params.serial_no || "",
        p_raw_callback: params,
      });
    }

    return new Response("SUCCESS", {
      headers: { "Content-Type": "text/plain" },
      status: 200,
    });
  } catch (_err) {
    return new Response("ERROR", { status: 500 });
  }
});
