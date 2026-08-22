import React, { useState, useEffect, useMemo } from 'react';
import { ProductCabinetArtwork } from '../components/Artworks';
import { FloatingContact } from '../components/FloatingContact';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import { ProductItem, TabType, Wallet, PlanCategory } from '../types';
import { fetchPlans, purchasePlanWithWallet, checkProEligibility, fetchPurchases } from '../services/api';
import { playCoinSound, playSuccessChime } from '../utils/audio';
import { Zap, ShieldCheck, AlertCircle, ArrowRight, Sparkles, Gift, Lock, CheckCircle2, ChevronRight } from 'lucide-react';
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

  const availableBalance = wallet?.availableBalance || 0;

  // Extract distinct categories dynamically (defaulting to HOURLY and PRO first)
  const categories = useMemo(() => {
    const set = new Set<string>();
    // Guarantee HOURLY and PRO appear first
    set.add('HOURLY');
    set.add('PRO');
    plans.forEach((p) => {
      const cat = (p.category || (p.name.toUpperCase().includes('PRO') ? 'PRO' : 'HOURLY')).toUpperCase();
      set.add(cat);
    });
    return Array.from(set);
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

    if (availableBalance < price) {
      setInsufficientBalanceModal({
        isOpen: true,
        required: price,
        available: availableBalance,
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
      
      await loadData();
      onPurchaseSuccess();
    } catch (err: any) {
      alert(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col pb-28">
      {/* Top Orange Header Banner */}
      <div className="w-full bg-gradient-to-r from-[#FF6B00] via-[#FF7D00] to-[#FFA000] px-4 pt-4 pb-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-white fill-white" />
            <h1 className="text-white font-extrabold text-lg tracking-tight">
              Purchase Hall
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-full text-white text-xs font-semibold">
              <span>Balance: ₹{availableBalance.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full text-white text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Guaranteed Yield</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Plan Categories Tabs: [ HOURLY PLAN ] [ PRO PLAN ] */}
      <div className="bg-white border-b border-gray-200/80 px-3 py-2 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const isPro = cat === 'PRO';
            const label = cat === 'HOURLY' ? 'HOURLY PLAN' : cat === 'PRO' ? 'PRO PLAN' : `${cat} PLAN`;
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
                      : 'bg-[#FF6000] text-white shadow-sm shadow-orange-500/25'
                    : 'bg-gray-100/90 text-gray-600 hover:bg-gray-200/70'
                }`}
              >
                {isPro && <Sparkles className={`w-3.5 h-3.5 ${isActive ? 'text-gray-950' : 'text-amber-500'}`} />}
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

      {/* Product List matching Screenshot 3 */}
      <div className="px-3.5 pt-3 space-y-3.5">
        {filteredPlans.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">No devices available in this category</p>
            <p className="text-xs text-gray-500">Please check back soon or browse other plan categories.</p>
          </div>
        ) : (
          filteredPlans.map((item) => {
            const isPro = (item.category || '').toUpperCase() === 'PRO' || item.name.toUpperCase().includes('PRO');
            const price = item.devicePrice || item.price || 0;
            const instantBonus = item.instantBonus || 0;
            const dailyEarn = item.dailyEarnings || (item.hourlyEarnings ? +(item.hourlyEarnings * 24).toFixed(2) : 0);
            const duration = item.durationDays || item.duration || (isPro ? 7 : 365);
            const totalReturn = (dailyEarn * duration) + instantBonus;

            return (
              <div
                key={item.id}
                className={`w-full bg-white rounded-2xl border p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3 transition-all ${
                  isPro ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/20 to-white' : 'border-gray-200/70'
                }`}
              >
                {/* Instant Bonus Ribbon for PRO Plans */}
                {instantBonus > 0 && (
                  <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-gray-950 px-3 py-1 -mt-1 -mx-1 rounded-xl text-xs font-black shadow-xs">
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
                      type={item.imageType || (isPro ? 'cabinet-pro' : 'cabinet-green')}
                      className="w-16 h-16 rounded-xl border border-gray-900"
                    />
                    <span className={`mt-1 px-2 py-0.5 rounded-full text-white font-bold text-[9.5px] leading-none shadow-2xs ${
                      isPro ? 'bg-amber-600' : 'bg-[#FF6200]'
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
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {item.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              isPro
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
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
                      ₹{isPro ? dailyEarn : item.hourlyEarnings}
                    </span>
                    <span className="text-gray-400 text-[10.5px] font-medium -mt-0.5">
                      {isPro ? 'Daily Earn' : 'Hourly Earn'} (₹)
                    </span>
                  </div>

                  {/* Buy Button */}
                  <button
                    onClick={() => handleBuyClick(item)}
                    className={`px-6 py-1.5 rounded-lg text-white font-bold text-[14px] shadow-sm active:scale-95 transition-all ${
                      isPro
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-950 font-black shadow-amber-500/25 hover:from-amber-600 hover:to-yellow-600'
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
                  <span className="font-bold text-green-700">
                    ₹{(selectedProduct.dailyEarnings || (selectedProduct.hourlyEarnings * 24)).toFixed(2)}/day
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-bold text-gray-800">
                    {selectedProduct.durationDays || selectedProduct.duration || 365} Days
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-orange-200/50">
                  <span className="text-gray-600">Wallet Balance After:</span>
                  <span className="font-bold text-gray-900">
                    ₹{(
                      availableBalance - 
                      (selectedProduct.devicePrice || selectedProduct.price || 0) +
                      (selectedProduct.instantBonus || 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={purchasing}
                  onClick={handleConfirmPurchase}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6000] hover:bg-[#E65100] text-white font-bold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {purchasing ? 'Activating...' : 'Confirm & Activate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRO Eligibility Requirement Modal */}
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
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl z-10 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Active Hourly Plan Required</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {eligibilityModal.reason || 'You must have an active Hourly Plan to purchase this PRO Plan.'}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 font-medium">
                Current Active Hourly Plans: <span className="font-bold">{eligibilityModal.activeHourlyCount}</span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEligibilityModal({ isOpen: false, reason: '', activeHourlyCount: 0 })}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEligibilityModal({ isOpen: false, reason: '', activeHourlyCount: 0 });
                    setSelectedCategory('HOURLY');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6000] text-white font-bold text-xs shadow-md flex items-center justify-center gap-1"
                >
                  <span>View Hourly Plans</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Insufficient Balance Modal */}
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
              className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl z-10 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Insufficient Wallet Balance</h3>
              <p className="text-xs text-gray-600">
                You have <span className="font-bold text-gray-900">₹{insufficientBalanceModal.available.toFixed(2)}</span> in your wallet. This device requires <span className="font-bold text-[#FF6000]">₹{insufficientBalanceModal.required}</span>.
              </p>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setInsufficientBalanceModal({ isOpen: false, required: 0, available: 0 })}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInsufficientBalanceModal({ isOpen: false, required: 0, available: 0 });
                    onOpenRecharge();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6000] text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>Recharge Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
