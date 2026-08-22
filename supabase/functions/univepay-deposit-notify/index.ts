// Supabase Edge Function: univepay-deposit-notify
// Webhook callback endpoint for UniVePay deposit confirmation

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

function md5Hex(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = crypto.subtle.digestSync('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function verifySignature(params: Record<string, any>, secret: string): boolean {
  const providedSignature = params.Signature || params.signature;
  if (!providedSignature) return false;

  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase() !== 'signature' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();
  const kvPairs = keys.map((k) => `${k}=${params[k]}`);
  const expected = md5Hex(`${kvPairs.join('&')}&${secret}`);
  return expected.toUpperCase() === String(providedSignature).trim().toUpperCase();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const secret = Deno.env.get('UNIVEPAY_SECRET') || '123456';

    // Parse application/x-www-form-urlencoded or JSON
    let params: Record<string, string> = {};
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const bodyText = await req.text();
      const searchParams = new URLSearchParams(bodyText);
      searchParams.forEach((val, key) => {
        params[key] = val;
      });
    } else {
      params = await req.json().catch(() => ({}));
    }

    const { Traceno, Status, Amount, SerialNo, Merchno, PayCode, TransDate, Signature, UTR } = params;

    // Log inbound callback
    await supabaseClient.from('gateway_logs').insert({
      endpoint: 'univepay-deposit-notify',
      direction: 'INBOUND',
      traceno: Traceno,
      payload: params,
      gateway_status: Status,
    });

    if (!Traceno) {
      return new Response('MISSING_TRACENO', { status: 400 });
    }

    // Verify signature
    const isValid = verifySignature(params, secret);
    if (!isValid) {
      console.error('Signature verification failed for deposit callback:', params);
      return new Response('INVALID_SIGNATURE', { status: 400 });
    }

    // Handle SUCCESS status
    if (Status === 'SUCCESS') {
      const { data: creditRes, error: creditErr } = await supabaseClient.rpc('complete_univepay_deposit_success', {
        p_traceno: Traceno,
        p_gateway_serial_no: SerialNo || null,
        p_gateway_order_id: null,
        p_payload: params,
        p_utr: UTR || null,
      });

      if (creditErr || !creditRes?.success) {
        console.error('Failed to credit deposit:', creditErr || creditRes?.error);
        return new Response('PROCESSING_ERROR', { status: 500 });
      }

      // Return plain text SUCCESS to gateway
      return new Response('SUCCESS', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // If failed/other status
    await supabaseClient.from('deposit_transactions').update({
      status: 'FAILED',
      gateway_status: Status,
      callback_payload: params,
      updated_at: new Date().toISOString(),
    }).eq('traceno', Traceno);

    return new Response('SUCCESS', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  } catch (err: any) {
    console.error('Error in univepay-deposit-notify:', err);
    return new Response('ERROR', { status: 500 });
  }
});
