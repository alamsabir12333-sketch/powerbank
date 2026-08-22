import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Download,
  Filter,
  RefreshCw,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Zap,
  DollarSign,
} from 'lucide-react';
import { fetchAdminAllTransactions } from '../../services/api';
import { WalletTransaction } from '../../types';

interface AdminTransactionsTabProps {
  onShowToast: (msg: string) => void;
}

export const AdminTransactionsTab: React.FC<AdminTransactionsTabProps> = ({
  onShowToast,
}) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminAllTransactions({
        type: typeFilter,
        query: searchQuery,
      });
      setTransactions(data);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTransactions();
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      onShowToast('No transactions to export.');
      return;
    }

    const headers = ['Transaction ID', 'User ID', 'Type', 'Amount (INR)', 'Balance Before', 'Balance After', 'Reference ID', 'Description', 'Timestamp'];
    const rows = transactions.map((t) => [
      t.id,
      t.userId,
      t.type,
      t.amount,
      t.balanceBefore || 0,
      t.balanceAfter || 0,
      `"${t.referenceId || ''}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.createdAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `powerbank_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Transaction ledger exported to CSV.');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Global Double-Entry Financial Ledger
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Immutable journal of all credits, claims, device purchases, withdrawals, and balance updates.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={loadTransactions}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 w-full relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, description, or user ID..."
              className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] rounded-xl py-2.5 pl-10 pr-20 text-xs text-white placeholder-gray-500 outline-none"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-800 text-gray-200 text-xs font-bold rounded-lg hover:bg-gray-700"
            >
              Filter
            </button>
          </form>

          {/* Type chips */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'RECHARGE', label: 'Recharge' },
              { id: 'EARNING_CLAIM', label: 'Device Claims' },
              { id: 'PURCHASE', label: 'Purchases' },
              { id: 'WITHDRAWAL', label: 'Withdrawals' },
              { id: 'REFERRAL_BONUS', label: 'Referrals' },
              { id: 'ADMIN_ADJUSTMENT', label: 'Adjustments' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setTypeFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  typeFilter === st.id
                    ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/50'
                    : 'bg-[#0d1117] text-gray-400 border border-gray-800 hover:border-gray-700'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">TX ID & Time</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Transaction Type</th>
                <th className="py-3.5 px-4">Delta Amount</th>
                <th className="py-3.5 px-4">Balance Run</th>
                <th className="py-3.5 px-4">Description & Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-sans">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Querying financial ledger...</span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-500 font-sans">
                    No ledger entries found.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isPositive = t.amount >= 0;
                  return (
                    <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-white text-[11.5px] font-bold">{t.id}</div>
                        <div className="text-[10px] text-gray-500 font-sans">
                          {new Date(t.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <div className="text-gray-200 font-semibold">{t.username || 'User'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{t.userId?.substring(0, 8)}...</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-300">
                          {t.type}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`font-black text-sm ${
                            isPositive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isPositive ? `+₹${t.amount.toFixed(2)}` : `-₹${Math.abs(t.amount).toFixed(2)}`}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[11px] text-gray-400">
                        <span>₹{(t.balanceBefore || 0).toFixed(2)}</span>
                        <span className="text-gray-600 mx-1">&rarr;</span>
                        <span className="text-white font-bold">₹{(t.balanceAfter || 0).toFixed(2)}</span>
                      </td>

                      <td className="py-3 px-4 font-sans text-xs">
                        <div className="text-gray-300">{t.description}</div>
                        {t.referenceId && (
                          <div className="text-[10px] text-gray-500 font-mono">Ref: {t.referenceId}</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
