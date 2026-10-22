# RCA — HeartLink push notifications not delivered (background/closed)

Deployment: dating-app-debug-1 (heartlink.co.in) | Active run: a4daa1c6-7cfe-44fc-84c0-df5a0a954876
Mode: READ-ONLY diagnosis. No data/secrets changed. Window: last ~6h (prod backend logs, UTC).

## Symptom
Message and match push notifications do not reach phones in background/closed state.

## Root cause (CONFIRMED)
The legacy notification module `backend/firebase_config.py` calls a Firebase API that no longer exists in the installed SDK.

- `requirements.txt:27` pins `firebase_admin==7.1.0`. `messaging.send_multicast()` was removed in firebase-admin ≥ 6.2 (replaced by `send_each_for_multicast()`).
- `backend/firebase_config.py:109` → `response = messaging.send_multicast(message)` (inside `send_notification_to_multiple`, def at line 85).
- Runtime log (exact string), 4 occurrences in 6h:
  `firebase_config - ERROR - FCM multicast error: module 'firebase_admin.messaging' has no attribute 'send_multicast'`
  Timestamps (UTC): 2026-10-22 17:06:39,428 / 17:13:06,797 / 17:36:43,846 / 17:43:10,945
- Every push routed through this legacy multicast helper throws and reaches nobody.

A second, newer module `backend/fcm_service.py` already uses the correct API:
- `fcm_service.py:131` → `messaging.send_each_for_multicast(msg)` — works.
  Log: `fcm_service - INFO - FCM multi: 3 ok, 0 fail, 0 stale` at 17:26:02.
- Single-token sends also work: `firebase_config.py:71` `messaging.send()` →
  `firebase_config - INFO - FCM sent: projects/heartlink-6abe9/messages/...` at 17:10:41 and 17:17:08.

So the codebase has TWO parallel push paths; the legacy `firebase_config` multicast path is broken, the `fcm_service` path is correct. Any match/message flow that reaches `firebase_config.send_notification_to_multiple()` fails with the AttributeError above.

## Requested log strings — findings (last 6h)
- "FCM OK", "FCM send error", "FCM token stale", "SenderIdMismatch", "Firebase FCM ready", "Firebase init failed", "Firebase credentials not found": NONE found. The code does not emit these exact strings; firebase_config emits "FCM sent"/"FCM multicast error" and fcm_service emits "FCM multi: N ok, N fail, N stale". => No Firebase init failure, no missing-credentials, no SenderIdMismatch, no stale-token events were logged.
- "Push to <user_id> failed: <error>" (incl. no_token) for the two ids: NONE found.
- "FCM token registered for user":
  - 89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c (male): 3x — 17:28:29,598 / 17:36:20,607 / 17:38:19,334
  - b942536a-b47e-4d20-ad26-6d41398e7597 (female): 1x — 17:30:03,382

## Production DB (users collection; token VALUES not printed)
db: dating-app-debug-1-dating_app_db
- 89a6e3b5-...dc22c: fcm_token = NON-EMPTY; fcm_token_updated_at = 2026-10-22T17:38:17.096884+00:00
- b942536a-...6597: fcm_token = NON-EMPTY; fcm_token_updated_at = 2026-10-22T17:29:55.209814+00:00
- The two tokens are DIFFERENT (not shared).
=> Token registration/storage is healthy for both users; "no_token" is NOT the cause here.

## Fix (Code — E1, then redeploy)
Primary: in `backend/firebase_config.py:109` replace `messaging.send_multicast(message)` with `messaging.send_each_for_multicast(message)`. `send_each_for_multicast` returns a BatchResponse with the same `success_count`/`failure_count`, so line 110 logging is unaffected.
Preferred: route all match/message push through `backend/fcm_service.py` (already uses the correct API and token-staleness handling), and retire the legacy `firebase_config` multicast helper to avoid drift.

## Caveat / what to verify
- Single-token `messaging.send()` already succeeds ("FCM sent"). If the live match/message handlers use the single-token helpers (`send_match_notification`/`send_message_notification`, lines 121/130) rather than the multicast helper, those messages ARE reaching FCM — in which case any remaining background-delivery gap would be a client-side/payload concern not visible in backend logs. E1 should confirm which path the match/message events invoke. The one defect proven in backend logs is the `send_multicast` AttributeError on the multicast path.
- firebase_admin version was confirmed from requirements.txt (==7.1.0) and from the live runtime error; the sandbox did not have the package installed to print __version__.
