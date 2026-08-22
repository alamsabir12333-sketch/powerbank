import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Loader2,
  Clock,
  User,
  Layers,
  FileText,
} from 'lucide-react';
import { fetchAdminAuditLogs } from '../../services/api';
import { AuditLogEntry } from '../../types';

interface AdminAuditTabProps {
  onShowToast: (msg: string) => void;
}

export const AdminAuditTab: React.FC<AdminAuditTabProps> = ({
  onShowToast,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminAuditLogs();
      setLogs(data);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(q) ||
      (log.description || '').toLowerCase().includes(q) ||
      (log.targetType || '').toLowerCase().includes(q) ||
      (log.targetId || '').toLowerCase().includes(q) ||
      (log.adminUserId || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Administrative Security Audit Trail
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Cryptographically timestamped record of every administrative login, approval, rejection, and ledger adjustment.
            </p>
          </div>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, target entity, admin username, or log details..."
            className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Log ID & Timestamp</th>
                <th className="py-3.5 px-4">Admin Operator</th>
                <th className="py-3.5 px-4">Action Type</th>
                <th className="py-3.5 px-4">Target Entity</th>
                <th className="py-3.5 px-4">Description & Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono text-[11.5px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 font-sans">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Loading security audit logs...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-500 font-sans">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-white font-bold text-[11px]">{log.id}</div>
                      <div className="text-[10px] text-gray-500 font-sans">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-gray-200 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        {log.adminUsername || log.adminUserId}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-800 text-cyan-300 font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-gray-300">{log.targetType}</div>
                      {log.targetId && (
                        <div className="text-[10px] text-gray-500">{log.targetId}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-sans text-xs text-gray-200">
                      <div>{log.description}</div>
                      {log.details && Object.keys(log.details).length > 1 && (
                        <div className="text-[10.5px] text-gray-500 font-mono mt-0.5">
                          {JSON.stringify(log.details)}
                        </div>
                      )}
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
