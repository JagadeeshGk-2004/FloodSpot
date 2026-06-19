import { Shield, AlertTriangle, X, Loader } from 'lucide-react';

/**
 * ImageVerificationBadge — Shows flood image verification status.
 * States: verifying, verified, suspicious, rejected
 */
export default function ImageVerificationBadge({ status, confidence, message, onDismiss }) {
  if (!status) return null;

  const configs = {
    verifying: {
      bg: 'bg-[#A891DE]/15',
      border: 'border-[#A891DE]/30',
      text: 'text-[#A891DE]',
      icon: <Loader size={14} className="animate-spin" />,
      label: 'Analyzing...',
    },
    verified: {
      bg: 'bg-green-500/15',
      border: 'border-green-500/30',
      text: 'text-green-500',
      icon: <Shield size={14} />,
      label: `Verified · ${confidence}%`,
    },
    suspicious: {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-500',
      icon: <AlertTriangle size={14} />,
      label: `Review · ${confidence}%`,
    },
    rejected: {
      bg: 'bg-red-500/15',
      border: 'border-red-500/30',
      text: 'text-red-500',
      icon: <X size={14} />,
      label: 'Rejected',
    },
  };

  const cfg = configs[status] || configs.verifying;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.bg} ${cfg.border} animate-in fade-in duration-300`}>
      <div className={`${cfg.text} shrink-0`}>{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-black uppercase tracking-widest ${cfg.text}`}>{cfg.label}</p>
        {message && <p className="text-[9px] font-medium text-[#1a1410] dark:text-white/60 mt-0.5 truncate">{message}</p>}
      </div>
      {onDismiss && status === 'rejected' && (
        <button onClick={onDismiss} className="text-white/30 hover:text-white/60 smooth-transition p-1">
          <X size={12} />
        </button>
      )}
    </div>
  );
}
