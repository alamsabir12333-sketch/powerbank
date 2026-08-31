import React, { useState, useEffect } from 'react';
import {
  Zap,
  Cpu,
  Clock,
  CheckCircle2,
  RefreshCw,
  Loader2,
  TrendingUp,
  Award,
  Layers,
} from 'lucide-react';
import {
  fetchEarningsHistory,
  triggerHourlyYieldCycle,
  fetchPurchases,
} from '../../services/api';
import { EarningRecord, ClaimBatch, PurchaseItem } from '../../types';

interface AdminEarningsTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
  onRefreshGlobalStats: () => void;
}

export const AdminEarningsTab: React.FC<AdminEarningsTabProps> = ({
  adminId,
  onShowToast,
  onRefreshGlobalStats,
}) => {
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [claims, setClaims] = useState<ClaimBatch[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CLAIMABLE' | 'CLAIMED'>('ALL');

  const loadEarningsData = async () => {
    setLoading(true);
    try {
      const [earningsRes, purchasesRes] = await Promise.all([
        fetchEarningsHistory('admin'),
        fetchPurchases('admin'),
      ]);
      setEarnings(earningsRes.earnings);
      setClaims(earningsRes.claims);
      setPurchases(purchasesRes);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading earnings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarningsData();
  }, []);

  const handleTriggerCycle = async () => {
    setTriggering(true);
    try {
      const res = await triggerHourlyYieldCycle('admin');
      const count = res.devicesProcessed ?? (res as any).processedCount ?? 0;
      const accrued = res.totalAccrued ?? (res as any).totalYieldAdded ?? 0;
      if (count > 0) {
        onShowToast(`Processed hourly yield cycle for ${count} device(s). Added ₹${accrued.toFixed(2)} claimable yield.`);
      } else {
        onShowToast(res.message || 'All active devices are up-to-date.');
      }
      loadEarningsData();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to trigger yield cycle');
    } finally {
      setTriggering(false);
    }
  };

  const totalClaimable = earnings.filter((e) => e.status === 'CLAIMABLE').reduce((acc, e) => acc + e.amount, 0);
  const totalClaimed = earnings.filter((e) => e.status === 'CLAIMED').reduce((acc, e) => acc + e.amount, 0);

  const filteredEarnings = earnings.filter((e) => {
    if (statusFilter === 'ALL') return true;
    return e.status === statusFilter;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF6000]" />
              Device Yield Engine & Claim Records
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Hourly background earning calculations and user claim settlement history.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleTriggerCycle}
              disabled={triggering}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Execute Hourly Yield Cycle</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Unclaimed Device Yield</div>
            <div className="text-xl font-extrabold text-cyan-400 mt-1">₹{totalClaimable.toFixed(2)}</div>
            <div className="text-[10.5px] text-gray-500 mt-0.5">Stored as CLAIMABLE in My Device</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Claimed & Settled Yield</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">₹{totalClaimed.toFixed(2)}</div>
            <div className="text-[10.5px] text-gray-500 mt-0.5">Transferred to user wallet balances</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Active Revenue Devices</div>
            <div className="text-xl font-extrabold text-amber-400 mt-1">
              {purchases.filter((p) => p.status === 'ACTIVE').length} Units
            </div>
            <div className="text-[10.5px] text-gray-500 mt-0.5">Generating continuous hourly returns</div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 mt-4">
          {[
            { id: 'ALL', label: 'All Yield Entries' },
            { id: 'CLAIMABLE', label: 'Claimable (Unclaimed)' },
            { id: 'CLAIMED', label: 'Claimed (In Wallet)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-gray-800 text-white border border-[#FF6000]'
                  : 'bg-[#0d1117] text-gray-400 border border-gray-800 hover:border-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Yield Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Yield Record ID</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Device / Type</th>
                <th className="py-3.5 px-4">Yield Amount</th>
                <th className="py-3.5 px-4">Generated Timestamp</th>
                <th className="py-3.5 px-4">Claim Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-sans">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Loading device yield batches...</span>
                  </td>
                </tr>
              ) : filteredEarnings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-500 font-sans">
                    No earning records found.
                  </td>
                </tr>
              ) : (
                filteredEarnings.slice(0, 100).map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white text-[11px]">{item.id}</td>
                    <td className="py-3 px-4 font-sans text-gray-200">{item.userId?.substring(0, 10)}...</td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-300">
                        {item.earningType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-extrabold text-emerald-400 text-sm">
                      ₹{item.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-[10.5px]">
                      {new Date(item.earnedAt || item.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'CLAIMED'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                            : 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/50'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
