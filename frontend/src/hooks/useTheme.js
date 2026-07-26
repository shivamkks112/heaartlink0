import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'heartlink_theme';

/**
 * useTheme — manages light/dark/system theme.
 * Applies 'dark' class on <html> and persists choice.
 */
export function useTheme() {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  const applyTheme = useCallback((m) => {
    const isDark =
      m === 'dark' ||
      (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    applyTheme(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}

    // Listen for system changes when mode is 'system'
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode, applyTheme]);

  return { mode, setMode, isDark: document.documentElement.classList.contains('dark') };
}
