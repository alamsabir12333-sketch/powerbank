import React, { useState } from 'react';
import {
  ChevronLeft,
  Smartphone,
  Mail,
  CreditCard,
  Building,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { saveBankAccount } from '../services/api';

interface AddBankCardPageProps {
  userId: string;
  onBack: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
}

export const AddBankCardPage: React.FC<AddBankCardPageProps> = ({
  userId,
  onBack,
  onSuccess,
  onShowToast,
}) => {
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setError('Please enter your full name as per bank records.');
      return;
    }
    if (!mobileNumber.trim() || mobileNumber.trim().length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!bankName.trim()) {
      setError('Please enter your bank name (e.g. HDFC Bank, SBI).');
      return;
    }
    if (!accountNumber.trim() || accountNumber.trim().length < 6) {
      setError('Please enter a valid bank account number.');
      return;
    }
    if (!ifscCode.trim() || ifscCode.trim().length < 6) {
      setError('Please enter a valid IFSC code (e.g. HDFC0001234).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveBankAccount(userId, {
        accountHolderName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: emailAddress.trim() || undefined,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifsc: ifscCode.trim().toUpperCase(),
        isDefault: true,
      });

      onShowToast('Bank card added and linked successfully!');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save bank card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 pb-12 flex flex-col justify-between">
      {/* Top Header matching Screenshot 3 */}
      <div className="pt-4 px-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 -ml-0.5" />
        </button>

        <h1 className="text-base font-bold text-gray-900">Add new card</h1>

        <div className="w-9 h-9" />
      </div>

      {/* Main Form Body matching Screenshot 3 */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4">
        <div className="space-y-1 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Add new card</h2>
          <p className="text-sm text-gray-400 font-normal">
            Please enter your details accurately.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2.5 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form id="add-bank-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">Full Name</label>
            <div className="bg-[#f8f9fa] rounded-2xl px-4 py-3.5 flex items-center">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Please enter"
                className="w-full bg-transparent text-sm text-gray-900 font-medium placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* Mobile Number with Phone Icon */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">Mobile Number</label>
            <div className="bg-[#f8f9fa] rounded-2xl px-4 py-3.5 flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="Please enter"
                className="w-full bg-transparent text-sm text-gray-900 font-medium placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* Email Address with Mail Icon */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">Email Address</label>
            <div className="bg-[#f8f9fa] rounded-2xl px-4 py-3.5 flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="Please enter"
                className="w-full bg-transparent text-sm text-gray-900 font-medium placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* Bank Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">Bank Name</label>
            <div className="bg-[#f8f9fa] rounded-2xl px-4 py-3.5 flex items-center gap-2.5">
              <input
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Please enter"
                className="w-full bg-transparent text-sm text-gray-900 font-medium placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* Bank Account Number with Card Icon */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">Bank Account Number</label>
            <div className="bg-[#f8f9fa] rounded-2xl px-4 py-3.5 flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Please enter"
                className="w-full bg-transparent text-sm text-gray-900 font-medium font-mono placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          {/* IFSC Code */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">IFSC Code</label>
            <div className="bg-[#f8f9fa] rounded-2xl px-4 py-3.5 flex items-center">
              <input
                type="text"
                required
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="Please enter"
                className="w-full bg-transparent text-sm text-gray-900 font-medium font-mono uppercase placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>
        </form>
      </div>

      {/* Fixed Bottom Action Button */}
      <div className="px-5 w-full max-w-lg mx-auto pt-6">
        <button
          type="submit"
          form="add-bank-form"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Saving Card...</span>
            </>
          ) : (
            <span>Add New Card</span>
          )}
        </button>
      </div>
    </div>
  );
};
