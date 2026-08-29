import React, { useState, useEffect } from 'react';
import { Wallet, UsdtSettings, UsdtDepositItem } from '../types';
import {
  fetchUsdtSettings,
  uploadUsdtScreenshot,
  submitUsdtDeposit,
  fetchUserUsdtDeposits,
  fetchUsdtSignedUrl,
  compressImageFile,
} from '../services/api';
import {
  ChevronLeft,
  Coins,
  Copy,
  Check,
  Upload,
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Loader2,
  FileText,
  Eye,
  X,
} from 'lucide-react';

interface UsdtDepositPageProps {
  userId?: string;
  wallet?: Wallet | null;
  initialAmount?: string;
  onBack?: () => void;
  onNavigateTab?: (tab: any) => void;
  onShowToast?: (msg: string) => void;
  onRefreshData?: () => void;
}

export default function UsdtDepositPage({
  userId,
  wallet,
  initialAmount = '500',
  onBack,
  onNavigateTab,
  onShowToast,
  onRefreshData,
}: UsdtDepositPageProps) {
  const [usdtSettings, setUsdtSettings] = useState<UsdtSettings>({
    isEnabled: true,
    usdtRate: 100,
    trc20Address: '',
    bep20Address: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Form states
  const [amountInr, setAmountInr] = useState<string>(initialAmount || '500');
  const [network, setNetwork] = useState<'TRC20' | 'BEP20'>('TRC20');
  const [txHash, setTxHash] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // History states
  const [history, setHistory] = useState<UsdtDepositItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Preview Modal
  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false);

  // Load Settings & User History
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const settings = await fetchUsdtSettings();
        if (isMounted && settings) {
          setUsdtSettings(settings);
        }
      } catch (err) {
        console.warn('[USDT PAGE] Failed to load USDT settings:', err);
      } finally {
        if (isMounted) setSettingsLoading(false);
      }

      if (userId) {
        try {
          const items = await fetchUserUsdtDeposits(userId);
          if (isMounted) {
            setHistory(items);
          }
        } catch (err) {
          console.warn('[USDT PAGE] Failed to load history:', err);
        } finally {
          if (isMounted) setHistoryLoading(false);
        }
      } else {
        if (isMounted) setHistoryLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const reloadHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const items = await fetchUserUsdtDeposits(userId);
      setHistory(items);
    } catch (err) {
      console.warn('[USDT PAGE] Failed to reload history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    if (onShowToast) onShowToast('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const rate = usdtSettings.usdtRate > 0 ? usdtSettings.usdtRate : 100;
  const numInr = Number(amountInr) || 0;
  const calculatedUsdt = numInr > 0 ? (numInr / rate).toFixed(4) : '0.0000';

  const activeWalletAddress =
    network === 'TRC20'
      ? usdtSettings.trc20Address || 'TRC20-ADDRESS-NOT-CONFIGURED'
      : usdtSettings.bep20Address || 'BEP20-ADDRESS-NOT-CONFIGURED';

  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setFormError(null);
      try {
        const preview = await compressImageFile(file, 900, 900, 0.85);
        setProofPreview(preview || null);
      } catch {
        const reader = new FileReader();
        reader.onload = () => setProofPreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setFormError('Please sign in to submit a USDT deposit.');
      return;
    }
    if (numInr < 100) {
      setFormError('Minimum deposit amount is ₹100.');
      return;
    }
    if (!proofFile && !proofPreview) {
      setFormError('Please attach a screenshot of your USDT transfer proof.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      let uploadedStoragePath = '';
      if (proofFile) {
        uploadedStoragePath = await uploadUsdtScreenshot(userId, proofFile);
      } else if (proofPreview) {
        uploadedStoragePath = proofPreview;
      }

      const res = await submitUsdtDeposit({
        userId,
        amountInr: numInr,
        usdtAmount: Number(calculatedUsdt),
        usdtRate: rate,
        network,
        walletAddress: activeWalletAddress,
        txHash: txHash.trim(),
        proofPath: uploadedStoragePath,
        note: note.trim(),
      });

      if (onShowToast) {
        onShowToast(res.message || 'USDT deposit submitted! Admin will verify and credit your wallet.');
      }

      // Reset form
      setTxHash('');
      setNote('');
      setProofFile(null);
      setProofPreview(null);

      // Reload user history and main wallet
      reloadHistory();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit USDT deposit.');
      if (onShowToast) onShowToast(err.message || 'Deposit submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const openScreenshot = async (item: UsdtDepositItem) => {
    if (item.signedProofUrl) {
      setViewScreenshotUrl(item.signedProofUrl);
      return;
    }
    if (!userId) return;

    setLoadingSignedUrl(true);
    try {
      const url = await fetchUsdtSignedUrl(userId, item.id, item.proofUrl);
      if (url) {
        setViewScreenshotUrl(url);
      } else {
        setViewScreenshotUrl(item.proofUrl);
      }
    } catch (err) {
      setViewScreenshotUrl(item.proofUrl);
    } finally {
      setLoadingSignedUrl(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'PAID' || s === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>APPROVED</span>
        </span>
      );
    }
    if (s === 'REJECTED' || s === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-3.5 h-3.5" />
          <span>REJECTED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3.5 h-3.5 animate-spin text-amber-600" />
        <span>PENDING</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-[#1A202C]">
      {/* Top Navigation Bar */}
      <div className="bg-[#FF5500] text-white pt-8 pb-14 px-4 rounded-b-[30px] relative shadow-md shadow-orange-600/10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => (onBack ? onBack() : onNavigateTab ? onNavigateTab('recharge') : window.history.back())}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-1.5">
            <Coins className="w-5 h-5 text-yellow-300" />
            <h1 className="text-lg font-bold tracking-wide">USDT Recharge</h1>
          </div>
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

      {/* Main Content */}
      <div className="px-4 -mt-8 flex-1 max-w-lg mx-auto w-full pb-12 space-y-6">
        {/* Rate & Calculator Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between bg-orange-50/80 border border-orange-100 rounded-xl p-3.5">
            <div>
              <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider block">
                Official Conversion Rate
              </span>
              <span className="text-base font-black text-gray-900">
                1 USDT = ₹{rate.toFixed(2)} INR
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium text-gray-500 block">Recharge Wallet</span>
              <span className="text-sm font-bold text-[#FF5500]">
                ₹{(wallet?.rechargeBalance ?? wallet?.availableBalance ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Amount Inr Input */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">
              Recharge Amount (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                ₹
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter amount (Min ₹100)"
                value={amountInr}
                onChange={(e) => setAmountInr(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-[#FF5500] focus:bg-white text-gray-900 font-bold"
              />
            </div>
          </div>

          {/* Preset Chips */}
          <div className="flex flex-wrap gap-2">
            {[500, 1000, 2000, 5000, 10000, 20000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmountInr(String(amt))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  amountInr === String(amt)
                    ? 'bg-[#FF5500] text-white border-[#FF5500]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                ₹{amt}
              </button>
            ))}
          </div>

          {/* USDT Calculation Summary Box */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-medium block">You need to send:</span>
              <span className="text-xl font-black text-[#FF5500]">
                {calculatedUsdt} <span className="text-xs text-gray-600 font-bold">USDT</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(calculatedUsdt, 'usdtAmount')}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              {copiedField === 'usdtAmount' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy USDT</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Network & Transfer Address Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              1. Select Network & Address
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Manual Transfer
            </span>
          </div>

          {/* Network Selection Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setNetwork('TRC20')}
              className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                network === 'TRC20'
                  ? 'bg-white text-[#FF5500] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              TRC20 (Tron)
            </button>
            <button
              type="button"
              onClick={() => setNetwork('BEP20')}
              className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                network === 'BEP20'
                  ? 'bg-white text-[#FF5500] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              BEP20 (BNB Chain)
            </button>
          </div>

          {/* Deposit Address Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">
                Official {network} Deposit Address:
              </span>
            </div>
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
              <p className="font-mono text-xs font-bold text-gray-800 break-all select-all">
                {activeWalletAddress || 'No address configured by admin.'}
              </p>
              <button
                type="button"
                onClick={() => copyToClipboard(activeWalletAddress, 'address')}
                disabled={!activeWalletAddress || activeWalletAddress.includes('NOT-CONFIGURED')}
                className="w-full py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {copiedField === 'address' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Address Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-600" />
                    <span>Copy {network} Address</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Please ensure you send <strong>USDT</strong> via the selected <strong>{network}</strong> network only. Sending other assets or across wrong networks will result in permanent loss.
            </p>
          </div>
        </div>

        {/* Payment Submission Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            2. Upload Transfer Proof
          </h3>

          {/* Screenshot Upload */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">
              Payment Screenshot <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-200 hover:border-[#FF5500] rounded-xl p-4 text-center transition-colors bg-gray-50/50">
              {proofPreview ? (
                <div className="space-y-3">
                  <img
                    src={proofPreview}
                    alt="Proof preview"
                    className="max-h-48 mx-auto rounded-lg border border-gray-200 object-contain"
                  />
                  <div className="flex items-center justify-center gap-3">
                    <label className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors shadow-xs">
                      Change Screenshot
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofChange}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFile(null);
                        setProofPreview(null);
                      }}
                      className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block py-4">
                  <Upload className="w-8 h-8 mx-auto text-[#FF5500] mb-2 opacity-80" />
                  <span className="text-xs font-bold text-gray-800 block">
                    Click to select payment screenshot
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-1">
                    Supports JPG, PNG, WEBP (Max 10MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProofChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* TXID / Hash input */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">
              Blockchain TXID / Transaction Hash (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 7f8a9b1c2d3e4f5..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-[#FF5500] focus:bg-white text-gray-900"
            />
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">
              Note for Admin (Optional)
            </label>
            <input
              type="text"
              placeholder="Any additional details..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#FF5500] focus:bg-white text-gray-900"
            />
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#FF5500] hover:bg-[#E04B00] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#FF5500]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting USDT Deposit...</span>
              </>
            ) : (
              <span>Submit USDT Deposit (₹{numInr})</span>
            )}
          </button>
        </form>

        {/* USDT Deposit History */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              USDT Deposit History
            </h3>
            <button
              type="button"
              onClick={reloadHistory}
              disabled={historyLoading}
              className="text-xs text-gray-500 hover:text-[#FF5500] flex items-center gap-1 font-medium cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl animate-pulse flex justify-between">
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-4 w-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="py-6 text-center text-gray-400">
              <FileText className="w-7 h-7 mx-auto mb-1.5 opacity-30" />
              <p className="text-xs font-medium">No USDT deposits yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((item) => (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-gray-900">
                        ₹{item.amountInr.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold ml-2">
                        ({item.usdtAmount} USDT via {item.network})
                      </span>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                      {new Date(item.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {item.proofUrl && (
                      <button
                        type="button"
                        onClick={() => openScreenshot(item)}
                        className="text-[#FF5500] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Proof</span>
                      </button>
                    )}
                  </div>

                  {item.adminNote && (
                    <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-600 border border-gray-100">
                      <strong>Admin note:</strong> {item.adminNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Preview Modal */}
      {viewScreenshotUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-bold text-sm text-gray-900">Payment Screenshot Proof</h4>
              <button
                type="button"
                onClick={() => setViewScreenshotUrl(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto flex items-center justify-center bg-gray-50">
              <img
                src={viewScreenshotUrl}
                alt="Payment proof"
                className="max-h-[65vh] object-contain rounded-lg border border-gray-200"
              />
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-right">
              <button
                type="button"
                onClick={() => setViewScreenshotUrl(null)}
                className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-bold hover:bg-gray-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
