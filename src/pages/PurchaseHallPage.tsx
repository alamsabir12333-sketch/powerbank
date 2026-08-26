import React, { useState, useEffect, useMemo } from 'react';
import { ProductCabinetArtwork } from '../components/Artworks';
import { FloatingContact } from '../components/FloatingContact';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import { ProductItem, TabType, Wallet, PlanCategory } from '../types';
import { fetchPlans, purchasePlanWithWallet, checkProEligibility, fetchPurchases } from '../services/api';
import { playCoinSound, playSuccessChime } from '../utils/audio';
import { Zap, ShieldCheck, AlertCircle, ArrowRight, Sparkles, Gift, Lock, CheckCircle2, ChevronRight, Flame, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PurchaseHallPageProps {
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
  userId: string;
  wallet: Wallet | null;
  onOpenRecharge: () => void;
  onPurchaseSuccess: () => void;
}

export const PurchaseHallPage: React.FC<PurchaseHallPageProps> = ({
  onNavigateTab,
  onShowToast,
  userId,
  wallet,
  onOpenRecharge,
  onPurchaseSuccess,
}) => {
  const [plans, setPlans] = useState<ProductItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('HOURLY');
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [insufficientBalanceModal, setInsufficientBalanceModal] = useState<{
    isOpen: boolean;
    required: number;
    available: number;
  }>({ isOpen: false, required: 0, available: 0 });
  const [eligibilityModal, setEligibilityModal] = useState<{
    isOpen: boolean;
    reason: string;
    activeHourlyCount: number;
  }>({ isOpen: false, reason: '', activeHourlyCount: 0 });
  const [purchasing, setPurchasing] = useState(false);
  const [proEligibility, setProEligibility] = useState<{
    eligible: boolean;
    reason?: string;
    activeHourlyCount: number;
  }>({ eligible: true, activeHourlyCount: 0 });

  const loadData = async () => {
    try {
      const [fetchedPlans, eligibility] = await Promise.all([
        fetchPlans(),
        checkProEligibility(userId),
      ]);
      setPlans(fetchedPlans.filter((p) => p.status !== 'archived'));
      setProEligibility(eligibility);
    } catch (e) {
      console.error('Error loading plans/eligibility:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const topupBalance = wallet?.topupBalance ?? wallet?.rechargeBalance ?? wallet?.availableBalance ?? 0;

  // Extract distinct categories dynamically (guaranteeing HOURLY, PRO, EVENT appear in priority order)
  const categories = useMemo(() => {
    const list: string[] = ['HOURLY', 'PRO', 'EVENT'];
    plans.forEach((p) => {
      const cat = (p.category || (p.name.toUpperCase().includes('PRO') ? 'PRO' : 'HOURLY')).toUpperCase();
      if (!list.includes(cat)) {
        list.push(cat);
      }
    });
    return list;
  }, [plans]);

  // Filter plans by selected category
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const cat = (p.category || (p.name.toUpperCase().includes('PRO') ? 'PRO' : 'HOURLY')).toUpperCase();
      return cat === selectedCategory;
    });
  }, [plans, selectedCategory]);

  const handleBuyClick = async (product: ProductItem) => {
    const isPro = (product.category || '').toUpperCase() === 'PRO' || product.name.toUpperCase().includes('PRO');
    const isEvent = (product.category || '').toUpperCase() === 'EVENT' || product.name.toUpperCase().includes('EVENT');
    const price = product.devicePrice || product.price || 0;

    // Check PRO eligibility
    if (isPro) {
      const check = await checkProEligibility(userId, product.id);
      if (!check.eligible) {
        setEligibilityModal({
          isOpen: true,
          reason: check.reason || 'Active Hourly Plan required to activate PRO Plans.',
          activeHourlyCount: check.activeHourlyCount,
        });
        return;
      }
    }

    // Check Event Plan active time window
    if (isEvent || product.startAt || product.endAt || product.startDate || product.endDate) {
      const now = Date.now();
      const start = product.startAt || product.startDate;
      const end = product.endAt || product.endDate;
      if (start && now < new Date(start).getTime()) {
        onShowToast('This Event Plan has not started yet. Please check back when it opens.');
        return;
      }
      if (end && now > new Date(end).getTime()) {
        onShowToast('This Event Plan has ended.');
        return;
      }
    }

    if (topupBalance < price) {
      setInsufficientBalanceModal({
        isOpen: true,
        required: price,
        available: topupBalance,
      });
      return;
    }

    setSelectedProduct(product);
    setIsConfirmOpen(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct) return;
    setPurchasing(true);
    try {
      const res = await purchasePlanWithWallet(userId, selectedProduct);
      setIsConfirmOpen(false);
      
      // Play coin collection / success sound
      playCoinSound();
      playSuccessChime();

      if (selectedProduct.instantBonus && selectedProduct.instantBonus > 0) {
        onShowToast(`🎉 ${selectedProduct.name} activated! Instant cashback of ₹${selectedProduct.instantBonus} credited to wallet!`);
      } else {
        onShowToast(`Successfully acquired ${selectedProduct.name}! Yield generating now.`);
      }
      
      onPurchaseSuccess();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] pb-28">
      {/* 1. Header Section */}
      <div className="w-full bg-[#FF6000] px-4 pt-4 pb-3 flex items-center justify-between shadow-xs">
        <h1 className="text-lg font-bold text-white tracking-wide">Purchase Hall</h1>
        <div className="flex items-center gap-2">
          <div className="bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1.5 border border-white/20">
            <span>Topup: ₹{topupBalance.toFixed(2)}</span>
          </div>
          <button
            onClick={onOpenRecharge}
            className="px-2.5 py-1 rounded-full bg-white text-[#FF6000] text-xs font-black shadow-xs hover:bg-orange-50 active:scale-95 transition-all"
          >
            + Topup
          </button>
        </div>
      </div>

      {/* Dynamic Plan Categories Tabs: [ HOURLY PLAN ] [ PRO PLAN ] [ EVENT PLAN ] */}
      <div className="bg-white border-b border-gray-200/80 px-3 py-2 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const isPro = cat === 'PRO';
            const isEvent = cat === 'EVENT';
            const label = cat === 'HOURLY' ? 'HOURLY PLAN' : cat === 'PRO' ? 'PRO PLAN' : cat === 'EVENT' ? 'EVENT PLAN' : `${cat} PLAN`;
            const count = plans.filter((p) => {
              const pCat = (p.category || (p.name.toUpperCase().includes('PRO') ? 'PRO' : 'HOURLY')).toUpperCase();
              return pCat === cat;
            }).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`relative px-4 py-2 rounded-xl font-bold text-xs tracking-tight transition-all shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? isPro
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-950 shadow-sm shadow-amber-500/30'
                      : isEvent
                      ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/30'
                      : 'bg-[#FF6000] text-white shadow-sm shadow-orange-500/25'
                    : 'bg-gray-100/90 text-gray-600 hover:bg-gray-200/70'
                }`}
              >
                {isPro && <Sparkles className={`w-3.5 h-3.5 ${isActive ? 'text-gray-950' : 'text-amber-500'}`} />}
                {isEvent && <Flame className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-rose-500'}`} />}
                <span>{label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive
                        ? isPro
                          ? 'bg-black/20 text-gray-950'
                          : 'bg-white/25 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
                {isPro && !proEligibility.eligible && (
                  <Lock className="w-3 h-3 text-amber-900/60" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* PRO Plan Eligibility Notice Banner (shown when viewing PRO tab) */}
      {selectedCategory === 'PRO' && (
        <div className="mx-3.5 mt-3">
          {proEligibility.eligible ? (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/90 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-gray-950 flex items-center justify-center font-bold text-sm shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950">PRO VIP Eligibility Unlocked</h4>
                  <p className="text-[10.5px] text-amber-800 font-medium">
                    Active Hourly Devices: <span className="font-bold">{proEligibility.activeHourlyCount}</span>. Enjoy instant bonus & high returns!
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-extrabold text-[10px]">
                ELIGIBLE
              </span>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/90 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6000] flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-900">Active Hourly Plan Required</h4>
                  <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                    PRO Plans offer exclusive instant cash bonuses and accelerated daily revenue. Activate at least 1 standard Hourly Plan to unlock PRO access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategory('HOURLY')}
                className="w-full py-1.5 rounded-xl bg-[#FF6000] hover:bg-[#E65100] text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all"
              >
                <span>VIEW HOURLY PLANS</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* EVENT Plan Banner (shown when viewing EVENT tab) */}
      {selectedCategory === 'EVENT' && (
        <div className="mx-3.5 mt-3">
          <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200/90 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-950">Festival & Limited Event Plans</h4>
                <p className="text-[10.5px] text-rose-800 font-medium">
                  Exclusive carnival power stations with accelerated returns. Activated using Topup Wallet.
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] uppercase">
              LIMITED TIME
            </span>
          </div>
        </div>
      )}

      {/* Product List matching Gain Power UI */}
      <div className="px-3.5 pt-3 space-y-3.5">
        {filteredPlans.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No devices available in this category</p>
            <p className="text-xs text-gray-500">Please check back soon or browse other plan categories.</p>
          </div>
        ) : (
          filteredPlans.map((item) => {
            const isPro = (item.category || '').toUpperCase() === 'PRO' || item.name.toUpperCase().includes('PRO');
            const isEvent = (item.category || '').toUpperCase() === 'EVENT' || item.name.toUpperCase().includes('EVENT');
            const price = item.devicePrice || item.price || 0;
            const instantBonus = item.instantBonus || 0;
            const dailyEarn = item.dailyEarnings || (item.hourlyEarnings ? +(item.hourlyEarnings * 24).toFixed(2) : 0);
            const duration = item.durationDays || item.duration || (isPro ? 7 : isEvent ? 15 : 365);
            const totalReturn = (dailyEarn * duration) + instantBonus;

            return (
              <div
                key={item.id}
                className={`w-full bg-white rounded-2xl border p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 transition-all ${
                  isPro
                    ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/20 to-white'
                    : isEvent
                    ? 'border-rose-300/80 bg-gradient-to-b from-rose-50/20 to-white'
                    : 'border-gray-200/70'
                }`}
              >
                {/* Instant Bonus Ribbon */}
                {instantBonus > 0 && (
                  <div className={`flex items-center justify-between px-3 py-1 -mt-1 -mx-1 rounded-xl text-xs font-black shadow-xs ${
                    isEvent
                      ? 'bg-gradient-to-r from-rose-500 via-orange-400 to-rose-500 text-white'
                      : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-gray-950'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5" />
                      <span>Instant Bonus Cashback: ₹{instantBonus}</span>
                    </div>
                    <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-md font-bold uppercase">
                      CREDITED IMMEDIATELY
                    </span>
                  </div>
                )}

                {/* Top Product Section: Image on left + Title & Tags beside it */}
                <div className="flex items-start gap-3">
                  {/* Product Image box with limit pill below it */}
                  <div className="flex flex-col items-center shrink-0">
                    <ProductCabinetArtwork
                      type={item.imageType || (isPro ? 'cabinet-pro' : isEvent ? 'cabinet-gold' : 'cabinet-green')}
                      className="w-16 h-16 rounded-xl border border-gray-900"
                    />
                    <span className={`mt-1 px-2 py-0.5 rounded-full text-white font-bold text-[9.5px] leading-none shadow-2xs ${
                      isPro ? 'bg-amber-600' : isEvent ? 'bg-rose-600' : 'bg-[#FF6200]'
                    }`}>
                      {item.limit} limit
                    </span>
                  </div>

                  {/* Title & Tags */}
                  <div className="flex flex-col justify-between min-h-[64px] flex-1">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-[16px] font-semibold text-gray-900 font-cabinet-title italic tracking-tight leading-snug">
                          {item.name}
                        </h3>
                        {isPro && (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-extrabold rounded-sm">
                            PRO
                          </span>
                        )}
                        {isEvent && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[9px] font-extrabold rounded-sm">
                            EVENT
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {item.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              isPro
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : isEvent
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-[#FFF3E0] text-[#D97706] border-[#FFE0B2]'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Cycle duration summary */}
                    <div className="text-[11px] text-gray-500 font-medium mt-1">
                      Cycle Duration: <span className="font-bold text-gray-800">{duration} Days</span>
                      {totalReturn > 0 && (
                        <span className="text-green-600 font-bold ml-1.5">
                          (Est. Total: ₹{totalReturn.toFixed(0)})
                        </span>
                      )}
                    </div>

                    {/* Event Dates if configured */}
                    {(item.startDate || item.startAt) && (
                      <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Event: {item.startDate || item.startAt?.slice(0, 10)} to {item.endDate || item.endAt?.slice(0, 10)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Price, Earnings & Buy Button */}
                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                  {/* Device Price */}
                  <div className="flex flex-col">
                    <span className="text-[#FF6000] font-black text-[17px] tracking-tight">
                      ₹{price}
                    </span>
                    <span className="text-gray-400 text-[10.5px] font-medium -mt-0.5">
                      Device Price
                    </span>
                  </div>

                  {/* Daily / Hourly Earnings */}
                  <div className="flex flex-col">
                    <span className="text-gray-800 font-black text-[17px] tracking-tight">
                      ₹{isPro || isEvent ? dailyEarn : item.hourlyEarnings}
                    </span>
                    <span className="text-gray-400 text-[10.5px] font-medium -mt-0.5">
                      {isPro || isEvent ? 'Daily Earn' : 'Hourly Earn'} (₹)
                    </span>
                  </div>

                  {/* Buy Button */}
                  <button
                    onClick={() => handleBuyClick(item)}
                    className={`px-6 py-1.5 rounded-lg text-white font-bold text-[14px] shadow-sm active:scale-95 transition-all ${
                      isPro
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-950 font-black shadow-amber-500/25 hover:from-amber-600 hover:to-yellow-600'
                        : isEvent
                        ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white font-black shadow-rose-500/25 hover:from-rose-600 hover:to-red-700'
                        : 'bg-[#FF6000] hover:bg-[#E65100] shadow-orange-500/25'
                    }`}
                  >
                    Buy
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Contact Button */}
      <FloatingContact
        isDark={false}
        onClick={() => setIsSupportOpen(true)}
      />

      <CustomerSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Confirm Purchase Modal */}
      <AnimatePresence>
        {isConfirmOpen && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl z-10 space-y-4"
            >
              <h3 className="text-base font-bold text-gray-900">
                Confirm Device Acquisition
              </h3>
              
              <div className="p-3.5 bg-orange-50/60 rounded-xl border border-orange-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Selected Unit:</span>
                  <span className="font-bold text-gray-900">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span className="font-bold text-amber-700">{selectedProduct.category || 'HOURLY'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Acquisition Cost:</span>
                  <span className="font-bold text-[#FF6000] text-sm">₹{selectedProduct.devicePrice || selectedProduct.price}</span>
                </div>
                
                {selectedProduct.instantBonus && selectedProduct.instantBonus > 0 ? (
                  <div className="flex justify-between text-amber-900 font-bold bg-amber-100/80 px-2 py-1 rounded-md">
                    <span>🎁 Instant Cashback:</span>
                    <span>+₹{selectedProduct.instantBonus}</span>
                  </div>
                ) : null}

                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Revenue:</span>
                  <span className="font-bold text-green-600">₹{selectedProduct.dailyEarnings || (selectedProduct.hourlyEarnings ? +(selectedProduct.hourlyEarnings * 24).toFixed(2) : 0)}/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-bold text-gray-800">{selectedProduct.durationDays || selectedProduct.duration || 365} Days</span>
                </div>
                <div className="flex justify-between border-t border-orange-200/60 pt-1.5 font-bold">
                  <span className="text-gray-700">Payment Wallet:</span>
                  <span className="text-[#FF6000]">Topup Wallet</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPurchase}
                  disabled={purchasing}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8A00] text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:from-[#E65100] hover:to-[#E67E00] active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {purchasing ? (
                    <span>Deploying Unit...</span>
                  ) : (
                    <>
                      <span>Pay ₹{selectedProduct.devicePrice || selectedProduct.price}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Insufficient Topup Balance Modal */}
      <AnimatePresence>
        {insufficientBalanceModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInsufficientBalanceModal({ isOpen: false, required: 0, available: 0 })}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl z-10 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 text-[#FF6000] flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900">
                  Insufficient Topup Wallet Balance
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Plans must be purchased using your <strong className="text-gray-900">Topup Wallet</strong>. Available balance: <span className="font-bold text-[#FF6000]">₹{insufficientBalanceModal.available.toFixed(2)}</span>. Required: <span className="font-bold text-gray-900">₹{insufficientBalanceModal.required.toFixed(2)}</span>.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInsufficientBalanceModal({ isOpen: false, required: 0, available: 0 })}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInsufficientBalanceModal({ isOpen: false, required: 0, available: 0 });
                    onOpenRecharge();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6000] text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:bg-[#E65100] active:scale-95 transition-all"
                >
                  Recharge Topup Wallet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRO Plan Locked / Ineligible Modal */}
      <AnimatePresence>
        {eligibilityModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEligibilityModal({ isOpen: false, reason: '', activeHourlyCount: 0 })}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl z-10 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900">
                  PRO Plan Locked
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {eligibilityModal.reason}
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-left space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Hourly Plans:</span>
                  <span className="font-bold text-gray-900">{eligibilityModal.activeHourlyCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hourly Plan Required:</span>
                  <span className="font-bold text-amber-800">At least 1 active</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEligibilityModal({ isOpen: false, reason: '', activeHourlyCount: 0 })}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEligibilityModal({ isOpen: false, reason: '', activeHourlyCount: 0 });
                    setSelectedCategory('HOURLY');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6000] text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:bg-[#E65100] active:scale-95 transition-all"
                >
                  View Hourly Plans
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
