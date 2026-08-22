// Supabase Edge Function: univepay-deposit-query
// Queries UniVePay Collect Order Query V2 and reconciles local state

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

    // Get local record
    const { data: dep, error: depErr } = await supabaseClient
      .from('deposit_transactions')
      .select('*')
      .eq('traceno', traceno)
      .single();

    if (depErr || !dep) {
      return new Response(JSON.stringify({ success: false, error: 'Deposit record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const merchantNo = Deno.env.get('UNIVEPAY_MERCHANT_NO') || '100008';
    const secret = Deno.env.get('UNIVEPAY_SECRET') || '123456';
    const queryUrl = Deno.env.get('UNIVEPAY_QUERY_DEPOSIT_URL') || 'https://ydss.univepay.com/api/Collect/OrderQueryV2';

    const queryParams: Record<string, any> = {
      Merchno: merchantNo,
      Traceno: traceno,
      Amount: String(dep.amount),
    };
    queryParams.Signature = generateSignature(queryParams, secret);

    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryParams),
    });

    const resJson = await res.json().catch(() => null);

    // If query indicates success, reconcile local state atomically
    if (resJson?.code === 200 && resJson?.data?.status === 'SUCCESS') {
      await supabaseClient.rpc('complete_univepay_deposit_success', {
        p_traceno: traceno,
        p_gateway_serial_no: resJson.data.serialNo || null,
        p_gateway_order_id: null,
        p_payload: resJson,
        p_utr: resJson.data.extraData || null,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: resJson,
      localStatus: dep.status,
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
