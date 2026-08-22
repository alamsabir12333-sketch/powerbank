import React from 'react';
import {
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Zap,
  Gift,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  Award,
} from 'lucide-react';
import { AdminDashboardStats, AuditLogEntry } from '../../types';

interface AdminDashboardTabProps {
  stats: AdminDashboardStats | null;
  auditLogs?: AuditLogEntry[];
  loading: boolean;
  onRefresh?: () => void;
  onNavigateTab: (tab: string) => void;
  onShowToast?: (msg: string) => void;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({
  stats,
  auditLogs = [],
  loading,
  onRefresh = () => {},
  onNavigateTab,
}) => {
  const statCards = [
    {
      id: 'users',
      label: 'Total Registered Users',
      value: stats ? stats.totalUsers : 0,
      subValue: `${stats?.activeUsers || 0} active accounts`,
      icon: Users,
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
      actionTab: 'users',
    },
    {
      id: 'wallet',
      label: 'Total Platform Wallets',
      value: `₹${(stats?.totalWalletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subValue: 'Aggregated user balances',
      icon: Wallet,
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
      actionTab: 'users',
    },
    {
      id: 'recharges_approved',
      label: 'Total Approved Recharges',
      value: `₹${(stats?.totalRecharge || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subValue: `${stats?.pendingRecharge ? '₹' + stats.pendingRecharge.toLocaleString() + ' pending' : 'Zero pending'}`,
      icon: ArrowDownLeft,
      color: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
      actionTab: 'recharge',
      highlightBadge: stats && stats.pendingRecharge > 0 ? `${stats.pendingRecharge}₹ PENDING` : undefined,
    },
    {
      id: 'withdrawals_completed',
      label: 'Total Paid Withdrawals',
      value: `₹${(stats?.totalWithdrawals || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subValue: `${stats?.pendingWithdrawals ? '₹' + stats.pendingWithdrawals.toLocaleString() + ' pending' : 'Zero pending'}`,
      icon: ArrowUpRight,
      color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
      actionTab: 'withdrawals',
      highlightBadge: stats && stats.pendingWithdrawals > 0 ? `${stats.pendingWithdrawals}₹ ACTION REQUIRED` : undefined,
    },
    {
      id: 'active_investments',
      label: 'Active Hardware Stakes',
      value: `₹${(stats?.totalInvestments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subValue: 'Currently running investments',
      icon: TrendingUp,
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
      actionTab: 'plans',
    },
    {
      id: 'hourly_devices',
      label: 'Active Hourly Devices',
      value: stats?.activeHourlyPlans || 0,
      subValue: 'Yield generated hourly',
      icon: Cpu,
      color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-[#FF6000]',
      actionTab: 'earnings',
    },
    {
      id: 'pro_devices',
      label: 'Active High-Yield PRO Devices',
      value: stats?.activeProPlans || 0,
      subValue: 'Maturity yield contracts',
      icon: Zap,
      color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
      actionTab: 'earnings',
    },
    {
      id: 'claimable_yield',
      label: 'Unclaimed Device Yield',
      value: `₹${(stats?.totalClaimableEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subValue: 'Ready in users My Device',
      icon: Clock,
      color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
      actionTab: 'earnings',
    },
    {
      id: 'claimed_yield',
      label: 'Total Yield Claimed to Wallet',
      value: `₹${(stats?.totalClaimedEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subValue: 'Moved to withdrawable balance',
      icon: CheckCircle2,
      color: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400',
      actionTab: 'earnings',
    },
    {
      id: 'referral_bonuses',
      label: 'Total Referral Commissions',
      value: `₹${(stats?.referralEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      subValue: 'Multi-tier rewards credited',
      icon: Gift,
      color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400',
      actionTab: 'referrals',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161b22] border border-gray-800/80 rounded-2xl p-4 sm:p-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Executive Platform Overview</span>
            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[11px] font-semibold px-2 py-0.5 rounded-full">
              LIVE REAL-TIME
            </span>
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Real-time financial telemetry, liquidity metrics, and operational audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {/* 10 Statistics Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => onNavigateTab(card.actionTab)}
              className={`relative bg-[#161b22] border rounded-2xl p-4 hover:border-gray-600 transition-all cursor-pointer group flex flex-col justify-between ${card.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                    <Icon className="w-4 h-4" />
                  </div>
                  {card.highlightBadge && (
                    <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                      {card.highlightBadge}
                    </span>
                  )}
                </div>
                <div className="text-gray-400 text-[11.5px] font-medium leading-tight">
                  {card.label}
                </div>
                <div className="text-xl font-extrabold text-white tracking-tight mt-1">
                  {card.value}
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between">
                <span>{card.subValue}</span>
                <span className="text-gray-400 group-hover:text-white transition-colors text-[10px] font-semibold">
                  Manage &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Health Summary Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Net Liquidity Engine */}
        <div className="bg-gradient-to-br from-[#161b22] to-[#1c232d] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-gray-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FF6000]" />
              Platform Liquidity Ratio
            </h3>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              HEALTHY
            </span>
          </div>
          <div className="space-y-2.5 text-xs text-gray-300">
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">Total Deposits Processed</span>
              <span className="font-bold text-green-400">₹{(stats?.totalRecharge || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">Total Withdrawals Cleared</span>
              <span className="font-bold text-purple-400">₹{(stats?.totalWithdrawals || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 font-semibold text-sm">
              <span className="text-gray-200">Net Platform Reserve</span>
              <span className="text-[#FF6000] font-black">
                ₹{((stats?.totalRecharge || 0) - (stats?.totalWithdrawals || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Dispatch */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-gray-200 flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Direct Action Dispatch
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              One-click shortcuts to key operational queue modules.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onNavigateTab('recharge')}
              className="p-2.5 rounded-xl bg-orange-950/30 border border-orange-700/40 text-orange-400 text-xs font-bold hover:bg-orange-900/30 transition-all text-left"
            >
              Verify Recharges
            </button>
            <button
              onClick={() => onNavigateTab('withdrawals')}
              className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-700/40 text-purple-400 text-xs font-bold hover:bg-purple-900/30 transition-all text-left"
            >
              Process Withdrawals
            </button>
            <button
              onClick={() => onNavigateTab('users')}
              className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-400 text-xs font-bold hover:bg-blue-900/30 transition-all text-left"
            >
              Manage Users
            </button>
            <button
              onClick={() => onNavigateTab('settings')}
              className="p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-xs font-bold hover:bg-gray-700 transition-all text-left"
            >
              System Controls
            </button>
          </div>
        </div>

        {/* Security & Audit Pulse */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-gray-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              Security Integrity Status
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">TLS / RLS SECURE</span>
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>RLS Database Authorization enforced</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Device yield isolated to My Device claim flow</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Double-entry ledger with atomic balance updates</span>
            </p>
            <div className="pt-2 text-right">
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-xs font-bold text-[#FF6000] hover:underline"
              >
                View Full Audit Logs &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Audit Activities Stream */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Recent Security & Administrative Actions
          </h3>
          <button
            onClick={() => onNavigateTab('audit')}
            className="text-xs text-[#FF6000] hover:underline font-semibold"
          >
            All Logs ({auditLogs.length})
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-500">
            No administrative operations recorded yet in current session.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px]">
                    {log.action}
                  </span>
                  <span className="text-gray-300 font-medium">{log.description}</span>
                </div>
                <span className="text-gray-500 text-[10.5px]">
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
