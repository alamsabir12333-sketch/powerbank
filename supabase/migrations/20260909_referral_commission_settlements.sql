-- ==============================================================================
-- MIGRATION: 20260909_referral_commission_settlements.sql
-- DESCRIPTION: Dedicated PostgreSQL Table & Atomic Idempotent Settlement RPC for Referral Commissions
-- ==============================================================================

-- 1. Create Dedicated Table for Referral Commission Settlements
CREATE TABLE IF NOT EXISTS public.referral_commission_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL,
    topup_reference TEXT NOT NULL,
    deposit_user_id UUID NOT NULL,
    deposit_amount NUMERIC(14, 2) NOT NULL CHECK (deposit_amount > 0),
    tier INT NOT NULL CHECK (tier IN (1, 2, 3)),
    referrer_id UUID NOT NULL,
    commission_percentage NUMERIC(6, 2) NOT NULL CHECK (commission_percentage > 0),
    commission_amount NUMERIC(14, 2) NOT NULL CHECK (commission_amount > 0),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_referral_commission_settlements_topup_tier_referrer UNIQUE (topup_reference, tier, referrer_id),
    CONSTRAINT uq_referral_commission_settlements_reference_id UNIQUE (reference_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_settlements_topup ON public.referral_commission_settlements(topup_reference);
CREATE INDEX IF NOT EXISTS idx_ref_settlements_referrer ON public.referral_commission_settlements(referrer_id);
CREATE INDEX IF NOT EXISTS idx_ref_settlements_ref_id ON public.referral_commission_settlements(reference_id);

-- Enable RLS and define permissive internal access for service role
ALTER TABLE public.referral_commission_settlements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referral_commission_settlements' 
          AND policyname = 'Enable read for authenticated users'
    ) THEN
        CREATE POLICY "Enable read for authenticated users" 
            ON public.referral_commission_settlements 
            FOR SELECT 
            TO authenticated 
            USING (referrer_id = auth.uid() OR deposit_user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referral_commission_settlements' 
          AND policyname = 'Enable all for service_role'
    ) THEN
        CREATE POLICY "Enable all for service_role" 
            ON public.referral_commission_settlements 
            FOR ALL 
            TO service_role 
            USING (true) 
            WITH CHECK (true);
    END IF;
END $$;

-- 2. Create Atomic PostgreSQL RPC Function for Commission Settlement
CREATE OR REPLACE FUNCTION public.settle_referral_commission(
    p_reference_id TEXT,
    p_topup_reference TEXT,
    p_deposit_user_id UUID,
    p_deposit_amount NUMERIC,
    p_tier INT,
    p_referrer_id UUID,
    p_commission_percentage NUMERIC,
    p_commission_amount NUMERIC,
    p_description TEXT DEFAULT NULL,
    p_ref_row_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id UUID;
    v_existing_status TEXT;
    v_settlement_id UUID;
    v_wallet RECORD;
    v_balance_before NUMERIC(14, 2);
    v_balance_after NUMERIC(14, 2);
    v_desc TEXT;
    v_tx_id UUID;
    v_ledger_id UUID;
    v_legacy_ref_id TEXT;
BEGIN
    v_legacy_ref_id := 'TOPUP-T' || p_tier || '-' || p_topup_reference;
    v_desc := COALESCE(p_description, 'L' || p_tier || ' Referral Commission (' || p_commission_percentage || '%) from Topup #' || p_topup_reference);

    -- 1. Idempotency Check in settlements table
    SELECT id, status INTO v_existing_id, v_existing_status
    FROM public.referral_commission_settlements
    WHERE reference_id = p_reference_id
       OR (topup_reference = p_topup_reference AND tier = p_tier AND referrer_id = p_referrer_id)
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'settled', false,
            'already_settled', true,
            'reason', 'ALREADY_SETTLED_IN_SETTLEMENTS',
            'settlement_id', v_existing_id,
            'status', v_existing_status
        );
    END IF;

    -- 2. Idempotency Check in wallet_ledger and wallet_transactions (prevent duplicates from historical runs)
    IF EXISTS (
        SELECT 1 FROM public.wallet_ledger 
        WHERE user_id = p_referrer_id 
          AND (reference_id = p_reference_id OR reference_id = v_legacy_ref_id)
        LIMIT 1
    ) OR EXISTS (
        SELECT 1 FROM public.wallet_transactions
        WHERE user_id = p_referrer_id
          AND (reference_id = p_reference_id OR reference_id = v_legacy_ref_id)
        LIMIT 1
    ) THEN
        -- Record settlement entry for historical completeness
        INSERT INTO public.referral_commission_settlements (
            reference_id, topup_reference, deposit_user_id, deposit_amount,
            tier, referrer_id, commission_percentage, commission_amount,
            status, metadata
        ) VALUES (
            p_reference_id, p_topup_reference, p_deposit_user_id, p_deposit_amount,
            p_tier, p_referrer_id, p_commission_percentage, p_commission_amount,
            'COMPLETED', jsonb_build_object('source', 'HISTORICAL_SETTLED')
        ) ON CONFLICT DO NOTHING;

        RETURN jsonb_build_object(
            'success', true,
            'settled', false,
            'already_settled', true,
            'reason', 'ALREADY_SETTLED_IN_LEDGER_OR_TX'
        );
    END IF;

    -- 3. Atomically Insert Settlement Record with UNIQUE Constraint Check
    -- Concurrent requests for the same (topup_reference, tier, referrer_id) will encounter unique_violation
    BEGIN
        INSERT INTO public.referral_commission_settlements (
            reference_id,
            topup_reference,
            deposit_user_id,
            deposit_amount,
            tier,
            referrer_id,
            commission_percentage,
            commission_amount,
            status,
            metadata
        ) VALUES (
            p_reference_id,
            p_topup_reference,
            p_deposit_user_id,
            p_deposit_amount,
            p_tier,
            p_referrer_id,
            p_commission_percentage,
            p_commission_amount,
            'COMPLETED',
            jsonb_build_object(
                'reference_id', p_reference_id,
                'topup_reference', p_topup_reference,
                'deposit_user_id', p_deposit_user_id,
                'deposit_amount', p_deposit_amount,
                'tier', p_tier,
                'referrer_id', p_referrer_id,
                'percentage', p_commission_percentage,
                'commission', p_commission_amount,
                'ref_row_id', p_ref_row_id
            )
        ) RETURNING id INTO v_settlement_id;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', true,
            'settled', false,
            'already_settled', true,
            'reason', 'CONCURRENT_SETTLEMENT_BLOCKED'
        );
    END;

    -- 4. Lock Referrer Wallet FOR UPDATE (Guarantees strict atomic balance increment)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_referrer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create wallet with initial commission
        v_balance_before := 0.00;
        v_balance_after := ROUND(p_commission_amount, 2);

        INSERT INTO public.wallets (
            user_id,
            recharge_balance,
            withdraw_balance,
            earned_balance,
            available_balance,
            pending_balance,
            total_earned,
            team_commission,
            total_withdrawn,
            created_at,
            updated_at
        ) VALUES (
            p_referrer_id,
            0.00,
            v_balance_after,
            v_balance_after,
            v_balance_after,
            0.00,
            v_balance_after,
            v_balance_after,
            0.00,
            now(),
            now()
        );
    ELSE
        v_balance_before := COALESCE(v_wallet.withdraw_balance, v_wallet.earned_balance, 0.00);
        v_balance_after := ROUND(v_balance_before + p_commission_amount, 2);

        UPDATE public.wallets
        SET withdraw_balance = v_balance_after,
            earned_balance = v_balance_after,
            available_balance = ROUND(COALESCE(recharge_balance, 0.00) + v_balance_after, 2),
            team_commission = ROUND(COALESCE(team_commission, 0.00) + p_commission_amount, 2),
            total_earned = ROUND(COALESCE(total_earned, 0.00) + p_commission_amount, 2),
            updated_at = now()
        WHERE user_id = p_referrer_id;
    END IF;

    -- 5. Insert wallet_transactions (type: TEAM_BONUS, wallet_type: WITHDRAW)
    INSERT INTO public.wallet_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        reference_id,
        description,
        wallet_type,
        status,
        metadata
    ) VALUES (
        p_referrer_id,
        'TEAM_BONUS',
        p_commission_amount,
        v_balance_before,
        v_balance_after,
        p_reference_id,
        v_desc,
        'WITHDRAW',
        'COMPLETED',
        jsonb_build_object(
            'direction', 'CREDIT',
            'rewardType', 'TOPUP_COMMISSION',
            'tier', p_tier,
            'type', 'COMMISSION',
            'refId', p_reference_id,
            'depositUserId', p_deposit_user_id,
            'traceno', p_topup_reference,
            'depositAmount', p_deposit_amount,
            'settlementId', v_settlement_id
        )
    ) RETURNING id INTO v_tx_id;

    -- 6. Insert wallet_ledger (DEVICE_EARNING, REFERRAL_COMMISSION, CREDIT)
    INSERT INTO public.wallet_ledger (
        user_id,
        wallet_type,
        transaction_type,
        amount,
        direction,
        reference_type,
        reference_id,
        balance_before,
        balance_after,
        description,
        created_at
    ) VALUES (
        p_referrer_id,
        'DEVICE_EARNING',
        'REFERRAL_COMMISSION',
        p_commission_amount,
        'CREDIT',
        'REFERRAL_COMMISSION',
        p_reference_id,
        v_balance_before,
        v_balance_after,
        v_desc,
        now()
    ) RETURNING id INTO v_ledger_id;

    -- 7. Update referrals commission_earned
    IF p_ref_row_id IS NOT NULL THEN
        UPDATE public.referrals
        SET commission_earned = ROUND(COALESCE(commission_earned, 0.00) + p_commission_amount, 2),
            updated_at = now()
        WHERE id = p_ref_row_id;
    ELSE
        UPDATE public.referrals
        SET commission_earned = ROUND(COALESCE(commission_earned, 0.00) + p_commission_amount, 2),
            updated_at = now()
        WHERE referee_id = p_deposit_user_id
          AND referrer_id = p_referrer_id;
    END IF;

    -- 8. Return Comprehensive Settlement Result
    RETURN jsonb_build_object(
        'success', true,
        'settled', true,
        'already_settled', false,
        'settlement_id', v_settlement_id,
        'reference_id', p_reference_id,
        'tier', p_tier,
        'referrer_id', p_referrer_id,
        'commission_amount', p_commission_amount,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'tx_id', v_tx_id,
        'ledger_id', v_ledger_id
    );
END;
$$;
