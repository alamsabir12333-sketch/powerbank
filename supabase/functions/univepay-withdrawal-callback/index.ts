// Supabase Edge Function: univepay-withdrawal-callback
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

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
  let body: any = {};
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    for (const [key, val] of params.entries()) {
      body[key] = val;
    }
  } else {
    body = await req.json().catch(() => ({}));
  }

  const transDate = body.TransDate || body.transDate || "";
  const merchno = body.Merchno || body.merchno || "";
  const amount = body.Amount || body.amount || "";
  const account = body.Account || body.account || "";
  const cardNo = body.CardNo || body.cardNo || "";
  const traceno = body.Traceno || body.traceno || "";
  const serialNo = body.SerialNo || body.serialNo || "";
  const status = (body.Status || body.status || "").toUpperCase();
  const signature = body.Signature || body.signature || "";
  const utr = req.headers.get("app-utr") || body.utr || body.UTR || "";

  console.log(`[UNIVEPAY][WITHDRAWAL_CALLBACK] Traceno: ${traceno}, Status: ${status}, Amount: ${amount}`);

  const merchantNo = Deno.env.get("UNIVEPAY_MERCHANT_NO") || "";
  const secretKey = Deno.env.get("UNIVEPAY_SECRET") || "";

  if (!secretKey) {
    console.error("[UNIVEPAY][WITHDRAWAL_CALLBACK] Fatal: UNIVEPAY_SECRET missing.");
    return new Response("SERVER_CONFIGURATION_ERROR", { status: 500 });
  }

  if (merchantNo && merchno !== merchantNo) {
    console.error(`[UNIVEPAY][WITHDRAWAL_CALLBACK] Merchant mismatch! Expected: ${merchantNo}, Received: ${merchno}`);
    return new Response("MERCHANT_ERROR", { status: 400 });
  }

  // Exact documented signature: Account + Amount + CardNo + Merchno + SerialNo + Status + Traceno + TransDate + secretKey
  const signString = `${account}${amount}${cardNo}${merchno}${serialNo}${status}${traceno}${transDate}${secretKey}`;
  const calculated = md5(signString);

  if (calculated.toUpperCase() !== signature.toUpperCase()) {
    console.error(`[UNIVEPAY][WITHDRAWAL_CALLBACK] Signature error! Calc: ${calculated}, Recv: ${signature}`);
    return new Response("SIGNATURE_ERROR", { status: 400 });
  }

  if (traceno) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (status === "SUCCESS") {
      await supabase.rpc("complete_univepay_withdrawal_success", {
        p_traceno: traceno,
        p_serial_no: serialNo,
        p_utr: utr || serialNo,
        p_payload: body,
      });
      console.log(`[UNIVEPAY][WITHDRAWAL_CALLBACK] Withdrawal completed for Traceno: ${traceno}`);
    } else if (status === "FAIL" || status === "REFUSE") {
      await supabase.rpc("fail_univepay_withdrawal_refund", {
        p_traceno: traceno,
        p_reason: body.Remark || "Gateway Rejected Cashout",
        p_payload: body,
      });
      console.log(`[UNIVEPAY][WITHDRAWAL_CALLBACK] Withdrawal refunded for Traceno: ${traceno}`);
    }
  }

  return new Response("SUCCESS", {
    headers: { "Content-Type": "text/plain" },
    status: 200,
  });
});
