// Supabase Edge Function: univepay-deposit-utr-supplement
// Admin tool to submit UTR supplement to UniVePay and reconcile deposit

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function md5Hex(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = crypto.subtle.digestSync('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function generateSignature(params: Record<string, any>, secret: string): string {
  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase() !== 'signature' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();
  const kvPairs = keys.map((k) => `${k}=${params[k]}`);
  return md5Hex(`${kvPairs.join('&')}&${secret}`);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { traceno, utr, amount } = body;

    if (!traceno || !utr) {
      return new Response(JSON.stringify({ success: false, error: 'Traceno and UTR are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const merchantNo = Deno.env.get('UNIVEPAY_MERCHANT_NO') || '100008';
    const secret = Deno.env.get('UNIVEPAY_SECRET') || '123456';
    const supplementUrl = Deno.env.get('UNIVEPAY_SUPPLEMENT_URL') || 'https://ydss.univepay.com/api/Collect/SupplyOrder';

    const params: Record<string, any> = {
      Merchno: merchantNo,
      Traceno: traceno,
      Amount: String(amount),
      UTR: String(utr),
    };
    params.Signature = generateSignature(params, secret);

    const formBody = new URLSearchParams(params).toString();
    const res = await fetch(supplementUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });

    const resJson = await res.json().catch(() => null);

    // If Code 00 and Status true -> complete local deposit
    if (resJson?.Code === '00' && resJson?.Status === true) {
      await supabaseClient.rpc('complete_univepay_deposit_success', {
        p_traceno: traceno,
        p_gateway_serial_no: null,
        p_gateway_order_id: null,
        p_payload: resJson,
        p_utr: utr,
      });
    }

    return new Response(JSON.stringify({
      success: resJson?.Code === '00',
      data: resJson,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
