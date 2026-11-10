-- =========================================================================
-- GAINPOWER: FIX UNASSIGNED RECORD VARIABLES IN MANUAL UPI SETTLEMENT & REJECTION
-- Migration: 20261110_fix_unassigned_record_variables.sql
-- Status: STANDALONE PATCH FOR USER APPROVAL - DO NOT EXECUTE AUTOMATICALLY
-- =========================================================================

-- 1. Settle Manual UPI Deposit RPC (Hardened with Scalar Status Variables)
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
    v_payment_status TEXT := NULL;
    v_deposit_status TEXT := NULL;
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

    -- Defense-in-Depth: Caller Identity Verification
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ANONYMOUS_ACCESS: Anonymous callers are strictly forbidden from manual UPI settlement.';
    END IF;

    IF auth.role() = 'authenticated' THEN
        IF auth.uid() IS NULL OR (auth.uid() != p_admin_id AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND id = p_admin_id
        )) THEN
            RAISE EXCEPTION 'PRIVILEGE_ESCALATION_DETECTED: Authenticated caller % is not authorized to act as administrator %', auth.uid(), p_admin_id;
        END IF;
    END IF;

    -- 3. Deterministic Identifier Resolution (Step A: Preliminary Lookup Without Locks)
    SELECT id, user_id, amount, order_id, COALESCE(utr, utr_number) AS utr, status
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_payment.id IS NOT NULL THEN
        v_payment_id := v_payment.id;
        v_user_id := v_payment.user_id;
        v_amount := v_payment.amount;
        v_order_id := v_payment.order_id;
        v_utr := v_payment.utr;
        v_payment_status := UPPER(TRIM(COALESCE(v_payment.status, '')));

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
                SELECT id, status INTO v_deposit_id, v_deposit_status
                FROM public.deposit_transactions
                WHERE (v_order_id IS NOT NULL AND (order_id = v_order_id OR traceno = v_order_id))
                   OR (v_utr IS NOT NULL AND utr = v_utr)
                LIMIT 1;
                v_deposit_status := UPPER(TRIM(COALESCE(v_deposit_status, '')));
            END IF;
        END IF;
    ELSE
        SELECT id, user_id, amount, COALESCE(order_id, traceno) AS order_id, utr, status
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
        v_deposit_status := UPPER(TRIM(COALESCE(v_deposit.status, '')));

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
                SELECT id, status INTO v_payment_id, v_payment_status
                FROM public.payments
                WHERE (v_order_id IS NOT NULL AND order_id = v_order_id)
                   OR (v_utr IS NOT NULL AND (utr = v_utr OR utr_number = v_utr))
                LIMIT 1;
                v_payment_status := UPPER(TRIM(COALESCE(v_payment_status, '')));
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
        v_payment_status := UPPER(TRIM(COALESCE(v_payment.status, '')));
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
        v_deposit_status := UPPER(TRIM(COALESCE(v_deposit.status, '')));
    END IF;

    -- 5. Post-Lock Companion Consistency Validation (Step C)
    IF v_payment_id IS NOT NULL AND v_deposit_id IS NOT NULL THEN
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

    -- 6. Status Validation & Idempotency Using Safe Scalar Variables (Eliminates Error 55000)
    IF (v_payment_status IS NOT NULL AND v_payment_status IN ('PAID', 'SUCCESS', 'COMPLETED')) OR
       (v_deposit_status IS NOT NULL AND v_deposit_status IN ('PAID', 'SUCCESS', 'COMPLETED')) THEN
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

    -- Check for Terminated Status Using Safe Scalar Variables
    IF (v_payment_status IS NOT NULL AND v_payment_status IN ('REJECTED', 'CANCELLED', 'FAILED')) OR
       (v_deposit_status IS NOT NULL AND v_deposit_status IN ('REJECTED', 'CANCELLED', 'FAILED')) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PAYMENT_ALREADY_TERMINATED',
            'message', 'Cannot approve a deposit that has already been rejected, cancelled, or failed.'
        );
    END IF;

    -- 7. Rigorous Ledger Idempotency Check (5 Financial Dimensions)
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

    -- 8. Concurrency-Safe Wallet Initialization & Exclusive Row Lock (SELECT ... FOR UPDATE)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.wallets (
            user_id, recharge_balance, withdraw_balance, available_balance,
            pending_balance, total_earned, total_withdrawn, total_recharge,
            created_at, updated_at
        ) VALUES (
            v_user_id, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, v_now, v_now
        )
        ON CONFLICT (user_id) DO NOTHING;

        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_user_id
        FOR UPDATE;
    END IF;

    -- 9. Financial Invariants:
    -- Invariant: available_balance = recharge_balance + withdraw_balance
    -- withdraw_balance is STRICTLY PRESERVED and NEVER modified.
    v_cur_recharge := COALESCE(v_wallet.recharge_balance, 0.00);
    v_cur_withdraw := COALESCE(v_wallet.withdraw_balance, 0.00);
    v_new_recharge := +(v_cur_recharge + v_amount);
    v_new_available := +(v_new_recharge + v_cur_withdraw);
    v_new_total_recharge := +(COALESCE(v_wallet.total_recharge, 0.00) + v_amount);

    -- 10. Atomically Update Wallet Balance
    UPDATE public.wallets
    SET recharge_balance = v_new_recharge,
        available_balance = v_new_available,
        total_recharge = v_new_total_recharge,
        updated_at = v_now
    WHERE user_id = v_user_id;

    -- 11. Atomically Update payments Record
    IF v_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET status = 'PAID',
            verified_at = v_now,
            verified_by = p_admin_id,
            updated_at = v_now
        WHERE id = v_payment_id;
    END IF;

    -- 12. Atomically Update companion deposit_transactions Record
    IF v_deposit_id IS NOT NULL THEN
        UPDATE public.deposit_transactions
        SET status = 'SUCCESS',
            gateway_status = 'SUCCESS',
            completed_at = v_now,
            updated_at = v_now
        WHERE id = v_deposit_id;
    END IF;

    -- 13. Atomically Update or Insert wallet_transactions Record
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

    -- 14. Atomically Insert Exactly One Immutable wallet_ledger Audit Record
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

    -- 15. Insert User Notification (Safely handles schema variations: read vs is_read)
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
            NULL; -- Notification failure never aborts settlement
        END;
    END;

    -- 16. Return Final Ledger Snapshot
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

-- Security Grants: Exclusively service_role
REVOKE ALL ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_manual_upi_deposit(UUID, UUID) TO service_role;


-- 2. Reject Manual UPI Deposit RPC (Hardened with Scalar Status Variables)
CREATE OR REPLACE FUNCTION public.reject_manual_upi_deposit(
    p_payment_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Verification Failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment RECORD;
    v_deposit RECORD;
    v_payment_id UUID := NULL;
    v_deposit_id UUID := NULL;
    v_payment_status TEXT := NULL;
    v_deposit_status TEXT := NULL;
    v_user_id UUID := NULL;
    v_order_id TEXT := NULL;
    v_utr TEXT := NULL;
    v_amount NUMERIC(14, 2) := 0;
    v_admin_match_count INT := 0;
    v_admin_profile RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_clean_reason TEXT;
BEGIN
    -- 1. Validate Input (FAIL CLOSED)
    IF p_payment_id IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_ID_REQUIRED: Missing deposit payment identifier.';
    END IF;

    IF p_admin_id IS NULL THEN
        RAISE EXCEPTION 'ADMIN_ID_REQUIRED: A verified administrator identity must be provided to reject deposits.';
    END IF;

    v_clean_reason := COALESCE(NULLIF(TRIM(p_reason), ''), 'Verification Failed');

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
        RAISE EXCEPTION 'UNAUTHORIZED_ADMIN_ROLE: Role % is not authorized to reject deposits.', COALESCE(v_admin_profile.role, 'NULL');
    END IF;

    -- Defense-in-Depth: Caller Identity Verification
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ANONYMOUS_ACCESS: Anonymous callers are strictly forbidden from manual UPI rejection.';
    END IF;

    IF auth.role() = 'authenticated' THEN
        IF auth.uid() IS NULL OR (auth.uid() != p_admin_id AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND id = p_admin_id
        )) THEN
            RAISE EXCEPTION 'PRIVILEGE_ESCALATION_DETECTED: Authenticated caller % is not authorized to act as administrator %', auth.uid(), p_admin_id;
        END IF;
    END IF;

    -- 3. Deterministic Identifier Resolution (Check payments, then deposit_transactions)
    SELECT id, user_id, amount, order_id, COALESCE(utr, utr_number) AS utr, status
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_payment.id IS NOT NULL THEN
        v_payment_id := v_payment.id;
        v_user_id := v_payment.user_id;
        v_amount := v_payment.amount;
        v_order_id := v_payment.order_id;
        v_utr := v_payment.utr;
        v_payment_status := UPPER(TRIM(COALESCE(v_payment.status, '')));

        -- Resolve companion deposit_transactions record if exists by order_id or utr
        IF v_order_id IS NOT NULL OR v_utr IS NOT NULL THEN
            SELECT id, status INTO v_deposit_id, v_deposit_status
            FROM public.deposit_transactions
            WHERE (v_order_id IS NOT NULL AND (order_id = v_order_id OR traceno = v_order_id))
               OR (v_utr IS NOT NULL AND utr = v_utr)
            LIMIT 1;
            v_deposit_status := UPPER(TRIM(COALESCE(v_deposit_status, '')));
        END IF;
    ELSE
        SELECT id, user_id, amount, COALESCE(order_id, traceno) AS order_id, utr, status
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
        v_deposit_status := UPPER(TRIM(COALESCE(v_deposit.status, '')));

        -- Resolve companion payments record if exists by order_id or utr
        IF v_order_id IS NOT NULL OR v_utr IS NOT NULL THEN
            SELECT id, status INTO v_payment_id, v_payment_status
            FROM public.payments
            WHERE (v_order_id IS NOT NULL AND order_id = v_order_id)
               OR (v_utr IS NOT NULL AND (utr = v_utr OR utr_number = v_utr))
            LIMIT 1;
            v_payment_status := UPPER(TRIM(COALESCE(v_payment_status, '')));
        END IF;
    END IF;

    -- 4. DETERMINISTIC LOCK HIERARCHY (payments first, deposit_transactions second)
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment
        FROM public.payments
        WHERE id = v_payment_id
        FOR UPDATE;
        v_payment_status := UPPER(TRIM(COALESCE(v_payment.status, '')));
    END IF;

    IF v_deposit_id IS NOT NULL THEN
        SELECT * INTO v_deposit
        FROM public.deposit_transactions
        WHERE id = v_deposit_id
        FOR UPDATE;
        v_deposit_status := UPPER(TRIM(COALESCE(v_deposit.status, '')));
    END IF;

    -- 5. Terminal State Guards Using Safe Scalar Variables (Eliminates Error 55000)
    IF (v_payment_status IS NOT NULL AND v_payment_status IN ('PAID', 'SUCCESS', 'COMPLETED'))
       OR (v_deposit_status IS NOT NULL AND v_deposit_status IN ('SUCCESS', 'COMPLETED', 'PAID')) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PAYMENT_ALREADY_APPROVED',
            'message', 'Cannot reject an already approved deposit.'
        );
    END IF;

    IF (v_payment_status IS NOT NULL AND v_payment_status IN ('REJECTED', 'FAILED'))
       AND (v_deposit_status IS NULL OR v_deposit_status IN ('REJECTED', 'FAILED')) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_rejected', true,
            'payment_id', COALESCE(v_payment_id, v_deposit_id),
            'message', 'Deposit request was already rejected previously.'
        );
    END IF;

    -- 6. Atomically Update Records to REJECTED (NO wallet balance modified)
    IF v_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET status = 'REJECTED',
            rejection_reason = v_clean_reason,
            admin_id = p_admin_id,
            verified_by = p_admin_id,
            verified_at = v_now,
            updated_at = v_now
        WHERE id = v_payment_id;
    END IF;

    IF v_deposit_id IS NOT NULL THEN
        UPDATE public.deposit_transactions
        SET status = 'REJECTED',
            failure_reason = v_clean_reason,
            verified_by = p_admin_id,
            verified_at = v_now,
            updated_at = v_now
        WHERE id = v_deposit_id;
    END IF;

    -- Update any pending wallet transaction
    IF v_order_id IS NOT NULL THEN
        UPDATE public.wallet_transactions
        SET status = 'Rejected',
            description = 'Deposit Rejected: ' || v_clean_reason
        WHERE user_id = v_user_id
          AND (reference_id = v_order_id OR reference_id = p_payment_id::text)
          AND status = 'Pending';
    END IF;

    -- 7. Insert User Notification (Safely handles schema variations: read vs is_read)
    BEGIN
        INSERT INTO public.notifications (
            user_id, title, message, type, read, created_at
        ) VALUES (
            v_user_id, 'Topup Rejected',
            'Your recharge of ₹' || TRIM(TO_CHAR(v_amount, 'FM999999990.00')) || ' was rejected: ' || v_clean_reason,
            'WARNING', false, v_now
        );
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO public.notifications (
                user_id, title, message, type, is_read, created_at
            ) VALUES (
                v_user_id, 'Topup Rejected',
                'Your recharge of ₹' || TRIM(TO_CHAR(v_amount, 'FM999999990.00')) || ' was rejected: ' || v_clean_reason,
                'WARNING', false, v_now
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', COALESCE(v_payment_id, v_deposit_id),
        'order_id', v_order_id,
        'amount', v_amount,
        'message', 'Recharge request rejected successfully.'
    );
END;
$$;

-- Security Grants: Exclusively service_role
REVOKE ALL ON FUNCTION public.reject_manual_upi_deposit(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_manual_upi_deposit(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.reject_manual_upi_deposit(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reject_manual_upi_deposit(UUID, UUID, TEXT) TO service_role;
