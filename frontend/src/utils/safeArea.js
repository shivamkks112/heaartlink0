/**
 * SafeArea - Dynamically measures and exposes safe area insets as CSS variables.
 * Works on ALL Android devices regardless of gesture/3-button navigation.
 *
 * Sets on <html>:
 *   --safe-bottom:     actual bottom inset in px (0 if none)
 *   --nav-height:      bottom navbar total height including safe area
 *   --header-offset:   top safe area offset
 */

import { Capacitor } from '@capacitor/core';

const NAVBAR_INNER = 52; // px – icon row height (fixed)

function measure() {
  const root = document.documentElement;

  // 1. Try CSS env() — works on iOS + some Android
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const envBottom = probe.offsetHeight;
  document.body.removeChild(probe);

  // 2. Fallback: measure gap between window.innerHeight and visualViewport
  let measuredBottom = envBottom;
  if (envBottom === 0 && window.visualViewport) {
    const gap = window.screen.height - window.innerHeight;
    // Typically status bar ≈ 24-48px. If gap > 60 there's a nav bar too.
    if (gap > 80) {
      measuredBottom = Math.max(gap - 48, 16); // rough nav bar height
    }
  }

  // 3. On native Capacitor, use a safe minimum of 12px (gesture bar)
  if (Capacitor.isNativePlatform() && measuredBottom < 8) {
    measuredBottom = 12;
  }
  // On mobile web, ensure a small default for gesture bars
  if (!Capacitor.isNativePlatform() && measuredBottom < 4 && /Mobi|Android/i.test(navigator.userAgent)) {
    measuredBottom = 6;
  }

  // Top safe area
  const probeTop = document.createElement('div');
  probeTop.style.cssText = 'position:fixed;top:0;left:0;width:1px;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
  document.body.appendChild(probeTop);
  let topInset = probeTop.offsetHeight;
  document.body.removeChild(probeTop);
  if (Capacitor.isNativePlatform() && topInset < 20) topInset = 28;

  // Set CSS variables
  root.style.setProperty('--safe-bottom', `${measuredBottom}px`);
  root.style.setProperty('--safe-top', `${topInset}px`);
  root.style.setProperty('--nav-height', `${NAVBAR_INNER + measuredBottom}px`);
  root.style.setProperty('--header-offset', `${topInset}px`);
}

export function initSafeArea() {
  // Measure immediately
  measure();
  // Re-measure on resize (keyboard, rotation, fold)
  window.addEventListener('resize', measure);
  // Re-measure after short delay (some WebViews report late)
  setTimeout(measure, 500);
  setTimeout(measure, 2000);
}
