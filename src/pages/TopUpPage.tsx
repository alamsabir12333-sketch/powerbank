import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Wallet, DepositTransaction, RechargeSettings, UsdtSettings } from '../types';
import { apiUrl } from '../services/apiClient';
import {
  fetchDepositTransactions,
  submitDepositComplaint,
  uploadComplaintScreenshot,
  compressImageFile,
  fetchRechargeSettings,
  fetchUsdtSettings,
} from '../services/api';
import {
  ChevronLeft,
  FileText,
  Loader2,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ArrowDownLeft,
  HelpCircle,
  Upload,
  Image as ImageIcon,
  Send,
  X,
  ShieldAlert,
  Coins,
} from 'lucide-react';

interface TopUpPageProps {
  userId?: string;
  wallet?: Wallet | null;
  onBack?: () => void;
  onNavigateTab?: (tab: any) => void;
  onShowToast?: (msg: string) => void;
  onRefreshData?: () => void;
}

const DEFAULT_PRESET_AMOUNTS = [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000];

export default function TopUpPage({
  userId: propUserId,
  wallet: propWallet,
  onBack,
  onNavigateTab,
  onShowToast,
  onRefreshData,
}: TopUpPageProps) {
  // Single authoritative amount state (defaults to "500")
  const [amount, setAmount] = useState<string>('500');
  const [balance, setBalance] = useState<number>(
    () => propWallet?.rechargeBalance ?? propWallet?.availableBalance ?? 0.0
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string>(propUserId || '');
  
  // Dynamic Settings
  const [rechargeSettings, setRechargeSettings] = useState<RechargeSettings>({
    presetAmounts: DEFAULT_PRESET_AMOUNTS,
    minRecharge: 100,
    maxRecharge: 50000,
    isEnabled: true,
  });
  const [usdtSettings, setUsdtSettings] = useState<UsdtSettings>({
    isEnabled: true,
    usdtRate: 100,
    trc20Address: '',
    bep20Address: '',
  });

  // Recharge History states
  const [rechargeHistory, setRechargeHistory] = useState<DepositTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pay Complaint Modal states
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintOrder, setComplaintOrder] = useState<DepositTransaction | null>(null);
  const [complaintTraceno, setComplaintTraceno] = useState('');
  const [complaintAmount, setComplaintAmount] = useState('');
  const [complaintUtr, setComplaintUtr] = useState('');
  const [complaintProofFile, setComplaintProofFile] = useState<File | null>(null);
  const [complaintProofPreview, setComplaintProofPreview] = useState<string | null>(null);
  const [complaintNote, setComplaintNote] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintError, setComplaintError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDynamicSettings() {
      try {
        const [rSet, uSet] = await Promise.all([
          fetchRechargeSettings(),
          fetchUsdtSettings(),
        ]);
        if (rSet) setRechargeSettings(rSet);
        if (uSet) setUsdtSettings(uSet);
      } catch (err) {
        console.warn('[TopUpPage] Failed to fetch settings:', err);
      }
    }
    loadDynamicSettings();
  }, []);

  const handleOpenComplaint = (order?: DepositTransaction | null) => {
    if (order) {
      setComplaintOrder(order);
      setComplaintTraceno(order.traceno || order.id || '');
      setComplaintAmount(String(order.amount || ''));
    } else {
      setComplaintOrder(null);
      setComplaintTraceno('');
      setComplaintAmount(amount || '500');
    }
    setComplaintUtr('');
    setComplaintProofFile(null);
    setComplaintProofPreview(null);
    setComplaintNote('');
    setComplaintError(null);
    setComplaintModalOpen(true);
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setComplaintProofFile(file);
      try {
        const preview = await compressImageFile(file, 800, 800, 0.8);
        setComplaintProofPreview(preview || null);
      } catch {
        const reader = new FileReader();
        reader.onload = () => {
          setComplaintProofPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveUid = currentAuthUserId || propUserId;
    if (!effectiveUid) {
      setComplaintError('User session expired. Please sign in again.');
      return;
    }
    const cleanUtr = complaintUtr.trim();
    if (!cleanUtr || cleanUtr.length < 8) {
      setComplaintError('Please enter a valid 12-digit UPI UTR number.');
      return;
    }
    const cleanAmount = Number(complaintAmount);
    if (!cleanAmount || cleanAmount <= 0) {
      setComplaintError('Please provide a valid deposit amount.');
      return;
    }

    setSubmittingComplaint(true);
    setComplaintError(null);
    try {
      let uploadedUrl: string | undefined = undefined;
      if (complaintProofFile) {
        uploadedUrl = await uploadComplaintScreenshot(complaintProofFile, effectiveUid);
      }

      const res = await submitDepositComplaint({
        userId: effectiveUid,
        traceno: complaintTraceno.trim() || `MANUAL_${Date.now()}`,
        amount: cleanAmount,
        utr: cleanUtr,
        proofUrl: uploadedUrl || complaintProofPreview || undefined,
        note: complaintNote.trim() || undefined,
      });

      if (onShowToast) {
        onShowToast(res.message || 'Deposit complaint submitted for Admin review.');
      }

      setComplaintModalOpen(false);
      // Reload history and balance
      loadHistory(effectiveUid);
      fetchWallet(effectiveUid);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setComplaintError(err.message || 'Failed to submit complaint. Please try again.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const pollingRef = useRef<any>(null);

  const fetchWallet = async (uid: string) => {
    if (!supabase || !uid) return;
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance, recharge_balance, available_balance')
        .eq('user_id', uid)
        .maybeSingle();
      if (wallet) {
        setBalance(wallet.recharge_balance ?? wallet.available_balance ?? wallet.balance ?? 0);
      }
    } catch (_e) {}
  };

  const loadHistory = async (uid: string) => {
    if (!uid) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await fetchDepositTransactions(uid);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[TopUp Recharge Query]', {
          userId: uid,
          table: 'deposit_transactions + wallet_transactions + payments',
          resultCount: data ? data.length : 0,
        });
      }
      setRechargeHistory(data || []);
    } catch (e: any) {
      console.error('[TopUp Recharge Query] Error:', e);
      setHistoryError('Unable to load recharge history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let channel: any = null;

    async function initUser() {
      try {
        let effectiveId = propUserId;
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            effectiveId = user.id;
            setCurrentAuthUserId(user.id);
          }
        }
        if (effectiveId) {
          await fetchWallet(effectiveId);
          await loadHistory(effectiveId);

          if (supabase) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', effectiveId)
              .maybeSingle();
            if (profile) setUserProfile(profile);

            // Subscribe to real-time deposit updates
            channel = supabase
              .channel(`user-deposits-${effectiveId}`)
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: 'deposit_transactions',
                  filter: `user_id=eq.${effectiveId}`,
                },
                () => {
                  loadHistory(effectiveId!);
                  fetchWallet(effectiveId!);
                  if (onRefreshData) onRefreshData();
                }
              )
              .subscribe();
          }
        }
      } catch (e) {
        console.warn('Error loading user profile in TopUpPage:', e);
      }
    }

    initUser();

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [propUserId]);

  // Sync with propWallet updates
  useEffect(() => {
    if (propWallet) {
      setBalance(propWallet.rechargeBalance ?? propWallet.availableBalance ?? 0);
    }
  }, [propWallet]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    if (onShowToast) onShowToast('Order ID copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTopUp = async () => {
    setErrorMsg(null);
    const numAmount = parseInt(amount, 10);

    if (isNaN(numAmount) || numAmount < 100) {
      const msg = 'Minimum recharge amount is ₹100';
      setErrorMsg(msg);
      if (onShowToast) onShowToast(msg);
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate user
      let effectiveUserId = currentAuthUserId || propUserId;
      let currentUserEmail = '';
      let currentUserPhone = userProfile?.phone || userProfile?.whatsapp_no || userProfile?.mobile || '';

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          effectiveUserId = user.id;
          currentUserEmail = user.email || '';
          if (!currentUserPhone && user.user_metadata?.phone) {
            currentUserPhone = user.user_metadata.phone;
          }
        }
      }

      if (!effectiveUserId) {
        throw new Error('Please log in first to proceed with recharge.');
      }

      const effectivePhone = currentUserPhone || userProfile?.phone || userProfile?.whatsapp_no || '9999999999';
      const effectiveEmail = currentUserEmail || `${effectivePhone}@gainpower.internal`;

      // 2. Generate unique application order ID
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const traceno = `DEP${timestamp}${randomSuffix}`;

      // 3. Create PENDING order in Supabase BEFORE opening gateway
      if (supabase) {
        const { error: insertErr } = await supabase.from('deposit_transactions').insert({
          traceno: traceno,
          merchant_order_id: traceno,
          user_id: effectiveUserId,
          amount: numAmount,
          currency: 'INR',
          pay_code: '印度UPI-银台',
          status: 'PENDING',
          channel: 'UNIVEPAY',
        });

        if (insertErr) {
          console.error('[TOPUP] Insert deposit_transactions failed:', insertErr);
          throw new Error('Unable to create recharge order. Please try again.');
        }

        // 4. Verify database insert succeeded
        const { data: verifiedOrder, error: verifyErr } = await supabase
          .from('deposit_transactions')
          .select('id, traceno, status, amount, user_id')
          .eq('traceno', traceno)
          .maybeSingle();

        if (verifyErr || !verifiedOrder || verifiedOrder.status !== 'PENDING') {
          console.error('[TOPUP] Order verification failed:', verifyErr);
          throw new Error('Unable to create recharge order. Please try again.');
        }

        // Create pending record in wallet_transactions
        try {
          await supabase.from('wallet_transactions').insert({
            user_id: effectiveUserId,
            type: 'RECHARGE',
            amount: numAmount,
            balance_before: balance,
            balance_after: balance,
            reference_id: traceno,
            description: `Recharge Order #${traceno}`,
            wallet_type: 'TOPUP',
            status: 'Pending',
          });
        } catch (wErr) {
          console.warn('[TOPUP] Pending wallet_transaction insert warning:', wErr);
        }

        // Refresh recharge history in UI immediately so PENDING order appears below button
        loadHistory(effectiveUserId);
      }

      // 5. ONLY AFTER PENDING order exists: invoke the existing payment gateway
      let response: any = null;
      if (supabase) {
        try {
          response = await supabase.functions.invoke('create-payin-order', {
            body: {
              amount: numAmount,
              userId: effectiveUserId,
              orderId: traceno,
              traceno: traceno,
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
        const res = await fetch(apiUrl('/api/create-payin-order'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: numAmount,
            userId: effectiveUserId,
            orderId: traceno,
            traceno: traceno,
            customerName: userProfile?.full_name || userProfile?.username || userProfile?.name || 'Customer',
            customerEmail: effectiveEmail,
            customerPhone: effectivePhone,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          throw new Error('Payment gateway backend returned an invalid response (HTML). Please verify backend status.');
        }
        const backendData = await res.json().catch(() => null);
        response = { data: backendData, error: null };
      }

      if (response?.error || !response?.data?.success || !response?.data?.payUrl) {
        const errorDetail = response?.data?.error || response?.error?.message || 'Payment initiation failed';
        throw new Error(errorDetail);
      }

      const { payUrl } = response.data;

      // Start status polling in background
      if (supabase && traceno) {
        let attempts = 0;
        pollingRef.current = setInterval(async () => {
          attempts++;
          try {
            const { data: order } = await supabase
              .from('deposit_transactions')
              .select('status')
              .eq('traceno', traceno)
              .maybeSingle();

            if (order?.status === 'SUCCESS' || order?.status === 'PAID' || order?.status === 'COMPLETED') {
              clearInterval(pollingRef.current);
              await fetchWallet(effectiveUserId!);
              await loadHistory(effectiveUserId!);
              if (onRefreshData) onRefreshData();
              const successMsg = 'Deposit successful! Recharge wallet credited.';
              if (onShowToast) onShowToast(successMsg);
            }
          } catch (_err) {}

          if (attempts > 40) {
            clearInterval(pollingRef.current);
          }
        }, 3000);
      }

      if (onShowToast) {
        onShowToast(`Redirecting to payment gateway for ₹${numAmount}...`);
      }

      // Open existing gateway payment page
      window.location.href = payUrl;
    } catch (err: any) {
      const errText = err.message || 'Unable to create recharge order. Please try again.';
      setErrorMsg(errText);
      if (onShowToast) onShowToast(errText);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'SUCCESS' || s === 'PAID' || s === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>PAID</span>
        </span>
      );
    }
    if (s === 'FAILED' || s === 'REJECTED' || s === 'FAILED_GATEWAY_CREATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/60">
          <XCircle className="w-3.5 h-3.5" />
          <span>FAILED</span>
        </span>
      );
    }
    if (s === 'CANCELLED' || s === 'EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200/60">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>CANCELLED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
        <Clock className="w-3.5 h-3.5 animate-spin text-amber-600" />
        <span>PENDING</span>
      </span>
    );
  };

  const currentDisplayAmount = amount ? Number(amount).toLocaleString('en-IN') : '0';

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-[#1A202C]">
      {/* Orange Top Bar */}
      <div className="bg-[#FF5500] text-white pt-8 pb-14 px-4 rounded-b-[30px] relative shadow-md shadow-orange-600/10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-semibold tracking-wide">Recharge</h1>
          <button
            onClick={() => onNavigateTab && onNavigateTab('transactions')}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
            title="Transactions"
            aria-label="Transactions"
          >
            <FileText className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Amount Selector Card */}
      <div className="px-4 -mt-8 flex-1 max-w-lg mx-auto w-full pb-10 space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
          <h2 className="text-4xl font-black text-[#1A202C]">
            ₹{currentDisplayAmount}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Recharge Wallet Balance: ₹{balance.toFixed(2)}
          </p>

          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-3 w-full mt-6">
            {(rechargeSettings.presetAmounts && rechargeSettings.presetAmounts.length > 0
              ? rechargeSettings.presetAmounts
              : DEFAULT_PRESET_AMOUNTS
            ).map((amt) => {
              const isSelected = amount === String(amt);
              const isRecommended = [1500, 3500, 5000].includes(amt);

              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className={`py-3 rounded-xl font-bold relative border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#FF5500] text-[#FF5500] bg-[#FFF5F0] shadow-sm'
                      : 'border-gray-100 text-gray-800 bg-gray-50/60 hover:bg-gray-100'
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

          {/* Custom Amount Input Field */}
          <div className="w-full mt-6">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={`₹ Or enter other amount (Min ₹${rechargeSettings.minRecharge || 100})`}
              value={amount}
              onChange={(e) => {
                const cleanDigits = e.target.value.replace(/\D/g, '');
                setAmount(cleanDigits);
                if (errorMsg) setErrorMsg(null);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF5500] focus:bg-white text-gray-900 font-semibold transition-colors"
            />
          </div>

          {errorMsg && (
            <div className="w-full mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs text-red-700">
              <span className="font-medium">{errorMsg}</span>
              <button
                type="button"
                onClick={handleTopUp}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Primary Recharge Button */}
          <button
            type="button"
            onClick={handleTopUp}
            disabled={loading}
            className="w-full mt-6 bg-[#FF5500] hover:bg-[#E04B00] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#FF5500]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-base"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Creating order & opening gateway...</span>
              </>
            ) : (
              <span>Recharge</span>
            )}
          </button>

          {/* Recharge USDT Button */}
          {usdtSettings.isEnabled !== false && (
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) {
                  onNavigateTab('recharge_usdt');
                }
              }}
              className="w-full mt-3 bg-gradient-to-r from-amber-500 via-orange-500 to-[#FF5500] hover:from-amber-600 hover:to-[#E04B00] text-white font-bold py-3.5 rounded-2xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Coins className="w-4 h-4 text-yellow-200" />
              <span>Recharge USDT (1 USDT = ₹{usdtSettings.usdtRate || 100})</span>
            </button>
          )}
        </div>

        {/* RECHARGE HISTORY SECTION DIRECTLY BELOW THE TOP UP BUTTON */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-[#FF5500]" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Recharge History
              </h3>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (currentAuthUserId || propUserId) {
                    loadHistory(currentAuthUserId || propUserId!);
                  }
                }}
                disabled={historyLoading}
                className="text-xs text-gray-500 hover:text-[#FF5500] flex items-center gap-1 font-medium cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3.5 bg-gray-50/80 rounded-xl animate-pulse flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                    <div className="h-3 w-32 bg-gray-200 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded-full" />
                </div>
              ))}
            </div>
          ) : historyError ? (
            <div className="py-8 text-center text-gray-500 space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-500 opacity-80" />
              <p className="text-xs font-semibold text-rose-500">{historyError}</p>
              <button
                type="button"
                onClick={() => {
                  const targetId = currentAuthUserId || propUserId;
                  if (targetId) loadHistory(targetId);
                }}
                className="px-4 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF5500] font-bold text-xs cursor-pointer transition-colors inline-flex items-center gap-1.5 border border-orange-200/60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : rechargeHistory.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">No recharge orders yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Your recharge history will appear here immediately upon creating a top up.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rechargeHistory.map((item) => {
                const formattedDate = item.createdAt
                  ? new Date(item.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'N/A';

                return (
                  <div
                    key={item.id || item.traceno}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          +₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span className="font-mono text-gray-500">#{item.traceno}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.traceno)}
                          className="hover:text-gray-700 cursor-pointer p-0.5"
                          title="Copy order ID"
                        >
                          {copiedId === item.traceno ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[11px] text-gray-400 block font-medium">
                        {item.paymentMethod || 'UPI Gateway'}
                      </span>
                      {item.status !== 'PAID' && item.status !== 'SUCCESS' && item.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => handleOpenComplaint(item)}
                          className="text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                        >
                          Dispute / UTR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PAY COMPLAINT / DEPOSIT DISPUTE MODAL */}
      {complaintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-[#FF5500] text-white">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold">Deposit Problem / Pay Complaint</h3>
                  <p className="text-[10px] text-orange-100">Submit 12-digit UPI UTR and proof screenshot</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComplaintModalOpen(false)}
                disabled={submittingComplaint}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="p-5 space-y-4 text-xs">
              {complaintError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{complaintError}</span>
                </div>
              )}

              <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-[#FF5500]" />
                  <span>Money debited but not credited to Recharge Wallet?</span>
                </p>
                <p className="text-amber-700 leading-relaxed">
                  Enter the exact 12-digit UTR / Ref No from your payment app (Google Pay, PhonePe, Paytm, BHIM) and upload the payment receipt screenshot. Our support team will verify and credit your wallet.
                </p>
              </div>

              {/* Order ID / Traceno (Optional / Pre-filled) */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Order Number / Traceno (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. T20250101..."
                  value={complaintTraceno}
                  onChange={(e) => setComplaintTraceno(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 outline-none focus:border-[#FF5500] font-mono text-xs"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Paid Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={complaintAmount}
                  onChange={(e) => setComplaintAmount(e.target.value)}
                  required
                  min="1"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-bold outline-none focus:border-[#FF5500] text-xs"
                />
              </div>

              {/* 12-Digit UTR Number */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  12-Digit UPI UTR / RRN / Reference No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 423589123456"
                  value={complaintUtr}
                  onChange={(e) => setComplaintUtr(e.target.value)}
                  required
                  maxLength={24}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-mono font-bold outline-none focus:border-[#FF5500] text-xs tracking-wider"
                />
              </div>

              {/* Screenshot Proof Upload */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Payment Receipt Screenshot (Recommended)
                </label>
                <div className="mt-1 flex flex-col gap-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer transition-colors text-gray-600">
                    <Upload className="w-4 h-4 text-[#FF5500]" />
                    <span className="font-medium text-xs">
                      {complaintProofFile ? complaintProofFile.name : 'Select or capture screenshot'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofFileChange}
                      className="hidden"
                    />
                  </label>

                  {complaintProofPreview && (
                    <div className="relative inline-block border border-gray-200 rounded-xl overflow-hidden max-h-32 bg-gray-100">
                      <img
                        src={complaintProofPreview}
                        alt="Proof preview"
                        className="h-32 w-auto object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setComplaintProofFile(null);
                          setComplaintProofPreview(null);
                        }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Additional Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via PhonePe, money deducted from bank"
                  value={complaintNote}
                  onChange={(e) => setComplaintNote(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 outline-none focus:border-[#FF5500] text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setComplaintModalOpen(false)}
                  disabled={submittingComplaint}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplaint}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF5500] hover:from-orange-600 hover:to-[#E04B00] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50"
                >
                  {submittingComplaint ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Submit Complaint</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { TopUpPage };
