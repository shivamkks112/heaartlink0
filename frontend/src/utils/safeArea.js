/**
 * SafeArea — Bulletproof safe area detection for Android + iOS + Web.
 *
 * Detection layers (highest priority first):
 *   1. capacitor-plugin-safe-area (actual Android WindowInsets)
 *   2. CSS env(safe-area-inset-*) probes
 *   3. Screen gap heuristic (screen.height vs innerHeight)
 *   4. Platform-aware minimum floors
 *
 * Sets on <html>:
 *   --safe-bottom      bottom system inset (px)
 *   --safe-top         top system inset (px)
 *   --nav-inner        app navbar icon-row height
 *   --nav-total        full navbar height (inner + safe-bottom)
 *   --card-pad         gap between card bottom and navbar
 *   --action-offset    button offset from card bottom
 *   --btn-lg/md/sm     responsive button sizes
 *   --vh               1% of real viewport height
 */

import { Capacitor } from '@capacitor/core';

// Cache the plugin insets so we don't call the native bridge every resize
let pluginBottom = null;
let pluginTop = null;
let pluginFetched = false;

async function fetchPluginInsets() {
  if (pluginFetched) return;
  pluginFetched = true;
  try {
    const { SafeArea } = await import('capacitor-plugin-safe-area');
    const { insets } = await SafeArea.getSafeAreaInsets();
    pluginBottom = insets.bottom;
    pluginTop = insets.top;
    // Re-measure with real insets
    measure();
    // Listen for changes (orientation, fold)
    SafeArea.addListener('safeAreaChanged', (data) => {
      pluginBottom = data.insets.bottom;
      pluginTop = data.insets.top;
      measure();
    });
  } catch (e) {
    // Plugin not available (web, or native build missing plugin)
    pluginBottom = null;
    pluginTop = null;
  }
}

function measure() {
  const root = document.documentElement;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === 'android';
  const isLandscape = vw > vh;

  // ── Bottom safe area (multi-layer detection) ──

  // Layer 1: Plugin value (most accurate on native)
  let safeBottom = 0;
  if (pluginBottom !== null && pluginBottom > 0) {
    safeBottom = pluginBottom;
  }

  // Layer 2: CSS env() probe
  if (safeBottom === 0) {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;bottom:0;left:0;width:1px;height:0;' +
      'padding-bottom:env(safe-area-inset-bottom,0px);' +
      'visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const envVal = probe.offsetHeight;
    document.body.removeChild(probe);
    if (envVal > 0) safeBottom = envVal;
  }

  // Layer 3: Screen gap heuristic (edge-to-edge detection)
  if (safeBottom === 0 && isNative) {
    const screenH = window.screen.height;
    const totalGap = screenH - vh;
    // On Android, status bar ≈ 24dp. If total gap significantly exceeds that,
    // the remaining gap is the navigation bar.
    const statusBarEstPx = Math.round(24 * dpr);
    if (totalGap > statusBarEstPx + Math.round(8 * dpr)) {
      safeBottom = Math.max(totalGap - statusBarEstPx, Math.round(16 * dpr));
    }
  }

  // Layer 4: Platform-aware minimums
  // On Android Capacitor, gesture nav is ≈16-24dp, 3-button is ≈48dp.
  // We MUST have enough padding to clear the system bar.
  if (isAndroid) {
    // Minimum floor: 34px covers gesture nav on 2-3x DPR devices.
    // This is intentionally generous — it's better to have 10px extra padding
    // than to have the navbar hidden behind the system bar.
    const minBottom = Math.round(20 * dpr);  // 20dp in actual pixels
    safeBottom = Math.max(safeBottom, Math.max(minBottom, 34));
  } else if (isNative) {
    // iOS: env() usually works, but ensure a floor
    safeBottom = Math.max(safeBottom, 20);
  } else if (/Mobi|Android/i.test(navigator.userAgent)) {
    // Mobile web browser
    safeBottom = Math.max(safeBottom, 6);
  }

  // ── Top safe area ──
  let safeTop = 0;
  if (pluginTop !== null && pluginTop > 0) {
    safeTop = pluginTop;
  }
  if (safeTop === 0) {
    const probeT = document.createElement('div');
    probeT.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:0;' +
      'padding-top:env(safe-area-inset-top,0px);' +
      'visibility:hidden;pointer-events:none';
    document.body.appendChild(probeT);
    safeTop = probeT.offsetHeight;
    document.body.removeChild(probeT);
  }
  if (isAndroid && safeTop < Math.round(20 * dpr)) {
    safeTop = Math.round(24 * dpr);
  } else if (isNative && safeTop < 20) {
    safeTop = 28;
  }

  // ── Responsive navbar inner height (icon row) ──
  // Must be ≥ 48dp for Material Design touch target compliance.
  // On small screens: 48dp. On larger: up to 58dp.
  let navInner;
  if (isLandscape && vh < 500) navInner = 46;
  else if (vh < 640)          navInner = 48;
  else if (vh < 750)          navInner = 50;
  else if (vh < 900)          navInner = 52;
  else if (vh < 1100)         navInner = 54;
  else                        navInner = 58;

  const navTotal = navInner + safeBottom;

  // ── Card-to-navbar gap (min 26px guaranteed) ──
  const cardPad = Math.max(26, Math.min(40, Math.round(vh * 0.032)));

  // ── Action button offset ──
  const actionOffset = Math.max(16, Math.min(28, Math.round(vh * 0.022)));

  // ── Responsive button sizes ──
  const baseSize = Math.min(vw, 480);
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

  // Legacy compat
  root.style.setProperty('--nav-height', `${navTotal}px`);
  root.style.setProperty('--header-offset', `${safeTop}px`);
}

let debounceTimer = null;
function debouncedMeasure() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(measure, 60);
}

export function initSafeArea() {
  // Immediate measure with CSS-only detection
  measure();

  // Fetch plugin values (async, will re-measure when ready)
  fetchPluginInsets();

  // Re-measure on viewport changes (debounced to avoid layout thrash)
  window.addEventListener('resize', debouncedMeasure);
  window.addEventListener('orientationchange', () => setTimeout(measure, 200));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedMeasure);
  }

  // Delayed re-measures for late-reporting WebViews
  setTimeout(measure, 500);
  setTimeout(measure, 2000);
  setTimeout(measure, 5000);
}
