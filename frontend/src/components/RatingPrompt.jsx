import { useState, useEffect, useCallback } from 'react';
import { Star, X, Heart, ExternalLink } from 'lucide-react';
import { API } from '@/config/api';

const RATING_STORAGE_KEY = 'heartlink_rating_check';

/**
 * In-App Rating Prompt
 * Shown after user hits 3+ matches. Appears as a delightful modal.
 * - "Rate Us" opens Play Store
 * - "Maybe Later" dismisses for 7 days
 * - Never shows again after rating
 */
const RatingPrompt = ({ user }) => {
  const [visible, setVisible] = useState(false);
  const [ratingData, setRatingData] = useState(null);
  const [animateIn, setAnimateIn] = useState(false);

  const shouldCheck = useCallback(() => {
    try {
      const raw = localStorage.getItem(RATING_STORAGE_KEY);
      if (!raw) return true;
      const { checkedAt, rated } = JSON.parse(raw);
      if (rated) return false;
      // Don't check more than once per hour
      return (Date.now() - checkedAt) > 3600000;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !shouldCheck()) return;

    const check = async () => {
      try {
        const res = await fetch(`${API}/rating/check/${user.id}`);
        if (!res.ok) return;
        const data = await res.json();

        localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify({
          checkedAt: Date.now(),
          rated: false,
        }));

        if (data.show_rating) {
          setRatingData(data);
          // Delay show for smooth experience (don't interrupt immediately)
          setTimeout(() => {
            setVisible(true);
            setTimeout(() => setAnimateIn(true), 50);
            // Track shown
            fetch(`${API}/rating/event`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: user.id, event: 'rating_prompt_shown' }),
            }).catch(() => {});
          }, 2000);
        }
      } catch {
        // Silent fail
      }
    };

    // Check after 5s so it doesn't block initial load
    const timer = setTimeout(check, 5000);
    return () => clearTimeout(timer);
  }, [user?.id, shouldCheck]);

  const handleRate = () => {
    // Track
    fetch(`${API}/rating/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, event: 'rating_submitted' }),
    }).catch(() => {});

    // Mark as rated locally
    localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify({ checkedAt: Date.now(), rated: true }));

    // Open Play Store
    const url = ratingData?.play_store_url || 'https://play.google.com/store/apps/details?id=com.heartlink.app';
    window.open(url, '_system');

    setAnimateIn(false);
    setTimeout(() => setVisible(false), 300);
  };

  const handleDismiss = () => {
    fetch(`${API}/rating/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, event: 'rating_dismissed' }),
    }).catch(() => {});

    localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify({ checkedAt: Date.now(), rated: false }));

    setAnimateIn(false);
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible || !ratingData) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{
        background: animateIn ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        transition: 'background 0.3s ease',
      }}
      data-testid="rating-prompt-overlay"
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: 'white',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          transform: animateIn ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          opacity: animateIn ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        }}
        data-testid="rating-prompt-card"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors z-10"
          data-testid="rating-close-btn"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* Header with hearts animation */}
        <div
          className="relative px-6 pt-8 pb-5 text-center"
          style={{ background: 'linear-gradient(135deg, #fdf2f8, #fce7f3, #fbcfe8)' }}
        >
          {/* Floating hearts */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <Heart
                key={i}
                className="absolute text-pink-300/40"
                fill="currentColor"
                style={{
                  width: `${12 + Math.random() * 10}px`,
                  left: `${10 + i * 15}%`,
                  top: `${20 + Math.random() * 50}%`,
                  animation: `floatHeart ${2 + Math.random() * 2}s ease-in-out ${i * 0.3}s infinite alternate`,
                }}
              />
            ))}
          </div>

          {/* Stars row */}
          <div className="flex justify-center gap-1 mb-3 relative z-10">
            {[1,2,3,4,5].map(i => (
              <Star
                key={i}
                className="w-8 h-8 text-amber-400 drop-shadow-sm"
                fill="#fbbf24"
                style={{
                  animation: `popStar 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.3 + i * 0.1}s both`,
                }}
              />
            ))}
          </div>

          <h2 className="text-xl font-bold text-gray-900 relative z-10">
            Enjoying HeartLink?
          </h2>
          <p className="text-sm text-gray-600 mt-1.5 relative z-10">
            You've made <span className="font-bold text-pink-600">{ratingData.match_count}+ matches</span>!
            We'd love your feedback.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-center">
          <p className="text-sm text-gray-500 mb-5">
            Your rating helps us grow and improve HeartLink for everyone.
          </p>

          {/* CTA Buttons */}
          <button
            onClick={handleRate}
            data-testid="rate-now-btn"
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.96] mb-3"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
              boxShadow: '0 4px 16px rgba(244,63,94,0.35)',
            }}
          >
            <Star className="w-4.5 h-4.5" fill="white" strokeWidth={0} />
            Rate HeartLink on Play Store
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </button>

          <button
            onClick={handleDismiss}
            data-testid="rate-later-btn"
            className="w-full py-3 rounded-2xl font-medium text-gray-400 text-sm hover:text-gray-600 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes floatHeart {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-12px) rotate(10deg); }
        }
        @keyframes popStar {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RatingPrompt;
