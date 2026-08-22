import React, { useState, useEffect } from 'react';
import {
  Gift,
  Users,
  TrendingUp,
  Award,
  RefreshCw,
  Loader2,
  Share2,
} from 'lucide-react';
import { fetchAdminUsers } from '../../services/api';

interface AdminReferralsTabProps {
  onShowToast: (msg: string) => void;
}

export const AdminReferralsTab: React.FC<AdminReferralsTabProps> = ({
  onShowToast,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading referral data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalReferrals = users.filter((u) => u.referredBy).length;

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-400" />
              Referral Network & Team Affiliate Structure
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Affiliate tree, level commissions, and referral bonus distribution.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Platform Referral Links</div>
            <div className="text-xl font-extrabold text-pink-400 mt-1">{totalReferrals} Active Invites</div>
            <div className="text-[10.5px] text-gray-500 mt-0.5">Tracked via unique referral codes</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Direct Level 1 Bonus</div>
            <div className="text-xl font-extrabold text-white mt-1">10% Default</div>
            <div className="text-[10.5px] text-gray-500 mt-0.5">Instant credit on referee plan purchase</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Top Affiliates</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">{Math.max(1, Math.floor(users.length / 2))} Leaders</div>
            <div className="text-[10.5px] text-gray-500 mt-0.5">Generating viral team expansion</div>
          </div>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Member</th>
                <th className="py-3.5 px-4">Referral Code</th>
                <th className="py-3.5 px-4">Referred By</th>
                <th className="py-3.5 px-4">Wallet Balance</th>
                <th className="py-3.5 px-4">Registration Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Loading referral network...</span>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id || u.userId} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{u.username || 'User'}</div>
                      <div className="text-[10px] text-gray-500 font-mono">+91 {u.whatsappNo || u.mobile}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-pink-400">
                      {u.referralCode || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-300">
                      {u.referredBy ? (
                        <span className="bg-gray-800 px-2 py-0.5 rounded text-[11px]">
                          {u.referredBy}
                        </span>
                      ) : (
                        <span className="text-gray-600 italic">Direct Organic</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      ₹{(u.availableBalance || u.walletBalance || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-[10.5px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
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
