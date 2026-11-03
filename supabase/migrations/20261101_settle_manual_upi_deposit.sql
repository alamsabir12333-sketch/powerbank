-- =========================================================================
-- GAINPOWER: SECURE ATOMIC MANUAL UPI DEPOSIT SETTLEMENT RPC & UTR PROTECTION
-- Migration: 20261101_settle_manual_upi_deposit.sql
-- =========================================================================

-- 1. Performance and lookup indexes
-- Drop legacy composite index that included uncontrolled UTR text
DROP INDEX IF EXISTS public.idx_payments_lookup_order_utr;

-- Efficient index on order_id and status (avoids large text columns)
CREATE INDEX IF NOT EXISTS idx_payments_lookup_order_status
ON public.payments (order_id, status);

-- Index on user_id and status for user dashboard history
CREATE INDEX IF NOT EXISTS idx_payments_user_status
ON public.payments (user_id, status);

-- Lookup by UTR with strict length guard (banking UTR is never > 64 chars; protects against btree 2704 limit)
CREATE INDEX IF NOT EXISTS idx_payments_lookup_utr
ON public.payments (utr)
WHERE utr IS NOT NULL AND LENGTH(TRIM(utr)) <= 64;

-- 2. Scoped Database-Level Partial Unique Indexes to prevent concurrent duplicate UTRs
-- Scoped strictly to Manual UPI with length guard (6-64 chars) to eliminate ERROR 54000 from oversized legacy text/base64
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_manual_upi_utr_unique
ON public.payments (LOWER(TRIM(utr)))
WHERE utr IS NOT NULL 
  AND TRIM(utr) != '' 
  AND LENGTH(TRIM(utr)) BETWEEN 6 AND 64
  AND (payment_type = 'MANUAL_UPI' OR payment_method = 'UPI');

CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_transactions_manual_upi_utr_unique
ON public.deposit_transactions (LOWER(TRIM(utr)))
WHERE utr IS NOT NULL 
  AND TRIM(utr) != '' 
  AND LENGTH(TRIM(utr)) BETWEEN 6 AND 64
  AND (payment_type = 'MANUAL_UPI' OR channel = 'MANUAL_UPI' OR payment_method = 'UPI');

-- 3. Atomic Manual UPI Settlement Function
CREATE OR REPLACE FUNCTION public.settle_manual_upi_deposit(
    p_payment_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment RECORD;
    v_deposit RECORD;
    v_wallet RECORD;
    v_user_id UUID;
    v_amount NUMERIC(14, 2);
    v_order_id TEXT;
    v_utr TEXT;
    v_payment_id UUID := NULL;
    v_deposit_id UUID := NULL;
    v_dep_matches INT := 0;
    v_dep_distinct INT := 0;
    v_pay_matches INT := 0;
    v_pay_distinct INT := 0;
    v_admin_match_count INT := 0;
    v_cur_recharge NUMERIC(14, 2);
    v_cur_withdraw NUMERIC(14, 2);
    v_new_recharge NUMERIC(14, 2);
    v_new_available NUMERIC(14, 2);
    v_new_total_recharge NUMERIC(14, 2);
    v_existing_ledger RECORD;
    v_tx_updated INT := 0;
    v_ledger_id UUID;
    v_admin_profile RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Validate Input (FAIL CLOSED)
    IF p_payment_id IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_ID_REQUIRED: Missing deposit payment identifier.';
    END IF;

    IF p_admin_id IS NULL THEN
        RAISE EXCEPTION 'ADMIN_ID_REQUIRED: A verified administrator identity must be provided to approve deposits.';
    END IF;

    -- 2. Unambiguous Admin Identity & Role Authorization (FAIL CLOSED)
    SELECT COUNT(*)
    INTO v_admin_match_count
    FROM public.profiles
    WHERE id = p_admin_id OR user_id = p_admin_id;

    IF v_admin_match_count = 0 THEN
        RAISE EXCEPTION 'ADMIN_PROFILE_NOT_FOUND: Admin ID % does not exist in profiles.', p_admin_id;
    END IF;

    IF v_admin_match_count > 1 THEN
        RAISE EXCEPTION 'AMBIGUOUS_ADMIN_IDENTITY: Admin ID % matched % distinct profile records.', p_admin_id, v_admin_match_count;
    END IF;

    SELECT id, role INTO v_admin_profile
    FROM public.profiles
    WHERE id = p_admin_id OR user_id = p_admin_id
    LIMIT 1;

    IF v_admin_profile.role IS NULL OR v_admin_profile.role NOT IN ('admin', 'support', 'superadmin', 'manager') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ADMIN_ROLE: Role % is not authorized to approve deposits.', COALESCE(v_admin_profile.role, 'NULL');
    END IF;

    -- 3. Deterministic Identifier Resolution (Step A: Preliminary Lookup Without Locks)
    SELECT id, user_id, amount, order_id, COALESCE(utr, utr_number) AS utr
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_payment.id IS NOT NULL THEN
        v_payment_id := v_payment.id;
        v_user_id := v_payment.user_id;
        v_amount := v_payment.amount;
        v_order_id := v_payment.order_id;
        v_utr := v_payment.utr;

        -- Resolve companion deposit_transactions record if one exists
        IF v_order_id IS NOT NULL OR v_utr IS NOT NULL THEN
            SELECT COUNT(*), COUNT(DISTINCT id)
            INTO v_dep_matches, v_dep_distinct
            FROM public.deposit_transactions
            WHERE (v_order_id IS NOT NULL AND (order_id = v_order_id OR traceno = v_order_id))
               OR (v_utr IS NOT NULL AND utr = v_utr);

            IF v_dep_distinct > 1 THEN
                RAISE EXCEPTION 'AMBIGUOUS_COMPANION_DEPOSIT: Multiple distinct deposit_transactions (%) match payment order %', v_dep_distinct, v_order_id;
            ELSIF v_dep_distinct = 1 THEN
                SELECT id INTO v_deposit_id
                FROM public.deposit_transactions
                WHERE (v_order_id IS NOT NULL AND (order_id = v_order_id OR traceno = v_order_id))
                   OR (v_utr IS NOT NULL AND utr = v_utr)
                LIMIT 1;
            END IF;
        END IF;
    ELSE
        SELECT id, user_id, amount, COALESCE(order_id, traceno) AS order_id, utr
        INTO v_deposit
        FROM public.deposit_transactions
        WHERE id = p_payment_id;

        IF v_deposit.id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'PAYMENT_NOT_FOUND',
                'message', 'No manual deposit found with ID: ' || p_payment_id::text
            );
        END IF;

        v_deposit_id := v_deposit.id;
        v_user_id := v_deposit.user_id;
        v_amount := v_deposit.amount;
        v_order_id := v_deposit.order_id;
        v_utr := v_deposit.utr;

        -- Resolve companion payments record if one exists
        IF v_order_id IS NOT NULL OR v_utr IS NOT NULL THEN
            SELECT COUNT(*), COUNT(DISTINCT id)
            INTO v_pay_matches, v_pay_distinct
            FROM public.payments
            WHERE (v_order_id IS NOT NULL AND order_id = v_order_id)
               OR (v_utr IS NOT NULL AND (utr = v_utr OR utr_number = v_utr));

            IF v_pay_distinct > 1 THEN
                RAISE EXCEPTION 'AMBIGUOUS_COMPANION_PAYMENT: Multiple distinct payments (%) match deposit order %', v_pay_distinct, v_order_id;
            ELSIF v_pay_distinct = 1 THEN
                SELECT id INTO v_payment_id
                FROM public.payments
                WHERE (v_order_id IS NOT NULL AND order_id = v_order_id)
                   OR (v_utr IS NOT NULL AND (utr = v_utr OR utr_number = v_utr))
                LIMIT 1;
            END IF;
        END IF;
    END IF;

    -- 4. DETERMINISTIC LOCK HIERARCHY (Step B: Strict Consistent Lock Order)
    -- Hierarchy 1: public.payments (ALWAYS FIRST)
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment
        FROM public.payments
        WHERE id = v_payment_id
        FOR UPDATE;

        IF v_payment.id IS NULL THEN
            RAISE EXCEPTION 'PAYMENT_CONCURRENTLY_REMOVED: Payment record % no longer exists.', v_payment_id;
        END IF;

        v_user_id := v_payment.user_id;
        v_amount := v_payment.amount;
        v_order_id := v_payment.order_id;
        v_utr := COALESCE(v_payment.utr, v_payment.utr_number);
    END IF;

    -- Hierarchy 2: public.deposit_transactions (ALWAYS SECOND)
    IF v_deposit_id IS NOT NULL THEN
        SELECT * INTO v_deposit
        FROM public.deposit_transactions
        WHERE id = v_deposit_id
        FOR UPDATE;

        IF v_deposit.id IS NULL THEN
            RAISE EXCEPTION 'DEPOSIT_CONCURRENTLY_REMOVED: Deposit record % no longer exists.', v_deposit_id;
        END IF;

        IF v_user_id IS NULL THEN
            v_user_id := v_deposit.user_id;
            v_amount := v_deposit.amount;
            v_order_id := COALESCE(v_deposit.order_id, v_deposit.traceno);
            v_utr := v_deposit.utr;
        END IF;
    END IF;

    -- 5. Post-Lock Companion Consistency Validation (Step C)
    IF v_payment.id IS NOT NULL AND v_deposit.id IS NOT NULL THEN
        IF v_payment.user_id != v_deposit.user_id THEN
            RAISE EXCEPTION 'COMPANION_USER_MISMATCH: Payment user (%) != Deposit user (%).', v_payment.user_id, v_deposit.user_id;
        END IF;

        IF ROUND(v_payment.amount, 2) != ROUND(v_deposit.amount, 2) THEN
            RAISE EXCEPTION 'COMPANION_AMOUNT_MISMATCH: Payment amount (%) != Deposit amount (%).', v_payment.amount, v_deposit.amount;
        END IF;

        IF v_payment.order_id IS NOT NULL AND COALESCE(v_deposit.order_id, v_deposit.traceno) IS NOT NULL AND
           v_payment.order_id != COALESCE(v_deposit.order_id, v_deposit.traceno) THEN
            RAISE EXCEPTION 'COMPANION_ORDER_MISMATCH: Payment order (%) != Deposit order (%).', v_payment.order_id, COALESCE(v_deposit.order_id, v_deposit.traceno);
        END IF;

        IF COALESCE(v_payment.utr, v_payment.utr_number) IS NOT NULL AND v_deposit.utr IS NOT NULL AND
           LOWER(TRIM(COALESCE(v_payment.utr, v_payment.utr_number))) != LOWER(TRIM(v_deposit.utr)) THEN
            RAISE EXCEPTION 'COMPANION_UTR_MISMATCH: Payment UTR (%) != Deposit UTR (%).', COALESCE(v_payment.utr, v_payment.utr_number), v_deposit.utr;
        END IF;
    END IF;

    -- Validate User and Amount
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'DEPOSIT_HAS_NO_USER_ID';
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_DEPOSIT_AMOUNT';
    END IF;

    -- 6. Status Validation & Idempotency: Already Completed Check
    IF (v_payment.id IS NOT NULL AND v_payment.status IN ('PAID', 'SUCCESS', 'COMPLETED')) OR
       (v_deposit.id IS NOT NULL AND v_deposit.status IN ('PAID', 'SUCCESS', 'COMPLETED')) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'already_approved', true,
            'payment_id', COALESCE(v_payment_id, v_deposit_id),
            'order_id', v_order_id,
            'user_id', v_user_id,
            'amount', v_amount,
            'message', 'Recharge was already approved previously.'
        );
    END IF;

    -- Check for Terminated Status (Rejected, Cancelled, Failed)
    IF (v_payment.id IS NOT NULL AND v_payment.status IN ('REJECTED', 'CANCELLED', 'FAILED')) OR
       (v_deposit.id IS NOT NULL AND v_deposit.status IN ('REJECTED', 'CANCELLED', 'FAILED')) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PAYMENT_ALREADY_TERMINATED',
            'message', 'Cannot approve a deposit that has already been rejected, cancelled, or failed.'
        );
    END IF;

    -- 6. Rigorous Ledger Idempotency Check (5 Financial Dimensions)
    -- Verify user_id, amount, wallet_type, direction, and reference match
    SELECT * INTO v_existing_ledger
    FROM public.wallet_ledger
    WHERE (reference_id = v_order_id OR (v_utr IS NOT NULL AND reference_id = v_utr) OR reference_id = p_payment_id::text)
      AND user_id = v_user_id
      AND amount = v_amount
      AND wallet_type = 'RECHARGE'
      AND direction = 'CREDIT'
      AND transaction_type = 'DEPOSIT_SUCCESS'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_ledger.id IS NOT NULL THEN
        -- Ledger already credited. Reconcile statuses safely without double crediting.
        IF v_payment_id IS NOT NULL THEN
            UPDATE public.payments
            SET status = 'PAID',
                verified_at = COALESCE(verified_at, v_now),
                verified_by = COALESCE(verified_by, p_admin_id),
                updated_at = v_now
            WHERE id = v_payment_id;
        END IF;

        IF v_deposit_id IS NOT NULL THEN
            UPDATE public.deposit_transactions
            SET status = 'SUCCESS',
                gateway_status = 'SUCCESS',
                completed_at = COALESCE(completed_at, v_now),
                updated_at = v_now
            WHERE id = v_deposit_id;
        END IF;

        -- Update any pending transaction record to Completed
        UPDATE public.wallet_transactions
        SET status = 'Completed'
        WHERE user_id = v_user_id
          AND (reference_id = v_order_id OR (v_utr IS NOT NULL AND reference_id = v_utr) OR reference_id = p_payment_id::text)
          AND status = 'Pending';

        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'already_credited', true,
            'reconciled_with_ledger', true,
            'payment_id', COALESCE(v_payment_id, v_deposit_id),
            'order_id', v_order_id,
            'user_id', v_user_id,
            'amount', v_amount,
            'ledger_id', v_existing_ledger.id,
            'message', 'Already processed and reconciled with existing ledger entry.'
        );
    END IF;

    -- 7. Concurrency-Safe Wallet Initialization & Exclusive Row Lock (SELECT ... FOR UPDATE)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Concurrency-safe insert with ON CONFLICT DO NOTHING
        INSERT INTO public.wallets (
            user_id, recharge_balance, withdraw_balance, available_balance,
            pending_balance, total_earned, total_withdrawn, total_recharge,
            created_at, updated_at
        ) VALUES (
            v_user_id, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, v_now, v_now
        )
        ON CONFLICT (user_id) DO NOTHING;

        -- Re-select with exclusive lock
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_user_id
        FOR UPDATE;
    END IF;

    -- 8. Financial Invariants:
    -- Invariant: available_balance = recharge_balance + withdraw_balance
    -- withdraw_balance is STRICTLY PRESERVED and NEVER modified.
    v_cur_recharge := COALESCE(v_wallet.recharge_balance, 0.00);
    v_cur_withdraw := COALESCE(v_wallet.withdraw_balance, 0.00);
    v_new_recharge := +(v_cur_recharge + v_amount);
    v_new_available := +(v_new_recharge + v_cur_withdraw);
    v_new_total_recharge := +(COALESCE(v_wallet.total_recharge, 0.00) + v_amount);

    -- 9. Atomically Update Wallet Balance
    UPDATE public.wallets
    SET recharge_balance = v_new_recharge,
        available_balance = v_new_available,
        total_recharge = v_new_total_recharge,
        updated_at = v_now
    WHERE user_id = v_user_id;

    -- 10. Atomically Update payments Record
    IF v_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET status = 'PAID',
            verified_at = v_now,
            verified_by = p_admin_id,
            updated_at = v_now
        WHERE id = v_payment_id;
    END IF;

    -- 11. Atomically Update companion deposit_transactions Record
    IF v_deposit_id IS NOT NULL THEN
        UPDATE public.deposit_transactions
        SET status = 'SUCCESS',
            gateway_status = 'SUCCESS',
            completed_at = v_now,
            updated_at = v_now
        WHERE id = v_deposit_id;
    END IF;

    -- 12. Atomically Update or Insert wallet_transactions Record
    UPDATE public.wallet_transactions
    SET status = 'Completed',
        balance_before = v_cur_recharge,
        balance_after = v_new_recharge,
        description = '⚡ Admin Approved Topup: ₹' || TRIM(TO_CHAR(v_amount, 'FM999999990.00')) || ' (UTR: ' || COALESCE(v_utr, 'N/A') || ')'
    WHERE id IN (
        SELECT id FROM public.wallet_transactions
        WHERE user_id = v_user_id
          AND (reference_id = v_order_id OR (v_utr IS NOT NULL AND reference_id = v_utr) OR reference_id = p_payment_id::text)
          AND status = 'Pending'
        ORDER BY created_at DESC
        LIMIT 1
    );

    GET DIAGNOSTICS v_tx_updated = ROW_COUNT;

    IF v_tx_updated = 0 THEN
        INSERT INTO public.wallet_transactions (
            user_id, type, amount, balance_before, balance_after,
            wallet_type, status, reference_id, description, created_at
        ) VALUES (
            v_user_id, 'RECHARGE', v_amount, v_cur_recharge, v_new_recharge,
            'TOPUP', 'Completed', v_order_id,
            '⚡ Admin Approved Topup: ₹' || TRIM(TO_CHAR(v_amount, 'FM999999990.00')) || ' (UTR: ' || COALESCE(v_utr, 'N/A') || ')',
            v_now
        );
    END IF;

    -- 13. Atomically Insert Exactly One Immutable wallet_ledger Audit Record
    INSERT INTO public.wallet_ledger (
        user_id, wallet_type, transaction_type, amount, direction,
        reference_type, reference_id, balance_before, balance_after,
        description, created_at
    ) VALUES (
        v_user_id, 'RECHARGE', 'DEPOSIT_SUCCESS', v_amount, 'CREDIT',
        'MANUAL_UPI_DEPOSIT', v_order_id, v_cur_recharge, v_new_recharge,
        'Admin Approved Manual UPI Recharge: ₹' || TRIM(TO_CHAR(v_amount, 'FM999999990.00')) || ' (UTR: ' || COALESCE(v_utr, 'N/A') || ')',
        v_now
    ) RETURNING id INTO v_ledger_id;

    -- 14. Insert User Notification (Safely handles schema variations: read vs is_read)
    BEGIN
        INSERT INTO public.notifications (
            user_id, title, message, type, read, created_at
        ) VALUES (
            v_user_id, 'Topup Approved! ⚡',
            'Your recharge of ₹' || TRIM(TO_CHAR(v_amount, 'FM999999990.00')) || ' has been verified and added to your Recharge Wallet.',
            'SUCCESS', false, v_now
        );
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO public.notifications (
                user_id, title, message, type, is_read, created_at
            ) VALUES (
                v_user_id, 'Topup Approved! ⚡',
                'Your recharge of ₹' || TRIM(TO_CHAR(v_amount, 'FM999999990.00')) || ' has been verified and added to your Recharge Wallet.',
                'SUCCESS', false, v_now
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Notification insert failure must never roll back completed wallet credit
        END;
    END;

    -- 15. Return Final Ledger Snapshot
    RETURN jsonb_build_object(
        'success', true,
        'payment_id', COALESCE(v_payment_id, v_deposit_id),
        'user_id', v_user_id,
        'order_id', v_order_id,
        'amount', v_amount,
        'recharge_balance', v_new_recharge,
        'withdraw_balance', v_cur_withdraw,
        'available_balance', v_new_available,
        'ledger_id', v_ledger_id,
        'message', 'Manual UPI deposit approved and credited atomically.'
    );
END;
$$;

-- 4. Function Permissions & Grant
-- Strictly restrict execution to backend service_role only. Untrusted clients, anon, and authenticated users cannot invoke this RPC directly.
REVOKE ALL ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) TO service_role;

