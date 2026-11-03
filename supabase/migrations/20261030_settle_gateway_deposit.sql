-- =========================================================================
-- GAINPOWER: SECURE ATOMIC GATEWAY DEPOSIT SETTLEMENT RPC
-- Migration: 20261030_settle_gateway_deposit.sql
-- =========================================================================

-- 1. Ensure performance indexes exist for fast O(1) order locking & reference checks
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_traceno_lookup
ON public.deposit_transactions (traceno, status);

CREATE INDEX IF NOT EXISTS idx_deposit_transactions_order_id_lookup
ON public.deposit_transactions (order_id, status);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_deposit_ref
ON public.wallet_ledger (reference_id, transaction_type, direction);

-- 2. Atomic Settlement Function
CREATE OR REPLACE FUNCTION public.settle_gateway_deposit(
    p_traceno TEXT,
    p_gateway_serial_no TEXT DEFAULT NULL,
    p_utr TEXT DEFAULT NULL,
    p_raw_response JSONB DEFAULT NULL,
    p_remark TEXT DEFAULT 'UniVePay deposit successful',
    p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_match_count INT;
    v_exact_traceno_count INT;
    v_deposit RECORD;
    v_wallet RECORD;
    v_user_id UUID;
    v_amount NUMERIC(14, 2);
    v_new_recharge NUMERIC(14, 2);
    v_new_available NUMERIC(14, 2);
    v_new_total_recharge NUMERIC(14, 2);
    v_existing_ledger RECORD;
    v_pending_tx_id UUID;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Input parameter validation
    IF p_traceno IS NULL OR TRIM(p_traceno) = '' THEN
        RAISE EXCEPTION 'TRACENO_REQUIRED';
    END IF;

    -- 2. UNAMBIGUOUS ORDER MATCHING
    -- Count how many distinct deposit records match across traceno, order_id, merchant_order_id
    SELECT COUNT(*), COUNT(DISTINCT id)
    INTO v_match_count, v_exact_traceno_count
    FROM public.deposit_transactions
    WHERE traceno = p_traceno OR order_id = p_traceno OR merchant_order_id = p_traceno;

    IF v_match_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ORDER_NOT_FOUND',
            'message', 'No deposit transaction found matching reference: ' || p_traceno
        );
    ELSIF v_match_count > 1 THEN
        -- Ambiguous match across multiple columns. Attempt exact match on traceno alone.
        SELECT COUNT(*) INTO v_exact_traceno_count
        FROM public.deposit_transactions
        WHERE traceno = p_traceno;

        IF v_exact_traceno_count = 1 THEN
            SELECT * INTO v_deposit
            FROM public.deposit_transactions
            WHERE traceno = p_traceno
            FOR UPDATE;
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'AMBIGUOUS_ORDER_MATCH',
                'message', 'Multiple distinct deposit records matched reference: ' || p_traceno
            );
        END IF;
    ELSE
        -- Exactly 1 record matched uniquely
        SELECT * INTO v_deposit
        FROM public.deposit_transactions
        WHERE traceno = p_traceno OR order_id = p_traceno OR merchant_order_id = p_traceno
        FOR UPDATE;
    END IF;

    -- 3. Idempotency Check: Already completed orders exit without crediting
    IF v_deposit.status IN ('SUCCESS', 'PAID', 'COMPLETED') THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'order_id', v_deposit.id,
            'traceno', v_deposit.traceno,
            'user_id', v_deposit.user_id,
            'amount', v_deposit.amount,
            'message', 'Deposit was already settled previously'
        );
    END IF;

    -- 4. Status Check: Must be in PENDING
    IF v_deposit.status != 'PENDING' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_ORDER_STATUS',
            'message', 'Deposit is in non-pending status: ' || v_deposit.status
        );
    END IF;

    v_user_id := v_deposit.user_id;
    v_amount := v_deposit.amount;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'DEPOSIT_HAS_NO_USER_ID';
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_DEPOSIT_AMOUNT';
    END IF;

    -- Gateway amount cross-verification (if gateway provided amount)
    IF p_amount IS NOT NULL AND ABS(p_amount - v_amount) > 0.05 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AMOUNT_MISMATCH',
            'message', 'Gateway amount (' || p_amount || ') does not match deposit order amount (' || v_amount || ')'
        );
    END IF;

    -- 5. RIGOROUS LEDGER IDEMPOTENCY CHECK (5 Financial Dimensions)
    -- Verify user_id, amount, wallet_type, direction, and reference match
    SELECT * INTO v_existing_ledger
    FROM public.wallet_ledger
    WHERE (reference_id = v_deposit.traceno OR reference_id = v_deposit.order_id)
      AND user_id = v_user_id
      AND amount = v_amount
      AND wallet_type = 'RECHARGE'
      AND direction = 'CREDIT'
      AND transaction_type = 'DEPOSIT_SUCCESS'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_ledger.id IS NOT NULL THEN
        -- Ledger entry exists and strictly matches all dimensions. Verify wallet exists and balance is consistent.
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_user_id
        FOR UPDATE;

        IF v_wallet.user_id IS NOT NULL THEN
            IF v_wallet.recharge_balance < v_amount THEN
                RAISE EXCEPTION 'CORRUPT_STATE_LEDGER_EXISTS_BUT_WALLET_BALANCE_INCONSISTENT';
            END IF;

            UPDATE public.deposit_transactions
            SET status = 'SUCCESS',
                gateway_status = 'SUCCESS',
                gateway_serial_no = COALESCE(p_gateway_serial_no, gateway_serial_no),
                utr = COALESCE(p_utr, utr),
                callback_received = true,
                completed_at = COALESCE(completed_at, v_now),
                updated_at = v_now
            WHERE id = v_deposit.id;

            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'reconciled_with_ledger', true,
                'order_id', v_deposit.id,
                'traceno', v_deposit.traceno,
                'user_id', v_user_id,
                'amount', v_amount,
                'ledger_id', v_existing_ledger.id
            );
        ELSE
            RAISE EXCEPTION 'CORRUPT_STATE_LEDGER_EXISTS_BUT_WALLET_MISSING';
        END IF;
    END IF;

    -- 6. CONCURRENCY-SAFE WALLET INITIALIZATION & EXCLUSIVE LOCK
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Insert with ON CONFLICT DO NOTHING to eliminate race conditions
        INSERT INTO public.wallets (
            user_id, recharge_balance, withdraw_balance, available_balance,
            pending_balance, total_earned, total_withdrawn, total_recharge,
            created_at, updated_at
        ) VALUES (
            v_user_id, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, v_now, v_now
        )
        ON CONFLICT (user_id) DO NOTHING;

        -- Re-select and lock the guaranteed row
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_user_id
        FOR UPDATE;
    END IF;

    -- 7. Exact Financial Invariant Calculations:
    -- Invariant: available_balance = recharge_balance + withdraw_balance
    -- withdraw_balance is STRICTLY PRESERVED and UNMODIFIED.
    v_new_recharge := +(COALESCE(v_wallet.recharge_balance, 0.00) + v_amount);
    v_new_available := +(v_new_recharge + COALESCE(v_wallet.withdraw_balance, 0.00));
    v_new_total_recharge := +(COALESCE(v_wallet.total_recharge, 0.00) + v_amount);

    -- 8. Atomically update wallet balances
    UPDATE public.wallets
    SET recharge_balance = v_new_recharge,
        available_balance = v_new_available,
        total_recharge = v_new_total_recharge,
        updated_at = v_now
    WHERE user_id = v_user_id;

    -- 9. Atomically mark deposit as SUCCESS
    UPDATE public.deposit_transactions
    SET status = 'SUCCESS',
        gateway_status = 'SUCCESS',
        gateway_serial_no = COALESCE(p_gateway_serial_no, gateway_serial_no),
        serial_no = COALESCE(p_gateway_serial_no, serial_no),
        utr = COALESCE(p_utr, utr),
        callback_received = true,
        signature_verified = true,
        raw_response = COALESCE(p_raw_response, raw_response),
        remark = COALESCE(p_remark, remark),
        completed_at = v_now,
        updated_at = v_now
    WHERE id = v_deposit.id;

    -- 10. EXACTLY-ONE WALLET_TRANSACTIONS UPDATE (Prevent silent multi-row updates)
    SELECT id INTO v_pending_tx_id
    FROM public.wallet_transactions
    WHERE user_id = v_user_id
      AND (reference_id = v_deposit.traceno OR reference_id = v_deposit.order_id)
      AND status = 'Pending'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_pending_tx_id IS NOT NULL THEN
        -- Update strictly this single targeted record
        UPDATE public.wallet_transactions
        SET status = 'Completed',
            balance_before = COALESCE(v_wallet.recharge_balance, 0.00),
            balance_after = v_new_recharge,
            reference_id = v_deposit.traceno,
            description = 'Topup Recharge of ₹' || TRIM(TO_CHAR(v_amount, '999999990.00')) || ' Credited to Recharge Wallet'
        WHERE id = v_pending_tx_id;

        -- Cancel any orphaned duplicate pending records for this reference
        UPDATE public.wallet_transactions
        SET status = 'Cancelled',
            description = 'Superseded duplicate pending transaction for ' || v_deposit.traceno
        WHERE user_id = v_user_id
          AND (reference_id = v_deposit.traceno OR reference_id = v_deposit.order_id)
          AND status = 'Pending'
          AND id != v_pending_tx_id;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.wallet_transactions
            WHERE user_id = v_user_id
              AND reference_id = v_deposit.traceno
              AND status = 'Completed'
        ) THEN
            INSERT INTO public.wallet_transactions (
                user_id, type, amount, balance_before, balance_after,
                wallet_type, reference_id, description, status, created_at
            ) VALUES (
                v_user_id, 'RECHARGE', v_amount,
                COALESCE(v_wallet.recharge_balance, 0.00), v_new_recharge,
                'TOPUP', v_deposit.traceno,
                'Topup Recharge of ₹' || TRIM(TO_CHAR(v_amount, '999999990.00')) || ' Credited to Recharge Wallet',
                'Completed', v_now
            );
        END IF;
    END IF;

    -- 11. Atomically insert immutable audit trail into wallet_ledger
    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction,
        reference_type, reference_id, balance_before, balance_after,
        description, created_at
    ) VALUES (
        v_user_id, 'RECHARGE', 'DEPOSIT_SUCCESS', v_amount, 'CREDIT',
        'GATEWAY_DEPOSIT', v_deposit.traceno,
        COALESCE(v_wallet.recharge_balance, 0.00), v_new_recharge,
        'UniVePay deposit successful (Order: ' || v_deposit.traceno || ')',
        v_now
    );

    -- 12. Also reconcile companion row in payments table if one exists
    UPDATE public.payments
    SET status = 'PAID',
        verified_at = v_now,
        updated_at = v_now
    WHERE (order_id = v_deposit.traceno OR reference_id = v_deposit.traceno)
      AND status IN ('PENDING', 'PENDING_VERIFICATION');

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'order_id', v_deposit.id,
        'traceno', v_deposit.traceno,
        'user_id', v_user_id,
        'amount', v_amount,
        'new_recharge_balance', v_new_recharge,
        'new_available_balance', v_new_available
    );
END;
$$;

-- Permissions and Security Hardening
REVOKE ALL ON FUNCTION public.settle_gateway_deposit(TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_gateway_deposit(TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC) TO service_role;

