-- ==============================================================================
-- GAINPOWER PLATFORM — POST-MIGRATION VERIFICATION & INTEGRITY TEST SUITE
-- ==============================================================================
-- File: /supabase/VERIFY_DATABASE.sql
-- Description: Run this in Supabase SQL Editor after executing FINAL_MASTER_MIGRATION.sql
-- ==============================================================================

-- 1. VERIFY CORE TABLES EXISTENCE
SELECT table_name, 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) AS is_present
FROM (VALUES 
    ('profiles'), ('wallets'), ('user_security'), ('plans'), ('purchases'), ('wallet_transactions'),
    ('earnings'), ('payments'), ('deposit_transactions'), ('bank_accounts'),
    ('withdrawals'), ('referrals'), ('notifications'), ('news'), ('banners'),
    ('missions'), ('mission_claims'), ('gift_codes'), ('gift_code_claims'),
    ('vip_levels'), ('settings'), ('admin_audit_logs')
) AS t(table_name)
ORDER BY is_present ASC, table_name ASC;

-- 2. VERIFY ROW LEVEL SECURITY (RLS) STATUS ACROSS ALL TABLES
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename ASC;

-- 3. VERIFY CRITICAL RPC FUNCTIONS & TRIGGERS
SELECT routine_name, routine_type, data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_auth_user', 'handle_user_onboarding', 'claim_device_earnings', 'is_admin');

-- 4. VERIFY AUTH TRIGGER IS ATTACHED
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 5. VERIFY PLAN CATEGORIES (NO UN-ARCHIVED STANDARD PLANS)
SELECT category, status, COUNT(*) as plan_count
FROM public.plans
GROUP BY category, status
ORDER BY category ASC;

-- 6. VERIFY ORPHAN PROFILES / WALLETS (INTEGRITY CHECK)
SELECT 
    (SELECT COUNT(*) FROM public.profiles) AS total_profiles,
    (SELECT COUNT(*) FROM public.wallets) AS total_wallets,
    (SELECT COUNT(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = p.user_id)) AS orphan_profiles_without_wallet;
