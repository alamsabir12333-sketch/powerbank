// Supabase Edge Function: create-univepay-withdrawal
// Server-side processing for UniVePay Auto Gateway Withdrawal

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
    const { amount, method, bankName, bankCode, accountName, accountNumber, upiId } = body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid withdrawal amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const withdrawMethod = method === 'UNIVEPAY_AUTO' ? 'UNIVEPAY_AUTO' : 'MANUAL';

    // 1. Generate unique Traceno
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    const traceno = `WD${timestampStr}${randDigits}`;

    // 2. Lock funds atomically and create withdrawal record
    const { data: lockRes, error: lockErr } = await supabaseClient.rpc('create_withdrawal_order', {
      p_user_id: user.id,
      p_amount: numAmount,
      p_method: withdrawMethod,
      p_traceno: traceno,
      p_bank_name: bankName || null,
      p_bank_code: bankCode || null,
      p_account_name: accountName || null,
      p_account_number: accountNumber || null,
      p_upi_id: upiId || null,
    });

    if (lockErr || !lockRes?.success) {
      return new Response(JSON.stringify({ success: false, error: lockErr?.message || lockRes?.error || 'Failed to lock withdrawal balance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If manual withdrawal, we are done
    if (withdrawMethod === 'MANUAL') {
      return new Response(JSON.stringify({
        success: true,
        method: 'MANUAL',
        traceno,
        amount: numAmount,
        netAmount: lockRes.net_amount,
        fee: lockRes.fee,
        message: 'Manual withdrawal submitted for admin review.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. For UNIVEPAY_AUTO: Call UniVePay cashout API
    const merchantNo = Deno.env.get('UNIVEPAY_MERCHANT_NO') || '100008';
    const secret = Deno.env.get('UNIVEPAY_SECRET') || '123456';
    const withdrawalUrl = Deno.env.get('UNIVEPAY_WITHDRAWAL_URL') || 'https://ydss.univepay.com/api/Pay/UnifiedOrder';
    const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/univepay-withdrawal-notify`;

    const payoutParams: Record<string, string> = {
      Merchno: merchantNo,
      Amount: String(numAmount),
      BankCode: bankCode || 'UPI',
      BankName: bankName || 'Bank',
      Account: accountName || 'User',
      CardNo: accountNumber || upiId || '',
      PaymentType: 'UPI',
      Traceno: traceno,
      NotifyUrl: notifyUrl,
      Currency: 'INR',
    };

    payoutParams.Signature = generateSignature(payoutParams, secret);

    const formBody = new URLSearchParams(payoutParams).toString();
    const gatewayRes = await fetch(withdrawalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });

    const resJson = await gatewayRes.json().catch(() => null);

    // Log gateway communication
    await supabaseClient.from('gateway_logs').insert({
      endpoint: withdrawalUrl,
      direction: 'OUTBOUND',
      traceno,
      user_transaction_id: lockRes.withdrawal_id,
      http_status: gatewayRes.status,
      response_code: resJson?.Status || String(gatewayRes.status),
      payload: { params: payoutParams, response: resJson },
    });

    const gatewayStatus = resJson?.Status;

    if (gatewayStatus === 'Accepted' || gatewayStatus === 'SUCCESS') {
      await supabaseClient.from('withdrawal_transactions').update({
        gateway_serial_no: resJson.SerialNo,
        gateway_status: gatewayStatus,
        status: gatewayStatus === 'SUCCESS' ? 'SUCCESS' : 'PROCESSING',
        gateway_response: resJson,
        updated_at: new Date().toISOString(),
      }).eq('traceno', traceno);

      if (gatewayStatus === 'SUCCESS') {
        await supabaseClient.rpc('complete_univepay_withdrawal_success', {
          p_traceno: traceno,
          p_serial_no: resJson.SerialNo,
          p_utr: null,
          p_payload: resJson,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        method: 'UNIVEPAY_AUTO',
        traceno,
        amount: numAmount,
        gatewayStatus,
        serialNo: resJson.SerialNo,
        message: 'Withdrawal submitted to UniVePay gateway successfully.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If gateway rejected / failed immediately:
    await supabaseClient.rpc('fail_univepay_withdrawal_refund', {
      p_traceno: traceno,
      p_reason: resJson?.Retmsg || resJson?.Status || 'Gateway cashout rejected',
      p_payload: resJson,
    });

    return new Response(JSON.stringify({
      success: false,
      error: resJson?.Retmsg || `Gateway error: ${gatewayStatus}`,
      gatewayResponse: resJson,
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
