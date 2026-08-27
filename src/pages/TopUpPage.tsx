import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet } from '../types';
import { checkUniVePayDepositStatus } from '../services/api';
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
  const [balance, setBalance] = useState<number>(() => propWallet?.rechargeBalance ?? propWallet?.availableBalance ?? 50.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTraceno, setActiveTraceno] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        if (!supabase) return;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const effectiveId = user?.id || propUserId;
        if (effectiveId) {
          const { data: walletData } = await supabase
            .from('wallets')
            .select('balance, recharge_balance, available_balance')
            .eq('user_id', effectiveId)
            .maybeSingle();

          if (walletData) {
            setBalance(walletData.balance ?? walletData.recharge_balance ?? walletData.available_balance ?? 0);
          }

          const { data: profile } = await supabase.from('profiles').select('*').eq('id', effectiveId).maybeSingle();
          if (profile) setUserProfile(profile);
        }
      } catch (e) {
        console.warn('Error loading user wallet in TopUpPage:', e);
      }
    }
    loadUserData();
  }, [propUserId]);

  // Sync prop balance when available
  useEffect(() => {
    if (propWallet) {
      setBalance(propWallet.rechargeBalance ?? propWallet.availableBalance ?? 0);
    }
  }, [propWallet]);

  // Polling for automated payment confirmation
  useEffect(() => {
    if (!activeTraceno) return;
    const interval = setInterval(async () => {
      try {
        const result = await checkUniVePayDepositStatus(activeTraceno);
        if (result.status === 'SUCCESS') {
          const notifyMsg = `Recharge of ₹${result.amount || selectedAmount} successfully credited!`;
          if (onShowToast) onShowToast(notifyMsg);
          else alert(notifyMsg);
          if (onRefreshData) onRefreshData();
          setActiveTraceno(null);
          clearInterval(interval);
        } else if (result.status === 'FAILED' || result.status === 'EXPIRED') {
          setActiveTraceno(null);
          clearInterval(interval);
        }
      } catch (_e) {}
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTraceno, onRefreshData, onShowToast, selectedAmount]);

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
      let currentUserEmail = 'customer@example.com';
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
          currentUserEmail = user.email || 'customer@example.com';
        }
      }

      if (!currentUserId) {
        throw new Error('Please log in first');
      }

      // Invoke Supabase Edge Function create-payin-order
      let response: any = null;
      if (supabase) {
        try {
          response = await supabase.functions.invoke('create-payin-order', {
            body: {
              amount: finalAmount,
              userId: currentUserId,
              customerName: userProfile?.full_name || userProfile?.username || 'Customer',
              customerEmail: currentUserEmail,
              customerPhone: userProfile?.phone || '9876543210',
            },
          });
        } catch (_fnErr) {
          response = null;
        }
      }

      if (!response || response?.error || !response?.data?.success) {
        // Fallback to Express backend API route if edge function is unreachable
        const res = await fetch('/api/create-payin-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: finalAmount,
            userId: currentUserId,
            customerName: userProfile?.full_name || userProfile?.username || 'Customer',
            customerEmail: currentUserEmail,
            customerPhone: userProfile?.phone || '9876543210',
          }),
        });
        const backendData = await res.json();
        response = { data: backendData, error: null };
      }

      if (response?.error || !response?.data?.success || !response?.data?.payUrl) {
        throw new Error(response?.error?.message || response?.data?.msg || response?.data?.error || 'Payment initiation failed');
      }

      const payUrl = response.data.payUrl;
      const orderId = response.data.orderId || response.data.traceno;
      if (orderId) {
        setActiveTraceno(orderId);
      }

      if (onShowToast) {
        onShowToast(`Redirecting to Payment Gateway for ₹${finalAmount}...`);
      }

      // Redirect user to Gateway checkout
      window.location.href = payUrl;
    } catch (err: any) {
      const errorMsg = err.message || 'Payment initiation failed';
      if (onShowToast) onShowToast(errorMsg);
      else alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-[#1A202C]">
      {/* Curved Orange Header */}
      <div className="bg-gradient-to-b from-[#FF5500] to-[#FF6E1A] text-white pt-6 pb-14 px-4 rounded-b-[32px] relative shadow-md shadow-orange-600/10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold tracking-wide">Top Up</h1>
          <button
            onClick={() => onNavigateTab && onNavigateTab('transactions')}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="px-4 -mt-8 flex-1 max-w-lg mx-auto w-full pb-10">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
          <h2 className="text-4xl sm:text-5xl font-black text-[#1A202C] tracking-tight">
            ₹{customAmount || selectedAmount.toLocaleString('en-IN')}
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mt-1.5 font-medium">
            Available balance: ₹{balance.toFixed(2)}
          </p>

          {/* Preset Buttons Grid */}
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
                  className={`py-3.5 px-2 rounded-2xl font-bold relative border transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isSelected
                      ? 'border-[#FF5500] text-[#FF5500] bg-[#FFF5F0] shadow-xs ring-1 ring-[#FF5500]'
                      : 'border-gray-100 text-gray-800 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base sm:text-lg">₹{amt}</span>
                  {isRecommended && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#FF5500] text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-xs flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> Recommended
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Amount Input */}
          <div className="w-full mt-7">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">₹</span>
              <input
                type="number"
                placeholder="Or enter other amount (Min ₹100)"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#FF5500] rounded-2xl pl-8 pr-4 py-3.5 text-sm font-semibold text-gray-900 focus:outline-none transition-colors placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="button"
            onClick={handleTopUp}
            disabled={loading}
            className="w-full mt-8 bg-[#FF5500] hover:bg-[#E04B00] active:scale-[0.99] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#FF5500]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-base"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing Payment...</span>
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
