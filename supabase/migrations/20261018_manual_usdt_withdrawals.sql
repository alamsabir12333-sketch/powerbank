-- ==============================================================================
-- GAINPOWER: MINIMAL ADDITIVE MANUAL USDT WITHDRAWAL MIGRATION
-- Safe & Idempotent: Adds dedicated USDT columns without modifying legacy columns
-- ==============================================================================

-- 1. Dedicated USDT columns on public.withdrawals (Null by default, preserving historical bank rows)
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS network VARCHAR(20) DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS usdt_address TEXT DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS usdt_amount NUMERIC(14, 4) DEFAULT 0.0000;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS usdt_rate NUMERIC(10, 2) DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS tx_hash TEXT DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12, 2) DEFAULT NULL;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- 2. Atomic Withdrawal Creation RPC (Strict Self-Only Authentication)
CREATE OR REPLACE FUNCTION public.request_usdt_withdrawal(
    p_user_id UUID,
    p_gross_amount NUMERIC(12, 2),
    p_network TEXT,
    p_usdt_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet public.wallets%ROWTYPE;
    v_sys_settings JSONB;
    v_usdt_settings JSONB;
    v_min_withdrawal NUMERIC;
    v_max_withdrawal NUMERIC;
    v_fee_pct NUMERIC;
    v_is_enabled BOOLEAN;
    v_usdt_rate NUMERIC;
    v_fee_inr NUMERIC;
    v_net_inr NUMERIC;
    v_usdt_amount NUMERIC;
    v_withdrawal_id UUID;
    v_tx_id UUID;
    v_clean_network TEXT;
    v_clean_address TEXT;
    v_new_withdraw NUMERIC;
    v_new_available NUMERIC;
    v_new_pending NUMERIC;
BEGIN
    -- 1. Strict Self-Only Authentication
    IF auth.role() = 'service_role' THEN
        -- Backend verified request (server verifies user JWT and fail-closed PIN)
        NULL;
    ELSIF auth.uid() IS NOT NULL AND auth.uid() = p_user_id THEN
        -- Direct user authenticated session
        NULL;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: A withdrawal must always target the authenticated user''s own ID.');
    END IF;

    -- 2. Gross Amount Validation (NULL & Non-Positive Safe)
    IF p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT: Gross withdrawal amount must be greater than zero.');
    END IF;

    -- 3. Whitelisted Network Check (Strict NULL & Blank Safe)
    v_clean_network := UPPER(BTRIM(COALESCE(p_network, '')));
    IF v_clean_network IS NULL OR v_clean_network = '' OR v_clean_network NOT IN ('TRC20', 'BEP20') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNSUPPORTED_NETWORK: Supported networks are TRC20 and BEP20.');
    END IF;

    -- 4. Address Syntax Validation (Strict NULL & Blank Safe)
    v_clean_address := BTRIM(COALESCE(p_usdt_address, ''));
    IF v_clean_address IS NULL OR v_clean_address = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ADDRESS: USDT destination address is required.');
    END IF;

    IF v_clean_network = 'TRC20' AND (v_clean_address !~ '^T[1-9A-HJ-NP-za-km-z]{33}$') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ADDRESS: Invalid TRC20 address. Must start with T and be exactly 34 characters.');
    END IF;
    IF v_clean_network = 'BEP20' AND (v_clean_address !~ '^0x[a-fA-F0-9]{40}$') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ADDRESS: Invalid BEP20 address. Must start with 0x and be exactly 42 characters.');
    END IF;

    -- 5. Read System Settings from admin_settings ('system')
    SELECT value INTO v_sys_settings FROM public.admin_settings WHERE id = 'system';
    IF v_sys_settings IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONFIG_UNAVAILABLE: System withdrawal settings are not configured in Admin Panel.');
    END IF;

    v_is_enabled := (v_sys_settings->>'isWithdrawalEnabled')::BOOLEAN;
    IF v_is_enabled IS NULL OR NOT v_is_enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'WITHDRAWALS_DISABLED: Withdrawals are currently disabled by administrator.');
    END IF;

    v_min_withdrawal := (v_sys_settings->>'minWithdrawal')::NUMERIC;
    v_max_withdrawal := (v_sys_settings->>'maxWithdrawal')::NUMERIC;
    v_fee_pct := (v_sys_settings->>'withdrawalFeePercent')::NUMERIC;

    IF v_min_withdrawal IS NULL OR v_min_withdrawal <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONFIG_INVALID: Minimum withdrawal limit is not configured in Admin Settings.');
    END IF;

    IF v_fee_pct IS NULL OR v_fee_pct < 0.00 OR v_fee_pct > 50.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONFIG_INVALID: Withdrawal fee percentage must be between 0% and 50%.');
    END IF;

    IF p_gross_amount < v_min_withdrawal THEN
        RETURN jsonb_build_object('success', false, 'error', 'AMOUNT_TOO_LOW: Minimum withdrawal amount is ₹' || v_min_withdrawal);
    END IF;
    IF v_max_withdrawal IS NOT NULL AND v_max_withdrawal > 0 AND p_gross_amount > v_max_withdrawal THEN
        RETURN jsonb_build_object('success', false, 'error', 'AMOUNT_TOO_HIGH: Maximum withdrawal amount is ₹' || v_max_withdrawal);
    END IF;

    -- 6. Read USDT Settings from admin_settings ('usdt_settings')
    SELECT value INTO v_usdt_settings FROM public.admin_settings WHERE id = 'usdt_settings';
    IF v_usdt_settings IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONFIG_UNAVAILABLE: USDT configuration is not available in Admin Settings.');
    END IF;

    IF (v_usdt_settings->>'isEnabled')::BOOLEAN IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'USDT_DISABLED: USDT operations are currently disabled in Admin Settings.');
    END IF;

    v_usdt_rate := (v_usdt_settings->>'usdtRate')::NUMERIC;
    IF v_usdt_rate IS NULL OR v_usdt_rate <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'CONFIG_INVALID: USDT conversion rate is unconfigured or invalid in Admin Settings.');
    END IF;

    -- 7. Calculate Financial Figures (Strict Invariant Validation)
    v_fee_inr := ROUND((p_gross_amount * (v_fee_pct / 100.0)), 2);
    v_net_inr := p_gross_amount - v_fee_inr;
    IF v_net_inr IS NULL OR v_net_inr <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_NET_AMOUNT: Net withdrawal amount after fee must be greater than zero.');
    END IF;

    v_usdt_amount := ROUND((v_net_inr / v_usdt_rate), 4);
    IF v_usdt_amount IS NULL OR v_usdt_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_USDT_AMOUNT: Calculated USDT amount must be greater than zero.');
    END IF;

    -- 8. Lock User Wallet & Check Balance
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND: User wallet does not exist.');
    END IF;

    IF COALESCE(v_wallet.withdraw_balance, 0.00) < p_gross_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE: Insufficient balance in Withdraw Wallet. Topup balance cannot be withdrawn.');
    END IF;

    -- 9. Atomic Wallet Balance Deductions
    v_new_withdraw  := v_wallet.withdraw_balance - p_gross_amount;
    v_new_available := COALESCE(v_wallet.recharge_balance, 0.00) + v_new_withdraw;
    v_new_pending   := COALESCE(v_wallet.pending_balance, 0.00) + p_gross_amount;

    UPDATE public.wallets
    SET withdraw_balance = v_new_withdraw,
        available_balance = v_new_available,
        pending_balance = v_new_pending,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- 10. Insert Withdrawal Record (Populates dedicated USDT columns, leaves bank fields empty)
    v_withdrawal_id := gen_random_uuid();
    INSERT INTO public.withdrawals (
        id, user_id, amount, fee, net_amount, actual_amount, status,
        network, usdt_address, usdt_amount, usdt_rate,
        account_number, ifsc_code, holder_name, bank_name,
        created_at, updated_at
    ) VALUES (
        v_withdrawal_id, p_user_id, p_gross_amount, v_fee_inr, v_net_inr, v_net_inr, 'PENDING',
        v_clean_network, v_clean_address, v_usdt_amount, v_usdt_rate,
        '', '', '', '',
        now(), now()
    );

    -- 11. Insert Ledger Transaction
    v_tx_id := gen_random_uuid();
    INSERT INTO public.wallet_transactions (
        id, user_id, type, amount, balance_before, balance_after,
        wallet_type, status, reference_id, description, created_at
    ) VALUES (
        v_tx_id, p_user_id, 'WITHDRAWAL', -p_gross_amount,
        v_wallet.withdraw_balance, v_new_withdraw,
        'WITHDRAWABLE', 'PENDING', v_withdrawal_id::TEXT,
        'USDT Withdrawal Request: ₹' || p_gross_amount || ' (' || v_usdt_amount || ' USDT to ' || v_clean_network || ')',
        now()
    );

    -- 12. Send User Notification
    INSERT INTO public.notifications (user_id, title, message, type, read, created_at)
    VALUES (
        p_user_id,
        'USDT Withdrawal Submitted',
        'Your withdrawal request of ' || v_usdt_amount || ' USDT (₹' || p_gross_amount || ') via ' || v_clean_network || ' is pending review.',
        'INFO', false, now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawalId', v_withdrawal_id,
        'grossAmountInr', p_gross_amount,
        'feeInr', v_fee_inr,
        'netAmountInr', v_net_inr,
        'usdtRate', v_usdt_rate,
        'usdtAmount', v_usdt_amount,
        'network', v_clean_network,
        'destinationAddress', v_clean_address
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_usdt_withdrawal(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_usdt_withdrawal(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;

-- ==============================================================================
-- 3. ATOMIC ADMIN APPROVAL RPC (STRICTLY SERVICE_ROLE ONLY)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.approve_usdt_withdrawal(
    p_withdrawal_id UUID,
    p_tx_hash TEXT,
    p_admin_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_w public.withdrawals%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_clean_tx TEXT;
    v_new_pending NUMERIC;
    v_new_total_withdrawn NUMERIC;
BEGIN
    v_clean_tx := TRIM(p_tx_hash);
    IF v_clean_tx IS NULL OR length(v_clean_tx) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TXID: Blockchain transaction hash (TXID) is mandatory (minimum 10 characters).');
    END IF;

    SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND: Withdrawal record not found.');
    END IF;

    IF v_w.status = 'COMPLETED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'ALREADY_COMPLETED: Withdrawal is already completed.', 'alreadyProcessed', true);
    END IF;

    IF v_w.status = 'REJECTED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ILLEGAL_TRANSITION: Cannot complete a previously rejected withdrawal.');
    END IF;

    IF v_w.status != 'PENDING' AND v_w.status != 'PROCESSING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATE: Withdrawal is not in PENDING state.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_w.user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND: User wallet does not exist.');
    END IF;

    IF v_wallet.pending_balance < v_w.amount THEN
        RAISE EXCEPTION 'ACCOUNTING_DISCREPANCY: pending_balance (%) is less than withdrawal amount (%)',
            v_wallet.pending_balance, v_w.amount;
    END IF;

    v_new_pending := v_wallet.pending_balance - v_w.amount;
    v_new_total_withdrawn := COALESCE(v_wallet.total_withdrawn, 0.00) + v_w.amount;

    UPDATE public.wallets
    SET pending_balance = v_new_pending,
        total_withdrawn = v_new_total_withdrawn,
        updated_at = now()
    WHERE user_id = v_w.user_id;

    UPDATE public.withdrawals
    SET status = 'COMPLETED',
        tx_hash = v_clean_tx,
        processed_at = now(),
        processed_by = p_admin_id,
        updated_at = now()
    WHERE id = p_withdrawal_id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        wallet_type, status, reference_id, description, created_at
    ) VALUES (
        v_w.user_id, 'WITHDRAWAL', v_w.amount,
        v_wallet.withdraw_balance, v_wallet.withdraw_balance,
        'WITHDRAWABLE', 'COMPLETED', v_clean_tx,
        'USDT Payout Disbursed: ' || COALESCE(v_w.usdt_amount, 0) || ' USDT (TXID: ' || v_clean_tx || ')',
        now()
    );

    INSERT INTO public.notifications (user_id, title, message, type, read, created_at)
    VALUES (
        v_w.user_id,
        'USDT Withdrawal Disbursed! 🚀',
        'Your withdrawal of ' || COALESCE(v_w.usdt_amount, 0) || ' USDT has been sent via ' || COALESCE(v_w.network, 'USDT') || '. TXID: ' || v_clean_tx,
        'SUCCESS', false, now()
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal completed and TXID recorded.');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_usdt_withdrawal(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_usdt_withdrawal(UUID, TEXT, TEXT) TO service_role;

-- ==============================================================================
-- 4. ATOMIC ADMIN REJECTION RPC (STRICTLY SERVICE_ROLE ONLY)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reject_usdt_withdrawal(
    p_withdrawal_id UUID,
    p_reason TEXT,
    p_admin_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_w public.withdrawals%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_clean_reason TEXT;
    v_new_pending NUMERIC;
    v_new_withdraw NUMERIC;
    v_new_available NUMERIC;
BEGIN
    v_clean_reason := TRIM(p_reason);
    IF v_clean_reason IS NULL OR length(v_clean_reason) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'MANDATORY_REASON: Rejection reason is required.');
    END IF;

    SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND: Withdrawal record not found.');
    END IF;

    IF v_w.status = 'REJECTED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'ALREADY_REJECTED: Withdrawal is already rejected.', 'alreadyProcessed', true);
    END IF;

    IF v_w.status = 'COMPLETED' OR v_w.status = 'PAID' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ILLEGAL_TRANSITION: Cannot refund an already completed withdrawal.');
    END IF;

    IF v_w.status != 'PENDING' AND v_w.status != 'PROCESSING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATE: Withdrawal is not in PENDING state.');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_w.user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND: User wallet does not exist.');
    END IF;

    IF v_wallet.pending_balance < v_w.amount THEN
        RAISE EXCEPTION 'ACCOUNTING_DISCREPANCY: pending_balance (%) is less than withdrawal amount (%)',
            v_wallet.pending_balance, v_w.amount;
    END IF;

    v_new_pending   := v_wallet.pending_balance - v_w.amount;
    v_new_withdraw  := v_wallet.withdraw_balance + v_w.amount;
    v_new_available := COALESCE(v_wallet.recharge_balance, 0.00) + v_new_withdraw;

    UPDATE public.wallets
    SET pending_balance = v_new_pending,
        withdraw_balance = v_new_withdraw,
        available_balance = v_new_available,
        updated_at = now()
    WHERE user_id = v_w.user_id;

    UPDATE public.withdrawals
    SET status = 'REJECTED',
        rejection_reason = v_clean_reason,
        rejected_reason = v_clean_reason,
        processed_at = now(),
        processed_by = p_admin_id,
        updated_at = now()
    WHERE id = p_withdrawal_id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        wallet_type, status, reference_id, description, created_at
    ) VALUES (
        v_w.user_id, 'WITHDRAWAL_REVERSAL', v_w.amount,
        v_wallet.withdraw_balance, v_new_withdraw,
        'WITHDRAWABLE', 'COMPLETED', v_w.id::TEXT,
        'Withdrawal Reversal (Refund): ' || v_clean_reason,
        now()
    );

    INSERT INTO public.notifications (user_id, title, message, type, read, created_at)
    VALUES (
        v_w.user_id,
        'Withdrawal Rejected & Refunded',
        'Your withdrawal of ₹' || v_w.amount || ' was rejected (' || v_clean_reason || '). Funds have been refunded to your Withdraw Wallet.',
        'WARNING', false, now()
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected and funds refunded to user wallet.');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_usdt_withdrawal(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_usdt_withdrawal(UUID, TEXT, TEXT) TO service_role;
