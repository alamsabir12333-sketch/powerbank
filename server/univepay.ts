import crypto from 'crypto';

// Server-side environment variables or defaults
const UNIVEPAY_MERCHANT_NO = process.env.UNIVEPAY_MERCHANT_NO || '100008';
const UNIVEPAY_SECRET = process.env.UNIVEPAY_SECRET || '123456';
const UNIVEPAY_BASE_URL = process.env.UNIVEPAY_BASE_URL || 'https://ydss.univepay.com';

export interface UniVePayConfig {
  merchantNo: string;
  secret: string;
  baseUrl: string;
  createDepositUrl: string;
  queryDepositUrl: string;
  supplementUrl: string;
  createWithdrawalUrl: string;
  queryWithdrawalUrl: string;
  balanceUrl: string;
}

export const getUniVePayConfig = (): UniVePayConfig => {
  const base = process.env.UNIVEPAY_BASE_URL || UNIVEPAY_BASE_URL;
  return {
    merchantNo: process.env.UNIVEPAY_MERCHANT_NO || UNIVEPAY_MERCHANT_NO,
    secret: process.env.UNIVEPAY_SECRET || UNIVEPAY_SECRET,
    baseUrl: base,
    createDepositUrl: process.env.UNIVEPAY_CREATE_DEPOSIT_URL || `${base}/api/Collect/OrderSubmitNew`,
    queryDepositUrl: process.env.UNIVEPAY_QUERY_DEPOSIT_URL || `${base}/api/Collect/OrderQueryV2`,
    supplementUrl: process.env.UNIVEPAY_SUPPLEMENT_URL || `${base}/api/Collect/SupplyOrder`,
    createWithdrawalUrl: process.env.UNIVEPAY_WITHDRAWAL_URL || `${base}/api/Pay/UnifiedOrder`,
    queryWithdrawalUrl: process.env.UNIVEPAY_QUERY_WITHDRAWAL_URL || `${base}/api/Pay/SettlementQueryV2`,
    balanceUrl: process.env.UNIVEPAY_BALANCE_URL || `${base}/api/Pay/BalanceQuery`,
  };
};

/**
 * Generates MD5 signature for UniVePay according to official documentation:
 * 1. Filter out empty, null, undefined values and 'Signature'/'signature'
 * 2. Sort keys alphabetically (ASCII dictionary order)
 * 3. Form key=value&key2=value2 string
 * 4. Append '&{SECRET}'
 * 5. Compute MD5 hash and convert to UPPERCASE
 */
export function generateUniVePaySignature(params: Record<string, any>, secret: string): string {
  const keys = Object.keys(params)
    .filter((k) => {
      if (k.toLowerCase() === 'signature') return false;
      const val = params[k];
      return val !== undefined && val !== null && val !== '';
    })
    .sort();

  const kvPairs = keys.map((k) => `${k}=${params[k]}`);
  const stringToSign = `${kvPairs.join('&')}&${secret}`;
  
  return crypto.createHash('md5').update(stringToSign, 'utf8').digest('hex').toUpperCase();
}

/**
 * Validates incoming UniVePay webhook callback signature
 */
export function verifyUniVePaySignature(params: Record<string, any>, secret: string, providedSignature?: string): boolean {
  const signature = providedSignature || params.Signature || params.signature;
  if (!signature) return false;

  const expectedSignature = generateUniVePaySignature(params, secret);
  return expectedSignature.toUpperCase() === String(signature).trim().toUpperCase();
}

/**
 * Sanitizes log payloads to avoid leaking secrets or sensitive card/account numbers
 */
export function maskSensitiveData(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  
  if (clone.secret) clone.secret = '***MASKED***';
  if (clone.Secret) clone.Secret = '***MASKED***';
  if (clone.CardNo && typeof clone.CardNo === 'string' && clone.CardNo.length > 4) {
    clone.CardNo = `***${clone.CardNo.slice(-4)}`;
  }
  if (clone.accountNumber && typeof clone.accountNumber === 'string' && clone.accountNumber.length > 4) {
    clone.accountNumber = `***${clone.accountNumber.slice(-4)}`;
  }
  return clone;
}

/**
 * Helper to generate a unique Traceno (18-20 digits numeric or unique timestamp string)
 */
export function generateTraceno(prefix: string = 'TR'): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${yyyy}${mm}${dd}${hh}${min}${ss}${ms}${rand}`;
}
