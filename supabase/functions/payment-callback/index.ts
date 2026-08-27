import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.168.0/node/crypto.ts";

function verifySignature(params: Record<string, string>, secretKey: string, receivedSign: string): boolean {
  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase() !== "signature" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort();
  const rawString = keys.map((k) => `${k}=${params[k]}`).join("&") + `&${secretKey}`;
  const hash = createHash("md5");
  hash.update(rawString);
  const calculatedSign = hash.digest("hex").toUpperCase();
  return calculatedSign === (receivedSign || "").toUpperCase();
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const bodyText = await req.text();
    let params: Record<string, string> = {};

    try {
      if (bodyText.startsWith("{")) {
        params = JSON.parse(bodyText);
      } else {
        params = Object.fromEntries(new URLSearchParams(bodyText));
      }
    } catch (_e) {
      params = {};
    }

    const orderId = params.Traceno || params.traceno || params.orderId || params.order_id || "";
    const status = (params.Status || params.status || "").toUpperCase();
    const serialNo = params.SerialNo || params.serialNo || params.serial_no || "";
    const signature = params.Signature || params.signature || "";

    const { data: config } = await supabase.from("gateway_settings").select("*").eq("is_active", true).maybeSingle();
    const secretKey = config?.secret_key || Deno.env.get("GATEWAY_SECRET_KEY") || "secret";

    try {
      await supabase.from("gateway_logs").insert({
        action: "WEBHOOK_CALLBACK",
        order_id: orderId,
        request_payload: { raw: bodyText, parsed: params },
        status: status || "RECEIVED",
      });
    } catch (_e) {}

    const isValid = verifySignature(params, secretKey, signature);
    if (!isValid) {
      console.error("Signature mismatch for order:", orderId);
    }

    if (status === "SUCCESS" || status === "00" || status === "PAID") {
      await supabase.rpc("process_deposit_success", {
        p_order_id: orderId,
        p_serial_no: serialNo,
        p_raw_callback: params,
      });
    }

    return new Response("SUCCESS", {
      headers: { "Content-Type": "text/plain" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Callback handler error:", err.message);
    return new Response("ERROR", { status: 500 });
  }
});
