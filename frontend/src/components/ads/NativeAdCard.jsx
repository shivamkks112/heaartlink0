import React, { useEffect, useRef, useState } from 'react';
import adsService, { AD_CONFIG } from '@/services/AdsService';

export const NATIVE_AD_EVERY = 6;

// One native ad feed per screen; only for male non-premium users on the Android/iOS app.
export const useNativeAdFeed = (feedId, user) => {
  const [feed, setFeed] = useState(null);
  const [failed, setFailed] = useState([]);
  const adUser = Boolean(user) && user.gender?.toLowerCase() === 'male' && !user.is_premium && !user.isPremium;

  useEffect(() => {
    if (!adUser || !adsService.isNative()) return undefined;
    let active = true;
    let instance = null;
    (async () => {
      try {
        await adsService.initialize();
        const { NativeAdFeed, NativeAdTemplate, NativeAdPluginEvents } = await import('@capacitor-community/admob');
        instance = await NativeAdFeed.create({
          feedId,
          adId: AD_CONFIG.NATIVE_ID,
          template: NativeAdTemplate.Medium,
          isTesting: false,
          style: { backgroundColor: '#ffffff', cornerRadius: 16, headlineColor: '#111827', bodyColor: '#6b7280', callToActionBackgroundColor: '#D6336C', callToActionTextColor: '#ffffff' },
        });
        await instance.addListener(NativeAdPluginEvents.AdImpression, () => adsService._track('native'));
        await instance.addListener(NativeAdPluginEvents.FailedToLoad, (e) => setFailed(f => [...f, e.slotKey]));
        if (active) setFeed(instance); else instance.destroy();
      } catch (e) {
        console.log('NativeAdFeed unavailable:', e?.message);
      }
    })();
    return () => { active = false; if (instance) instance.destroy().catch(() => {}); setFeed(null); };
  }, [feedId, adUser]);

  return { feed, failed };
};

export const NativeAdCard = ({ feed, slotKey, failed }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!feed || !el) return undefined;
    feed.attach(slotKey, el);
    return () => { try { feed.detach(el); } catch (_) { /* feed destroyed */ } };
  }, [feed, slotKey]);

  if (!feed || failed.includes(slotKey)) return null;
  return (
    <div className="col-span-2 bg-white rounded-2xl shadow-md overflow-hidden" data-testid={`native-ad-${slotKey}`}>
      <div ref={ref} style={{ height: 320, width: '100%' }} />
    </div>
  );
};

export default NativeAdCard;
