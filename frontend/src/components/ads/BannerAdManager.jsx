import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import adsService from '@/services/AdsService';

// Adaptive banner only on list screens; never on Discover swipe, chat, premium, profile edit or auth.
const BANNER_PATHS = ['/matches', '/likes', '/notifications'];

export const BannerAdManager = ({ user }) => {
  const location = useLocation();
  const adUser = Boolean(user) && user.gender?.toLowerCase() === 'male' && !user.is_premium && !user.isPremium;
  const [popupOpen, setPopupOpen] = useState(false);
  const show = adUser && BANNER_PATHS.includes(location.pathname) && !popupOpen;

  // Hide the banner while any popup/sheet is open so it never covers buttons
  useEffect(() => {
    if (!adUser || !adsService.isNative()) return undefined;
    const check = () => setPopupOpen(Boolean(document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-testid*="modal"]')));
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
    return () => obs.disconnect();
  }, [adUser]);

  useEffect(() => {
    if (!adsService.isNative()) return undefined;
    let cancelled = false;
    if (show) {
      // Small delay: let the page paint first, so the ad never blocks content loading
      const t = setTimeout(async () => {
        await adsService.initialize();
        if (cancelled) return;
        const nav = document.querySelector('nav');
        adsService.showBanner(nav ? nav.offsetHeight : 56);
      }, 1200);
      return () => { cancelled = true; clearTimeout(t); };
    }
    adsService.hideBanner();
    return undefined;
  }, [show]);

  return null;
};

export default BannerAdManager;
