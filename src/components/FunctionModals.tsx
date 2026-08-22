import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, CreditCard, RefreshCw, Gift, Copy, Check, ShieldCheck, Smartphone, Building } from 'lucide-react';
import { UserProfile } from '../types';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl z-10 text-gray-800"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6200] flex items-center justify-center">
                  {icon}
                </div>
                <h3 className="text-base font-bold text-gray-900">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 1. Personal Information Modal
export const PersonalInfoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
}> = ({ isOpen, onClose, user }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Personal Information"
      icon={<User className="w-4 h-4 text-[#FF6200]" />}
    >
      <div className="space-y-3">
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
          <span className="text-gray-500">Username</span>
          <span className="font-bold text-gray-900">{user.username || user.name || 'Member'}</span>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
          <span className="text-gray-500">WhatsApp No.</span>
          <span className="font-bold text-gray-900">+91 {user.whatsappNo || user.mobile}</span>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
          <span className="text-gray-500">Email</span>
          <span className="font-bold text-gray-900 truncate max-w-[180px]">{user.email || 'N/A'}</span>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
          <span className="text-gray-500">Membership Number</span>
          <span className="font-bold text-[#FF6200] font-mono">{user.membershipNumber}</span>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
          <span className="text-gray-500">Referral Code</span>
          <span className="font-bold text-gray-900 font-mono">{user.referralCode || user.membershipNumber}</span>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
          <span className="text-gray-500">Account Security</span>
          <span className="font-semibold text-green-600 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> High
          </span>
        </div>
      </div>
      <div className="mt-5">
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6200] to-[#FF8A00] text-white font-semibold text-sm shadow-md shadow-orange-500/20 active:scale-98 transition-all"
        >
          Confirm
        </button>
      </div>
    </BaseModal>
  );
};

// 2. Bind Bank Card Modal
export const BindBankCardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSuccess?: () => void;
}> = ({ isOpen, onClose, userId = 'usr_demo_01', onSuccess }) => {
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bank, setBank] = useState('');
  const [upi, setUpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { saveBankAccount } = await import('../services/api');
      await saveBankAccount(userId, {
        accountHolderName: name.trim(),
        accountNumber: account.trim(),
        bankName: bank.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        upiId: upi.trim() || undefined,
        isDefault: true,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Failed to save bank card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Bind Bank Card"
      icon={<CreditCard className="w-4 h-4 text-[#FF6200]" />}
    >
      {saved ? (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-3">
            <Check className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-gray-900">Card Bound Successfully</h4>
          <p className="text-xs text-gray-500 mt-1">Bank account information saved for withdrawals.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Account Holder Name
            </label>
            <input
              type="text"
              required
              placeholder="Name matching bank records"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Bank Account Number
            </label>
            <input
              type="text"
              required
              placeholder="Enter account number"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SBIN0001234"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none uppercase font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Bank Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SBI / HDFC"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              UPI ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. username@okhdfcbank"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#FF6200] focus:ring-1 focus:ring-[#FF6200] outline-none font-mono"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6200] to-[#FF8A00] text-white font-semibold text-sm shadow-md shadow-orange-500/20 active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Bank Card'}
            </button>
          </div>
        </form>
      )}
    </BaseModal>
  );
};

// 3. Resale Modal
export const ResaleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Equipment Resale"
      icon={<RefreshCw className="w-4 h-4 text-[#FF6200]" />}
    >
      <div className="space-y-3 text-center py-2">
        <div className="w-14 h-14 mx-auto rounded-full bg-orange-50 text-[#FF6200] flex items-center justify-center">
          <RefreshCw className="w-7 h-7" />
        </div>
        <h4 className="text-base font-bold text-gray-900">
          Secondary Market Resale
        </h4>
        <p className="text-xs text-gray-600 leading-relaxed">
          You currently do not have any transferable shared power bank cabinets eligible for liquidation. Resale is unlocked after 30 days of active station runtime.
        </p>
        <div className="p-3 bg-gray-50 rounded-xl text-left text-xs space-y-1.5 border border-gray-100">
          <div className="flex justify-between">
            <span className="text-gray-500">Eligible Devices:</span>
            <span className="font-bold text-gray-800">0 Units</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Est. Resale Yield:</span>
            <span className="font-bold text-[#FF6200]">0.00 ₹</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6200] to-[#FF8A00] text-white font-semibold text-sm shadow-md shadow-orange-500/20 active:scale-98 transition-all"
        >
          Understood
        </button>
      </div>
    </BaseModal>
  );
};

// 4. Invite Friends Modal
export const InviteFriendsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  referralCode?: string;
  onCopyToast?: (text: string) => void;
}> = ({ isOpen, onClose, referralCode = 'PB888999', onCopyToast }) => {
  const [copied, setCopied] = useState(false);
  const hostOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://powerbank.app';
  const inviteLink = `${hostOrigin}/invite/${referralCode}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    onCopyToast?.(`${label} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Friends"
      icon={<Gift className="w-4 h-4 text-[#FF6200]" />}
    >
      <div className="space-y-4">
        {/* Referral Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 text-center">
          <span className="text-xs text-gray-500 font-medium">My Invitation Code</span>
          <div className="text-2xl font-black text-[#FF6200] tracking-widest my-1.5">
            {referralCode}
          </div>
          <button
            onClick={() => copyToClipboard(referralCode, 'Invitation code')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6200] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Link box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700">Invitation Link</label>
          <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl">
            <span className="text-xs text-gray-600 truncate flex-1 font-mono">
              {inviteLink}
            </span>
            <button
              onClick={() => copyToClipboard(inviteLink, 'Invitation link')}
              className="p-1.5 rounded-lg bg-orange-100 text-[#FF6200] hover:bg-orange-200 shrink-0 active:scale-95"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Commission Tiers */}
        <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1.5 border border-gray-100">
          <h5 className="font-bold text-gray-800">Tiered Referral Commissions:</h5>
          <div className="flex justify-between text-gray-600">
            <span>Tier 1 Direct Invite:</span>
            <span className="font-bold text-[#FF6200]">10% Commission</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tier 2 Secondary:</span>
            <span className="font-bold text-[#FF6200]">5% Commission</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tier 3 Tertiary:</span>
            <span className="font-bold text-[#FF6200]">2% Commission</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6200] to-[#FF8A00] text-white font-semibold text-sm shadow-md shadow-orange-500/20 active:scale-98 transition-all"
        >
          Close
        </button>
      </div>
    </BaseModal>
  );
};
