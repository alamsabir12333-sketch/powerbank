import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  Check,
  Share2,
  Send,
  MessageCircle,
  Smartphone,
  ExternalLink,
  Users,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string;
  customMessage?: string;
  contextTitle?: string;
  onShowToast: (msg: string) => void;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  referralCode,
  customMessage,
  contextTitle,
  onShowToast,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Dynamic origin and production referral link
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://gainpower.app';
  
  const cleanCode = referralCode || '2829906';
  const referralUrl = `${origin}/invite/${cleanCode}`;

  const defaultMessage = customMessage || 'Join GAIN POWER using my referral link and start earning:';
  const fullShareText = `${defaultMessage}\n${referralUrl}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = referralUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLink(true);
      onShowToast('Referral link copied.');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      onShowToast('Referral link copied.');
    }
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanCode);
      }
      setCopiedCode(true);
      onShowToast('Referral code copied.');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (e) {
      onShowToast(`Referral Code: ${cleanCode}`);
    }
  };

  const handleShareWhatsApp = () => {
    setShareError(null);
    try {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`;
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.href = url;
      }
    } catch (err) {
      setShareError('Sharing app is not available on this device.');
      handleCopyLink();
    }
  };

  const handleShareTelegram = () => {
    setShareError(null);
    try {
      const url = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(defaultMessage)}`;
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.href = url;
      }
    } catch (err) {
      setShareError('Sharing app is not available on this device.');
      handleCopyLink();
    }
  };

  const handleShareFacebook = () => {
    setShareError(null);
    try {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}&quote=${encodeURIComponent(defaultMessage)}`;
      const win = window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
      if (!win) {
        window.location.href = url;
      }
    } catch (err) {
      setShareError('Sharing app is not available on this device.');
      handleCopyLink();
    }
  };

  const handleShareMessenger = () => {
    setShareError(null);
    try {
      // Try opening mobile Messenger URI scheme or Facebook dialog with fallback
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const messengerUri = `fb-messenger://share?link=${encodeURIComponent(referralUrl)}`;
        window.location.href = messengerUri;
        // Set timeout fallback in case messenger app isn't installed
        setTimeout(() => {
          handleShareFacebook();
        }, 1200);
      } else {
        const messengerWebUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(referralUrl)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(referralUrl)}`;
        const win = window.open(messengerWebUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
        if (!win) {
          handleShareFacebook();
        }
      }
    } catch (err) {
      setShareError('Sharing app is not available on this device.');
      handleCopyLink();
    }
  };

  const handleSystemShare = async () => {
    setShareError(null);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'GAIN POWER',
          text: defaultMessage,
          url: referralUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-xs"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 z-10 border border-gray-100"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-start justify-between border-b border-gray-100 bg-gradient-to-b from-orange-50/60 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF6000]/10 text-[#FF6000] flex items-center justify-center font-bold shadow-xs">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-gray-900 tracking-tight leading-tight">
                  Invite Friends
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Share your referral link
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Context Badge (if provided, e.g. Mission Bonus) */}
            {contextTitle && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50/80 border border-orange-200/80 text-orange-800 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-[#FF6000] shrink-0" />
                <span className="line-clamp-1">{contextTitle}</span>
              </div>
            )}

            {/* Error Message Fallback */}
            {shareError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <span>{shareError}</span>
                  <div className="font-semibold mt-0.5 text-amber-900">Please use Copy Link or System Share below.</div>
                </div>
              </div>
            )}

            {/* Referral Link Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span>Referral Link</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-[11px] font-mono text-[#FF6000] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Code: <strong>{cleanCode}</strong></span>
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-2xl">
                <div className="flex-1 px-2 py-1 text-xs font-mono text-gray-600 truncate select-all">
                  {referralUrl}
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#FF6000] hover:bg-[#E05300] text-white active:scale-95'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Social Share 2-Column Grid */}
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                Share via Social Apps
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. WhatsApp */}
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="p-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-100/70 active:scale-95 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-gray-900 block">WhatsApp</span>
                    <span className="text-[10px] text-emerald-700 font-medium">Direct Chat</span>
                  </div>
                </button>

                {/* 2. Facebook */}
                <button
                  type="button"
                  onClick={handleShareFacebook}
                  className="p-3 rounded-2xl border border-blue-100 bg-blue-50/60 hover:bg-blue-100/70 active:scale-95 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-gray-900 block">Facebook</span>
                    <span className="text-[10px] text-blue-700 font-medium">Feed / Story</span>
                  </div>
                </button>

                {/* 3. Messenger */}
                <button
                  type="button"
                  onClick={handleShareMessenger}
                  className="p-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/70 active:scale-95 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0084FF] via-[#A033FF] to-[#FF5E3A] text-white flex items-center justify-center shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-gray-900 block">Messenger</span>
                    <span className="text-[10px] text-indigo-700 font-medium">Direct Message</span>
                  </div>
                </button>

                {/* 4. Telegram */}
                <button
                  type="button"
                  onClick={handleShareTelegram}
                  className="p-3 rounded-2xl border border-sky-100 bg-sky-50/60 hover:bg-sky-100/70 active:scale-95 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#229ED9] text-white flex items-center justify-center shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-gray-900 block">Telegram</span>
                    <span className="text-[10px] text-sky-700 font-medium">Channel / DM</span>
                  </div>
                </button>

                {/* 5. Copy Link */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-3 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-800 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    {copiedLink ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-gray-900 block">
                      {copiedLink ? 'Copied!' : 'Copy Link'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">Clipboard</span>
                  </div>
                </button>

                {/* 6. More / System Share */}
                <button
                  type="button"
                  onClick={handleSystemShare}
                  className="p-3 rounded-2xl border border-orange-100 bg-orange-50/60 hover:bg-orange-100/70 active:scale-95 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FF6000] text-white flex items-center justify-center shadow-sm shadow-orange-500/20 group-hover:scale-105 transition-transform">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-gray-900 block">More / Share</span>
                    <span className="text-[10px] text-orange-700 font-medium">System Menu</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Explanatory note */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-[11px] text-gray-500 leading-relaxed">
              <span className="font-bold text-gray-700">Notice:</span> Friends who join through your referral link and activate their first sharing cabinet will count towards your mission rewards and commission levels!
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
