# HeartLink - India's Safe Dating App

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI + Material 3 Design System
- Backend: FastAPI (Python) + MongoDB
- Mobile: Capacitor 7 (Android) with CapacitorHttp + capacitor-plugin-safe-area
- Notifications: Firebase Cloud Messaging (FCM)

## Architecture
- `/app/frontend/src/styles/material3.css` - M3 design tokens, animations, utilities
- `/app/frontend/src/utils/safeArea.js` - Multi-layer safe area detection
- `/app/frontend/src/config/api.js` - Forces production URL for Capacitor
- `/app/backend/server.py` - Monolithic backend (~7500 lines)

## Completed (July 25-26, 2026)
- Phase 1 & 2: UI/UX Redesign — Safe Area + Tinder-style Discover page
- CRITICAL FIX: Bottom Nav + Android System Nav Bar overlap (4-layer detection)
- ALL PAGES safe area fix (A-Z)
- **COMPLETE Material 3 UI/UX Redesign:**
  - M3 design tokens (colors, shapes, elevation, motion)
  - M3 Bottom Navigation with active indicator pill
  - Frosted glass TopBar and Navbar
  - M3 surface color system across all pages
  - Premium card shapes (28px radius)
  - M3 segmented buttons on Matches page
  - Premium gradient action buttons on Discover
  - M3 auth page with pill tab switcher
  - M3 chat bubbles with gradient
  - Stagger animations, fade-ins, scale transitions
  - M3 chips, badges, skeleton loaders
  - Testing agent verified 100% - all functionality intact

## Pending / Backlog
### P0: Phases 3-13 remaining QA (Dark mode, accessibility audit, performance)
### P1: Admin API authentication, server.py refactoring
### P2: AI photo verification, AI Trust Score

## Critical Notes
- **M3 Theme:** All design tokens in `/src/styles/material3.css`. Use `--m3-*` CSS variables.
- **Safe Areas:** Use `--nav-total` CSS variable. NEVER hardcode bottom padding.
- **Firebase:** `HEARTLINK_FIREBASE_B64` in K8s. Do NOT change fcm_service.py.
- **Capacitor:** Always import from `@/config/api.js`.
- **Production:** https://dating-app-debug-1.emergent.host (redeploy to push changes)
