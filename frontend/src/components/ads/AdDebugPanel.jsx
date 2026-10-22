import React, { useState } from 'react';
import adsService from '@/services/AdsService';

// Temporary on-device ad diagnostics: shows SDK state and exact AdMob error codes.
export const AdDebugPanel = () => {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  if (!adsService.isNative()) return null;
  const refresh = () => setTick(t => t + 1);
  const testInterstitial = async () => {
    await adsService.initialize();
    adsService._interstitialHistory = [];
    await adsService.showInterstitial();
    setTimeout(refresh, 500);
  };
  const st = adsService.isAdAvailable().states;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4" data-testid="ad-debug-panel">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left text-sm font-semibold text-gray-700" data-testid="ad-debug-toggle">
        Ad status (testing) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-600" data-testid="ad-debug-states">
            SDK: {adsService.initialized ? 'ready' : 'not ready'} | Interstitial: {st.interstitial} | Video: {st.rewarded} | Banner: {st.banner}
          </p>
          <div className="flex gap-2">
            <button onClick={testInterstitial} className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-xs font-bold" data-testid="ad-debug-test-btn">Test ad</button>
            <button onClick={refresh} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-bold" data-testid="ad-debug-refresh-btn">Refresh</button>
          </div>
          <pre className="text-[10px] leading-4 bg-gray-50 p-2 rounded-lg max-h-64 overflow-auto whitespace-pre-wrap" data-testid="ad-debug-log">
            {adsService.getDebugLog().join('\n') || 'No log yet'}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AdDebugPanel;
