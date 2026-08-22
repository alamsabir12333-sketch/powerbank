// Supabase Edge Function: create-univepay-deposit
// Handles initiating a new UniVePay Gateway deposit order server-side

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { amount, phone, email, name, notifyUrl, callbackUrl } = body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid deposit amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Generate unique Traceno
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    const traceno = `TR${timestampStr}${randDigits}`;

    // 2. Create pending deposit record in database
    const { data: orderRes, error: orderErr } = await supabaseClient.rpc('create_univepay_deposit_order', {
      p_user_id: user.id,
      p_amount: numAmount,
      p_traceno: traceno,
    });

    if (orderErr || !orderRes?.success) {
      return new Response(JSON.stringify({ success: false, error: orderErr?.message || orderRes?.error || 'Failed to create deposit order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Prepare parameters for UniVePay
    const merchantNo = Deno.env.get('UNIVEPAY_MERCHANT_NO') || '100008';
    const secret = Deno.env.get('UNIVEPAY_SECRET') || '123456';
    const gatewayUrl = Deno.env.get('UNIVEPAY_CREATE_DEPOSIT_URL') || 'https://ydss.univepay.com/api/Collect/OrderSubmitNew';
    const hostUrl = req.headers.get('origin') || Deno.env.get('APP_URL') || 'http://localhost:3000';
    const resolvedNotifyUrl = notifyUrl || `${Deno.env.get('SUPABASE_URL')}/functions/v1/univepay-deposit-notify`;

    const gatewayParams: Record<string, string> = {
      Merchno: merchantNo,
      Amount: String(numAmount),
      Traceno: traceno,
      Pname: name || user.email?.split('@')[0] || 'User',
      Pemail: email || user.email || 'user@pay.com',
      Phone: phone || user.phone || '9876543210',
      CountryCode: 'india',
      Currency: 'INR',
      PayCode: 'UPI',
      GoodsName: 'PowerBank Balance Recharge',
      NotifyUrl: resolvedNotifyUrl,
      CallbackUrl: callbackUrl || `${hostUrl}/me`,
    };

    const signature = generateSignature(gatewayParams, secret);
    gatewayParams.Signature = signature;

    // 4. Request UniVePay API
    const formBody = new URLSearchParams(gatewayParams).toString();
    const gatewayRes = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });

    const resText = await gatewayRes.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      resJson = { raw: resText };
    }

    // Log outbound gateway interaction
    await supabaseClient.from('gateway_logs').insert({
      endpoint: gatewayUrl,
      direction: 'OUTBOUND',
      traceno,
      user_transaction_id: orderRes.deposit_id,
      http_status: gatewayRes.status,
      response_code: resJson?.status || String(gatewayRes.status),
      payload: { params: gatewayParams, response: resJson },
    });

    if (resJson?.status === '00' && resJson?.payUrl) {
      await supabaseClient.from('deposit_transactions').update({
        gateway_order_id: resJson.payOrderid,
        pay_url: resJson.payUrl,
        gateway_status: resJson.status,
        gateway_response: resJson,
      }).eq('traceno', traceno);

      return new Response(JSON.stringify({
        success: true,
        traceno,
        payUrl: resJson.payUrl,
        payOrderid: resJson.payOrderid,
        amount: numAmount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: resJson?.msg || 'Gateway order creation failed',
      gatewayResponse: resJson,
      traceno,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
