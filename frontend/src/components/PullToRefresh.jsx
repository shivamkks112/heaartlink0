import { useState, useRef, useCallback } from 'react';
import { haptic } from '@/utils/haptics';

/**
 * PullToRefresh — Native-feel pull-down refresh
 * Usage: <PullToRefresh onRefresh={async () => fetchData()}>...children...</PullToRefresh>
 */
const PullToRefresh = ({ onRefresh, children, className = '' }) => {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef(null);
  const threshold = 80;

  const onTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop > 5) return;
    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && containerRef.current?.scrollTop <= 0) {
      const dist = Math.min(dy * 0.5, 120);
      setPullDistance(dist);
      if (dist >= threshold) haptic.light();
    }
  }, [pulling, refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      haptic.medium();
      try { await onRefresh?.(); } catch {}
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 || refreshing ? `${Math.max(pullDistance, refreshing ? 48 : 0)}px` : '0px' }}
      >
        <div
          className={`w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: refreshing ? 'none' : `rotate(${pullDistance * 3}deg)`, opacity: Math.min(pullDistance / threshold, 1) }}
        />
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
