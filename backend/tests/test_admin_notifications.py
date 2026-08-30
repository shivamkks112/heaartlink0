"""
HeartLink - Admin Panel & Notification flow backend tests
Covers: health, admin dashboard stats, fcm-status, pending-verifications,
all-users, user notifications (GET/read), admin send-notification,
notification-history, and E2E like -> notification storage.
"""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

TEST_USER = {"email": "referraltest@heartlink.com", "password": "Test@123"}
ADMIN_USER = {"email": "admin@heartlink.com", "password": "Admin@123"}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(client, creds):
    payload = {"email_or_phone": creds["email"], "password": creds["password"]}
    r = client.post(f"{API}/auth/login", json=payload, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds['email']}: {r.status_code} {r.text[:300]}")
    return r.json()


@pytest.fixture(scope="session")
def test_user(client):
    return _login(client, TEST_USER)


@pytest.fixture(scope="session")
def admin_user(client):
    return _login(client, ADMIN_USER)


# ---------- Health ----------
class TestHealth:
    def test_api_health(self, client):
        r = client.get(f"{API}/health", timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("status") in ("healthy", "ok"), data


# ---------- Auth ----------
class TestAuth:
    def test_test_user_login(self, test_user):
        assert "user" in test_user or "id" in test_user, test_user

    def test_admin_login_and_is_admin(self, admin_user):
        user = admin_user.get("user", admin_user)
        assert user.get("email") == ADMIN_USER["email"], user
        assert user.get("is_admin") is True, "Admin account does not have is_admin=True"


# ---------- Admin Panel APIs ----------
class TestAdminPanel:
    def test_dashboard_stats(self, client):
        r = client.get(f"{API}/admin/dashboard-stats", timeout=90)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        for key in ["total_users", "male_users", "female_users", "new_today",
                    "premium_users", "verified_users", "banned_users",
                    "total_matches", "total_messages", "recent_signups"]:
            assert key in d, f"missing {key}"
        assert isinstance(d["total_users"], int) and d["total_users"] > 0
        assert isinstance(d["recent_signups"], list)
        for u in d["recent_signups"]:
            assert "_id" not in u

    def test_fcm_status(self, client):
        r = client.get(f"{API}/admin/fcm-status", timeout=90)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert isinstance(d["total_users"], int)
        assert isinstance(d["users_with_fcm_token"], int)
        assert d["users_with_fcm_token"] + d["users_without_token"] == d["total_users"]
        assert d["can_send_notifications"] == (d["users_with_fcm_token"] > 0)

    def test_pending_verifications(self, client):
        r = client.get(f"{API}/admin/pending-verifications", timeout=90)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        items = d if isinstance(d, list) else d.get("users", d.get("verifications"))
        assert isinstance(items, list), d

    def test_all_users_pagination(self, client):
        r = client.get(f"{API}/admin/all-users", params={"page": 1, "limit": 5}, timeout=90)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert isinstance(d["users"], list) and len(d["users"]) <= 5
        assert d["page"] == 1
        assert isinstance(d["total"], int) and d["total"] >= len(d["users"])
        assert d["pages"] >= 1
        for u in d["users"]:
            assert "_id" not in u
            assert "id" in u and "name" in u

    def test_all_users_search(self, client):
        r = client.get(f"{API}/admin/all-users", params={"search": "referraltest"}, timeout=90)
        assert r.status_code == 200, r.text[:500]
        emails = [u.get("email") for u in r.json()["users"]]
        assert TEST_USER["email"] in emails, emails

    def test_notification_templates(self, client):
        r = client.get(f"{API}/admin/notification-templates", timeout=60)
        assert r.status_code == 200
        t = r.json()
        assert isinstance(t, list) and len(t) > 0
        assert {"id", "title", "body"} <= set(t[0].keys())


# ---------- User notifications ----------
class TestUserNotifications:
    def test_get_notifications(self, client, test_user):
        uid = test_user.get("user", test_user)["id"]
        r = client.get(f"{API}/notifications/{uid}", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert isinstance(d["notifications"], list)
        assert isinstance(d["unread_count"], int)
        for n in d["notifications"]:
            assert {"id", "type", "title", "message", "read", "created_at"} <= set(n.keys())

    def test_mark_all_read(self, client, test_user):
        uid = test_user.get("user", test_user)["id"]
        r = client.post(f"{API}/notifications/{uid}/read", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("success") is True
        # verify persistence
        g = client.get(f"{API}/notifications/{uid}", timeout=60)
        assert g.json()["unread_count"] == 0

    def test_notifications_unknown_user(self, client):
        r = client.get(f"{API}/notifications/{uuid.uuid4()}", timeout=60)
        assert r.status_code == 200
        assert r.json()["notifications"] == []


# ---------- E2E: like creates stored notification ----------
class TestLikeCreatesNotification:
    def test_like_stores_notification_for_target(self, client, test_user, admin_user):
        liker = test_user.get("user", test_user)
        target = admin_user.get("user", admin_user)

        before = client.get(f"{API}/notifications/{target['id']}", timeout=60).json()
        before_count = len(before["notifications"])

        r = client.post(
            f"{API}/action/{liker['id']}",
            json={"target_user_id": target["id"], "action": "like"},
            timeout=90,
        )
        assert r.status_code == 200, f"swipe/like failed: {r.status_code} {r.text[:300]}"
        action = r.json().get("action")
        assert action in ("liked", "matched"), r.json()

        after = client.get(f"{API}/notifications/{target['id']}", timeout=60).json()
        assert len(after["notifications"]) > before_count, (
            "Like did not create a stored notification for the target user"
        )
        newest = after["notifications"][0]
        assert newest["type"] in ("like", "match"), newest
        assert newest["read"] is False
        assert liker["name"] in newest["message"], newest


# ---------- Admin send notification + history ----------
class TestAdminSendNotification:
    def test_send_notification_response(self, client):
        payload = {"title": "TEST_QA Notification", "body": "TEST_QA body", "target": "all"}
        r = client.post(f"{API}/admin/send-notification", json=payload, timeout=120)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert "success" in d
        if d["success"]:
            assert isinstance(d.get("success_count"), int)
        else:
            # preview env has 0 FCM tokens - graceful message expected
            assert "FCM" in d.get("message", "") or "token" in d.get("message", "").lower()

    def test_send_notification_validation(self, client):
        r = client.post(f"{API}/admin/send-notification", json={"body": "no title"}, timeout=60)
        assert r.status_code == 422, f"expected 422 got {r.status_code}"

    def test_notification_history(self, client):
        r = client.get(f"{API}/admin/notification-history", timeout=60)
        assert r.status_code == 200, r.text[:500]
        logs = r.json()
        assert isinstance(logs, list)
        for log in logs:
            assert "_id" not in log
            assert {"id", "title", "body", "target", "sent_at"} <= set(log.keys())

    def test_scheduled_notification_crud(self, client):
        payload = {
            "title": "TEST_QA Scheduled",
            "body": "TEST_QA scheduled body",
            "target": "all",
            "schedule_time": "2030-01-01T10:00:00+00:00",
        }
        r = client.post(f"{API}/admin/schedule-notification", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:300]
        sid = r.json()["scheduled_id"]

        g = client.get(f"{API}/admin/scheduled-notifications", timeout=60)
        assert g.status_code == 200
        assert any(n["id"] == sid for n in g.json()), "scheduled notification not persisted"

        d = client.delete(f"{API}/admin/scheduled-notification/{sid}", timeout=60)
        assert d.status_code == 200, d.text[:300]

        g2 = client.get(f"{API}/admin/scheduled-notifications", timeout=60)
        assert not any(n["id"] == sid for n in g2.json()), "cancelled notification still pending"

    def test_delete_nonexistent_scheduled(self, client):
        r = client.delete(f"{API}/admin/scheduled-notification/{uuid.uuid4()}", timeout=60)
        assert r.status_code == 404, f"expected 404 got {r.status_code}"


# ---------- Discover ----------
class TestDiscover:
    def test_discover_returns_profiles(self, client, test_user):
        uid = test_user.get("user", test_user)["id"]
        r = client.get(f"{API}/discover/{uid}", timeout=120)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        users = d if isinstance(d, list) else d.get("users", [])
        assert isinstance(users, list)
        for u in users:
            assert "_id" not in u


# ---------- Known defects (documented as failing tests) ----------
class TestKnownDefects:
    """These tests encode expected-correct behaviour and currently FAIL.
    They document the defects reported to the developer agent."""

    def test_all_users_gender_filter_applied(self, client):
        """AdminDashboard sends `gender` param but backend ignores it."""
        r = client.get(f"{API}/admin/all-users", params={"gender": "female", "limit": 50}, timeout=90)
        assert r.status_code == 200
        genders = [(u.get("gender") or "").lower() for u in r.json()["users"]]
        assert all(g == "female" for g in genders), f"gender filter ignored: {genders}"

    def test_all_users_status_filter_applied(self, client):
        """AdminDashboard sends `status` param but backend ignores it."""
        r = client.get(f"{API}/admin/all-users", params={"status": "banned", "limit": 50}, timeout=90)
        assert r.status_code == 200
        users = r.json()["users"]
        assert all(u.get("is_shadow_banned") or u.get("is_permanently_banned") for u in users), \
            "status=banned filter ignored"

    def test_admin_endpoints_require_auth(self, client):
        """Admin endpoints are publicly callable without any token (PII / destructive ops exposed)."""
        anon = requests.Session()
        r = anon.get(f"{API}/admin/all-users", timeout=90)
        assert r.status_code in (401, 403), (
            f"/admin/all-users returned {r.status_code} without auth and leaks user emails/phones"
        )

    def test_admin_notification_persisted_for_users(self, client, test_user):
        """Admin notifications should also be stored in db.notifications so users see them in-app."""
        uid = test_user.get("user", test_user)["id"]
        client.post(f"{API}/notifications/{uid}/read", timeout=60)
        before = len(client.get(f"{API}/notifications/{uid}", timeout=60).json()["notifications"])
        client.post(
            f"{API}/admin/send-notification",
            json={"title": "TEST_QA Persist", "body": "TEST_QA persist body", "target": "all"},
            timeout=120,
        )
        after = client.get(f"{API}/notifications/{uid}", timeout=60).json()["notifications"]
        assert len(after) > before, "admin/send-notification does not store an in-app notification"

    def test_send_notification_logged_even_when_no_tokens(self, client):
        """Attempt with 0 FCM tokens is not logged, so admin history stays empty."""
        before = len(client.get(f"{API}/admin/notification-history", timeout=60).json())
        client.post(
            f"{API}/admin/send-notification",
            json={"title": "TEST_QA Log", "body": "TEST_QA log body", "target": "all"},
            timeout=120,
        )
        after = len(client.get(f"{API}/admin/notification-history", timeout=60).json())
        assert after > before, "send-notification attempt not recorded in notification_logs"

    def test_scheduled_notifications_are_dispatched(self, client):
        """No background worker consumes db.scheduled_notifications - schedule feature is a no-op."""
        payload = {
            "title": "TEST_QA DueNow",
            "body": "TEST_QA due now",
            "target": "all",
            "schedule_time": "2020-01-01T00:00:00+00:00",
        }
        sid = client.post(f"{API}/admin/schedule-notification", json=payload, timeout=60).json()["scheduled_id"]
        # a past-due scheduled notification should not remain 'pending' forever
        pending = client.get(f"{API}/admin/scheduled-notifications", timeout=60).json()
        still_pending = any(n["id"] == sid for n in pending)
        client.delete(f"{API}/admin/scheduled-notification/{sid}", timeout=60)
        assert not still_pending, "past-due scheduled notification still pending; no dispatcher exists"
