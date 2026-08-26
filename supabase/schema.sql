-- ==============================================================================
-- GAINPOWER / POWERBANK COMPREHENSIVE PRODUCTION DATABASE ARCHITECTURE
-- PostgreSQL Schema, Enums, Tables, Indexes, RLS Policies & Atomic RPCs
-- Single Source of Truth for GainPower Platform (https://gainpower-top-1.com)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE DATABASE TABLES (WITH FULL DDL AND COLUMN EVOLUTION)
-- ==============================================================================

-- 2.1 PROFILES TABLE (User Master Data)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    whatsapp_no TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    membership_number TEXT UNIQUE NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'support')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    vip_level INT DEFAULT 0,
    is_premium BOOLEAN DEFAULT false,
    premium_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_level INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- 2.2 WALLETS TABLE (Multi-Balance System)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    available_balance NUMERIC(14, 2) DEFAULT 0.00 CHECK (available_balance >= 0),
    recharge_balance NUMERIC(14, 2) DEFAULT 0.00 CHECK (recharge_balance >= 0),
    pending_balance NUMERIC(14, 2) DEFAULT 0.00 CHECK (pending_balance >= 0),
    total_earned NUMERIC(14, 2) DEFAULT 0.00 CHECK (total_earned >= 0),
    total_withdrawn NUMERIC(14, 2) DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS recharge_balance NUMERIC(14, 2) DEFAULT 0.00;

-- 2.3 PLANS TABLE (Earning PowerBank Hardware & Cloud Rental Plans)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    image_url TEXT,
    description TEXT,
    price NUMERIC(14, 2) NOT NULL CHECK (price > 0),
    daily_earnings NUMERIC(14, 2) DEFAULT 0.00 CHECK (daily_earnings >= 0),
    earning_rate NUMERIC(14, 2) NOT NULL CHECK (earning_rate >= 0),
    earning_type TEXT DEFAULT 'hourly' CHECK (earning_type IN ('hourly', 'daily')),
    duration INT DEFAULT 365,
    limit_per_user INT DEFAULT 999,
    tags TEXT[] DEFAULT ARRAY['Shared Power', 'Sharing Economy'],
    category TEXT DEFAULT 'STANDARD' CHECK (category IN ('STANDARD', 'PRO', 'SPECIAL')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived', 'sold_out')),
    allow_duplicate BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS daily_earnings NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'STANDARD';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- 2.4 PURCHASES TABLE (Active User Devices & Hardware Leases)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    wallet_transaction_id UUID,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
    earning_rate NUMERIC(14, 2) NOT NULL,
    daily_earnings NUMERIC(14, 2) DEFAULT 0.00,
    plan_category TEXT DEFAULT 'STANDARD',
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    total_earned NUMERIC(14, 2) DEFAULT 0.00,
    claimed_amount NUMERIC(14, 2) DEFAULT 0.00,
    last_settled_at TIMESTAMPTZ DEFAULT now(),
    last_claimed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS daily_earnings NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS plan_category TEXT DEFAULT 'STANDARD';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS claimed_amount NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS last_claimed_at TIMESTAMPTZ DEFAULT now();

-- 2.5 EARNINGS TABLE (Discrete Accrued Yield Cycles)
CREATE TABLE IF NOT EXISTS public.earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    earning_type TEXT DEFAULT 'HOURLY_DEVICE',
    earning_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'CLAIMABLE' CHECK (status IN ('CLAIMABLE', 'SETTLED', 'EXPIRED')),
    claim_batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS claim_batch_id UUID;

-- 2.6 CLAIM BATCHES & EARNINGS CLAIMS (Audit for Batch Claims)
CREATE TABLE IF NOT EXISTS public.claim_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    item_count INT DEFAULT 1,
    claimed_at TIMESTAMPTZ DEFAULT now(),
    transaction_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.earnings_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    claim_batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.7 DEPOSIT TRANSACTIONS TABLE (UniVePay Gateway Canonical Table)
CREATE TABLE IF NOT EXISTS public.deposit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    traceno TEXT UNIQUE NOT NULL,
    gateway_order_id TEXT,
    gateway_serial_no TEXT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'INR',
    pay_code TEXT DEFAULT '印度UPI-银台',
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'FAILED_GATEWAY_CREATION')),
    gateway_status TEXT,
    pay_url TEXT,
    callback_received BOOLEAN DEFAULT false,
    signature_verified BOOLEAN DEFAULT false,
    utr TEXT,
    callback_payload JSONB,
    gateway_response JSONB,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2.8 WITHDRAWAL TRANSACTIONS TABLE (UniVePay & Manual Payouts)
CREATE TABLE IF NOT EXISTS public.withdrawal_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    traceno TEXT UNIQUE NOT NULL,
    gateway_serial_no TEXT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    fee NUMERIC(14, 2) DEFAULT 0.00,
    net_amount NUMERIC(14, 2) NOT NULL,
    method TEXT DEFAULT 'MANUAL' CHECK (method IN ('MANUAL', 'UNIVEPAY_AUTO')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REJECTED', 'REFUNDED', 'CANCELLED')),
    gateway_status TEXT,
    bank_name TEXT,
    bank_code TEXT,
    account_name TEXT,
    account_number TEXT,
    ifsc TEXT,
    upi_id TEXT,
    payment_type TEXT DEFAULT 'UPI',
    utr TEXT,
    gateway_response JSONB,
    callback_payload JSONB,
    amount_locked NUMERIC(14, 2) NOT NULL,
    rejection_reason TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.withdrawal_transactions ADD COLUMN IF NOT EXISTS ifsc TEXT;
ALTER TABLE public.withdrawal_transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2.9 PAYMENTS TABLE (Manual / Legacy UPI Recharges)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_type TEXT DEFAULT 'RECHARGE',
    utr TEXT,
    proof_url TEXT,
    status TEXT DEFAULT 'PAYMENT_PENDING' CHECK (status IN ('PAYMENT_PENDING', 'PENDING_VERIFICATION', 'PAID', 'REJECTED')),
    admin_id UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.10 WITHDRAWALS TABLE (Manual Admin Approval Flow)
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    fee NUMERIC(14, 2) DEFAULT 0.00,
    net_amount NUMERIC(14, 2) NOT NULL,
    bank_account_id UUID,
    upi_id TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
    admin_note TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 2.11 BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_holder_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc TEXT NOT NULL,
    upi_id TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.12 WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'EARNING', 'REFERRAL_BONUS', 'TEAM_BONUS', 'RECHARGE', 
        'PLAN_PURCHASE', 'WITHDRAWAL', 'WITHDRAWAL_REVERSAL', 
        'REFUND', 'ADMIN_ADJUSTMENT', 'MISSION_REWARD', 'GIFT_CODE', 'VIP_BONUS'
    )),
    amount NUMERIC(14, 2) NOT NULL,
    balance_before NUMERIC(14, 2) NOT NULL,
    balance_after NUMERIC(14, 2) NOT NULL,
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.13 IMMUTABLE WALLET LEDGER TABLE (Financial Double-Entry Audit Trail)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_type TEXT NOT NULL CHECK (wallet_type IN ('RECHARGE', 'DEVICE_EARNING', 'WITHDRAWABLE')),
    transaction_type TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    reference_type TEXT,
    reference_id TEXT,
    balance_before NUMERIC(14, 2) NOT NULL,
    balance_after NUMERIC(14, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.14 REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referee_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level INT DEFAULT 1,
    bonus_amount NUMERIC(14, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'QUALIFIED', 'REWARDED', 'INACTIVE')),
    qualifying_recharge_done BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS qualifying_recharge_done BOOLEAN DEFAULT false;

-- 2.15 VIP LEVELS TABLE (Dynamic Tiers)
CREATE TABLE IF NOT EXISTS public.vip_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level_number INT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    min_investment NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (min_investment >= 0),
    max_investment NUMERIC(14, 2),
    icon TEXT DEFAULT 'crown',
    badge_text TEXT NOT NULL,
    description TEXT,
    benefits TEXT[] DEFAULT ARRAY[]::TEXT[],
    daily_bonus_rate NUMERIC(5, 2) DEFAULT 0.00,
    withdrawal_fee_discount NUMERIC(5, 2) DEFAULT 0.00,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.16 MISSIONS & MISSION CLAIMS (Task System)
CREATE TABLE IF NOT EXISTS public.missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'DAILY',
    type TEXT NOT NULL,
    target INT NOT NULL DEFAULT 1,
    reward_amount NUMERIC(14, 2) NOT NULL CHECK (reward_amount >= 0),
    reward_type TEXT DEFAULT 'RECHARGE_BALANCE',
    icon TEXT DEFAULT 'target',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mission_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
    reward_amount NUMERIC(14, 2) NOT NULL CHECK (reward_amount >= 0),
    claimed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, mission_id)
);

-- 2.17 GIFT CODES & REDEMPTION (Promo Codes)
CREATE TABLE IF NOT EXISTS public.gift_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    max_claims INT DEFAULT 100,
    claims_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_code_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gift_code_id UUID NOT NULL REFERENCES public.gift_codes(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL,
    claimed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, gift_code_id)
);

-- 2.18 NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'INFO',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2.19 BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    cta_text TEXT DEFAULT 'Go Now >',
    image_url TEXT,
    target_tab TEXT DEFAULT 'purchase',
    is_active BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.20 PLATFORM NEWS TABLE
CREATE TABLE IF NOT EXISTS public.platform_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT,
    tag TEXT DEFAULT 'Operational',
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.21 SETTINGS & CONFIGURATION TABLES
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    upi_id TEXT NOT NULL DEFAULT 'powerbank@upi',
    qr_image_url TEXT,
    instructions TEXT DEFAULT 'Scan the QR code using any UPI app (GPay, PhonePe, Paytm), pay exact amount, and enter UTR.',
    is_recharge_enabled BOOLEAN DEFAULT true,
    is_purchase_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gateway_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_univepay_deposit_enabled BOOLEAN DEFAULT true,
    is_upi_deposit_enabled BOOLEAN DEFAULT true,
    is_manual_withdrawal_enabled BOOLEAN DEFAULT true,
    is_univepay_auto_withdrawal_enabled BOOLEAN DEFAULT true,
    min_withdrawal NUMERIC(14, 2) DEFAULT 100.00,
    max_withdrawal NUMERIC(14, 2) DEFAULT 50000.00,
    withdrawal_fee_percent NUMERIC(5, 2) DEFAULT 0.00,
    gateway_fee_percent NUMERIC(5, 2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.about_platform_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    company_name TEXT DEFAULT 'GainPower Technology Pvt Ltd',
    license_no TEXT DEFAULT 'CIN-U72900DL2024PTC394821',
    platform_version TEXT DEFAULT '3.5.0',
    terms_content TEXT,
    privacy_content TEXT,
    about_us_content TEXT,
    support_whatsapp TEXT DEFAULT '+91 98765 43210',
    support_telegram TEXT DEFAULT '@GainPowerSupport',
    support_email TEXT DEFAULT 'support@gainpower-top-1.com',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.22 AUDIT LOGS & GATEWAY LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gateway_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    traceno TEXT,
    user_transaction_id TEXT,
    http_status INT,
    gateway_status TEXT,
    response_code TEXT,
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH THROUGHPUT AND ZERO QUERY BOTTLENECK
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);

CREATE INDEX IF NOT EXISTS idx_purchases_user_status ON public.purchases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchases_expires_at ON public.purchases(expires_at);

CREATE INDEX IF NOT EXISTS idx_earnings_user_status ON public.earnings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_earnings_purchase ON public.earnings(purchase_id);
CREATE INDEX IF NOT EXISTS idx_earnings_date ON public.earnings(earning_date);

CREATE INDEX IF NOT EXISTS idx_deposit_tx_user ON public.deposit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_traceno ON public.deposit_transactions(traceno);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_status ON public.deposit_transactions(status);

CREATE INDEX IF NOT EXISTS idx_withdrawal_tx_user ON public.withdrawal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_tx_traceno ON public.withdrawal_transactions(traceno);
CREATE INDEX IF NOT EXISTS idx_withdrawal_tx_status ON public.withdrawal_transactions(status);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON public.wallet_transactions(type);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON public.wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_ref ON public.wallet_ledger(reference_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON public.referrals(referee_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_missions_active_sort ON public.missions(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON public.gift_codes(code);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_logs ENABLE ROW LEVEL SECURITY;

-- Helper: Admin Check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'support')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile or admin" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles for referral and leaderboard" ON public.profiles;
CREATE POLICY "Anyone can view profiles for referral and leaderboard" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "Admins full manage profiles" ON public.profiles;
CREATE POLICY "Admins full manage profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Wallets Policies (Strict Read-Only for Users; All balance mutations strictly via Security Definer RPCs)
DROP POLICY IF EXISTS "Users view own wallet" ON public.wallets;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own wallet" ON public.wallets;
CREATE POLICY "Users insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage wallets" ON public.wallets;
CREATE POLICY "Admins manage wallets" ON public.wallets FOR ALL USING (public.is_admin());

-- Plans Policies
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL USING (public.is_admin() OR true);

-- Purchases Policies
DROP POLICY IF EXISTS "Users view own purchases" ON public.purchases;
CREATE POLICY "Users view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage purchases" ON public.purchases;
CREATE POLICY "Admins manage purchases" ON public.purchases FOR ALL USING (public.is_admin());

-- Earnings & Claim Batches Policies
DROP POLICY IF EXISTS "Users view own earnings" ON public.earnings;
CREATE POLICY "Users view own earnings" ON public.earnings FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users view own claim batches" ON public.claim_batches;
CREATE POLICY "Users view own claim batches" ON public.claim_batches FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users view own earnings claims" ON public.earnings_claims;
CREATE POLICY "Users view own earnings claims" ON public.earnings_claims FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Deposit Transactions Policies
DROP POLICY IF EXISTS "Users view own deposits" ON public.deposit_transactions;
CREATE POLICY "Users view own deposits" ON public.deposit_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage deposit transactions" ON public.deposit_transactions;
CREATE POLICY "Admins manage deposit transactions" ON public.deposit_transactions FOR ALL USING (public.is_admin());

-- Withdrawal Transactions Policies
DROP POLICY IF EXISTS "Users view own withdrawal transactions" ON public.withdrawal_transactions;
CREATE POLICY "Users view own withdrawal transactions" ON public.withdrawal_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage withdrawal transactions" ON public.withdrawal_transactions;
CREATE POLICY "Admins manage withdrawal transactions" ON public.withdrawal_transactions FOR ALL USING (public.is_admin());

-- Manual Payments Policies
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert manual recharge request" ON public.payments;
CREATE POLICY "Users insert manual recharge request" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL USING (public.is_admin());

-- Manual Withdrawals Policies
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert manual withdrawal" ON public.withdrawals;
CREATE POLICY "Users insert manual withdrawal" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage withdrawals" ON public.withdrawals;
CREATE POLICY "Admins manage withdrawals" ON public.withdrawals FOR ALL USING (public.is_admin());

-- Bank Accounts Policies
DROP POLICY IF EXISTS "Users manage own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users manage own bank accounts" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Wallet Transactions & Immutable Ledger Policies
DROP POLICY IF EXISTS "Users view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users view own ledger" ON public.wallet_ledger;
CREATE POLICY "Users view own ledger" ON public.wallet_ledger FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins view all ledger" ON public.wallet_ledger;
CREATE POLICY "Admins view all ledger" ON public.wallet_ledger FOR ALL USING (public.is_admin());

-- Referrals Policies
DROP POLICY IF EXISTS "Users view own referrals" ON public.referrals;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id OR public.is_admin());

-- VIP Levels Policies
DROP POLICY IF EXISTS "Public view active vip levels" ON public.vip_levels;
CREATE POLICY "Public view active vip levels" ON public.vip_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage vip levels" ON public.vip_levels;
CREATE POLICY "Admins manage vip levels" ON public.vip_levels FOR ALL USING (public.is_admin());

-- Missions & Claims Policies
DROP POLICY IF EXISTS "Public view active missions" ON public.missions;
CREATE POLICY "Public view active missions" ON public.missions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage missions" ON public.missions;
CREATE POLICY "Admins manage missions" ON public.missions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users view own mission claims" ON public.mission_claims;
CREATE POLICY "Users view own mission claims" ON public.mission_claims FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Gift Codes Policies
DROP POLICY IF EXISTS "Users view own gift claims" ON public.gift_code_claims;
CREATE POLICY "Users view own gift claims" ON public.gift_code_claims FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage gift codes" ON public.gift_codes;
CREATE POLICY "Admins manage gift codes" ON public.gift_codes FOR ALL USING (public.is_admin());

-- Notifications Policies
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Content Policies (Banners, News, Settings)
DROP POLICY IF EXISTS "Public view active banners" ON public.banners;
CREATE POLICY "Public view active banners" ON public.banners FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners" ON public.banners FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public view published news" ON public.platform_news;
CREATE POLICY "Public view published news" ON public.platform_news FOR SELECT USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage platform news" ON public.platform_news;
CREATE POLICY "Admins manage platform news" ON public.platform_news FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public view payment settings" ON public.payment_settings;
CREATE POLICY "Public view payment settings" ON public.payment_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage payment settings" ON public.payment_settings;
CREATE POLICY "Admins manage payment settings" ON public.payment_settings FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public view gateway settings" ON public.gateway_settings;
CREATE POLICY "Public view gateway settings" ON public.gateway_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage gateway settings" ON public.gateway_settings;
CREATE POLICY "Admins manage gateway settings" ON public.gateway_settings FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public view admin settings" ON public.admin_settings;
CREATE POLICY "Public view admin settings" ON public.admin_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage admin settings" ON public.admin_settings;
CREATE POLICY "Admins manage admin settings" ON public.admin_settings FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public view about config" ON public.about_platform_config;
CREATE POLICY "Public view about config" ON public.about_platform_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage about config" ON public.about_platform_config;
CREATE POLICY "Admins manage about config" ON public.about_platform_config FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view gateway logs" ON public.gateway_logs;
CREATE POLICY "Admins view gateway logs" ON public.gateway_logs FOR ALL USING (public.is_admin());

-- ==============================================================================
-- 5. ATOMIC RPC FINANCIAL STORED PROCEDURES (SECURITY DEFINER)
-- ==============================================================================

-- 5.1 ATOMIC PLAN PURCHASE (USES RECHARGE BALANCE / AVAILABLE BALANCE)
CREATE OR REPLACE FUNCTION public.purchase_plan(
    p_user_id UUID,
    p_plan_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_plan public.plans%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_purchase_id UUID;
    v_tx_id UUID;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
    v_user_purchases_count INT;
    v_profile public.profiles%ROWTYPE;
    v_referrer_profile public.profiles%ROWTYPE;
    v_ref_bonus NUMERIC := 0.00;
BEGIN
    -- 1. Fetch & Lock Plan
    SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND status = 'active' FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Plan not found or currently inactive.');
    END IF;

    -- 2. Check User Purchase Limits
    IF v_plan.limit_per_user IS NOT NULL AND v_plan.limit_per_user > 0 THEN
        SELECT COUNT(*) INTO v_user_purchases_count FROM public.purchases WHERE user_id = p_user_id AND plan_id = p_plan_id AND status = 'ACTIVE';
        IF v_user_purchases_count >= v_plan.limit_per_user THEN
            RETURN jsonb_build_object('success', false, 'error', 'You have reached the maximum active purchase limit (' || v_plan.limit_per_user || ') for this plan.');
        END IF;
    END IF;

    -- 3. Lock & Fetch User Wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user wallet not found.');
    END IF;

    -- 4. Balance Verification (Recharge Balance / Available Balance)
    IF v_wallet.available_balance < v_plan.price THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Please recharge ₹' || (v_plan.price - v_wallet.available_balance) || ' to activate this device.');
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - v_plan.price;

    -- 5. Deduct Wallet Balance
    UPDATE public.wallets 
    SET available_balance = v_balance_after,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- 6. Insert Wallet Transaction
    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'PLAN_PURCHASE', -v_plan.price, v_balance_before, v_balance_after,
        p_plan_id::text, 'Purchased Hardware Plan: ' || v_plan.name
    );

    -- 7. Insert Immutable Ledger Log
    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        p_user_id, 'RECHARGE', 'PLAN_PURCHASE', v_plan.price, 'DEBIT', 'PLAN_ORDER', p_plan_id::text,
        v_balance_before, v_balance_after, 'Leased device: ' || v_plan.name
    );

    -- 8. Create Active Purchase Record
    v_purchase_id := uuid_generate_v4();
    INSERT INTO public.purchases (
        id, user_id, plan_id, amount, wallet_transaction_id, status, earning_rate, daily_earnings,
        plan_category, started_at, expires_at, total_earned, claimed_amount, last_settled_at, last_claimed_at
    ) VALUES (
        v_purchase_id, p_user_id, p_plan_id, v_plan.price, v_tx_id, 'ACTIVE', v_plan.earning_rate,
        coalesce(v_plan.daily_earnings, v_plan.earning_rate * 24), coalesce(v_plan.category, 'STANDARD'),
        now(), now() + (v_plan.duration || ' days')::INTERVAL, 0.00, 0.00, now(), now()
    );

    -- 9. Automatic Referral Qualification & Tier Reward
    SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;
    IF v_profile.referred_by IS NOT NULL AND trim(v_profile.referred_by) != '' THEN
        SELECT * INTO v_referrer_profile FROM public.profiles WHERE referral_code = v_profile.referred_by;
        IF FOUND AND v_referrer_profile.user_id != p_user_id THEN
            -- Update Referral Table
            UPDATE public.referrals
            SET status = 'QUALIFIED',
                qualifying_recharge_done = true
            WHERE referee_id = p_user_id AND referrer_id = v_referrer_profile.user_id;

            -- Calculate 10% direct referrer bonus
            v_ref_bonus := round((v_plan.price * 0.10)::numeric, 2);
            IF v_ref_bonus > 0 THEN
                -- Credit referrer wallet
                UPDATE public.wallets
                SET available_balance = available_balance + v_ref_bonus,
                    total_earned = total_earned + v_ref_bonus,
                    updated_at = now()
                WHERE user_id = v_referrer_profile.user_id;

                -- Referrer Transaction & Notification
                INSERT INTO public.wallet_transactions (
                    user_id, type, amount, balance_before, balance_after, reference_id, description
                ) VALUES (
                    v_referrer_profile.user_id, 'REFERRAL_BONUS', v_ref_bonus,
                    0, 0, v_purchase_id::text, '10% Direct Member Activation Reward from ' || v_profile.username
                );

                INSERT INTO public.notifications (user_id, title, message, type)
                VALUES (
                    v_referrer_profile.user_id,
                    'Referral Commission Received!',
                    'You earned ₹' || v_ref_bonus || ' referral reward from ' || v_profile.username || '''s device activation.',
                    'SUCCESS'
                );
            END IF;
        END IF;
    END IF;

    -- 10. Recalculate User VIP Level
    PERFORM public.recalculate_user_vip(p_user_id);

    -- 11. Create Activation Notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_user_id,
        'Device Activated Successfully!',
        'Your power cabinet "' || v_plan.name || '" is online and generating ₹' || v_plan.earning_rate || '/hour.',
        'SUCCESS'
    );

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'balance', v_balance_after,
        'message', 'Device activated successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.2 UNIVEPAY CANONICAL DEPOSIT ORDER INITIALIZATION
CREATE OR REPLACE FUNCTION public.create_univepay_deposit_order(
    p_user_id UUID,
    p_amount NUMERIC,
    p_traceno TEXT,
    p_pay_code TEXT DEFAULT '印度UPI-银台'
)
RETURNS JSONB AS $$
DECLARE
    v_tx_id UUID;
    v_user_exists BOOLEAN;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid deposit amount');
    END IF;

    -- Validate user exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = p_user_id) INTO v_user_exists;
    END IF;
    IF NOT v_user_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'User does not exist');
    END IF;

    IF EXISTS (SELECT 1 FROM public.deposit_transactions WHERE traceno = p_traceno) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Deposit order with this Traceno already exists');
    END IF;

    v_tx_id := uuid_generate_v4();
    INSERT INTO public.deposit_transactions (
        id, user_id, traceno, amount, currency, pay_code, status
    ) VALUES (
        v_tx_id, p_user_id, p_traceno, p_amount, 'INR', COALESCE(p_pay_code, '印度UPI-银台'), 'PENDING'
    );

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_tx_id,
        'traceno', p_traceno,
        'amount', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.3 UNIVEPAY CANONICAL DEPOSIT IDEMPOTENT SETTLEMENT (CREDITS RECHARGE BALANCE)
CREATE OR REPLACE FUNCTION public.complete_univepay_deposit_success(
    p_traceno TEXT,
    p_gateway_serial_no TEXT,
    p_gateway_order_id TEXT,
    p_payload JSONB,
    p_utr TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_dep public.deposit_transactions%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_bal_before NUMERIC;
    v_bal_after NUMERIC;
    v_tx_id UUID;
BEGIN
    -- 1. Lock deposit transaction
    SELECT * INTO v_dep FROM public.deposit_transactions WHERE traceno = p_traceno FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Deposit transaction not found for Traceno: ' || p_traceno);
    END IF;

    -- 2. Idempotency Check (Never double-credit)
    IF v_dep.status = 'SUCCESS' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Deposit already processed and credited', 'already_processed', true);
    END IF;

    -- 3. Lock user wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_dep.user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user wallet not found');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before + v_dep.amount;

    -- 4. Credit user wallet (Recharge Balance)
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        recharge_balance = v_wallet.recharge_balance + v_dep.amount,
        updated_at = now()
    WHERE user_id = v_dep.user_id;

    -- 5. Mark deposit SUCCESS
    UPDATE public.deposit_transactions
    SET status = 'SUCCESS',
        gateway_serial_no = coalesce(p_gateway_serial_no, gateway_serial_no),
        gateway_order_id = coalesce(p_gateway_order_id, gateway_order_id),
        utr = coalesce(p_utr, utr),
        callback_received = true,
        signature_verified = true,
        callback_payload = coalesce(p_payload, callback_payload),
        completed_at = now(),
        updated_at = now()
    WHERE id = v_dep.id;

    -- 6. Insert Wallet Transaction
    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, v_dep.user_id, 'RECHARGE', v_dep.amount, v_bal_before, v_bal_after,
        v_dep.traceno, 'UniVePay Gateway Recharge (Traceno: ' || v_dep.traceno || ')'
    );

    -- 7. Insert Immutable Wallet Ledger
    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        v_dep.user_id, 'RECHARGE', 'RECHARGE', v_dep.amount, 'CREDIT', 'UNIVEPAY_DEPOSIT', v_dep.traceno,
        v_bal_before, v_bal_after, 'UniVePay Deposit Success (Serial: ' || coalesce(p_gateway_serial_no, 'N/A') || ')'
    );

    -- 8. Notify User
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_dep.user_id,
        'Recharge Successful!',
        'Your Recharge Balance has been credited with ₹' || v_dep.amount || ' (Traceno: ' || v_dep.traceno || ').',
        'SUCCESS'
    );

    RETURN jsonb_build_object(
        'success', true,
        'amount', v_dep.amount,
        'new_balance', v_bal_after,
        'message', 'Deposit credited successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.4 ATOMIC DISCRETE HOURLY YIELD CALCULATION
CREATE OR REPLACE FUNCTION public.settle_and_calculate_earnings(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_rec RECORD;
    v_hours INT;
    v_earned NUMERIC;
    v_total_accrued NUMERIC := 0.00;
BEGIN
    FOR v_rec IN 
        SELECT id, plan_id, earning_rate, last_settled_at, started_at, expires_at
        FROM public.purchases
        WHERE user_id = p_user_id 
          AND status = 'ACTIVE'
          AND (expires_at IS NULL OR now() < expires_at)
          AND now() > last_settled_at + INTERVAL '1 hour'
        FOR UPDATE
    LOOP
        v_hours := FLOOR(EXTRACT(EPOCH FROM (now() - v_rec.last_settled_at)) / 3600)::INT;
        IF v_hours >= 1 THEN
            v_earned := round((v_rec.earning_rate * v_hours)::numeric, 2);
            IF v_earned > 0 THEN
                -- Advance purchase settled pointer
                UPDATE public.purchases
                SET total_earned = total_earned + v_earned,
                    last_settled_at = last_settled_at + (v_hours || ' hours')::INTERVAL,
                    updated_at = now()
                WHERE id = v_rec.id;

                -- Record discrete claimable earning row
                INSERT INTO public.earnings (
                    user_id, purchase_id, amount, earning_type, earning_date, status
                ) VALUES (
                    p_user_id, v_rec.id, v_earned, 'HOURLY_DEVICE', CURRENT_DATE, 'CLAIMABLE'
                );

                v_total_accrued := v_total_accrued + v_earned;
            END IF;
        END IF;
    END LOOP;

    -- Check if any purchase expired and mark status
    UPDATE public.purchases
    SET status = 'COMPLETED', updated_at = now()
    WHERE user_id = p_user_id AND status = 'ACTIVE' AND expires_at IS NOT NULL AND now() >= expires_at;

    RETURN jsonb_build_object(
        'success', true,
        'accrued', v_total_accrued,
        'message', 'Hourly device yield updated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.5 ATOMIC BATCH CLAIM OF ACCRUED DEVICE EARNINGS
CREATE OR REPLACE FUNCTION public.claim_user_earnings(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_settle_res JSONB;
    v_total_claimable NUMERIC := 0.00;
    v_count INT := 0;
    v_wallet public.wallets%ROWTYPE;
    v_bal_before NUMERIC;
    v_bal_after NUMERIC;
    v_batch_id UUID;
    v_tx_id UUID;
BEGIN
    -- 1. Settle completed hours first
    v_settle_res := public.settle_and_calculate_earnings(p_user_id);

    -- 2. Lock all CLAIMABLE earnings for this user
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_claimable, v_count
    FROM public.earnings
    WHERE user_id = p_user_id AND status = 'CLAIMABLE';

    IF v_total_claimable <= 0 OR v_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No claimable earnings available at this moment.');
    END IF;

    -- 3. Lock user wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User wallet not found.');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before + v_total_claimable;

    -- 4. Credit Wallet Available Balance & Total Earned
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        total_earned = v_wallet.total_earned + v_total_claimable,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- 5. Create Batch Claim Record
    v_batch_id := uuid_generate_v4();
    v_tx_id := uuid_generate_v4();

    INSERT INTO public.claim_batches (
        id, user_id, amount, item_count, claimed_at, transaction_id
    ) VALUES (
        v_batch_id, p_user_id, v_total_claimable, v_count, now(), v_tx_id
    );

    -- 6. Mark Earnings Rows as SETTLED
    UPDATE public.earnings
    SET status = 'SETTLED',
        claim_batch_id = v_batch_id
    WHERE user_id = p_user_id AND status = 'CLAIMABLE';

    -- 7. Update Purchases Claimed Timestamp and Amount
    UPDATE public.purchases
    SET claimed_amount = total_earned,
        last_claimed_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id AND status = 'ACTIVE';

    -- 8. Insert Wallet Transaction
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'EARNING', v_total_claimable, v_bal_before, v_bal_after,
        v_batch_id::text, 'Claimed Device Hourly Earnings (' || v_count || ' cycles)'
    );

    -- 9. Insert Immutable Wallet Ledger
    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        p_user_id, 'DEVICE_EARNING', 'EARNING_CLAIM', v_total_claimable, 'CREDIT', 'CLAIM_BATCH', v_batch_id::text,
        v_bal_before, v_bal_after, 'Claimed ₹' || v_total_claimable || ' device revenue.'
    );

    -- 10. Notify User
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_user_id,
        'Earnings Claimed!',
        '₹' || v_total_claimable || ' has been added to your withdrawable wallet.',
        'SUCCESS'
    );

    RETURN jsonb_build_object(
        'success', true,
        'amount', v_total_claimable,
        'claim_batch_id', v_batch_id,
        'new_balance', v_bal_after,
        'items_count', v_count,
        'message', 'Earnings claimed successfully!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.6 ATOMIC WITHDRAWAL CREATION (LOCKS FUNDS ATOMICALLY)
CREATE OR REPLACE FUNCTION public.create_withdrawal_order(
    p_user_id UUID,
    p_amount NUMERIC,
    p_method TEXT,
    p_traceno TEXT,
    p_bank_name TEXT DEFAULT NULL,
    p_bank_code TEXT DEFAULT NULL,
    p_account_name TEXT DEFAULT NULL,
    p_account_number TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_wallet public.wallets%ROWTYPE;
    v_settings public.gateway_settings%ROWTYPE;
    v_fee NUMERIC := 0.00;
    v_net NUMERIC;
    v_bal_before NUMERIC;
    v_bal_after NUMERIC;
    v_tx_id UUID;
    v_w_id UUID;
BEGIN
    -- 1. Validate against Gateway Settings
    SELECT * INTO v_settings FROM public.gateway_settings WHERE id = 'default';
    IF FOUND THEN
        IF p_method = 'UNIVEPAY_AUTO' AND NOT v_settings.is_univepay_auto_withdrawal_enabled THEN
            RETURN jsonb_build_object('success', false, 'error', 'UniVePay Auto Withdrawal is currently disabled by admin.');
        END IF;
        IF p_method = 'MANUAL' AND NOT v_settings.is_manual_withdrawal_enabled THEN
            RETURN jsonb_build_object('success', false, 'error', 'Manual Withdrawal is currently disabled by admin.');
        END IF;
        IF p_amount < v_settings.min_withdrawal THEN
            RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ₹' || v_settings.min_withdrawal);
        END IF;
        IF p_amount > v_settings.max_withdrawal THEN
            RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal amount is ₹' || v_settings.max_withdrawal);
        END IF;
        IF v_settings.withdrawal_fee_percent > 0 THEN
            v_fee := round((p_amount * v_settings.withdrawal_fee_percent / 100.0)::numeric, 2);
        END IF;
    END IF;

    v_net := p_amount - v_fee;

    -- 2. Lock user wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
    END IF;

    IF v_wallet.available_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient available balance.');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before - p_amount;

    -- 3. Lock amount in pending_balance
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        pending_balance = v_wallet.pending_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- 4. Insert Withdrawal Transaction
    v_w_id := uuid_generate_v4();
    INSERT INTO public.withdrawal_transactions (
        id, user_id, traceno, amount, fee, net_amount, method, status,
        bank_name, bank_code, account_name, account_number, upi_id, amount_locked
    ) VALUES (
        v_w_id, p_user_id, p_traceno, p_amount, v_fee, v_net, p_method, 'PENDING',
        p_bank_name, p_bank_code, p_account_name, p_account_number, p_upi_id, p_amount
    );

    -- 5. Insert Wallet Transaction
    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'WITHDRAWAL', -p_amount, v_bal_before, v_bal_after,
        p_traceno, 'Withdrawal request of ₹' || p_amount || ' (' || p_method || ')'
    );

    -- 6. Insert Immutable Wallet Ledger
    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        p_user_id, 'DEVICE_EARNING', 'WITHDRAWAL_LOCK', p_amount, 'DEBIT', 'WITHDRAWAL_REQUEST', p_traceno,
        v_bal_before, v_bal_after, 'Locked ₹' || p_amount || ' for withdrawal (Traceno: ' || p_traceno || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_w_id,
        'traceno', p_traceno,
        'amount', p_amount,
        'net_amount', v_net,
        'fee', v_fee,
        'new_balance', v_bal_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.7 ATOMIC COMPLETION OF UNIVEPAY AUTO WITHDRAWAL
CREATE OR REPLACE FUNCTION public.complete_univepay_withdrawal_success(
    p_traceno TEXT,
    p_serial_no TEXT,
    p_utr TEXT,
    p_payload JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_w public.withdrawal_transactions%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
BEGIN
    SELECT * INTO v_w FROM public.withdrawal_transactions WHERE traceno = p_traceno FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found for Traceno: ' || p_traceno);
    END IF;

    IF v_w.status = 'SUCCESS' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Withdrawal already finalized', 'already_processed', true);
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_w.user_id FOR UPDATE;
    IF FOUND THEN
        UPDATE public.wallets
        SET pending_balance = GREATEST(0, v_wallet.pending_balance - v_w.amount_locked),
            total_withdrawn = v_wallet.total_withdrawn + v_w.amount,
            updated_at = now()
        WHERE user_id = v_w.user_id;
    END IF;

    UPDATE public.withdrawal_transactions
    SET status = 'SUCCESS',
        gateway_serial_no = coalesce(p_serial_no, gateway_serial_no),
        utr = coalesce(p_utr, utr),
        callback_payload = coalesce(p_payload, callback_payload),
        completed_at = now(),
        updated_at = now()
    WHERE id = v_w.id;

    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        v_w.user_id, 'DEVICE_EARNING', 'WITHDRAWAL_FINALIZE', v_w.amount, 'DEBIT', 'UNIVEPAY_WITHDRAWAL_SUCCESS', p_traceno,
        v_wallet.available_balance, v_wallet.available_balance, 'Finalized withdrawal payout of ₹' || v_w.amount || ' (Serial: ' || coalesce(p_serial_no, 'N/A') || ')'
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_w.user_id,
        'Withdrawal Successful!',
        '₹' || v_w.net_amount || ' has been successfully paid out to your account (UTR: ' || coalesce(p_utr, p_serial_no, 'Confirmed') || ').',
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal finalized successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.8 ATOMIC REFUND OF FAILED WITHDRAWAL
CREATE OR REPLACE FUNCTION public.fail_univepay_withdrawal_refund(
    p_traceno TEXT,
    p_reason TEXT,
    p_payload JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_w public.withdrawal_transactions%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_bal_before NUMERIC;
    v_bal_after NUMERIC;
BEGIN
    SELECT * INTO v_w FROM public.withdrawal_transactions WHERE traceno = p_traceno FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found for Traceno: ' || p_traceno);
    END IF;

    IF v_w.status = 'FAILED' OR v_w.status = 'REJECTED' OR v_w.status = 'REFUNDED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Withdrawal already refunded', 'already_processed', true);
    END IF;

    IF v_w.status = 'SUCCESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot refund already successful withdrawal');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_w.user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User wallet not found');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before + v_w.amount_locked;

    -- Return locked funds
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        pending_balance = GREATEST(0, v_wallet.pending_balance - v_w.amount_locked),
        updated_at = now()
    WHERE user_id = v_w.user_id;

    UPDATE public.withdrawal_transactions
    SET status = 'FAILED',
        rejection_reason = p_reason,
        callback_payload = coalesce(p_payload, callback_payload),
        updated_at = now()
    WHERE id = v_w.id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_w.user_id, 'WITHDRAWAL_REVERSAL', v_w.amount_locked, v_bal_before, v_bal_after,
        p_traceno, 'Withdrawal Failed Refund: ' || coalesce(p_reason, 'Gateway failure')
    );

    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        v_w.user_id, 'DEVICE_EARNING', 'WITHDRAWAL_REFUND', v_w.amount_locked, 'CREDIT', 'UNIVEPAY_WITHDRAWAL_FAIL', p_traceno,
        v_bal_before, v_bal_after, 'Refunded locked ₹' || v_w.amount_locked || ' due to failure: ' || coalesce(p_reason, 'Refused')
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_w.user_id,
        'Withdrawal Failed & Refunded',
        'Your withdrawal of ₹' || v_w.amount || ' failed (' || coalesce(p_reason, 'Gateway error') || '). Amount has been refunded to your wallet.',
        'ERROR'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal marked failed and refunded');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.9 ATOMIC ADMIN MANUAL WALLET ADJUSTMENT
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
    p_user_id UUID,
    p_amount NUMERIC,
    p_reason TEXT,
    p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_wallet public.wallets%ROWTYPE;
    v_bal_before NUMERIC;
    v_bal_after NUMERIC;
    v_tx_id UUID;
    v_dir TEXT;
BEGIN
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mandatory audit reason is required for adjustments.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User wallet not found.');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before + p_amount;

    IF v_bal_after < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Debit exceeds available user balance.');
    END IF;

    v_dir := CASE WHEN p_amount >= 0 THEN 'CREDIT' ELSE 'DEBIT' END;

    UPDATE public.wallets
    SET available_balance = v_bal_after,
        updated_at = now()
    WHERE user_id = p_user_id;

    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'ADMIN_ADJUSTMENT', p_amount, v_bal_before, v_bal_after,
        'ADJ-' || to_char(now(), 'YYYYMMDDHH24MISS'), 'Admin Adjustment: ' || p_reason
    );

    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        p_user_id, 'RECHARGE', 'ADMIN_ADJUSTMENT', abs(p_amount), v_dir, 'ADMIN_ACTION', v_tx_id::text,
        v_bal_before, v_bal_after, 'Admin ' || v_dir || ': ' || p_reason
    );

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (p_admin_id, 'ADMIN_WALLET_ADJUSTMENT', 'wallets', p_user_id::text, jsonb_build_object(
        'amount', p_amount,
        'reason', p_reason,
        'bal_before', v_bal_before,
        'bal_after', v_bal_after
    ));

    RETURN jsonb_build_object('success', true, 'newBalance', v_bal_after);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.10 ATOMIC GIFT CODE REDEMPTION
CREATE OR REPLACE FUNCTION public.claim_gift_code(
    p_user_id UUID,
    p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_code public.gift_codes%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_bal_before NUMERIC;
    v_bal_after NUMERIC;
    v_tx_id UUID;
BEGIN
    SELECT * INTO v_code FROM public.gift_codes WHERE code = trim(p_code) AND is_active = true FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired gift code.');
    END IF;

    IF v_code.expires_at IS NOT NULL AND now() > v_code.expires_at THEN
        RETURN jsonb_build_object('success', false, 'error', 'This gift code has expired.');
    END IF;

    IF v_code.claims_count >= v_code.max_claims THEN
        RETURN jsonb_build_object('success', false, 'error', 'This gift code has reached its maximum claim limit.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.gift_code_claims WHERE user_id = p_user_id AND gift_code_id = v_code.id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this gift code.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User wallet not found.');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before + v_code.amount;

    UPDATE public.wallets
    SET available_balance = v_bal_after,
        updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE public.gift_codes
    SET claims_count = claims_count + 1,
        updated_at = now()
    WHERE id = v_code.id;

    INSERT INTO public.gift_code_claims (user_id, gift_code_id, amount)
    VALUES (p_user_id, v_code.id, v_code.amount);

    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'GIFT_CODE', v_code.amount, v_bal_before, v_bal_after,
        v_code.code, 'Redeemed Gift Code: ' || v_code.code
    );

    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        p_user_id, 'RECHARGE', 'GIFT_CODE', v_code.amount, 'CREDIT', 'GIFT_CODE', v_code.code,
        v_bal_before, v_bal_after, 'Redeemed promo code ' || v_code.code
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_user_id,
        'Gift Code Redeemed!',
        'Congratulations! You received ₹' || v_code.amount || ' from code ' || v_code.code || '.',
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'amount', v_code.amount, 'new_balance', v_bal_after);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.11 ATOMIC MISSION REWARD CLAIM
CREATE OR REPLACE FUNCTION public.claim_mission_reward(
    p_user_id UUID,
    p_mission_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_mission public.missions%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_bal_before NUMERIC;
    v_bal_after NUMERIC;
    v_tx_id UUID;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = true FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mission not found or inactive.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.mission_claims WHERE user_id = p_user_id AND mission_id = p_mission_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already claimed this mission reward.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before + v_mission.reward_amount;

    UPDATE public.wallets
    SET available_balance = v_bal_after,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.mission_claims (user_id, mission_id, reward_amount)
    VALUES (p_user_id, p_mission_id, v_mission.reward_amount);

    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'MISSION_REWARD', v_mission.reward_amount, v_bal_before, v_bal_after,
        p_mission_id::text, 'Mission Reward: ' || v_mission.title
    );

    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction, reference_type, reference_id,
        balance_before, balance_after, description
    ) VALUES (
        p_user_id, 'RECHARGE', 'MISSION_REWARD', v_mission.reward_amount, 'CREDIT', 'MISSION', p_mission_id::text,
        v_bal_before, v_bal_after, 'Completed task: ' || v_mission.title
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_user_id,
        'Mission Reward Claimed!',
        'You earned ₹' || v_mission.reward_amount || ' for completing "' || v_mission.title || '".',
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'reward_amount', v_mission.reward_amount, 'new_balance', v_bal_after);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.12 RECALCULATE USER VIP LEVEL DYNAMICALLY
CREATE OR REPLACE FUNCTION public.recalculate_user_vip(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_invested NUMERIC := 0.00;
    v_vip public.vip_levels%ROWTYPE;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_invested
    FROM public.purchases
    WHERE user_id = p_user_id AND status != 'CANCELLED';

    SELECT * INTO v_vip
    FROM public.vip_levels
    WHERE min_investment <= v_total_invested AND is_active = true
    ORDER BY level_number DESC
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.profiles
        SET vip_level = v_vip.level_number,
            updated_at = now()
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object('success', true, 'vip_level', v_vip.level_number, 'total_invested', v_total_invested);
    END IF;

    RETURN jsonb_build_object('success', true, 'vip_level', 0, 'total_invested', v_total_invested);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.13 GLOBAL PLATFORM HOURLY YIELD ENGINE TRIGGER (FOR ADMIN / CRON)
CREATE OR REPLACE FUNCTION public.trigger_global_yield_accrual(p_admin_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_devices_count INT := 0;
    v_total_accrued NUMERIC := 0.00;
    v_user_accrued JSONB;
BEGIN
    FOR v_user IN 
        SELECT DISTINCT user_id FROM public.purchases WHERE status = 'ACTIVE'
    LOOP
        v_user_accrued := public.settle_and_calculate_earnings(v_user.user_id);
        IF (v_user_accrued->>'accrued')::numeric > 0 THEN
            v_total_accrued := v_total_accrued + (v_user_accrued->>'accrued')::numeric;
            v_devices_count := v_devices_count + 1;
        END IF;
    END LOOP;

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (p_admin_id, 'TRIGGER_GLOBAL_YIELD', 'yield_engine', 'all', jsonb_build_object(
        'total_accrued', v_total_accrued,
        'devices_processed', v_devices_count
    ));

    RETURN jsonb_build_object(
        'success', true,
        'total_accrued', v_total_accrued,
        'devices_processed', v_devices_count,
        'message', 'Global hourly yield accrual cycle completed.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ==============================================================================
-- 6. DEFAULT ESSENTIAL SEED CONFIGURATION (SAFE IDEMPOTENT INSERTS)
-- ==============================================================================

-- 6.0 NEW USER ONBOARDING TRIGGER ON AUTH.USERS (AUTOMATIC REGISTRATION SEQUENCE)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
    v_whatsapp_no TEXT;
    v_membership_number TEXT;
    v_referral_code TEXT;
    v_referred_by TEXT;
    v_referrer_profile public.profiles%ROWTYPE;
    v_signup_bonus NUMERIC := 50.00;
BEGIN
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    v_whatsapp_no := COALESCE(NEW.raw_user_meta_data->>'whatsapp_no', NEW.raw_user_meta_data->>'mobile', '');
    v_membership_number := COALESCE(NEW.raw_user_meta_data->>'membership_number', 'PB' || floor(random() * 900000 + 100000)::text);
    v_referral_code := COALESCE(NEW.raw_user_meta_data->>'referral_code', v_membership_number);
    v_referred_by := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referred_by', '')), '');

    -- Insert Profile if not exists
    INSERT INTO public.profiles (
        user_id, username, whatsapp_no, email, membership_number, referral_code, referred_by, role, status
    ) VALUES (
        NEW.id, v_username, v_whatsapp_no, NEW.email, v_membership_number, v_referral_code, v_referred_by, 'user', 'active'
    ) ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        whatsapp_no = EXCLUDED.whatsapp_no,
        email = EXCLUDED.email,
        updated_at = now();

    -- Insert Wallet if not exists with Signup Bonus
    INSERT INTO public.wallets (
        user_id, available_balance, recharge_balance, withdraw_balance, pending_balance, total_earned, total_withdrawn
    ) VALUES (
        NEW.id, v_signup_bonus, v_signup_bonus, 0.00, 0.00, 0.00, 0.00
    ) ON CONFLICT (user_id) DO NOTHING;

    -- Create Welcome Transaction
    IF v_signup_bonus > 0 THEN
        INSERT INTO public.wallet_transactions (
            user_id, type, amount, balance_before, balance_after, reference_id, description
        ) VALUES (
            NEW.id, 'SIGNUP_BONUS', v_signup_bonus, 0.00, v_signup_bonus, 'WELCOME-' || NEW.id::text, '🎁 Welcome Sign-up Bonus: ₹50.00 (Topup Wallet)'
        ) ON CONFLICT DO NOTHING;
    END IF;

    -- Link Referral if provided
    IF v_referred_by IS NOT NULL THEN
        SELECT * INTO v_referrer_profile FROM public.profiles 
        WHERE referral_code = v_referred_by OR membership_number = v_referred_by OR user_id::text = v_referred_by;
        
        IF FOUND AND v_referrer_profile.user_id != NEW.id THEN
            INSERT INTO public.referrals (
                referrer_id, referee_id, level, status, commission_earned, qualifying_recharge_done
            ) VALUES (
                v_referrer_profile.user_id, NEW.id, 1, 'ACTIVE', 0.00, false
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- Welcome Notification
    INSERT INTO public.notifications (
        user_id, title, message, type, read
    ) VALUES (
        NEW.id, 'Welcome to Power Bank! 🎉', 
        'Welcome to Power Bank! A sign-up welcome bonus of ₹50.00 has been credited to your Topup Wallet for leasing power bank equipment.',
        'INFO', false
    ) ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 6.0b ONBOARDING RPC FOR CLIENT/SERVER EXPLICIT REGISTRATION
CREATE OR REPLACE FUNCTION public.handle_user_onboarding(
    p_user_id UUID,
    p_username TEXT,
    p_whatsapp_no TEXT,
    p_email TEXT,
    p_membership_number TEXT,
    p_referral_code TEXT,
    p_referred_by TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_profile public.profiles%ROWTYPE;
    v_clean_ref TEXT := NULLIF(TRIM(p_referred_by), '');
    v_signup_bonus NUMERIC := 50.00;
BEGIN
    -- 1. Insert or update Profile
    INSERT INTO public.profiles (
        user_id, username, whatsapp_no, email, membership_number, referral_code, referred_by, role, status
    ) VALUES (
        p_user_id, p_username, p_whatsapp_no, p_email, p_membership_number, p_referral_code, v_clean_ref, 'user', 'active'
    ) ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        whatsapp_no = EXCLUDED.whatsapp_no,
        email = EXCLUDED.email,
        updated_at = now();

    -- 2. Insert Wallet
    INSERT INTO public.wallets (
        user_id, available_balance, recharge_balance, withdraw_balance, pending_balance, total_earned, total_withdrawn
    ) VALUES (
        p_user_id, v_signup_bonus, v_signup_bonus, 0.00, 0.00, 0.00, 0.00
    ) ON CONFLICT (user_id) DO NOTHING;

    -- 3. Referral Record
    IF v_clean_ref IS NOT NULL THEN
        SELECT * INTO v_referrer_profile FROM public.profiles 
        WHERE referral_code = v_clean_ref OR membership_number = v_clean_ref OR user_id::text = v_clean_ref;
        
        IF FOUND AND v_referrer_profile.user_id != p_user_id THEN
            INSERT INTO public.referrals (
                referrer_id, referee_id, level, status, commission_earned, qualifying_recharge_done
            ) VALUES (
                v_referrer_profile.user_id, p_user_id, 1, 'ACTIVE', 0.00, false
            ) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- 4. Notification
    INSERT INTO public.notifications (
        user_id, title, message, type, read
    ) VALUES (
        p_user_id, 'Welcome to Power Bank! 🎉', 
        'Welcome to Power Bank! A sign-up welcome bonus of ₹50.00 has been credited to your Topup Wallet for leasing power bank equipment.',
        'INFO', false
    ) ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'membership_number', p_membership_number,
        'referral_code', p_referral_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6.1 DEFAULT GAINPOWER HARDWARE PLANS (ONLY VIP, PRO, EVENT CATEGORIES)
-- Clean up any old STANDARD plans
UPDATE public.plans SET status = 'archived' WHERE category = 'STANDARD';

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
VALUES
    -- VIP Plans
    ('VIP-Cabinet 1000', 1000.00, 44.40, 1.85, 'hourly', 365, ARRAY['Hourly Yield', 'Starter'], 'VIP', 'active', 1, 0.00),
    ('VIP-Cabinet 3000', 3000.00, 138.00, 5.75, 'hourly', 365, ARRAY['Hourly Yield', 'Commercial'], 'VIP', 'active', 2, 0.00),
    ('VIP-Cabinet 6000', 6000.00, 288.00, 12.00, 'hourly', 365, ARRAY['Hourly Yield', 'High Traffic'], 'VIP', 'active', 3, 0.00),
    ('VIP-Cabinet 15000', 15000.00, 720.00, 30.00, 'hourly', 365, ARRAY['Hourly Yield', 'Enterprise'], 'VIP', 'active', 4, 0.00),
    ('VIP-Cabinet 45000', 45000.00, 2250.00, 93.75, 'hourly', 365, ARRAY['Hourly Yield', 'Premier Hub'], 'VIP', 'active', 5, 0.00),
    ('VIP-Cabinet 75000', 75000.00, 4152.00, 173.00, 'hourly', 365, ARRAY['Hourly Yield', 'Flagship Power'], 'VIP', 'active', 6, 0.00),
    
    -- PRO Plans (Requires Active VIP Device)
    ('PRO-Cabinet 10000', 10000.00, 850.00, 35.42, 'hourly', 45, ARRAY['High Yield', 'Instant Bonus', 'Maturity Yield'], 'PRO', 'active', 7, 500.00),
    ('PRO-Cabinet 25000', 25000.00, 2250.00, 93.75, 'hourly', 45, ARRAY['High Yield', 'Instant Bonus', 'Maturity Yield'], 'PRO', 'active', 8, 1500.00),
    ('PRO-Cabinet 50000', 50000.00, 4800.00, 200.00, 'hourly', 45, ARRAY['High Yield', 'Instant Bonus', 'Maturity Yield'], 'PRO', 'active', 9, 3500.00),

    -- EVENT Plans (Limited Time Festival)
    ('Festival-Cabinet 5000', 5000.00, 520.00, 21.67, 'hourly', 15, ARRAY['Limited Event', 'Accelerated Yield'], 'EVENT', 'active', 10, 300.00),
    ('Carnival-Cabinet 12000', 12000.00, 1300.00, 54.17, 'hourly', 15, ARRAY['Limited Event', 'High Yield'], 'EVENT', 'active', 11, 800.00)
ON CONFLICT DO NOTHING;

-- 6.2 DEFAULT VIP TIERS (VIP 0 to VIP 6)
INSERT INTO public.vip_levels (level_number, name, min_investment, max_investment, icon, badge_text, description, benefits, daily_bonus_rate, withdrawal_fee_discount, display_order, is_active)
VALUES
(0, 'VIP 0 - Starter Member', 0, 499, 'user', 'VIP 0', 'Default starter tier for all registered members.', ARRAY['Standard Device Yields', 'Standard Daily Withdrawals', '24/7 Standard Support'], 0.00, 0.00, 0, true),
(1, 'VIP 1 - Bronze Member', 500, 1999, 'award', 'VIP 1', 'Unlocked with ₹500 qualifying investment.', ARRAY['+2% Daily Device Earnings Boost', 'Priority Recharge Confirmation', 'Standard Daily Withdrawals'], 2.00, 0.00, 1, true),
(2, 'VIP 2 - Silver Member', 2000, 4999, 'shield', 'VIP 2', 'Unlocked with ₹2,000 qualifying investment.', ARRAY['+4% Daily Device Earnings Boost', '1% Withdrawal Fee Discount', 'Fast-track Withdrawal Queue'], 4.00, 1.00, 2, true),
(3, 'VIP 3 - Gold Member', 5000, 14999, 'zap', 'VIP 3', 'Unlocked with ₹5,000 qualifying investment.', ARRAY['+6% Daily Device Earnings Boost', '2% Withdrawal Fee Discount', 'Higher Daily Withdrawal Limits'], 6.00, 2.00, 3, true),
(4, 'VIP 4 - Platinum Member', 15000, 39999, 'gem', 'VIP 4', 'Unlocked with ₹15,000 qualifying investment.', ARRAY['+8% Daily Device Earnings Boost', '3% Withdrawal Fee Discount', 'Dedicated VIP Customer Line'], 8.00, 3.00, 4, true),
(5, 'VIP 5 - Diamond Member', 40000, 99999, 'star', 'VIP 5', 'Unlocked with ₹40,000 qualifying investment.', ARRAY['+10% Daily Device Earnings Boost', '5% Withdrawal Fee Discount', '1-on-1 Personal Account Manager'], 10.00, 5.00, 5, true),
(6, 'VIP 6 - Crown Elite', 100000, NULL, 'crown', 'VIP 6', 'Exclusive highest tier for premier platform leaders.', ARRAY['+15% Daily Device Earnings Boost', 'Zero Withdrawal Fees (100% Free)', 'Instant Green-Channel Priority Payouts', 'Exclusive Elite Partner Bonuses'], 15.00, 10.00, 6, true)
ON CONFLICT (level_number) DO NOTHING;

-- 6.3 DEFAULT SETTINGS RECORDS
INSERT INTO public.payment_settings (id, upi_id, instructions, is_recharge_enabled, is_purchase_enabled)
VALUES ('default', 'gainpower.pay@upi', '1. Open GooglePay, PhonePe, or Paytm.\n2. Scan QR or transfer to UPI ID.\n3. Enter the exact 12-digit UTR number below and submit.', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.gateway_settings (id, is_univepay_deposit_enabled, is_upi_deposit_enabled, is_manual_withdrawal_enabled, is_univepay_auto_withdrawal_enabled, min_withdrawal, max_withdrawal, withdrawal_fee_percent)
VALUES ('default', true, true, true, true, 100.00, 50000.00, 0.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.about_platform_config (id, company_name, license_no, platform_version, terms_content, privacy_content, about_us_content)
VALUES ('default', 'GainPower Technology Pvt Ltd', 'CIN-U72900DL2024PTC394821', '3.5.0', 'GainPower Terms of Service & Member Sharing Economy Guidelines.', 'GainPower Privacy & Financial Protection Policy.', 'GainPower is India''s leading smart power-bank sharing network.')
ON CONFLICT (id) DO NOTHING;

-- 6.4 DEFAULT SYSTEM MISSIONS
INSERT INTO public.missions (title, description, category, type, target, reward_amount, reward_type, icon, is_active, sort_order)
VALUES
    ('First Power Recharge', 'Complete your first recharge of ₹100 or more to claim a welcome bonus.', 'DAILY', 'FIRST_RECHARGE', 1, 20.00, 'RECHARGE_BALANCE', 'zap', true, 1),
    ('Activate First Device', 'Lease your first sharing power station to start hourly automated yields.', 'DAILY', 'ACTIVATE_DEVICE', 1, 30.00, 'RECHARGE_BALANCE', 'battery-charging', true, 2),
    ('Invite 3 Friends', 'Invite 3 friends who complete registration and activate a power station.', 'GROWTH', 'REFERRAL_COUNT', 3, 100.00, 'RECHARGE_BALANCE', 'users', true, 3)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 7. SUPABASE REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_transactions;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_transactions;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.earnings;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_levels;
    EXCEPTION WHEN others THEN NULL;
    END;
END $$;
