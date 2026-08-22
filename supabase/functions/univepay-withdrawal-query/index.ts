// Supabase Edge Function: univepay-withdrawal-query
// Queries UniVePay Settlement Query V2 and syncs withdrawal transaction state

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
    const { traceno } = body;

    if (!traceno) {
      return new Response(JSON.stringify({ success: false, error: 'Traceno is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: w, error: wErr } = await supabaseClient
      .from('withdrawal_transactions')
      .select('*')
      .eq('traceno', traceno)
      .single();

    if (wErr || !w) {
      return new Response(JSON.stringify({ success: false, error: 'Withdrawal not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const merchantNo = Deno.env.get('UNIVEPAY_MERCHANT_NO') || '100008';
    const secret = Deno.env.get('UNIVEPAY_SECRET') || '123456';
    const queryUrl = Deno.env.get('UNIVEPAY_QUERY_WITHDRAWAL_URL') || 'https://ydss.univepay.com/api/Pay/SettlementQueryV2';

    const queryParams: Record<string, any> = {
      Merchno: merchantNo,
      Traceno: traceno,
      Amount: String(w.amount),
    };
    queryParams.Signature = generateSignature(queryParams, secret);

    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryParams),
    });

    const resJson = await res.json().catch(() => null);

    if (resJson?.code === 200 && resJson?.data?.status === 'SUCCESS') {
      await supabaseClient.rpc('complete_univepay_withdrawal_success', {
        p_traceno: traceno,
        p_serial_no: resJson.data.serialNo || null,
        p_utr: resJson.data.extraData || null,
        p_payload: resJson,
      });
    } else if (resJson?.code === 200 && (resJson?.data?.status === 'FAIL' || resJson?.data?.status === 'Refuse')) {
      await supabaseClient.rpc('fail_univepay_withdrawal_refund', {
        p_traceno: traceno,
        p_reason: resJson?.data?.extraData || 'Gateway Settlement Refused',
        p_payload: resJson,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: resJson,
      localStatus: w.status,
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
