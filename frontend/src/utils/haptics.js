/**
 * Haptic Feedback Utility — Native-feel vibrations
 * Uses navigator.vibrate, Capacitor Haptics loaded dynamically if available
 */

let hapticsPlugin = null;

// Dynamically load Capacitor Haptics if available (no hard dependency)
if (typeof window !== 'undefined') {
  try {
    import(/* webpackIgnore: true */ '@capacitor/haptics')
      .then(mod => { hapticsPlugin = mod.Haptics; })
      .catch(() => {});
  } catch {}
}

export const haptic = {
  // Light tap — tab switch, button press
  light() {
    try {
      if (hapticsPlugin) { hapticsPlugin.impact({ style: 'light' }); return; }
      navigator?.vibrate?.(10);
    } catch {}
  },
  // Medium — like, match
  medium() {
    try {
      if (hapticsPlugin) { hapticsPlugin.impact({ style: 'medium' }); return; }
      navigator?.vibrate?.(20);
    } catch {}
  },
  // Heavy — superlike, purchase
  heavy() {
    try {
      if (hapticsPlugin) { hapticsPlugin.impact({ style: 'heavy' }); return; }
      navigator?.vibrate?.(40);
    } catch {}
  },
  // Success — match, payment success
  success() {
    try {
      if (hapticsPlugin) { hapticsPlugin.notification({ type: 'success' }); return; }
      navigator?.vibrate?.([10, 50, 20]);
    } catch {}
  },
  // Error — failed action
  error() {
    try {
      if (hapticsPlugin) { hapticsPlugin.notification({ type: 'error' }); return; }
      navigator?.vibrate?.([30, 30, 30]);
    } catch {}
  },
};
