import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Wifi,
  CheckCircle2,
  Plus,
  Trash2,
  Edit3,
  Star,
  Building2,
  CreditCard,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { BankAccount } from '../types';
import {
  fetchBankAccounts,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
} from '../services/api';

interface BankCardPageProps {
  userId: string;
  onBack: () => void;
  onNavigateTab: (tab: any) => void;
  onOpenAddCard: () => void;
  onShowToast?: (msg: string) => void;
}

export const BankCardPage: React.FC<BankCardPageProps> = ({
  userId,
  onBack,
  onOpenAddCard,
  onShowToast,
}) => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  // Edit Modal State
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [editHolderName, setEditHolderName] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editIfsc, setEditIfsc] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete Confirmation State
  const [deletingBank, setDeletingBank] = useState<BankAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadBanks = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const banks = await fetchBankAccounts(userId);
      setBankAccounts(banks);
      if (banks.length > 0) {
        const defaultCard = banks.find((b) => b.isDefault) || banks[0];
        setSelectedBankId(defaultCard.id);
      } else {
        setSelectedBankId(null);
      }
    } catch (err) {
      console.warn('Failed to load bank accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanks();
  }, [userId]);

  const activeSelectedCard = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0] || null;

  const handleSetDefault = async (bankId: string) => {
    try {
      await setDefaultBankAccount(userId, bankId);
      onShowToast?.('Default bank card updated');
      await loadBanks();
    } catch (err: any) {
      alert(err.message || 'Failed to set default bank');
    }
  };

  const handleOpenEdit = (bank: BankAccount) => {
    setEditingBank(bank);
    setEditHolderName(bank.accountHolderName || bank.holderName || '');
    setEditBankName(bank.bankName || '');
    setEditAccountNumber(bank.accountNumber || '');
    setEditIfsc(bank.ifsc || bank.ifscCode || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank) return;
    if (!editHolderName.trim() || !editBankName.trim() || !editAccountNumber.trim() || !editIfsc.trim()) {
      alert('Please fill all required fields');
      return;
    }
    setEditSaving(true);
    try {
      await updateBankAccount(userId, editingBank.id, {
        accountHolderName: editHolderName.trim(),
        bankName: editBankName.trim(),
        accountNumber: editAccountNumber.trim(),
        ifsc: editIfsc.trim().toUpperCase(),
      });
      onShowToast?.('Bank card updated successfully');
      setEditingBank(null);
      await loadBanks();
    } catch (err: any) {
      alert(err.message || 'Failed to update bank card');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBank) return;
    setDeleteLoading(true);
    try {
      await deleteBankAccount(userId, deletingBank.id);
      onShowToast?.('Bank card deleted');
      setDeletingBank(null);
      await loadBanks();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bank card');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col justify-between pb-10">
      {/* Top Header */}
      <div className="pt-4 px-4 pb-2 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 -ml-0.5" />
        </button>

        <h1 className="text-base font-bold text-gray-900">Bank Card Management</h1>

        <button
          onClick={onOpenAddCard}
          className="p-2 rounded-full text-[#FF6000] hover:bg-orange-50 active:scale-95 transition-all"
          title="Add Bank Card"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 max-w-md w-full mx-auto px-4 py-5 space-y-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6000] mb-2" />
            <p className="text-xs">Loading saved bank cards...</p>
          </div>
        ) : bankAccounts.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-6 text-center bg-white rounded-3xl border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-[#FF6000] flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Bank Card Linked</h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto mb-6">
              Add your verified Indian bank account to enable instant, direct withdrawals to your bank account.
            </p>
            <button
              type="button"
              onClick={onOpenAddCard}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bank Card Now</span>
            </button>
          </div>
        ) : (
          <>
            {/* Active Card Preview Visual */}
            {activeSelectedCard && (
              <div className="relative w-full rounded-3xl bg-gradient-to-b from-[#E05300] via-[#FF6000] to-[#E64A00] p-6 text-white shadow-xl shadow-orange-950/20 flex flex-col justify-between border border-orange-300/30 overflow-hidden min-h-[220px]">
                {/* Background watermarks */}
                <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="absolute -left-6 -top-6 w-28 h-28 rounded-full bg-black/10 blur-lg pointer-events-none" />

                {/* Top Row: Bank Name & Default Badge */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-orange-200" />
                    <span className="font-bold text-base tracking-wide text-white drop-shadow-xs">
                      {activeSelectedCard.bankName}
                    </span>
                  </div>
                  {activeSelectedCard.isDefault ? (
                    <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold flex items-center gap-1 border border-white/30">
                      <Star className="w-3 h-3 fill-amber-300 text-amber-300" /> Default
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(activeSelectedCard.id)}
                      className="px-2.5 py-1 rounded-full bg-black/20 hover:bg-black/30 text-orange-100 text-[11px] font-semibold transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                </div>

                {/* Middle Row: Chip + Account Number */}
                <div className="relative z-10 my-4 flex items-center justify-between">
                  {/* EMV Chip Visual */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 shadow-md flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 border-t border-b border-amber-700/30">
                        <div className="border-r border-amber-700/30" />
                        <div className="border-r border-amber-700/30" />
                        <div />
                      </div>
                    </div>
                    <Wifi className="w-5 h-5 rotate-90 text-orange-200/80" />
                  </div>

                  {/* Masked Account Number */}
                  <div className="text-right">
                    <span className="text-xs text-orange-200 font-medium block">Account Number</span>
                    <span className="text-base font-mono font-bold tracking-wider text-white">
                      •••• •••• {activeSelectedCard.accountNumber.slice(-4)}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Holder Name & IFSC */}
                <div className="relative z-10 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-orange-200 block uppercase tracking-wider">
                      Card Holder
                    </span>
                    <span className="font-bold text-white tracking-wide uppercase truncate max-w-[170px] block">
                      {activeSelectedCard.accountHolderName || activeSelectedCard.holderName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-orange-200 block uppercase tracking-wider">
                      IFSC Code
                    </span>
                    <span className="font-mono font-bold text-white">
                      {activeSelectedCard.ifsc || activeSelectedCard.ifscCode}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* List of Bound Cards with CRUD Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Saved Cards ({bankAccounts.length})
                </h3>
                <span className="text-[11px] text-[#FF6000] font-semibold">Bank Account Only</span>
              </div>

              {bankAccounts.map((card) => {
                const isSelected = card.id === (activeSelectedCard?.id || '');
                return (
                  <div
                    key={card.id}
                    onClick={() => setSelectedBankId(card.id)}
                    className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6000] ring-2 ring-orange-500/20 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            card.isDefault
                              ? 'bg-orange-100 text-[#FF6000]'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-gray-900">{card.bankName}</h4>
                            {card.isDefault && (
                              <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6000] border border-orange-200 text-[10px] font-bold">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            A/C: •••• {card.accountNumber.slice(-4)} | IFSC: {card.ifsc || card.ifscCode}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Holder: {card.accountHolderName || card.holderName}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons: Set Default, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {!card.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(card.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#FF6000] hover:bg-orange-50 transition-colors"
                            title="Set as Default Card"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(card)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Card"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBank(card)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Card"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bottom Action Button */}
      {bankAccounts.length > 0 && (
        <div className="px-5 w-full max-w-md mx-auto sticky bottom-2">
          <button
            type="button"
            onClick={onOpenAddCard}
            className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-700/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Another Bank Card</span>
          </button>
        </div>
      )}

      {/* Edit Bank Account Modal */}
      {editingBank && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#FF6000]" />
                <span>Edit Bank Card</span>
              </h3>
              <button
                onClick={() => setEditingBank(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  required
                  value={editHolderName}
                  onChange={(e) => setEditHolderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:border-[#FF6000] focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:border-[#FF6000] focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  required
                  value={editAccountNumber}
                  onChange={(e) => setEditAccountNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:border-[#FF6000] focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  required
                  value={editIfsc}
                  onChange={(e) => setEditIfsc(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 text-xs font-mono uppercase bg-gray-50 border border-gray-200 rounded-xl focus:border-[#FF6000] focus:bg-white outline-none"
                />
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingBank(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-3 rounded-xl bg-[#FF6000] text-white text-xs font-bold shadow-md shadow-orange-500/20 hover:bg-[#E05300] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingBank && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Delete Bank Card?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-gray-700">{deletingBank.bankName}</span> (A/C: ••••{deletingBank.accountNumber.slice(-4)})? Past withdrawal records will remain safe.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBank(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                Keep Card
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md shadow-red-500/20 hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
