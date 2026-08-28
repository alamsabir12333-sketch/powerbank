import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Wallet } from '../types';
import { ChevronLeft, FileText, Loader2, Sparkles } from 'lucide-react';

interface TopUpPageProps {
  userId?: string;
  wallet?: Wallet | null;
  onBack?: () => void;
  onNavigateTab?: (tab: any) => void;
  onShowToast?: (msg: string) => void;
  onRefreshData?: () => void;
}

const PRESET_AMOUNTS = [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000];

export default function TopUpPage({
  userId: propUserId,
  wallet: propWallet,
  onBack,
  onNavigateTab,
  onShowToast,
  onRefreshData,
}: TopUpPageProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [balance, setBalance] = useState<number>(() => propWallet?.rechargeBalance ?? propWallet?.availableBalance ?? 0.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const pollingRef = useRef<any>(null);

  const fetchWallet = async (uid: string) => {
    if (!supabase) return;
    try {
      const { data: wallet } = await supabase.from('wallets').select('balance, recharge_balance, available_balance').eq('user_id', uid).maybeSingle();
      if (wallet) {
        setBalance(wallet.balance ?? wallet.recharge_balance ?? wallet.available_balance ?? 0);
      }
    } catch (_e) {}
  };

  useEffect(() => {
    async function loadUserData() {
      try {
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        const effectiveId = user?.id || propUserId;
        if (effectiveId) {
          await fetchWallet(effectiveId);
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', effectiveId).maybeSingle();
          if (profile) setUserProfile(profile);
        }
      } catch (e) {
        console.warn('Error loading user profile in TopUpPage:', e);
      }
    }
    loadUserData();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [propUserId]);

  // Sync with propWallet updates
  useEffect(() => {
    if (propWallet) {
      setBalance(propWallet.rechargeBalance ?? propWallet.availableBalance ?? 0);
    }
  }, [propWallet]);

  const handleTopUp = async () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (!finalAmount || finalAmount < 100) {
      const msg = 'Minimum recharge is ₹100';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }

    setLoading(true);
    try {
      let currentUserId = propUserId;
      let currentUserEmail = '';
      let currentUserPhone = userProfile?.phone || userProfile?.whatsapp_no || userProfile?.mobile || '';

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
          currentUserEmail = user.email || '';
          if (!currentUserPhone && user.user_metadata?.phone) {
            currentUserPhone = user.user_metadata.phone;
          }
        }
      }

      if (!currentUserId) {
        throw new Error('Please log in first');
      }

      const effectivePhone = currentUserPhone || userProfile?.phone || userProfile?.whatsapp_no || '9999999999';
      const effectiveEmail = currentUserEmail || `${effectivePhone}@gainpower.internal`;

      let response: any = null;
      if (supabase) {
        try {
          response = await supabase.functions.invoke('create-payin-order', {
            body: {
              amount: finalAmount,
              userId: currentUserId,
              customerName: userProfile?.full_name || userProfile?.username || userProfile?.name || 'Customer',
              customerEmail: effectiveEmail,
              customerPhone: effectivePhone,
            },
          });
        } catch (_fnErr) {
          response = null;
        }
      }

      if (!response || response?.error || !response?.data?.success) {
        const res = await fetch('/api/create-payin-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: finalAmount,
            userId: currentUserId,
            customerName: userProfile?.full_name || userProfile?.username || userProfile?.name || 'Customer',
            customerEmail: effectiveEmail,
            customerPhone: effectivePhone,
          }),
        });
        const backendData = await res.json();
        response = { data: backendData, error: null };
      }

      if (response?.error || !response?.data?.success || !response?.data?.payUrl) {
        throw new Error(response?.error?.message || response?.data?.msg || response?.data?.error || 'Payment initiation failed');
      }

      const { payUrl, orderId } = response.data;

      // Start fallback status polling in background
      if (supabase && orderId) {
        let attempts = 0;
        pollingRef.current = setInterval(async () => {
          attempts++;
          try {
            const { data: order } = await supabase
              .from('deposit_transactions')
              .select('status')
              .or(`traceno.eq.${orderId},merchant_order_id.eq.${orderId}`)
              .maybeSingle();

            if (order?.status === 'SUCCESS') {
              clearInterval(pollingRef.current);
              await fetchWallet(currentUserId!);
              if (onRefreshData) onRefreshData();
              const successMsg = 'Deposit successful! Balance updated.';
              if (onShowToast) onShowToast(successMsg);
              else alert(successMsg);
            }
          } catch (_err) {}

          if (attempts > 40) {
            clearInterval(pollingRef.current);
          }
        }, 3000);
      }

      if (onShowToast) {
        onShowToast(`Redirecting to payment gateway for ₹${finalAmount}...`);
      }

      // Open Payment Page
      window.location.href = payUrl;
    } catch (err: any) {
      const errText = err.message || 'Payment failed';
      if (onShowToast) onShowToast(errText);
      else alert(errText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-[#1A202C]">
      {/* Orange Top Bar */}
      <div className="bg-[#FF5500] text-white pt-8 pb-14 px-4 rounded-b-[30px] relative shadow-md shadow-orange-600/10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-semibold tracking-wide">Top Up</h1>
          <button
            onClick={() => onNavigateTab && onNavigateTab('transactions')}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Amount Selector Card */}
      <div className="px-4 -mt-8 flex-1 max-w-lg mx-auto w-full pb-10">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
          <h2 className="text-4xl font-black text-[#1A202C]">
            ₹{customAmount || selectedAmount.toLocaleString('en-IN')}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Available balance: ₹{balance.toFixed(2)}
          </p>

          <div className="grid grid-cols-3 gap-3 w-full mt-6">
            {PRESET_AMOUNTS.map((amt) => {
              const isSelected = selectedAmount === amt && !customAmount;
              const isRecommended = [1500, 3500, 5000].includes(amt);

              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-3 rounded-xl font-bold relative border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#FF5500] text-[#FF5500] bg-[#FFF5F0]'
                      : 'border-gray-100 text-gray-800 bg-gray-50/50 hover:bg-gray-100'
                  }`}
                >
                  ₹{amt}
                  {isRecommended && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#FF5500] text-white text-[9px] px-1.5 py-0.2 rounded-full whitespace-nowrap flex items-center gap-0.5 font-semibold">
                      <Sparkles className="w-2.5 h-2.5" /> Recommended
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-full mt-6">
            <input
              type="number"
              placeholder="₹ Or enter other amount (Min ₹100)"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF5500] text-gray-900 font-medium"
            />
          </div>

          <button
            type="button"
            onClick={handleTopUp}
            disabled={loading}
            className="w-full mt-8 bg-[#FF5500] hover:bg-[#E04B00] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#FF5500]/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-base"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Top Up</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export { TopUpPage };
