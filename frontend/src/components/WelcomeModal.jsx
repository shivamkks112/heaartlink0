import { Heart, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WelcomeModal = ({ data, onCta, onClose }) => {
  if (!data || !data.show) return null;

  const isNewUser = data.type === 'new_user';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm" data-testid="welcome-modal">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-bounce-in"
        style={{ background: 'var(--m3-surface-container-lowest, #fff)' }}
      >
        {/* Header gradient */}
        <div
          className="relative px-6 pt-10 pb-8 text-center"
          style={{ background: isNewUser
            ? 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)'
            : 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
          }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            {isNewUser
              ? <Heart className="w-8 h-8 text-white" fill="white" />
              : <Sparkles className="w-8 h-8 text-white" />
            }
          </div>
          <h2 className="text-xl font-bold text-white leading-tight" data-testid="welcome-title">
            {data.title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6 text-center">
          <p
            className="text-sm leading-relaxed mb-6"
            style={{ color: 'var(--m3-on-surface-variant, #555)' }}
            data-testid="welcome-message"
          >
            {data.message}
          </p>

          <Button
            onClick={onCta}
            className="w-full py-5 rounded-full font-semibold text-white text-base tracking-wide"
            style={{ background: isNewUser
              ? 'linear-gradient(135deg, #ec4899, #f97316)'
              : 'linear-gradient(135deg, #8b5cf6, #ec4899)'
            }}
            data-testid="welcome-cta-btn"
          >
            {isNewUser ? '✨' : '💬'} {data.cta}
            <ArrowRight className="w-4 h-4 ml-2 inline" />
          </Button>

          <button
            onClick={onClose}
            className="mt-3 text-xs font-medium py-2 w-full"
            style={{ color: 'var(--m3-outline, #888)' }}
            data-testid="welcome-skip-btn"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
