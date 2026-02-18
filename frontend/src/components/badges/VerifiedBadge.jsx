import React from 'react';
import { CheckCircle, Shield, Star, Sparkles } from 'lucide-react';

/**
 * Colorful Verified Badge Component
 * Shows different styles based on verification level
 */

// Animated gradient verified badge
export const VerifiedBadge = ({ size = 'md', showText = true, className = '' }) => {
  const sizes = {
    sm: { icon: 14, text: 'text-xs', padding: 'px-2 py-0.5' },
    md: { icon: 16, text: 'text-sm', padding: 'px-3 py-1' },
    lg: { icon: 20, text: 'text-base', padding: 'px-4 py-1.5' },
  };
  
  const { icon, text, padding } = sizes[size];

  return (
    <div 
      className={`
        inline-flex items-center gap-1.5 ${padding} rounded-full
        bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
        text-white font-semibold shadow-lg
        animate-shimmer bg-[length:200%_100%]
        ${className}
      `}
      style={{
        animation: 'shimmer 2s linear infinite',
      }}
    >
      <CheckCircle className="drop-shadow-sm" style={{ width: icon, height: icon }} />
      {showText && <span className={text}>Verified</span>}
    </div>
  );
};

// Premium verified badge with gold effect
export const PremiumVerifiedBadge = ({ size = 'md', showText = true, className = '' }) => {
  const sizes = {
    sm: { icon: 14, text: 'text-xs', padding: 'px-2 py-0.5' },
    md: { icon: 16, text: 'text-sm', padding: 'px-3 py-1' },
    lg: { icon: 20, text: 'text-base', padding: 'px-4 py-1.5' },
  };
  
  const { icon, text, padding } = sizes[size];

  return (
    <div 
      className={`
        inline-flex items-center gap-1.5 ${padding} rounded-full
        bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500
        text-white font-bold shadow-lg shadow-amber-300/50
        border-2 border-yellow-300/50
        ${className}
      `}
    >
      <Star className="fill-current drop-shadow-sm" style={{ width: icon, height: icon }} />
      {showText && <span className={text}>Premium</span>}
    </div>
  );
};

// Trust shield badge with different levels
export const TrustBadge = ({ level = 'medium', size = 'md', showText = true, className = '' }) => {
  const sizes = {
    sm: { icon: 14, text: 'text-xs', padding: 'px-2 py-0.5' },
    md: { icon: 16, text: 'text-sm', padding: 'px-3 py-1' },
    lg: { icon: 20, text: 'text-base', padding: 'px-4 py-1.5' },
  };
  
  const levels = {
    low: {
      gradient: 'from-gray-400 to-gray-500',
      shadow: 'shadow-gray-300/50',
      label: 'Basic'
    },
    medium: {
      gradient: 'from-emerald-400 to-teal-500',
      shadow: 'shadow-emerald-300/50',
      label: 'Trusted'
    },
    high: {
      gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
      shadow: 'shadow-purple-300/50',
      label: 'Highly Trusted'
    }
  };
  
  const { icon, text, padding } = sizes[size];
  const { gradient, shadow, label } = levels[level] || levels.medium;

  return (
    <div 
      className={`
        inline-flex items-center gap-1.5 ${padding} rounded-full
        bg-gradient-to-r ${gradient}
        text-white font-semibold shadow-lg ${shadow}
        ${className}
      `}
    >
      <Shield className="fill-current/20 drop-shadow-sm" style={{ width: icon, height: icon }} />
      {showText && <span className={text}>{label}</span>}
    </div>
  );
};

// Online status indicator with pulse animation
export const OnlineStatus = ({ isOnline, lastActive, size = 'md', showText = true }) => {
  const sizes = {
    sm: { dot: 'w-2 h-2', text: 'text-xs' },
    md: { dot: 'w-2.5 h-2.5', text: 'text-sm' },
    lg: { dot: 'w-3 h-3', text: 'text-base' },
  };
  
  const { dot, text } = sizes[size];

  const formatLastSeen = (lastActive) => {
    if (!lastActive) return { text: 'recently', isRecent: false };
    
    const now = new Date();
    const lastSeenDate = new Date(lastActive);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return { text: 'just now', isRecent: true };
    if (diffMins < 5) return { text: `${diffMins}m ago`, isRecent: true };
    if (diffMins < 60) return { text: `${diffMins}m ago`, isRecent: false };
    if (diffHours < 24) return { text: `${diffHours}h ago`, isRecent: false };
    if (diffDays < 7) return { text: `${diffDays}d ago`, isRecent: false };
    return { text: 'recently', isRecent: false };
  };

  // Calculate if truly online based on lastActive (within 5 minutes)
  const isActuallyOnline = () => {
    if (isOnline === true) return true;
    if (!lastActive) return false;
    
    const now = new Date();
    const lastSeenDate = new Date(lastActive);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    return diffMins < 5; // Online if active within 5 minutes
  };

  const actuallyOnline = isActuallyOnline();

  if (actuallyOnline) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className={`${dot} bg-green-500 rounded-full`}></div>
          <div className={`absolute inset-0 ${dot} bg-green-500 rounded-full animate-ping opacity-75`}></div>
        </div>
        {showText && <span className={`${text} text-green-600 font-semibold`}>Online now</span>}
      </div>
    );
  }

  const lastSeenInfo = formatLastSeen(lastActive);
  
  return (
    <div className="flex items-center gap-2">
      <div className={`${dot} bg-gray-400 rounded-full`}></div>
      {showText && (
        <span className={`${text} text-gray-500`}>
          Active {lastSeenInfo.text}
        </span>
      )}
    </div>
  );
};

// Sparkle verified badge (animated sparkles)
export const SparkleVerifiedBadge = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: { icon: 14, padding: 'p-1.5' },
    md: { icon: 18, padding: 'p-2' },
    lg: { icon: 24, padding: 'p-2.5' },
  };
  
  const { icon, padding } = sizes[size];

  return (
    <div 
      className={`
        inline-flex items-center justify-center ${padding} rounded-full
        bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500
        text-white shadow-lg shadow-purple-500/30
        relative overflow-hidden
        ${className}
      `}
    >
      {/* Animated sparkle background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"></div>
      <Sparkles className="relative z-10 drop-shadow-sm" style={{ width: icon, height: icon }} />
    </div>
  );
};

// Add CSS for animations
export const BadgeStyles = () => (
  <style>{`
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    
    @keyframes shine {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    
    .animate-shimmer {
      animation: shimmer 2s linear infinite;
    }
    
    .animate-shine {
      animation: shine 2s ease-in-out infinite;
    }
  `}</style>
);

export default VerifiedBadge;
