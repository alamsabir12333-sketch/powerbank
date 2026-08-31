import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Info,
  Zap,
  Layers,
  Crown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Users,
  Gift,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ShoppingBasket,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Percent,
  TrendingUp,
  Cpu,
  ChevronRight,
  Flame,
  Award,
  Star,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import {
  TabType,
  AboutPlatformConfig,
  ProductItem,
  VipLevel,
  SystemSettings,
  ReferralSettings,
} from '../types';
import {
  fetchAboutPlatformConfig,
  fetchPlans,
  fetchVipLevels,
  fetchSystemSettings,
  fetchAdminReferralData,
} from '../services/api';
import { defaultAboutPlatformConfig, defaultReferralSettings } from '../data/mockData';

interface AboutPlatformPageProps {
  onBack: () => void;
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const AboutPlatformPage: React.FC<AboutPlatformPageProps> = ({
  onBack,
  onNavigateTab,
  onShowToast,
}) => {
  const [config, setConfig] = useState<AboutPlatformConfig>(defaultAboutPlatformConfig);
  const [plans, setPlans] = useState<ProductItem[]>([]);
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings>(defaultReferralSettings);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllData = async (isManual: boolean = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [cfg, plansData, vipData, sysSettings, refData] = await Promise.all([
        fetchAboutPlatformConfig().catch(() => defaultAboutPlatformConfig),
        fetchPlans().catch(() => []),
        fetchVipLevels().catch(() => []),
        fetchSystemSettings().catch(() => null),
        fetchAdminReferralData().then((res) => res.settings).catch(() => defaultReferralSettings),
      ]);

      setConfig(cfg);
      setPlans(plansData.filter((p) => p.status !== 'archived'));
      setVipLevels(vipData.filter((v) => v.isActive !== false));
      setSystemSettings(sysSettings);
      setReferralSettings(refData);

      if (isManual) {
        onShowToast('Platform rules and rates updated');
      }
    } catch (e) {
      console.warn('Failed to load about platform data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const getIconComponent = (iconName?: string, className: string = 'w-4 h-4') => {
    switch (iconName?.toLowerCase()) {
      case 'creditcard':
      case 'card':
        return <CreditCard className={className} />;
      case 'shoppingbasket':
      case 'basket':
      case 'cart':
        return <ShoppingBasket className={className} />;
      case 'zap':
      case 'flash':
        return <Zap className={className} />;
      case 'arrowdownleft':
      case 'claim':
        return <ArrowDownLeft className={className} />;
      case 'crown':
      case 'vip':
        return <Crown className={className} />;
      case 'wallet':
        return <Wallet className={className} />;
      case 'arrowupright':
      case 'withdraw':
        return <ArrowUpRight className={className} />;
      case 'coins':
      case 'cash':
        return <Coins className={className} />;
      case 'users':
      case 'team':
        return <Users className={className} />;
      case 'gift':
      case 'bonus':
        return <Gift className={className} />;
      case 'sparkles':
      case 'star':
        return <Sparkles className={className} />;
      case 'shield':
      case 'shieldcheck':
      case 'security':
        return <ShieldCheck className={className} />;
      case 'cpu':
      case 'device':
        return <Cpu className={className} />;
      default:
        return <Info className={className} />;
    }
  };

  // Safe financial values computed dynamically
  const minWithdrawal = systemSettings?.minWithdrawal ?? 150;
  const withdrawalFee = systemSettings?.withdrawalFeePercent ?? 5;
  const signUpBonus = systemSettings?.signUpBonusAmount ?? 75;
  const dailyCheckIn = systemSettings?.dailyCheckInAmount ?? 5;
  const dailyCheckInDay7 = systemSettings?.dailyCheckInDay7Bonus ?? 100;
  const inviteBonus = referralSettings?.registrationReward?.rewardAmount ?? 0;
  const activeTiers = (referralSettings?.topupTiers || []).filter((t) => t.enabled !== false);

  const sections = config.sections || defaultAboutPlatformConfig.sections;

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-gray-900 flex flex-col pb-28">
      {/* 1. Header (Matching ME / VIP page aesthetic) */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 py-3.5 flex items-center justify-between shadow-xs">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 text-gray-700 transition-all cursor-pointer"
          aria-label="Go Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <h1 className="font-extrabold text-[17px] text-gray-900 tracking-tight flex items-center gap-1.5">
          <Info className="w-4.5 h-4.5 text-[#FF6000]" />
          <span>About Platform</span>
        </h1>

        <button
          onClick={() => loadAllData(true)}
          disabled={refreshing}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 active:scale-95 text-gray-600 transition-all cursor-pointer"
          title="Refresh Platform Rules"
        >
          <RefreshCw className={`w-4.5 h-4.5 ${refreshing ? 'animate-spin text-[#FF6000]' : ''}`} />
        </button>
      </header>

      {/* 2. Main Content */}
      <main className="px-4 pt-4 space-y-4 max-w-md mx-auto w-full">
        {/* 2.1 Hero Platform Brand Card */}
        <div className="relative w-full rounded-2xl overflow-hidden p-5 bg-gradient-to-br from-[#FF6000] via-[#FF7A00] to-[#E65100] text-white shadow-lg shadow-orange-600/20">
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/10 blur-lg pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white font-extrabold text-[10px] tracking-wide uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-200" />
                <span>{config.heroBadge || 'OFFICIAL PLATFORM GUIDE'}</span>
              </div>
              <span className="text-[11px] font-mono text-white/80">{config.appVersion || 'v2.4.0'}</span>
            </div>

            <h2 className="text-xl font-black text-white tracking-tight leading-snug">
              {config.pageTitle || 'About Platform & Operating Rules'}
            </h2>
            <p className="text-white/90 text-xs mt-1.5 leading-relaxed">
              {config.pageSubtitle || 'Complete business rules, yield calculation guide, and member reward policies.'}
            </p>

            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-white/90">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
                <span>Automated Smart Yield Settlement</span>
              </div>
              <span className="font-bold">{config.companyName || 'Power Bank Network'}</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: HOW INVESTING WORKS */}
        {sections.investingSteps?.enabled !== false && (
          <div className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-[#FF6000] flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {sections.investingSteps?.title || '1. How Investing Works'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {sections.investingSteps?.description || 'Automated 4-step revenue cycle'}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6000] text-[10px] font-extrabold">
                Process
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {(config.investingSteps || defaultAboutPlatformConfig.investingSteps)
                .filter((s) => s.enabled !== false)
                .map((step, idx) => (
                  <div
                    key={step.id || idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-orange-200 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#FF6000] text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      {step.stepNumber || idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                          {getIconComponent(step.icon, 'w-3.5 h-3.5 text-[#FF6000]')}
                          <span>{step.title}</span>
                        </h4>
                        {step.badge && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-white text-gray-600 border border-gray-200">
                            {step.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-gray-600 mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => onNavigateTab('purchase')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <ShoppingBasket className="w-3.5 h-3.5" />
                <span>Explore Investment Hall</span>
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: PLAN & RETURN RULES */}
        {sections.planRules?.enabled !== false && (
          <div className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {sections.planRules?.title || '2. Plan & Return Rules'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {sections.planRules?.description || 'Active power plans & yield parameters'}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold">
                {plans.length} Active Plans
              </span>
            </div>

            <div className="space-y-2.5">
              {plans.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">Loading plan rules...</div>
              ) : (
                plans.map((plan) => {
                  const isPro = (plan.category || '').toUpperCase() === 'PRO';
                  const dailyReturn = isPro
                    ? Number(plan.dailyEarnings || 0)
                    : Number(plan.hourlyEarnings || 0) * 24;
                  const duration = Number(plan.durationDays || plan.duration || 365);
                  const totalReturn = +(dailyReturn * duration).toFixed(2);
                  const price = Number(plan.devicePrice || plan.price || 0);

                  return (
                    <div
                      key={plan.id}
                      className="p-3 rounded-xl border border-gray-200/80 bg-gray-50/50 hover:bg-white hover:border-[#FF6000]/40 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase ${
                              isPro
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-orange-100 text-[#FF6000] border border-orange-200'
                            }`}
                          >
                            {plan.category || 'HOURLY'}
                          </span>
                          <h4 className="font-bold text-xs text-gray-900">{plan.name}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-[#FF6000]">₹{price.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 pt-1 text-center bg-white p-2 rounded-lg border border-gray-100 text-[10.5px]">
                        <div>
                          <div className="text-gray-400 text-[9.5px]">Daily Rate</div>
                          <div className="font-bold text-emerald-600 mt-0.5">₹{dailyReturn.toFixed(2)}/d</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-[9.5px]">Duration</div>
                          <div className="font-bold text-gray-700 mt-0.5">{duration} Days</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-[9.5px]">Total Return</div>
                          <div className="font-black text-gray-900 mt-0.5">₹{totalReturn.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-[9.5px]">Max Limit</div>
                          <div className="font-bold text-gray-700 mt-0.5">{plan.limit || 3} Units</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: VIP UNLOCK */}
        {sections.vipUnlock?.enabled !== false && (
          <div className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {sections.vipUnlock?.title || '3. VIP Unlock & Tiers'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {sections.vipUnlock?.description || 'Investment thresholds & privilege rates'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('vip_levels')}
                className="text-[11px] font-bold text-[#FF6000] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>View Status</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {vipLevels.map((lvl) => (
                <div
                  key={lvl.id || lvl.levelNumber}
                  className="p-2.5 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/60 to-orange-50/40 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-black text-[9px]">
                      {lvl.badgeText || `VIP ${lvl.levelNumber}`}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">
                      {lvl.levelNumber === 0 ? 'Starter' : `Level ${lvl.levelNumber}`}
                    </span>
                  </div>
                  <div className="text-xs font-black text-gray-900 pt-0.5">
                    ≥ ₹{Number(lvl.minInvestment || 0).toLocaleString('en-IN')}
                  </div>
                  <p className="text-[10px] text-gray-600 line-clamp-1">
                    {lvl.dailyBonusRate ? `+${lvl.dailyBonusRate}% Daily Bonus` : lvl.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4 & 5: TOPUP WALLET & WITHDRAW WALLET */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.topupWallet?.enabled !== false && (
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-200/80 space-y-2.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-extrabold text-xs text-gray-900">
                  {sections.topupWallet?.title || '4. Topup Wallet'}
                </h3>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Topup Wallet is dedicated exclusively to funding and activating power devices.
              </p>
              <div className="space-y-1.5 text-[11px] text-gray-700 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
                <div className="font-bold text-blue-900 text-[10.5px]">Used for:</div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>Recharge deposits</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>Daily check-in streak bonus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>Signup welcome bonus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>Plan purchases & activations</span>
                </div>
                <div className="text-[10px] text-red-600 font-semibold pt-1 border-t border-blue-200/60 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Cannot be withdrawn directly as cash</span>
                </div>
              </div>
            </div>
          )}

          {sections.withdrawWallet?.enabled !== false && (
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-200/80 space-y-2.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-extrabold text-xs text-gray-900">
                  {sections.withdrawWallet?.title || '5. Withdraw Wallet'}
                </h3>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Withdraw Wallet accumulates all legitimate income for instant bank withdrawal.
              </p>
              <div className="space-y-1.5 text-[11px] text-gray-700 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                <div className="font-bold text-emerald-900 text-[10.5px]">Receives eligible:</div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Device hourly claim returns</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Team referral commissions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Gift code cash bonuses</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-emerald-200/60 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Withdrawable to registered bank account</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 6: WITHDRAW RULES */}
        {sections.withdrawRules?.enabled !== false && (
          <div className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {sections.withdrawRules?.title || '6. Withdrawal Rules'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {sections.withdrawRules?.description || 'Dynamic limits & settlement policy'}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-extrabold">
                Live Policy
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-center">
                <div className="text-gray-500 text-[10.5px]">Minimum Withdrawal</div>
                <div className="text-base font-black text-[#FF6000] mt-0.5">₹{minWithdrawal}</div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">Instant gateway processing</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-center">
                <div className="text-gray-500 text-[10.5px]">Withdrawal Fee</div>
                <div className="text-base font-black text-rose-600 mt-0.5">{withdrawalFee}%</div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">Bank processing fee</div>
              </div>
            </div>

            <div className="space-y-2 text-[11.5px] text-gray-600 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span>Withdrawal processing time: Monday to Sunday, 09:00 to 18:00 IST.</span>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span>Ensure your bound bank account details and IFSC code are accurate.</span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 7: TEAM COMMISSION */}
        {sections.teamCommission?.enabled !== false && (
          <div className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {sections.teamCommission?.title || '7. Team Commission'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {sections.teamCommission?.description || 'Multi-tier affiliate commission rates'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('team')}
                className="text-[11px] font-bold text-[#FF6000] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>My Team</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {activeTiers.map((tier) => (
                <div
                  key={tier.tier}
                  className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-center space-y-1"
                >
                  <div className="w-5 h-5 mx-auto rounded-full bg-purple-600 text-white font-extrabold text-[10px] flex items-center justify-center">
                    L{tier.tier}
                  </div>
                  <div className="text-xs font-bold text-gray-800">{tier.name || `Tier ${tier.tier}`}</div>
                  <div className="text-base font-black text-purple-700">{tier.percentage}%</div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-500 text-center">
              Commissions are settled dynamically to your Withdraw Wallet whenever invited team members recharge.
            </p>
          </div>
        )}

        {/* SECTION 8: BONUSES */}
        {sections.bonuses?.enabled !== false && (
          <div className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {sections.bonuses?.title || '8. Bonuses & Free Rewards'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {sections.bonuses?.description || 'Configured platform welcome & daily rewards'}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-extrabold">
                Active Rewards
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-pink-50/40 border border-pink-100 text-center">
                <div className="text-gray-500 text-[10px] font-semibold">Signup Bonus</div>
                <div className="text-sm font-black text-pink-600 mt-0.5">₹{signUpBonus}</div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">First registration</div>
              </div>

              <div className="p-3 rounded-xl bg-pink-50/40 border border-pink-100 text-center">
                <div className="text-gray-500 text-[10px] font-semibold">Daily Check-In</div>
                <div className="text-sm font-black text-amber-600 mt-0.5">₹{dailyCheckIn}</div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">Day 7: ₹{dailyCheckInDay7}</div>
              </div>

              <div className="p-3 rounded-xl bg-pink-50/40 border border-pink-100 text-center">
                <div className="text-gray-500 text-[10px] font-semibold">Invite Register</div>
                <div className="text-sm font-black text-purple-600 mt-0.5">₹{inviteBonus}</div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">Per invited member</div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 9: GIFT CODE */}
        {sections.giftCode?.enabled !== false && (
          <div className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">
                    {sections.giftCode?.title || '9. Gift Code'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {sections.giftCode?.description || 'Redeem event codes for instant cash'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('fortune')}
                className="text-[11px] font-bold text-[#FF6000] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Claim Code</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <p className="text-[11.5px] text-gray-600 leading-relaxed">
              {config.giftCodeNotes ||
                'Users can redeem available Gift Codes from the Claim Gift Code section. Gift Code reward and validity depend on each configured event.'}
            </p>
          </div>
        )}

        {/* SECTION 10: CUSTOM PLATFORM RULES */}
        {sections.customRules?.enabled !== false && (config.customRules || []).length > 0 && (
          <div className="space-y-2.5">
            {(config.customRules || [])
              .filter((rule) => rule.enabled !== false)
              .map((rule) => (
                <div
                  key={rule.id}
                  className="bg-white rounded-2xl p-4.5 shadow-xs border border-gray-200/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-2">
                      {getIconComponent(rule.icon, 'w-4 h-4 text-[#FF6000]')}
                      <span>{rule.title}</span>
                    </h3>
                    {rule.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6000] text-[9.5px] font-bold">
                        {rule.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-gray-600 leading-relaxed pt-0.5">
                    {rule.description}
                  </p>
                </div>
              ))}
          </div>
        )}

        {/* Support & Contact Card */}
        <div className="p-4 rounded-2xl bg-gray-100/80 border border-gray-200 text-center space-y-2">
          <div className="text-xs font-bold text-gray-800">Need Further Assistance?</div>
          <p className="text-[11px] text-gray-500">
            Support Hours: {config.supportHours || '09:00 – 21:00 IST'} • {config.supportEmail || 'support@powerbank-energy.com'}
          </p>
          {config.supportTelegram && (
            <a
              href={config.supportTelegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6000] hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Official Telegram Community</span>
            </a>
          )}
        </div>
      </main>
    </div>
  );
};
