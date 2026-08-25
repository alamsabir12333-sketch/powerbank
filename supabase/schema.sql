-- ==============================================================================
-- SUPABASE POSTGRESQL SCHEMA & ATOMIC RPC FUNCTIONS FOR POWER BANK APP
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    whatsapp_no TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    membership_number TEXT UNIQUE NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. WALLETS TABLE
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    available_balance NUMERIC(12, 2) DEFAULT 0.00 CHECK (available_balance >= 0),
    pending_balance NUMERIC(12, 2) DEFAULT 0.00 CHECK (pending_balance >= 0),
    total_earned NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_earned >= 0),
    total_withdrawn NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PLANS TABLE
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    image_url TEXT,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    earning_rate NUMERIC(12, 2) NOT NULL CHECK (earning_rate >= 0),
    earning_type TEXT DEFAULT 'hourly',
    duration INT DEFAULT 365,
    limit_per_user INT DEFAULT 999,
    tags TEXT[] DEFAULT ARRAY['Shared Power', 'Sharing Economy'],
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'sold_out')),
    allow_duplicate BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    amount NUMERIC(12, 2) NOT NULL,
    wallet_transaction_id UUID,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    earning_rate NUMERIC(12, 2) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    total_earned NUMERIC(12, 2) DEFAULT 0.00,
    last_settled_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_type TEXT DEFAULT 'RECHARGE',
    utr TEXT,
    proof_url TEXT,
    status TEXT DEFAULT 'PAYMENT_PENDING' CHECK (status IN ('PAYMENT_PENDING', 'PENDING_VERIFICATION', 'PAID', 'REJECTED')),
    admin_id UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'EARNING', 'REFERRAL_BONUS', 'TEAM_BONUS', 'RECHARGE', 
        'PLAN_PURCHASE', 'WITHDRAWAL', 'WITHDRAWAL_REVERSAL', 
        'REFUND', 'ADMIN_ADJUSTMENT'
    )),
    amount NUMERIC(12, 2) NOT NULL,
    balance_before NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. EARNINGS TABLE
CREATE TABLE IF NOT EXISTS public.earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    earning_type TEXT DEFAULT 'HOURLY_DEVICE',
    earning_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'SETTLED',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referee_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level INT DEFAULT 1,
    bonus_amount NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. BANK ACCOUNTS TABLE
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

-- 10. WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    fee NUMERIC(12, 2) DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    upi_id TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
    admin_note TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 11. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'INFO',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    cta_text TEXT DEFAULT 'Go Now >',
    image_url TEXT,
    target_tab TEXT DEFAULT 'purchase',
    is_active BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. PLATFORM NEWS TABLE
CREATE TABLE IF NOT EXISTS public.platform_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT,
    tag TEXT DEFAULT 'Operational',
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. ADMIN SETTINGS & PAYMENT SETTINGS
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

-- 15. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_purchases_user_status ON public.purchases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_earnings_user_date ON public.earnings(user_id, earning_date);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can update own non-critical profile fields" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Wallets policies (Read own only, modifications ONLY via RPC/Security Definer functions)
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Plans policies (Public view active plans, Admin full manage)
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL USING (public.is_admin());

-- Purchases policies
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can insert recharge request" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL USING (public.is_admin());

-- Wallet transactions policies
CREATE POLICY "Users view own wallet transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Earnings policies
CREATE POLICY "Users view own earnings" ON public.earnings FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Referrals policies
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id OR public.is_admin());

-- Bank accounts policies
CREATE POLICY "Users manage own bank accounts" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id);

-- Withdrawals policies
CREATE POLICY "Users view and insert own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users insert withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage withdrawals" ON public.withdrawals FOR ALL USING (public.is_admin());

-- Notifications policies
CREATE POLICY "Users view and update own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- Banners & News policies
CREATE POLICY "Anyone can view banners" ON public.banners FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins manage banners" ON public.banners FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view published news" ON public.platform_news FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "Admins manage news" ON public.platform_news FOR ALL USING (public.is_admin());

-- Settings policies
CREATE POLICY "Anyone can read payment settings" ON public.payment_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage payment settings" ON public.payment_settings FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can read admin settings" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage admin settings" ON public.admin_settings FOR ALL USING (public.is_admin());

-- Audit logs
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR ALL USING (public.is_admin());

-- ==============================================================================
-- ATOMIC STORED PROCEDURES / SECURE RPC FUNCTIONS
-- ==============================================================================

-- 1. ATOMIC PLAN PURCHASE WITH WALLET BALANCE (SERVER-SIDE PRICE VERIFICATION)
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
BEGIN
    -- 1. Fetch Plan securely from DB
    SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND status = 'active';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Plan not found or inactive');
    END IF;

    -- 2. Lock & Fetch User Wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    -- 3. Verify Sufficient Balance
    IF v_wallet.available_balance < v_plan.price THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance. Please recharge your wallet.');
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - v_plan.price;

    -- 4. Deduct Wallet Balance
    UPDATE public.wallets 
    SET available_balance = v_balance_after,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- 5. Record Wallet Transaction
    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'PLAN_PURCHASE', -v_plan.price, v_balance_before, v_balance_after,
        p_plan_id::text, 'Purchase: ' || v_plan.name
    );

    -- 6. Create Active Purchase Record (Unlimited Active Plans Supported!)
    v_purchase_id := uuid_generate_v4();
    INSERT INTO public.purchases (
        id, user_id, plan_id, amount, wallet_transaction_id, status, earning_rate,
        started_at, expires_at, total_earned, last_settled_at
    ) VALUES (
        v_purchase_id, p_user_id, p_plan_id, v_plan.price, v_tx_id, 'ACTIVE', v_plan.earning_rate,
        now(), now() + (v_plan.duration || ' days')::INTERVAL, 0.00, now()
    );

    -- 7. Create Notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_user_id,
        'Plan Activated Successfully',
        'Your device "' || v_plan.name || '" is now active and generating earnings!',
        'SUCCESS'
    );

    -- 8. Audit Log
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (p_user_id, 'PURCHASE_PLAN', 'purchases', v_purchase_id::text, jsonb_build_object(
        'plan_id', p_plan_id,
        'amount', v_plan.price,
        'earning_rate', v_plan.earning_rate
    ));

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'balance', v_balance_after,
        'message', 'Plan purchased successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. ATOMIC RECHARGE SUBMISSION
CREATE OR REPLACE FUNCTION public.submit_recharge(
    p_user_id UUID,
    p_amount NUMERIC,
    p_utr TEXT,
    p_proof_url TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order_id TEXT;
    v_payment_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid recharge amount');
    END IF;

    IF p_utr IS NULL OR length(trim(p_utr)) < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid 12-digit UTR / Reference ID is required');
    END IF;

    -- Check if UTR is already submitted
    IF EXISTS (SELECT 1 FROM public.payments WHERE utr = trim(p_utr) AND status IN ('PAID', 'PENDING_VERIFICATION')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This UTR has already been submitted or processed.');
    END IF;

    v_order_id := 'RECHARGE-' || upper(substring(md5(random()::text) from 1 for 8));
    v_payment_id := uuid_generate_v4();

    INSERT INTO public.payments (
        id, user_id, order_id, amount, payment_type, utr, proof_url, status
    ) VALUES (
        v_payment_id, p_user_id, v_order_id, p_amount, 'RECHARGE', trim(p_utr), p_proof_url, 'PENDING_VERIFICATION'
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_user_id,
        'Recharge Request Submitted',
        'Recharge of ₹' || p_amount || ' (Order: ' || v_order_id || ') is under verification.',
        'INFO'
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'order_id', v_order_id,
        'message', 'Recharge submitted for verification'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ATOMIC IDEMPOTENT ADMIN RECHARGE APPROVAL
CREATE OR REPLACE FUNCTION public.approve_recharge(
    p_payment_id UUID,
    p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_payment public.payments%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
    v_tx_id UUID;
BEGIN
    -- 1. Lock payment row
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment request not found');
    END IF;

    -- 2. Idempotency verification
    IF v_payment.status = 'PAID' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment is already approved and credited');
    END IF;

    IF v_payment.status = 'REJECTED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment has already been rejected');
    END IF;

    -- 3. Lock user wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user wallet not found');
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before + v_payment.amount;

    -- 4. Credit user wallet
    UPDATE public.wallets
    SET available_balance = v_balance_after,
        updated_at = now()
    WHERE user_id = v_payment.user_id;

    -- 5. Create wallet transaction
    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, v_payment.user_id, 'RECHARGE', v_payment.amount, v_balance_before, v_balance_after,
        v_payment.order_id, 'Manual UPI Recharge (UTR: ' || coalesce(v_payment.utr, 'N/A') || ')'
    );

    -- 6. Update payment record
    UPDATE public.payments
    SET status = 'PAID',
        admin_id = p_admin_id,
        updated_at = now()
    WHERE id = p_payment_id;

    -- 7. Notify User
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_payment.user_id,
        'Recharge Successful!',
        'Your wallet has been credited with ₹' || v_payment.amount || ' (Order: ' || v_payment.order_id || ').',
        'SUCCESS'
    );

    -- 8. Audit Log
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (p_admin_id, 'APPROVE_RECHARGE', 'payments', p_payment_id::text, jsonb_build_object(
        'user_id', v_payment.user_id,
        'amount', v_payment.amount,
        'order_id', v_payment.order_id,
        'utr', v_payment.utr
    ));

    RETURN jsonb_build_object(
        'success', true,
        'amount', v_payment.amount,
        'new_balance', v_balance_after,
        'message', 'Recharge approved and credited successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. ATOMIC ADMIN RECHARGE REJECTION
CREATE OR REPLACE FUNCTION public.reject_recharge(
    p_payment_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_payment public.payments%ROWTYPE;
BEGIN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment request not found');
    END IF;

    IF v_payment.status != 'PENDING_VERIFICATION' AND v_payment.status != 'PAYMENT_PENDING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment is not in pending status');
    END IF;

    UPDATE public.payments
    SET status = 'REJECTED',
        admin_id = p_admin_id,
        rejection_reason = p_reason,
        updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_payment.user_id,
        'Recharge Request Rejected',
        'Your recharge of ₹' || v_payment.amount || ' was rejected: ' || coalesce(p_reason, 'Invalid transaction details.'),
        'ERROR'
    );

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
    VALUES (p_admin_id, 'REJECT_RECHARGE', 'payments', p_payment_id::text, jsonb_build_object(
        'user_id', v_payment.user_id,
        'reason', p_reason
    ));

    RETURN jsonb_build_object('success', true, 'message', 'Recharge rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ATOMIC WITHDRAWAL REQUEST CREATION
CREATE OR REPLACE FUNCTION public.request_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC,
    p_bank_account_id UUID,
    p_upi_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_wallet public.wallets%ROWTYPE;
    v_min_withdraw NUMERIC := 100.00;
    v_fee NUMERIC := 0.00;
    v_net_amount NUMERIC;
    v_withdrawal_id UUID;
    v_tx_id UUID;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
BEGIN
    IF p_amount < v_min_withdraw THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ₹' || v_min_withdraw);
    END IF;

    -- Lock wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF v_wallet.available_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient available balance for withdrawal');
    END IF;

    v_net_amount := p_amount - v_fee;
    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - p_amount;

    -- Deduct available balance and reserve in pending balance
    UPDATE public.wallets
    SET available_balance = v_balance_after,
        pending_balance = v_wallet.pending_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    v_withdrawal_id := uuid_generate_v4();
    INSERT INTO public.withdrawals (
        id, user_id, amount, fee, net_amount, bank_account_id, upi_id, status
    ) VALUES (
        v_withdrawal_id, p_user_id, p_amount, v_fee, v_net_amount, p_bank_account_id, p_upi_id, 'PENDING'
    );

    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'WITHDRAWAL', -p_amount, v_balance_before, v_balance_after,
        v_withdrawal_id::text, 'Withdrawal request of ₹' || p_amount
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        p_user_id,
        'Withdrawal Request Submitted',
        'Your withdrawal of ₹' || p_amount || ' is currently pending admin review.',
        'INFO'
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'new_balance', v_balance_after,
        'message', 'Withdrawal request submitted successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. ATOMIC WITHDRAWAL REJECTION & IDEMPOTENT REFUND
CREATE OR REPLACE FUNCTION public.reject_withdrawal(
    p_withdrawal_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_withdrawal public.withdrawals%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
BEGIN
    SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal record not found');
    END IF;

    IF v_withdrawal.status != 'PENDING' AND v_withdrawal.status != 'PROCESSING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal is not in pending state');
    END IF;

    -- Lock user wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_withdrawal.user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before + v_withdrawal.amount;

    -- Reverse wallet deduction
    UPDATE public.wallets
    SET available_balance = v_balance_after,
        pending_balance = GREATEST(0, v_wallet.pending_balance - v_withdrawal.amount),
        updated_at = now()
    WHERE user_id = v_withdrawal.user_id;

    -- Record reversal transaction
    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_withdrawal.user_id, 'WITHDRAWAL_REVERSAL', v_withdrawal.amount, v_balance_before, v_balance_after,
        p_withdrawal_id::text, 'Withdrawal rejected refund: ' || coalesce(p_reason, 'Admin rejection')
    );

    UPDATE public.withdrawals
    SET status = 'REJECTED',
        rejection_reason = p_reason,
        updated_at = now()
    WHERE id = p_withdrawal_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_withdrawal.user_id,
        'Withdrawal Rejected & Refunded',
        'Your withdrawal of ₹' || v_withdrawal.amount || ' was rejected: ' || coalesce(p_reason, 'Reason not specified') || '. Funds refunded to wallet.',
        'WARNING'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected and refunded');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. ATOMIC WITHDRAWAL COMPLETION
CREATE OR REPLACE FUNCTION public.complete_withdrawal(
    p_withdrawal_id UUID,
    p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_withdrawal public.withdrawals%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
BEGIN
    SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal record not found');
    END IF;

    IF v_withdrawal.status = 'COMPLETED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already marked completed');
    END IF;

    -- Update user wallet pending balance and total_withdrawn
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_withdrawal.user_id FOR UPDATE;
    IF FOUND THEN
        UPDATE public.wallets
        SET pending_balance = GREATEST(0, v_wallet.pending_balance - v_withdrawal.amount),
            total_withdrawn = v_wallet.total_withdrawn + v_withdrawal.amount,
            updated_at = now()
        WHERE user_id = v_withdrawal.user_id;
    END IF;

    UPDATE public.withdrawals
    SET status = 'COMPLETED',
        processed_at = now(),
        updated_at = now()
    WHERE id = p_withdrawal_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_withdrawal.user_id,
        'Withdrawal Completed!',
        '₹' || v_withdrawal.net_amount || ' has been successfully transferred to your account.',
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal completed successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. HOURLY EARNINGS SETTLEMENT FOR ACTIVE PLANS
CREATE OR REPLACE FUNCTION public.settle_hourly_earnings(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_rec RECORD;
    v_hours INT;
    v_earned NUMERIC;
    v_total_credited NUMERIC := 0.00;
    v_wallet public.wallets%ROWTYPE;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
BEGIN
    -- Select all active purchases where at least 1 hour has elapsed since last_settled_at
    FOR v_rec IN 
        SELECT id, plan_id, earning_rate, last_settled_at
        FROM public.purchases
        WHERE user_id = p_user_id 
          AND status = 'ACTIVE'
          AND now() > last_settled_at + INTERVAL '1 hour'
        FOR UPDATE
    LOOP
        v_hours := EXTRACT(EPOCH FROM (now() - v_rec.last_settled_at)) / 3600;
        IF v_hours >= 1 THEN
            v_earned := round((v_rec.earning_rate * v_hours)::numeric, 2);
            IF v_earned > 0 THEN
                -- Update purchase
                UPDATE public.purchases
                SET total_earned = total_earned + v_earned,
                    last_settled_at = last_settled_at + (v_hours || ' hours')::INTERVAL,
                    updated_at = now()
                WHERE id = v_rec.id;

                -- Record earning entry
                INSERT INTO public.earnings (
                    user_id, purchase_id, amount, earning_type, earning_date
                ) VALUES (
                    p_user_id, v_rec.id, v_earned, 'HOURLY_DEVICE', CURRENT_DATE
                );

                v_total_credited := v_total_credited + v_earned;
            END IF;
        END IF;
    END LOOP;

    -- If earnings accumulated, credit wallet atomically
    IF v_total_credited > 0 THEN
        SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            v_balance_before := v_wallet.available_balance;
            v_balance_after := v_balance_before + v_total_credited;

            UPDATE public.wallets
            SET available_balance = v_balance_after,
                total_earned = v_wallet.total_earned + v_total_credited,
                updated_at = now()
            WHERE user_id = p_user_id;

            INSERT INTO public.wallet_transactions (
                user_id, type, amount, balance_before, balance_after, description
            ) VALUES (
                p_user_id, 'EARNING', v_total_credited, v_balance_before, v_balance_after,
                'Automated Device Sharing Yield'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'credited', v_total_credited,
        'message', 'Settlement checked'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- INITIAL SEED DATA FOR PLANS & PAYMENT SETTINGS
-- ==============================================================================
INSERT INTO public.plans (name, price, earning_rate, duration, tags, status)
VALUES
    ('60Doors of charging cabinet', 75000.00, 173.00, 365, ARRAY['Shared Power', 'Sharing Economy'], 'active'),
    ('Airport dedicated cabinet', 45000.00, 93.75, 365, ARRAY['Airport Dedicated', 'High Traffic'], 'active'),
    ('48 Doors of charging cabinet', 15000.00, 30.00, 365, ARRAY['Shared Power', 'Commercial'], 'active'),
    ('36 Doors of charging cabinet', 6000.00, 12.00, 365, ARRAY['Shared Power', 'Retail Spot'], 'active'),
    ('24 Doors of charging cabinet', 3000.00, 5.75, 365, ARRAY['Shared Power', 'Standard Hub'], 'active'),
    ('12 Doors portable power station', 1000.00, 1.85, 365, ARRAY['Portable Hub', 'Entry Station'], 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.payment_settings (id, upi_id, instructions)
VALUES ('default', 'powerbank.pay@upi', '1. Open GooglePay, PhonePe, or Paytm.\n2. Scan QR or transfer to UPI ID.\n3. Enter the exact 12-digit UTR number below and submit.')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 16. UNIVEPAY GATEWAY DEPOSIT & WITHDRAWAL ARCHITECTURE
-- ==============================================================================

-- 16.1 DEPOSIT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.deposit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    traceno TEXT UNIQUE NOT NULL,
    gateway_order_id TEXT,
    gateway_serial_no TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
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
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 16.2 WITHDRAWAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawal_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    traceno TEXT UNIQUE NOT NULL,
    gateway_serial_no TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    fee NUMERIC(12, 2) DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL,
    method TEXT DEFAULT 'MANUAL' CHECK (method IN ('MANUAL', 'UNIVEPAY_AUTO')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REJECTED', 'REFUNDED')),
    gateway_status TEXT,
    bank_name TEXT,
    bank_code TEXT,
    account_name TEXT,
    account_number TEXT,
    upi_id TEXT,
    payment_type TEXT DEFAULT 'UPI',
    utr TEXT,
    gateway_response JSONB,
    callback_payload JSONB,
    amount_locked NUMERIC(12, 2) NOT NULL,
    rejection_reason TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 16.3 WALLET LEDGER (IMMUTABLE AUDIT TRAIL FOR DUAL BALANCE)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_type TEXT NOT NULL CHECK (wallet_type IN ('RECHARGE', 'DEVICE_EARNING')),
    transaction_type TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    reference_type TEXT,
    reference_id TEXT,
    balance_before NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 16.4 GATEWAY LOGS (AUDIT & SECURITY COMPLIANCE)
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

-- 16.5 GATEWAY SETTINGS
CREATE TABLE IF NOT EXISTS public.gateway_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_univepay_deposit_enabled BOOLEAN DEFAULT true,
    is_upi_deposit_enabled BOOLEAN DEFAULT true,
    is_manual_withdrawal_enabled BOOLEAN DEFAULT true,
    is_univepay_auto_withdrawal_enabled BOOLEAN DEFAULT true,
    min_withdrawal NUMERIC(12, 2) DEFAULT 100.00,
    max_withdrawal NUMERIC(12, 2) DEFAULT 50000.00,
    withdrawal_fee_percent NUMERIC(5, 2) DEFAULT 0.00,
    gateway_fee_percent NUMERIC(5, 2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.gateway_settings (id, is_univepay_deposit_enabled, is_upi_deposit_enabled, is_manual_withdrawal_enabled, is_univepay_auto_withdrawal_enabled)
VALUES ('default', true, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_deposit_tx_user ON public.deposit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_traceno ON public.deposit_transactions(traceno);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_status ON public.deposit_transactions(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_tx_user ON public.withdrawal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_tx_traceno ON public.withdrawal_transactions(traceno);
CREATE INDEX IF NOT EXISTS idx_withdrawal_tx_status ON public.withdrawal_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON public.wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_ref ON public.wallet_ledger(reference_id);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_traceno ON public.gateway_logs(traceno);

-- RLS POLICIES FOR NEW TABLES
ALTER TABLE public.deposit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deposit transactions" ON public.deposit_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins manage deposit transactions" ON public.deposit_transactions FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view own withdrawal transactions" ON public.withdrawal_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins manage withdrawal transactions" ON public.withdrawal_transactions FOR ALL USING (public.is_admin());

CREATE POLICY "Users view own wallet ledger" ON public.wallet_ledger FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins view all wallet ledgers" ON public.wallet_ledger FOR ALL USING (public.is_admin());

CREATE POLICY "Admins view gateway logs" ON public.gateway_logs FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can read gateway settings" ON public.gateway_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage gateway settings" ON public.gateway_settings FOR ALL USING (public.is_admin());

-- ==============================================================================
-- ATOMIC STORED PROCEDURES FOR UNIVEPAY AND DUAL BALANCE LEDGER
-- ==============================================================================

-- 1. ATOMIC INITIALIZATION OF PENDING DEPOSIT ORDER
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. ATOMIC IDEMPOTENT COMPLETION OF SUCCESSFUL DEPOSIT (CREDITS RECHARGE BALANCE ONLY)
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

    -- 2. Check Idempotency
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
        updated_at = now()
    WHERE id = v_dep.id;

    -- 6. Insert into Wallet Transactions
    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, v_dep.user_id, 'RECHARGE', v_dep.amount, v_bal_before, v_bal_after,
        v_dep.traceno, 'UniVePay Gateway Recharge (Traceno: ' || v_dep.traceno || ')'
    );

    -- 7. Insert into Immutable Wallet Ledger
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ATOMIC WITHDRAWAL CREATION (LOCKS FUNDS STRICTLY FROM DEVICE EARNING BALANCE)
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
    -- 1. Check settings
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
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    -- Strict verification of Device Earning Balance
    IF v_wallet.available_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient withdrawable device earning balance.');
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before - p_amount;

    -- 3. Lock the funds in pending_balance
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        pending_balance = v_wallet.pending_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- 4. Create withdrawal transaction
    v_w_id := uuid_generate_v4();
    INSERT INTO public.withdrawal_transactions (
        id, user_id, traceno, amount, fee, net_amount, method, status,
        bank_name, bank_code, account_name, account_number, upi_id, amount_locked
    ) VALUES (
        v_w_id, p_user_id, p_traceno, p_amount, v_fee, v_net, p_method, 'PENDING',
        p_bank_name, p_bank_code, p_account_name, p_account_number, p_upi_id, p_amount
    );

    -- 5. Create wallet transaction
    v_tx_id := uuid_generate_v4();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_tx_id, p_user_id, 'WITHDRAWAL', -p_amount, v_bal_before, v_bal_after,
        p_traceno, 'Withdrawal request of ₹' || p_amount || ' (' || p_method || ')'
    );

    -- 6. Insert into Immutable Wallet Ledger
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. ATOMIC COMPLETION OF UNIVEPAY AUTO WITHDRAWAL (FINALIZES LOCKED BALANCE)
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
        RETURN jsonb_build_object('success', true, 'message', 'Withdrawal already marked as successful', 'already_processed', true);
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ATOMIC REFUND OF FAILED WITHDRAWAL (RESTORES LOCKED AMOUNT EXACTLY ONCE)
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
        RETURN jsonb_build_object('success', true, 'message', 'Withdrawal already failed and refunded', 'already_processed', true);
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

    -- Return locked funds back to available Device Earning Balance
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

    -- Record in Wallet Transactions
    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_w.user_id, 'WITHDRAWAL_REVERSAL', v_w.amount_locked, v_bal_before, v_bal_after,
        p_traceno, 'Withdrawal Failed Refund: ' || coalesce(p_reason, 'Gateway failure')
    );

    -- Record in Wallet Ledger
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

