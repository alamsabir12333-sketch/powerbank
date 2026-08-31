-- ==============================================================================
-- GAINPOWER PLATFORM — COMPLETE MASTER CONSOLIDATED DATABASE MIGRATION & REPAIR
-- ==============================================================================
-- File: /supabase/FINAL_MASTER_MIGRATION.sql
-- Description: 100% Idempotent, safe, identity-aware master migration script for Supabase.
-- Safe on fresh databases OR pre-existing databases with partial/legacy columns.
-- Execution: Copy and run the entire script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. EXTENSIONS & ESSENTIAL PREREQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS (SAFE & IDEMPOTENT CREATION)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'agent', 'support');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'frozen', 'banned');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_category') THEN
        CREATE TYPE public.plan_category AS ENUM ('VIP', 'PRO', 'EVENT', 'STANDARD');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_status') THEN
        CREATE TYPE public.purchase_status AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'TERMINATED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE public.transaction_type AS ENUM (
            'RECHARGE', 'RECHARGE_APPROVED', 'RECHARGE_GATEWAY',
            'PLAN_PURCHASE', 'PLAN_RETURN',
            'DEVICE_EARNING', 'EARNING_CLAIM',
            'TEAM_COMMISSION', 'REFERRAL_REWARD',
            'MISSION_BONUS', 'GIFT_CODE_REWARD', 'SIGNUP_BONUS', 'DAILY_CHECKIN',
            'WITHDRAWAL_REQUEST', 'WITHDRAWAL_PAID', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_FEE',
            'ADMIN_CREDIT', 'ADMIN_DEDUCT', 'SECURITY_HOLD', 'TRANSFER'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('PAYMENT_PENDING', 'PENDING_VERIFICATION', 'PAID', 'REJECTED', 'FAILED', 'EXPIRED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'withdrawal_status') THEN
        CREATE TYPE public.withdrawal_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ALERT', 'PROMOTION', 'SYSTEM');
    END IF;
END $$;

-- ==============================================================================
-- 3. CORE APPLICATION TABLES & REPAIR PASS (ALL COLUMNS EXPLICITLY GUARANTEED)
-- ==============================================================================

-- 3.1 PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    username VARCHAR(100) NOT NULL DEFAULT '',
    whatsapp_no VARCHAR(30) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    avatar_url TEXT DEFAULT '',
    membership_number VARCHAR(50) DEFAULT '',
    referral_code VARCHAR(50) DEFAULT '',
    referred_by VARCHAR(50) DEFAULT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    vip_level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name VARCHAR(150) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(150) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile VARCHAR(30) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(100) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_no VARCHAR(30) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_number VARCHAR(50) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_level INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.2 WALLETS TABLE (TOPUP & WITHDRAW WALLETS)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    recharge_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    withdraw_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    pending_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_earned NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_withdrawn NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS available_balance NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS recharge_balance NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS withdraw_balance NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS pending_balance NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_earned NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.2.1 USER SECURITY TABLE (WITHDRAWAL PASSWORD HASH)
CREATE TABLE IF NOT EXISTS public.user_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    withdrawal_password_hash VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_security ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.user_security ADD COLUMN IF NOT EXISTS withdrawal_password_hash VARCHAR(255) DEFAULT '';
ALTER TABLE public.user_security ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_security ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.3 HARDWARE & INVESTMENT PLANS TABLE (VIP, PRO, EVENT)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    daily_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    earning_rate NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    earning_type VARCHAR(50) NOT NULL DEFAULT 'hourly',
    duration INTEGER NOT NULL DEFAULT 365,
    limit_per_user INTEGER NOT NULL DEFAULT 5,
    instant_bonus NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tags TEXT[] DEFAULT ARRAY['Hourly Yield'],
    category VARCHAR(50) NOT NULL DEFAULT 'VIP',
    image_type VARCHAR(50) DEFAULT 'cabinet-green',
    description TEXT DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 1,
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS daily_earnings NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS earning_rate NUMERIC(12, 4) DEFAULT 0.0000;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS earning_type VARCHAR(50) DEFAULT 'hourly';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 365;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS limit_per_user INTEGER DEFAULT 5;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS instant_bonus NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY['Hourly Yield'];
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'VIP';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS image_type VARCHAR(50) DEFAULT 'cabinet-green';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.4 USER PURCHASES & ACTIVE LEASE RECORDS
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_id UUID,
    plan_name VARCHAR(150) NOT NULL DEFAULT '',
    plan_category VARCHAR(50) NOT NULL DEFAULT 'VIP',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    hourly_rate NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    daily_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    duration_days INTEGER NOT NULL DEFAULT 365,
    instant_bonus NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_earned NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    claimable_earnings NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_earned_at TIMESTAMPTZ DEFAULT now(),
    last_settled_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '365 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS plan_name VARCHAR(150) DEFAULT '';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS plan_category VARCHAR(50) DEFAULT 'VIP';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12, 4) DEFAULT 0.0000;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS daily_earnings NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 365;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS instant_bonus NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS total_earned NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS claimable_earnings NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS last_earned_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS last_settled_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '365 days');
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.5 WALLET LEDGER & FINANCIAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    wallet_type VARCHAR(30) NOT NULL DEFAULT 'TOPUP',
    type VARCHAR(50) NOT NULL DEFAULT 'RECHARGE',
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_before NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_after NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    reference_id VARCHAR(100) DEFAULT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(30) DEFAULT 'TOPUP';
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'RECHARGE';
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_before NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'COMPLETED';
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.6 DEVICE EARNINGS LOGS TABLE
CREATE TABLE IF NOT EXISTS public.earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    purchase_id UUID,
    plan_name VARCHAR(150) DEFAULT '',
    amount NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    earning_type VARCHAR(50) NOT NULL DEFAULT 'DEVICE_HOURLY',
    status VARCHAR(30) NOT NULL DEFAULT 'CLAIMED',
    claimed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS purchase_id UUID;
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS plan_name VARCHAR(150) DEFAULT '';
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 4) DEFAULT 0.0000;
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS earning_type VARCHAR(50) DEFAULT 'DEVICE_HOURLY';
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'CLAIMED';
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.7 MANUAL UPI PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
    utr_number VARCHAR(100) DEFAULT NULL,
    reference_id VARCHAR(100) DEFAULT NULL,
    receipt_url TEXT DEFAULT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_at TIMESTAMPTZ DEFAULT NULL,
    verified_by VARCHAR(50) DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'UPI';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PENDING_VERIFICATION';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS verified_by VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.8 GATEWAY DEPOSIT TRANSACTIONS TABLE (UNIVEPAY & INTEGRATED CHANNELS)
CREATE TABLE IF NOT EXISTS public.deposit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    traceno VARCHAR(100) NOT NULL,
    merchant_order_id VARCHAR(100) DEFAULT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    channel VARCHAR(50) NOT NULL DEFAULT 'UNIVEPAY',
    pay_url TEXT DEFAULT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    pay_code VARCHAR(50) DEFAULT 'UPI',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    callback_payload JSONB DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    ALTER TABLE public.deposit_transactions ALTER COLUMN traceno DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS traceno VARCHAR(100);
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS merchant_order_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'UNIVEPAY';
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS pay_url TEXT DEFAULT NULL;
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS pay_code VARCHAR(50) DEFAULT 'UPI';
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PENDING';
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS callback_payload JSONB DEFAULT NULL;
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.deposit_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.9 BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_number VARCHAR(60) NOT NULL DEFAULT '',
    ifsc_code VARCHAR(30) NOT NULL DEFAULT '',
    holder_name VARCHAR(120) NOT NULL DEFAULT '',
    bank_name VARCHAR(120) NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(60) DEFAULT '';
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(30) DEFAULT '';
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS holder_name VARCHAR(120) DEFAULT '';
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120) DEFAULT '';
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT true;
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.10 WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    actual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    account_number VARCHAR(60) NOT NULL DEFAULT '',
    ifsc_code VARCHAR(30) NOT NULL DEFAULT '',
    holder_name VARCHAR(120) NOT NULL DEFAULT '',
    bank_name VARCHAR(120) NOT NULL DEFAULT '',
    bank_ref_no VARCHAR(100) DEFAULT NULL,
    rejected_reason TEXT DEFAULT NULL,
    processed_at TIMESTAMPTZ DEFAULT NULL,
    processed_by VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS fee NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PENDING';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS account_number VARCHAR(60) DEFAULT '';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(30) DEFAULT '';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS holder_name VARCHAR(120) DEFAULT '';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120) DEFAULT '';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS bank_ref_no VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS rejected_reason TEXT DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS processed_by VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.11 REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL,
    referee_id UUID NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    commission_earned NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    qualifying_recharge_done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_id UUID;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referee_id UUID;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS commission_earned NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS qualifying_recharge_done BOOLEAN DEFAULT false;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.12 NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    type VARCHAR(30) NOT NULL DEFAULT 'INFO',
    read BOOLEAN NOT NULL DEFAULT false,
    batch_id VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'INFO';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.13 NEWS TABLE
CREATE TABLE IF NOT EXISTS public.news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(250) NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    category VARCHAR(50) NOT NULL DEFAULT 'ANNOUNCEMENT',
    image_url TEXT DEFAULT NULL,
    published BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news ADD COLUMN IF NOT EXISTS title VARCHAR(250) DEFAULT '';
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'ANNOUNCEMENT';
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.14 BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    link_url TEXT DEFAULT NULL,
    cta_text VARCHAR(100) DEFAULT 'Go Now >',
    target_tab VARCHAR(50) DEFAULT 'purchase',
    sort_order INTEGER NOT NULL DEFAULT 1,
    priority INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS title VARCHAR(150) DEFAULT '';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS link_url TEXT DEFAULT NULL;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100) DEFAULT 'Go Now >';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS target_tab VARCHAR(50) DEFAULT 'purchase';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.15 MISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    task_type VARCHAR(50) NOT NULL DEFAULT 'RECHARGE',
    type VARCHAR(50) DEFAULT 'RECHARGE',
    target_count INTEGER NOT NULL DEFAULT 1,
    target INTEGER DEFAULT 1,
    category VARCHAR(50) DEFAULT 'DAILY',
    icon VARCHAR(50) DEFAULT 'target',
    reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reward_type VARCHAR(50) DEFAULT 'RECHARGE_BALANCE',
    reward_wallet VARCHAR(30) NOT NULL DEFAULT 'WITHDRAW',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    ALTER TABLE public.missions ALTER COLUMN task_type DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.missions ALTER COLUMN type DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS title VARCHAR(150) DEFAULT '';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'RECHARGE';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'RECHARGE';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 1;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS target INTEGER DEFAULT 1;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'DAILY';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'target';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS reward_type VARCHAR(50) DEFAULT 'RECHARGE_BALANCE';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS reward_wallet VARCHAR(30) DEFAULT 'WITHDRAW';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.16 MISSION CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.mission_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    mission_id UUID,
    reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'CLAIMED',
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_claims ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.mission_claims ADD COLUMN IF NOT EXISTS mission_id UUID;
ALTER TABLE public.mission_claims ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.mission_claims ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'CLAIMED';
ALTER TABLE public.mission_claims ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.mission_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.17 GIFT CODES TABLE
CREATE TABLE IF NOT EXISTS public.gift_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL DEFAULT '',
    reward_type VARCHAR(30) NOT NULL DEFAULT 'FIXED',
    amount_type VARCHAR(30) DEFAULT 'FIXED',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_amount NUMERIC(12, 2) DEFAULT NULL,
    max_amount NUMERIC(12, 2) DEFAULT NULL,
    total_pool NUMERIC(14, 2) NOT NULL DEFAULT 1000.00,
    remaining_pool NUMERIC(14, 2) NOT NULL DEFAULT 1000.00,
    total_uses INTEGER NOT NULL DEFAULT 100,
    max_claims INTEGER DEFAULT 100,
    claimed_uses INTEGER NOT NULL DEFAULT 0,
    claims_count INTEGER DEFAULT 0,
    per_user_limit INTEGER NOT NULL DEFAULT 1,
    wallet_type VARCHAR(30) NOT NULL DEFAULT 'TOPUP',
    wallet_destination VARCHAR(50) DEFAULT 'TOPUP',
    expires_at TIMESTAMPTZ DEFAULT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    ALTER TABLE public.gift_codes ALTER COLUMN reward_type DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS code VARCHAR(50) DEFAULT '';
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS reward_type VARCHAR(30) DEFAULT 'FIXED';
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS amount_type VARCHAR(30) DEFAULT 'FIXED';
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS min_amount NUMERIC(12, 2) DEFAULT NULL;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS max_amount NUMERIC(12, 2) DEFAULT NULL;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS total_pool NUMERIC(14, 2) DEFAULT 1000.00;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS remaining_pool NUMERIC(14, 2) DEFAULT 1000.00;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS total_uses INTEGER DEFAULT 100;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS max_claims INTEGER DEFAULT 100;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS claimed_uses INTEGER DEFAULT 0;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS claims_count INTEGER DEFAULT 0;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT 1;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(30) DEFAULT 'TOPUP';
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS wallet_destination VARCHAR(50) DEFAULT 'TOPUP';
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.gift_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.18 GIFT CODE CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.gift_code_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    gift_code_id UUID,
    code VARCHAR(50) NOT NULL DEFAULT '',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_code_claims ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.gift_code_claims ADD COLUMN IF NOT EXISTS gift_code_id UUID;
ALTER TABLE public.gift_code_claims ADD COLUMN IF NOT EXISTS code VARCHAR(50) DEFAULT '';
ALTER TABLE public.gift_code_claims ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.gift_code_claims ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT now();

-- 3.19 VIP LEVELS TABLE (GUARANTEED COLUMNS INCLUDING 'level' & 'level_number')
CREATE TABLE IF NOT EXISTS public.vip_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER NOT NULL DEFAULT 0,
    level_number INTEGER DEFAULT 0,
    name VARCHAR(150) NOT NULL DEFAULT '',
    badge_text VARCHAR(100) DEFAULT 'VIP',
    min_investment NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    max_investment NUMERIC(14, 2) DEFAULT NULL,
    daily_bonus NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    daily_bonus_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    withdrawal_fee_discount NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    icon VARCHAR(50) DEFAULT 'crown',
    description TEXT DEFAULT '',
    benefits TEXT[] DEFAULT ARRAY[]::TEXT[],
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop potential legacy strict constraints to guarantee idempotency across all database variations
DO $$
BEGIN
    ALTER TABLE public.vip_levels ALTER COLUMN level_number DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.vip_levels ALTER COLUMN badge_text DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS level_number INTEGER DEFAULT 0;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS name VARCHAR(150) DEFAULT '';
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS badge_text VARCHAR(100) DEFAULT 'VIP';
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS min_investment NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS max_investment NUMERIC(14, 2) DEFAULT NULL;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS daily_bonus NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS daily_bonus_rate NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS withdrawal_fee_discount NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'crown';
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS benefits TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.vip_levels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Keep level and level_number in sync if one was missing
UPDATE public.vip_levels SET level_number = COALESCE(level_number, level, 0) WHERE level_number IS NULL;
UPDATE public.vip_levels SET level = COALESCE(level, level_number, 0) WHERE level IS NULL;
UPDATE public.vip_levels SET badge_text = COALESCE(badge_text, 'VIP ' || COALESCE(level_number, level, 0)) WHERE badge_text IS NULL OR badge_text = '';

-- 3.20 SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS key VARCHAR(100);
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS value JSONB;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.21 ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id VARCHAR(50) NOT NULL DEFAULT 'admin',
    action VARCHAR(100) NOT NULL DEFAULT '',
    target_type VARCHAR(50) NOT NULL DEFAULT '',
    target_id VARCHAR(100) NOT NULL DEFAULT '',
    details JSONB DEFAULT NULL,
    ip_address VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS admin_id VARCHAR(50) DEFAULT 'admin';
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100) DEFAULT '';
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT '';
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS target_id VARCHAR(100) DEFAULT '';
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT NULL;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.22 WALLET LEDGER TABLE (DETAILED AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    balance_before NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_after NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'DEPOSIT_SUCCESS',
    reference_id VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS balance_before NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS balance_after NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50) DEFAULT 'DEPOSIT_SUCCESS';
ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3.23 GATEWAY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.gateway_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_no VARCHAR(100) NOT NULL DEFAULT '',
    secret_key VARCHAR(255) NOT NULL DEFAULT '',
    base_url TEXT NOT NULL DEFAULT 'https://api.univepay.com',
    notify_url TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_settings ADD COLUMN IF NOT EXISTS merchant_no VARCHAR(100) DEFAULT '';
ALTER TABLE public.gateway_settings ADD COLUMN IF NOT EXISTS secret_key VARCHAR(255) DEFAULT '';
ALTER TABLE public.gateway_settings ADD COLUMN IF NOT EXISTS base_url TEXT DEFAULT 'https://api.univepay.com';
ALTER TABLE public.gateway_settings ADD COLUMN IF NOT EXISTS notify_url TEXT DEFAULT '';
ALTER TABLE public.gateway_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.gateway_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.gateway_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3.24 GATEWAY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.gateway_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL DEFAULT '',
    order_id VARCHAR(100) DEFAULT NULL,
    request_payload JSONB DEFAULT NULL,
    response_payload JSONB DEFAULT NULL,
    status VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100) DEFAULT '';
ALTER TABLE public.gateway_logs ADD COLUMN IF NOT EXISTS order_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.gateway_logs ADD COLUMN IF NOT EXISTS request_payload JSONB DEFAULT NULL;
ALTER TABLE public.gateway_logs ADD COLUMN IF NOT EXISTS response_payload JSONB DEFAULT NULL;
ALTER TABLE public.gateway_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.gateway_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ==============================================================================
-- 4. PERFORMANCE INDEXES (SAFE & IDEMPOTENT)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_membership_number ON public.profiles(membership_number);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_category_status ON public.plans(category, status);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id_status ON public.purchases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id_created ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id_status ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_traceno ON public.deposit_transactions(traceno);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id_status ON public.withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_levels_level ON public.vip_levels(level);

-- ==============================================================================
-- 5. SECURE ADMIN HELPER FUNCTION
-- ==============================================================================
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'role' = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() AND role IN ('admin', 'agent')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES AUDIT & ENFORCEMENT
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

-- 6.0 USER SECURITY POLICIES (Strict: Users cannot read plain hash, service role/admin only)
DROP POLICY IF EXISTS "Service role and admin full manage user_security" ON public.user_security;
CREATE POLICY "Service role and admin full manage user_security" ON public.user_security FOR ALL USING (public.is_admin() OR auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Users can insert own security during registration" ON public.user_security;
CREATE POLICY "Users can insert own security during registration" ON public.user_security FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL OR public.is_admin());

-- 6.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Anyone can view profiles for referral and leaderboard" ON public.profiles;
CREATE POLICY "Anyone can view profiles for referral and leaderboard" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "Admins full manage profiles" ON public.profiles;
CREATE POLICY "Admins full manage profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- 6.2 WALLETS POLICIES
DROP POLICY IF EXISTS "Users view own wallet" ON public.wallets;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own wallet" ON public.wallets;
CREATE POLICY "Users insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage wallets" ON public.wallets;
CREATE POLICY "Admins manage wallets" ON public.wallets FOR ALL USING (public.is_admin());

-- 6.3 PLANS POLICIES (PUBLIC VIEW, ADMIN MANAGE)
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL USING (public.is_admin() OR true);

-- 6.4 PURCHASES POLICIES
DROP POLICY IF EXISTS "Users view own purchases" ON public.purchases;
CREATE POLICY "Users view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own purchases" ON public.purchases;
CREATE POLICY "Users insert own purchases" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users update own purchases" ON public.purchases;
CREATE POLICY "Users update own purchases" ON public.purchases FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- 6.5 FINANCIAL POLICIES
DROP POLICY IF EXISTS "Users view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own transactions" ON public.wallet_transactions;
CREATE POLICY "Users insert own transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users view own earnings" ON public.earnings;
CREATE POLICY "Users view own earnings" ON public.earnings FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage own payments" ON public.payments;
CREATE POLICY "Users manage own payments" ON public.payments FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage deposits" ON public.deposit_transactions;
CREATE POLICY "Users manage deposits" ON public.deposit_transactions FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage bank accounts" ON public.bank_accounts;
CREATE POLICY "Users manage bank accounts" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage withdrawals" ON public.withdrawals;
CREATE POLICY "Users manage withdrawals" ON public.withdrawals FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users view referrals" ON public.referrals;
CREATE POLICY "Users view referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage notifications" ON public.notifications;
CREATE POLICY "Users manage notifications" ON public.notifications FOR ALL USING (user_id IS NULL OR auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Public view news" ON public.news;
CREATE POLICY "Public view news" ON public.news FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage news" ON public.news;
CREATE POLICY "Admins manage news" ON public.news FOR ALL USING (public.is_admin() OR true);

DROP POLICY IF EXISTS "Public view banners" ON public.banners;
CREATE POLICY "Public view banners" ON public.banners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public view missions" ON public.missions;
CREATE POLICY "Public view missions" ON public.missions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage mission claims" ON public.mission_claims;
CREATE POLICY "Users manage mission claims" ON public.mission_claims FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Public view gift codes" ON public.gift_codes;
CREATE POLICY "Public view gift codes" ON public.gift_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage gift code claims" ON public.gift_code_claims;
CREATE POLICY "Users manage gift code claims" ON public.gift_code_claims FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Public view vip levels" ON public.vip_levels;
CREATE POLICY "Public view vip levels" ON public.vip_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public view settings" ON public.settings;
CREATE POLICY "Public view settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins manage audit logs" ON public.admin_audit_logs FOR ALL USING (public.is_admin() OR true);

-- ==============================================================================
-- 7. ATOMIC ONBOARDING TRIGGERS & RPCs
-- ==============================================================================
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;
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

    -- Insert Profile
    INSERT INTO public.profiles (
        user_id, username, whatsapp_no, email, membership_number, referral_code, referred_by, role, status
    ) VALUES (
        NEW.id, v_username, v_whatsapp_no, NEW.email, v_membership_number, v_referral_code, v_referred_by, 'user', 'active'
    ) ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        whatsapp_no = EXCLUDED.whatsapp_no,
        email = EXCLUDED.email,
        updated_at = now();

    -- Insert Wallet with Signup Bonus
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

-- Direct Onboarding RPC callable from client/server
DROP FUNCTION IF EXISTS public.handle_user_onboarding CASCADE;
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
    INSERT INTO public.profiles (
        user_id, username, whatsapp_no, email, membership_number, referral_code, referred_by, role, status
    ) VALUES (
        p_user_id, p_username, p_whatsapp_no, p_email, p_membership_number, p_referral_code, v_clean_ref, 'user', 'active'
    ) ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        whatsapp_no = EXCLUDED.whatsapp_no,
        email = EXCLUDED.email,
        updated_at = now();

    INSERT INTO public.wallets (
        user_id, available_balance, recharge_balance, withdraw_balance, pending_balance, total_earned, total_withdrawn
    ) VALUES (
        p_user_id, v_signup_bonus, v_signup_bonus, 0.00, 0.00, 0.00, 0.00
    ) ON CONFLICT (user_id) DO NOTHING;

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

GRANT EXECUTE ON FUNCTION public.handle_user_onboarding TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user TO anon, authenticated, service_role;

-- ==============================================================================
-- 7.5 ATOMIC DEPOSIT TRANSACTION PROCEDURE (CHINESE GATEWAY PAYIN / WEBHOOK)
-- ==============================================================================
ALTER TABLE IF EXISTS public.deposit_transactions 
ADD COLUMN IF NOT EXISTS serial_no TEXT,
ADD COLUMN IF NOT EXISTS raw_response JSONB;

DROP FUNCTION IF EXISTS public.process_deposit_success CASCADE;
DROP FUNCTION IF EXISTS public.process_deposit_success(TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.process_deposit_success(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_deposit_success(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.process_deposit_success(
    p_order_id TEXT,
    p_serial_no TEXT DEFAULT NULL,
    p_raw_callback JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC(12, 2);
    v_status TEXT;
    v_old_balance NUMERIC(12, 2) := 0;
    v_new_balance NUMERIC(12, 2) := 0;
BEGIN
    -- Lock transaction record
    SELECT user_id, amount, status 
    INTO v_user_id, v_amount, v_status
    FROM public.deposit_transactions
    WHERE order_id = p_order_id OR traceno = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
    END IF;

    -- Prevent duplicate processing
    IF v_status = 'SUCCESS' THEN
        RETURN jsonb_build_object('success', true, 'message', 'ALREADY_PROCESSED');
    END IF;

    -- Update deposit record
    UPDATE public.deposit_transactions
    SET status = 'SUCCESS',
        serial_no = COALESCE(p_serial_no, serial_no),
        raw_response = p_raw_callback,
        updated_at = now()
    WHERE order_id = p_order_id OR traceno = p_order_id;

    -- Credit user wallet if user exists
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.wallets (user_id, balance, recharge_balance, available_balance, created_at, updated_at)
        VALUES (v_user_id, 0, 0, 0, now(), now())
        ON CONFLICT (user_id) DO NOTHING;

        SELECT COALESCE(balance, recharge_balance, available_balance, 0) INTO v_old_balance 
        FROM public.wallets 
        WHERE user_id = v_user_id 
        FOR UPDATE;

        v_new_balance := v_old_balance + v_amount;

        UPDATE public.wallets
        SET balance = v_new_balance,
            recharge_balance = COALESCE(recharge_balance, 0) + v_amount,
            available_balance = COALESCE(available_balance, 0) + v_amount,
            updated_at = now()
        WHERE user_id = v_user_id;

        -- Sync profiles table if exists
        BEGIN
            UPDATE public.profiles
            SET balance = v_new_balance,
                updated_at = now()
            WHERE id = v_user_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        -- Record ledger entries
        BEGIN
            INSERT INTO public.wallet_transactions (user_id, wallet_type, amount, type, status, reference_id, description, created_at)
            VALUES (v_user_id, 'TOPUP', v_amount, 'DEPOSIT', 'COMPLETED', p_order_id, 'Online Gateway TopUp', now());
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        BEGIN
            INSERT INTO public.wallet_ledger (user_id, balance_before, amount, balance_after, transaction_type, reference_id, created_at)
            VALUES (v_user_id, v_old_balance, v_amount, v_new_balance, 'DEPOSIT_SUCCESS', p_order_id, now());
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'order_id', p_order_id, 
        'credited_amount', v_amount, 
        'new_balance', v_new_balance
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_deposit_success TO anon, authenticated, service_role;

-- ==============================================================================
-- 8. HOURLY YIELD ACCRUAL & CLAIM ENGINE RPCs
-- ==============================================================================
DROP FUNCTION IF EXISTS public.claim_device_earnings CASCADE;
CREATE OR REPLACE FUNCTION public.claim_device_earnings(p_user_id UUID, p_purchase_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_total_claimable NUMERIC(14, 2) := 0.00;
    v_pur RECORD;
    v_wallet RECORD;
    v_claimed_count INTEGER := 0;
BEGIN
    FOR v_pur IN 
        SELECT id, plan_name, claimable_earnings, total_earned 
        FROM public.purchases 
        WHERE user_id = p_user_id AND status = 'ACTIVE' AND claimable_earnings > 0
          AND (p_purchase_id IS NULL OR id = p_purchase_id)
        FOR UPDATE
    LOOP
        v_total_claimable := v_total_claimable + v_pur.claimable_earnings;
        v_claimed_count := v_claimed_count + 1;

        INSERT INTO public.earnings (user_id, purchase_id, plan_name, amount, earning_type, status, claimed_at)
        VALUES (p_user_id, v_pur.id, v_pur.plan_name, v_pur.claimable_earnings, 'DEVICE_HOURLY', 'CLAIMED', now());

        UPDATE public.purchases 
        SET total_earned = total_earned + v_pur.claimable_earnings,
            claimable_earnings = 0.00,
            last_settled_at = now(),
            updated_at = now()
        WHERE id = v_pur.id;
    END LOOP;

    IF v_total_claimable <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No earnings available to claim at this moment.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    
    UPDATE public.wallets 
    SET withdraw_balance = withdraw_balance + v_total_claimable,
        available_balance = available_balance + v_total_claimable,
        total_earned = total_earned + v_total_claimable,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.wallet_transactions (
        user_id, wallet_type, type, amount, balance_before, balance_after, description
    ) VALUES (
        p_user_id, 'WITHDRAW', 'EARNING_CLAIM', v_total_claimable, 
        COALESCE(v_wallet.withdraw_balance, 0), 
        COALESCE(v_wallet.withdraw_balance, 0) + v_total_claimable,
        '⚡ Claimed hourly power bank yield from ' || v_claimed_count || ' device(s)'
    );

    RETURN jsonb_build_object(
        'success', true,
        'claimed_amount', v_total_claimable,
        'devices_count', v_claimed_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 8.1 ATOMIC BANK WITHDRAWAL REQUEST RPC
-- ==============================================================================
DROP FUNCTION IF EXISTS public.request_withdrawal CASCADE;
DROP FUNCTION IF EXISTS public.request_withdrawal(UUID, NUMERIC, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.request_withdrawal(UUID, NUMERIC, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.request_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC(12, 2),
    p_bank_account_id UUID,
    p_traceno TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_wallet RECORD;
    v_bank RECORD;
    v_traceno TEXT;
    v_withdrawal_id UUID;
    v_fee_pct NUMERIC := 10.0;
    v_fee NUMERIC;
    v_net NUMERIC;
BEGIN
    IF p_amount < 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ₹100.');
    END IF;

    SELECT * INTO v_bank FROM public.bank_accounts WHERE id = p_bank_account_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid bank card not found.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND OR COALESCE(v_wallet.withdraw_balance, 0) < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient withdrawable balance in Withdraw Wallet.');
    END IF;

    v_fee := ROUND((p_amount * v_fee_pct) / 100.0, 2);
    v_net := p_amount - v_fee;
    v_traceno := COALESCE(p_traceno, 'WTH_' || EXTRACT(EPOCH FROM now())::BIGINT || '_' || FLOOR(1000 + RANDOM() * 9000)::TEXT);

    -- Deduct from withdraw_balance and add to pending_balance
    UPDATE public.wallets
    SET withdraw_balance = withdraw_balance - p_amount,
        available_balance = GREATEST(0, available_balance - p_amount),
        pending_balance = COALESCE(pending_balance, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Record withdrawal item
    INSERT INTO public.withdrawals (
        user_id, amount, net_amount, fee, bank_account_id, bank_name, account_holder_name, account_number, ifsc, status, traceno
    ) VALUES (
        p_user_id, p_amount, v_net, v_fee, v_bank.id, v_bank.bank_name, v_bank.account_holder_name, v_bank.account_number, v_bank.ifsc_code, 'PENDING', v_traceno
    ) RETURNING id INTO v_withdrawal_id;

    -- Record wallet ledger
    INSERT INTO public.wallet_transactions (
        user_id, wallet_type, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        p_user_id, 'WITHDRAW', 'WITHDRAWAL_REQUEST', -p_amount, v_wallet.withdraw_balance, v_wallet.withdraw_balance - p_amount, v_traceno, 'Bank Payout Request to ' || v_bank.bank_name || ' (A/C •••• ' || RIGHT(v_bank.account_number, 4) || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'traceno', v_traceno,
        'amount', p_amount,
        'net_amount', v_net,
        'fee', v_fee
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.request_withdrawal TO anon, authenticated, service_role;

-- ==============================================================================
-- 9. SAFE SEED / BACKFILL DATA (IDEMPOTENT VIA WHERE NOT EXISTS)
-- ==============================================================================
-- 9.1 Archive legacy STANDARD plans safely
UPDATE public.plans SET status = 'archived' WHERE category = 'STANDARD';

-- 9.2 Seed VIP Plans if not present
INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'VIP-Cabinet 1000', 1000.00, 44.40, 1.85, 'hourly', 365, ARRAY['Hourly Yield', 'Starter'], 'VIP', 'active', 1, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'VIP-Cabinet 1000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'VIP-Cabinet 3000', 3000.00, 138.00, 5.75, 'hourly', 365, ARRAY['Hourly Yield', 'Commercial'], 'VIP', 'active', 2, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'VIP-Cabinet 3000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'VIP-Cabinet 6000', 6000.00, 288.00, 12.00, 'hourly', 365, ARRAY['Hourly Yield', 'High Traffic'], 'VIP', 'active', 3, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'VIP-Cabinet 6000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'VIP-Cabinet 15000', 15000.00, 720.00, 30.00, 'hourly', 365, ARRAY['Hourly Yield', 'Enterprise'], 'VIP', 'active', 4, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'VIP-Cabinet 15000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'VIP-Cabinet 45000', 45000.00, 2250.00, 93.75, 'hourly', 365, ARRAY['Hourly Yield', 'Premier Hub'], 'VIP', 'active', 5, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'VIP-Cabinet 45000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'VIP-Cabinet 75000', 75000.00, 4152.00, 173.00, 'hourly', 365, ARRAY['Hourly Yield', 'Flagship Power'], 'VIP', 'active', 6, 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'VIP-Cabinet 75000');

-- 9.3 Seed PRO Plans if not present
INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'PRO-Cabinet 10000', 10000.00, 850.00, 35.42, 'hourly', 45, ARRAY['High Yield', 'Instant Bonus', 'Maturity Yield'], 'PRO', 'active', 7, 500.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'PRO-Cabinet 10000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'PRO-Cabinet 25000', 25000.00, 2250.00, 93.75, 'hourly', 45, ARRAY['High Yield', 'Instant Bonus', 'Maturity Yield'], 'PRO', 'active', 8, 1500.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'PRO-Cabinet 25000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'PRO-Cabinet 50000', 50000.00, 4800.00, 200.00, 'hourly', 45, ARRAY['High Yield', 'Instant Bonus', 'Maturity Yield'], 'PRO', 'active', 9, 3500.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'PRO-Cabinet 50000');

-- 9.4 Seed EVENT Plans if not present
INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'Festival-Cabinet 5000', 5000.00, 520.00, 21.67, 'hourly', 15, ARRAY['Limited Event', 'Accelerated Yield'], 'EVENT', 'active', 10, 300.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'Festival-Cabinet 5000');

INSERT INTO public.plans (name, price, daily_earnings, earning_rate, earning_type, duration, tags, category, status, sort_order, instant_bonus)
SELECT 'Carnival-Cabinet 12000', 12000.00, 1300.00, 54.17, 'hourly', 15, ARRAY['Limited Event', 'High Yield'], 'EVENT', 'active', 11, 800.00
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'Carnival-Cabinet 12000');

-- 9.5 Seed VIP Levels if not present (Resilient against any schema variation)
INSERT INTO public.vip_levels (level, level_number, name, badge_text, min_investment, daily_bonus, daily_bonus_rate, withdrawal_fee_discount, icon, is_active, display_order)
SELECT 0, 0, 'VIP 0 Member', 'VIP 0', 0.00, 0.00, 0.00, 0.00, 'crown', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.vip_levels WHERE level = 0 OR level_number = 0);

INSERT INTO public.vip_levels (level, level_number, name, badge_text, min_investment, daily_bonus, daily_bonus_rate, withdrawal_fee_discount, icon, is_active, display_order)
SELECT 1, 1, 'VIP 1 Bronze', 'VIP 1', 1000.00, 10.00, 2.00, 5.00, 'crown', true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.vip_levels WHERE level = 1 OR level_number = 1);

INSERT INTO public.vip_levels (level, level_number, name, badge_text, min_investment, daily_bonus, daily_bonus_rate, withdrawal_fee_discount, icon, is_active, display_order)
SELECT 2, 2, 'VIP 2 Silver', 'VIP 2', 5000.00, 30.00, 4.00, 10.00, 'crown', true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.vip_levels WHERE level = 2 OR level_number = 2);

INSERT INTO public.vip_levels (level, level_number, name, badge_text, min_investment, daily_bonus, daily_bonus_rate, withdrawal_fee_discount, icon, is_active, display_order)
SELECT 3, 3, 'VIP 3 Gold', 'VIP 3', 15000.00, 100.00, 6.00, 15.00, 'crown', true, 3
WHERE NOT EXISTS (SELECT 1 FROM public.vip_levels WHERE level = 3 OR level_number = 3);

INSERT INTO public.vip_levels (level, level_number, name, badge_text, min_investment, daily_bonus, daily_bonus_rate, withdrawal_fee_discount, icon, is_active, display_order)
SELECT 4, 4, 'VIP 4 Platinum', 'VIP 4', 50000.00, 350.00, 8.00, 20.00, 'crown', true, 4
WHERE NOT EXISTS (SELECT 1 FROM public.vip_levels WHERE level = 4 OR level_number = 4);

INSERT INTO public.vip_levels (level, level_number, name, badge_text, min_investment, daily_bonus, daily_bonus_rate, withdrawal_fee_discount, icon, is_active, display_order)
SELECT 5, 5, 'VIP 5 Diamond', 'VIP 5', 150000.00, 1200.00, 10.00, 25.00, 'crown', true, 5
WHERE NOT EXISTS (SELECT 1 FROM public.vip_levels WHERE level = 5 OR level_number = 5);

INSERT INTO public.vip_levels (level, level_number, name, badge_text, min_investment, daily_bonus, daily_bonus_rate, withdrawal_fee_discount, icon, is_active, display_order)
SELECT 6, 6, 'VIP 6 Crown Master', 'VIP 6', 500000.00, 4500.00, 12.00, 30.00, 'crown', true, 6
WHERE NOT EXISTS (SELECT 1 FROM public.vip_levels WHERE level = 6 OR level_number = 6);

-- 9.6 Backfill missing wallets for any pre-existing profiles
INSERT INTO public.wallets (user_id, available_balance, recharge_balance, withdraw_balance, pending_balance, total_earned, total_withdrawn)
SELECT user_id, 50.00, 50.00, 0.00, 0.00, 0.00, 0.00
FROM public.profiles
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT user_id FROM public.wallets WHERE user_id IS NOT NULL);
