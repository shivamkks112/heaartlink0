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
- Dark Mode Support (Light/Dark/System toggle)
- **UI Polish Audit:**
  - Match cards: M3 surfaces, compatibility pill badge, better photo placeholder, pill Chat button
  - Notification cards: M3 primary-container for unread, rounded icons, better timestamp
  - Profile stats: Consistent gradient cards with M3 elevation
  - Discover empty state: Refresh button + "expand distance" hint
  - Global: Image fade-in, card press animation, focus-visible outlines, scrollbar styling
  - Dark mode: Extended overrides for pink/green/border colors
  - Badge positioning: Smaller with border, better alignment
  - Accessibility: focus-visible outlines, min touch targets

## Pending / Backlog
### P1: Admin API authentication, server.py refactoring
### P2: AI photo verification, AI Trust Score

## Critical Notes
- **paddingTop:** All TopBar pages use `calc(var(--safe-top, 24px) + 60px)` — accounts for Android status bar
- **Theme:** `--m3-*` CSS variables. Dark via `html.dark` class
- **Safe Areas:** `--nav-total` for bottom padding. NEVER hardcode
- **Production:** https://dating-app-debug-1.emergent.host
