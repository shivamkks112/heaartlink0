# HeartLink - India's Safe Dating App

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + Material 3 Design System
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android) with CapacitorHttp + capacitor-plugin-safe-area
- Notifications: Firebase Cloud Messaging (FCM)

## Completed (July 25-26, 2026)
- Phase 1 & 2: Safe Area + Tinder-style Discover page
- Bottom Nav + Android System Nav Bar overlap fix (4-layer detection)
- ALL PAGES safe area fix (A-Z) with dynamic CSS variables
- Complete Material 3 UI/UX Redesign (all screens)
- **Dark Mode Support:**
  - M3 dark tokens in material3.css (html.dark selector)
  - Deep warm dark surfaces (#1A1113, #221A1D, #272022)
  - Light pink/cream text (#F0DEE1, #D6C2C5)
  - Dark frosted glass navbar/topbar via CSS variables
  - Automatic Tailwind class overrides (bg-white, text-gray-*, border-*)
  - useTheme hook with localStorage persistence
  - System preference detection (prefers-color-scheme: dark)
  - Light/Dark/System toggle in Settings page
  - All pages auto-adapt via CSS variable system

## Pending / Backlog
### P0: Accessibility audit (aria-current, dynamic font scaling)
### P1: Admin API authentication, server.py refactoring
### P2: AI photo verification, AI Trust Score

## Critical Notes
- **Theme:** Use `--m3-*` CSS variables. Dark tokens auto-apply via `html.dark` class.
- **Theme Hook:** `import { useTheme } from '@/hooks/useTheme'` — provides mode/setMode.
- **Safe Areas:** Use `--nav-total` CSS variable. NEVER hardcode bottom padding.
- **Production:** https://dating-app-debug-1.emergent.host (redeploy to push changes)
