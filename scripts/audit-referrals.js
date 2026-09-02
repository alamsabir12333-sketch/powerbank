import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

function formatSupabaseUrl(url) {
  const fallback = 'https://evhwqlnymvoduclmzshz.supabase.co';
  if (!url) return fallback;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (/^[a-z0-9-]+$/i.test(trimmed)) return `https://${trimmed}.supabase.co`;
  return fallback;
}

const supabaseUrl = formatSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const { data: refs, error } = await supabase.from('referrals').select('*');
  if (error) {
    console.error('Error fetching referrals:', error);
    return;
  }
  console.log('Total referrals in DB:', refs.length);

  const { data: profs } = await supabase.from('profiles').select('user_id, id');
  const validUserIds = new Set(profs.flatMap(p => [p.user_id, p.id]).filter(Boolean));

  let orphans = 0;
  let selfRefs = 0;
  let duplicates = 0;
  const seenPairs = new Set();

  for (const r of refs) {
    const hasReferrer = r.referrer_id && validUserIds.has(r.referrer_id);
    const hasReferee = r.referee_id && validUserIds.has(r.referee_id);
    if (!hasReferrer || !hasReferee) {
      console.log('Orphan referral row:', r.id, 'referrer:', r.referrer_id, 'referee:', r.referee_id);
      orphans++;
    }
    if (r.referrer_id && r.referee_id && r.referrer_id === r.referee_id) {
      console.log('Self-referral row:', r.id);
      selfRefs++;
    }
    const pairKey = `${r.referrer_id}->${r.referee_id}@L${r.level}`;
    if (seenPairs.has(pairKey)) {
      console.log('Duplicate referral pair:', pairKey, 'row id:', r.id);
      duplicates++;
    } else {
      seenPairs.add(pairKey);
    }
  }

  console.log('--- DATABASE INTEGRITY SUMMARY ---');
  console.log('Total referral records :', refs.length);
  console.log('Orphan referrals       :', orphans);
  console.log('Self referrals         :', selfRefs);
  console.log('Duplicate pairs        :', duplicates);
  console.log('Database Integrity     :', (orphans === 0 && selfRefs === 0 && duplicates === 0) ? 'PASS' : 'ISSUES DETECTED');
}

runAudit().catch(console.error);
