import { Component } from 'react';
import { Heart } from 'lucide-react';

/**
 * ErrorBoundary catches React render crashes and shows
 * a fallback UI instead of a white/blank screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[HeartLink] Component crash:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const isDark = document.documentElement.classList.contains('dark');
      return (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '24px',
            backgroundColor: isDark ? '#1A1113' : '#FFF0F3',
            color: isDark ? '#F0DEE1' : '#1F1A1C',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <Heart style={{ width: 48, height: 48, color: '#D6336C', marginBottom: 16 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 24, textAlign: 'center' }}>
            Page load nahi ho paya. Please try again.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/matches';
            }}
            style={{
              background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)',
              color: 'white', border: 'none', borderRadius: 9999,
              padding: '12px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
