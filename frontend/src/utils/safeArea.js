/**
 * SafeArea — Dynamically measures and exposes responsive CSS variables.
 * Adapts to ALL screen sizes, orientations, and navigation modes.
 *
 * Sets on <html>:
 *   --safe-bottom      actual bottom inset (px)
 *   --safe-top         actual top inset (px)
 *   --nav-inner        navbar icon-row height, scales with screen
 *   --nav-total        full navbar height (inner + safe-bottom)
 *   --card-pad         minimum gap between card bottom and navbar
 *   --action-offset    offset for action buttons from card bottom
 *   --btn-lg           large button diameter (Like)
 *   --btn-md           medium button diameter (Pass)
 *   --btn-sm           small button diameter (SuperLike)
 *   --vh               1% of real viewport height (for mobile browser chrome)
 */

import { Capacitor } from '@capacitor/core';

function measure() {
  const root = document.documentElement;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const isLandscape = vw > vh;

  // ── 1. Bottom safe area ──
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const envBottom = probe.offsetHeight;
  document.body.removeChild(probe);

  let safeBottom = envBottom;
  if (envBottom === 0 && window.visualViewport) {
    const gap = window.screen.height - window.innerHeight;
    if (gap > 80 && gap < 200) {
      safeBottom = Math.max(gap - 48, 16);
    }
  }
  if (Capacitor.isNativePlatform() && safeBottom < 8) safeBottom = 12;
  if (!Capacitor.isNativePlatform() && safeBottom < 4 && /Mobi|Android/i.test(navigator.userAgent)) {
    safeBottom = 6;
  }

  // ── 2. Top safe area ──
  const probeTop = document.createElement('div');
  probeTop.style.cssText = 'position:fixed;top:0;left:0;width:1px;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
  document.body.appendChild(probeTop);
  let safeTop = probeTop.offsetHeight;
  document.body.removeChild(probeTop);
  if (Capacitor.isNativePlatform() && safeTop < 20) safeTop = 28;

  // ── 3. Responsive navbar inner height ──
  //    Scales with viewport: smaller on small phones, larger on tablets
  let navInner;
  if (vh < 640)       navInner = 46;   // very small / landscape
  else if (vh < 750)  navInner = 48;   // small phone 6.1"
  else if (vh < 900)  navInner = 52;   // medium phone 6.5"
  else if (vh < 1100) navInner = 54;   // large phone 6.7-6.9"
  else                navInner = 58;   // tablet / foldable

  const navTotal = navInner + safeBottom;

  // ── 4. Card-to-navbar gap (min 24dp guaranteed) ──
  //    Proportional to screen height, clamped to 24-40px
  const cardPad = Math.max(24, Math.min(40, Math.round(vh * 0.032)));

  // ── 5. Action button offset from card bottom ──
  //    Buttons sit this far from card's bottom edge
  const actionOffset = Math.max(16, Math.min(28, Math.round(vh * 0.022)));

  // ── 6. Responsive button sizes ──
  const baseSize = Math.min(vw, 480); // cap at 480 for tablets
  const btnLg = Math.max(54, Math.min(68, Math.round(baseSize * 0.15)));
  const btnMd = Math.max(46, Math.min(58, Math.round(baseSize * 0.128)));
  const btnSm = Math.max(38, Math.min(48, Math.round(baseSize * 0.105)));

  // ── Set all CSS variables ──
  root.style.setProperty('--safe-bottom', `${safeBottom}px`);
  root.style.setProperty('--safe-top', `${safeTop}px`);
  root.style.setProperty('--nav-inner', `${navInner}px`);
  root.style.setProperty('--nav-total', `${navTotal}px`);
  root.style.setProperty('--card-pad', `${cardPad}px`);
  root.style.setProperty('--action-offset', `${actionOffset}px`);
  root.style.setProperty('--btn-lg', `${btnLg}px`);
  root.style.setProperty('--btn-md', `${btnMd}px`);
  root.style.setProperty('--btn-sm', `${btnSm}px`);
  root.style.setProperty('--vh', `${vh * 0.01}px`);
  root.style.setProperty('--is-landscape', isLandscape ? '1' : '0');

  // Legacy compat (other pages still use these)
  root.style.setProperty('--nav-height', `${navTotal}px`);
  root.style.setProperty('--header-offset', `${safeTop}px`);
}

export function initSafeArea() {
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', () => setTimeout(measure, 150));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', measure);
  }
  setTimeout(measure, 500);
  setTimeout(measure, 2000);
}
