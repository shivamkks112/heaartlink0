import { Heart, Sparkles, ArrowRight, Shield, Moon, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PERK_ICONS = {
  crown: Crown,
  shield: Shield,
  moon: Moon,
  zap: Zap,
};

const WelcomeModal = ({ data, onCta, onClose }) => {
  if (!data || !data.show) return null;

  const isNewUser = data.type === 'new_user';
  const isGirlsOnboarding = data.variant === 'girls_onboarding';

  // Girls special onboarding
  if (isGirlsOnboarding) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" data-testid="welcome-modal">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-bounce-in bg-white">
          {/* Header */}
          <div className="relative px-6 pt-8 pb-6 text-center bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Heart className="w-7 h-7 text-white" fill="white" />
            </div>
            <h2 className="text-xl font-bold text-white" data-testid="welcome-title">
              {data.title}
            </h2>
            <p className="text-sm text-white/80 mt-1">{data.message}</p>
            {data.is_premium && (
              <div className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-900 px-3 py-1 rounded-full text-xs font-bold mt-3">
                <Crown className="w-3.5 h-3.5" /> FREE Premium Active
              </div>
            )}
          </div>

          {/* Perks */}
          <div className="px-5 py-5 space-y-3">
            {(data.perks || []).map((perk, i) => {
              const Icon = PERK_ICONS[perk.icon] || Shield;
              const colors = [
                'bg-amber-50 text-amber-600',
                'bg-red-50 text-red-500',
                'bg-indigo-50 text-indigo-600',
                'bg-emerald-50 text-emerald-600',
              ];
              return (
                <div key={i} className="flex items-start gap-3" data-testid={`perk-${i}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[i] || colors[0]}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{perk.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{perk.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="px-5 pb-5">
            <Button
              onClick={onCta}
              className="w-full py-5 rounded-full font-semibold text-white text-base bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
              data-testid="welcome-cta-btn"
            >
              {data.cta} <ArrowRight className="w-4 h-4 ml-2 inline" />
            </Button>
            <button
              onClick={onClose}
              className="mt-2 text-xs font-medium py-2 w-full text-gray-400"
              data-testid="welcome-skip-btn"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default welcome modal (boys + returning users)
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/50 backdrop-blur-sm" data-testid="welcome-modal">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-bounce-in"
        style={{ background: 'var(--m3-surface-container-lowest, #fff)' }}
      >
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
            {data.cta}
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
