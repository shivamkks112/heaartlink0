import { useState, useEffect } from 'react';
import { Heart, MessageCircle, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MatchAnimation = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  matchedUser, 
  compatibilityScore,
  onStartChat 
}) => {
  const [showContent, setShowContent] = useState(false);
  const [hearts, setHearts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      // Show content instantly — no artificial delay
      setShowContent(true);
      
      // Generate floating hearts
      const newHearts = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        size: Math.random() * 20 + 15,
        duration: Math.random() * 2 + 2
      }));
      setHearts(newHearts);
      
      // Haptic feedback on supported devices
      try { navigator.vibrate?.([50, 30, 80]); } catch (_) {}
    } else {
      setShowContent(false);
      setHearts([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop with gradient */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-pink-600/95 via-rose-500/95 to-orange-500/95 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Floating Hearts Animation */}
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute text-white/30 animate-float-up pointer-events-none"
          style={{
            left: `${heart.left}%`,
            bottom: '-50px',
            fontSize: `${heart.size}px`,
            animationDelay: `${heart.delay}s`,
            animationDuration: `${heart.duration}s`
          }}
        >
          ❤️
        </div>
      ))}

      {/* Sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full animate-sparkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: Math.random() * 0.8 + 0.2
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div 
        className={`relative z-10 flex flex-col items-center transition-all duration-700 ${
          showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 p-2 bg-white/20 rounded-full hover:bg-white/30 transition z-20"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* "It's a Match!" Text */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-2 animate-bounce-slow" data-testid="match-title">
            It's a Match! 💗
          </h1>
          <p className="text-white/80 text-lg" data-testid="match-subtitle">
            You both liked each other
          </p>
        </div>

        {/* Profile Pictures */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {/* Current User */}
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-2xl overflow-hidden animate-slide-in-left">
              <img
                src={currentUser?.profile_picture || '/default-avatar.png'}
                alt={currentUser?.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-lg">
              <span className="text-sm font-semibold text-gray-800">{currentUser?.name?.split(' ')[0]}</span>
            </div>
          </div>

          {/* Heart Icon in middle */}
          <div className="relative">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl animate-pulse-scale">
              <Heart className="w-8 h-8 text-pink-500 fill-pink-500" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-spin-slow" />
            <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 text-yellow-300 animate-spin-slow" style={{ animationDelay: '0.5s' }} />
          </div>

          {/* Matched User */}
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-2xl overflow-hidden animate-slide-in-right">
              <img
                src={matchedUser?.profile_picture || '/default-avatar.png'}
                alt={matchedUser?.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-lg">
              <span className="text-sm font-semibold text-gray-800">{matchedUser?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </div>

        {/* Compatibility Score */}
        {compatibilityScore && (
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-3 mb-8 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-white font-medium">
                {compatibilityScore}% Compatible
              </span>
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md px-4">
          <Button
            onClick={onStartChat}
            className="flex-1 bg-white text-pink-600 hover:bg-gray-100 font-semibold py-6 text-lg rounded-full shadow-xl transition-transform hover:scale-105"
            data-testid="match-send-message-btn"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Send a Message
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 bg-transparent border-2 border-white text-white hover:bg-white/20 font-semibold py-6 text-lg rounded-full transition-transform hover:scale-105"
            data-testid="match-keep-discovering-btn"
          >
            Keep Discovering
          </Button>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
        
        @keyframes sparkle {
          0%, 100% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes slide-in-left {
          0% {
            transform: translateX(-100px) rotate(-20deg);
            opacity: 0;
          }
          100% {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes slide-in-right {
          0% {
            transform: translateX(100px) rotate(20deg);
            opacity: 0;
          }
          100% {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes pulse-scale {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes fade-in-up {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes spin-slow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        .animate-float-up {
          animation: float-up linear forwards;
        }
        
        .animate-sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
        
        .animate-slide-in-left {
          animation: slide-in-left 0.6s ease-out forwards;
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.6s ease-out forwards;
          animation-delay: 0.2s;
        }
        
        .animate-pulse-scale {
          animation: pulse-scale 1.5s ease-in-out infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
          animation-delay: 0.8s;
          opacity: 0;
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default MatchAnimation;
