"""HeartLink iteration 37 audit: health, profile (both routes), safety-ban duration,
custom-ai-persona toggle/list, safety-analytics."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "shivamkks112@gmail.com"
ADMIN_PASSWORD = "Shivam@2026"
ADMIN_USER_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
NON_ADMIN_EMAIL = "Shivamkks122@gmail.com"
NON_ADMIN_PASSWORD = "TestNonAdmin@2026"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def non_admin_id(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": NON_ADMIN_EMAIL, "password": NON_ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Non-admin login failed: {r.status_code}")
    body = r.json()
    return body.get("user", {}).get("id") or body.get("user_id")


# ----- health -----
def test_health(s):
    r = s.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("status") in ("healthy", "ok")


# ----- profile endpoint (single + duplicate route) -----
def test_profile_single_prefix(s):
    r = s.get(f"{BASE_URL}/api/profile/{ADMIN_USER_ID}")
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("id") == ADMIN_USER_ID
    assert d.get("email") == ADMIN_EMAIL
    assert "_id" not in d
    assert "password_hash" not in d


def test_profile_double_prefix_apk_compat(s):
    """Duplicate route /api/api/profile/{id} for older APK clients."""
    r = s.get(f"{BASE_URL}/api/api/profile/{ADMIN_USER_ID}")
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("id") == ADMIN_USER_ID
    assert "_id" not in d


def test_profile_not_found(s):
    r = s.get(f"{BASE_URL}/api/profile/does-not-exist-xxx")
    assert r.status_code == 404


# ----- safety-analytics -----
def test_safety_analytics_default(s):
    r = s.get(f"{BASE_URL}/api/admin/safety-analytics")
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    # Should include chart (list of daily buckets) and totals
    chart = d.get("chart") or d.get("daily") or d.get("data")
    assert chart is not None, f"no chart in response keys={list(d.keys())}"
    assert isinstance(chart, list)
    if chart:
        sample = chart[0]
        for k in ("date", "bans", "unbans"):
            assert k in sample, f"missing key {k}"


@pytest.mark.parametrize("days", [7, 14, 30])
def test_safety_analytics_period(s, days):
    r = s.get(f"{BASE_URL}/api/admin/safety-analytics?days={days}")
    assert r.status_code == 200
    d = r.json()
    chart = d.get("chart") or d.get("daily") or d.get("data") or []
    assert len(chart) == days


# ----- custom AI persona toggle + list -----
def test_custom_ai_persona_toggle_and_list(s, non_admin_id):
    # enable
    r = s.post(f"{BASE_URL}/api/admin/custom-ai-persona/toggle",
               json={"user_id": non_admin_id, "enable": True})
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("success") is True
    assert d.get("custom_ai_persona") is True

    # verify appears in list
    r2 = s.get(f"{BASE_URL}/api/admin/custom-ai-personas")
    assert r2.status_code == 200
    users = r2.json().get("users", [])
    ids = [u.get("id") for u in users]
    assert non_admin_id in ids, f"user not in custom persona list; got {ids}"

    # disable (cleanup)
    r3 = s.post(f"{BASE_URL}/api/admin/custom-ai-persona/toggle",
                json={"user_id": non_admin_id, "enable": False})
    assert r3.status_code == 200
    assert r3.json().get("custom_ai_persona") is False


def test_custom_ai_persona_missing_user_id(s):
    r = s.post(f"{BASE_URL}/api/admin/custom-ai-persona/toggle", json={"enable": True})
    assert r.status_code == 400


# ----- safety-ban duration (idempotent: ban then unban immediately) -----
@pytest.mark.parametrize("duration", ["24h", "7d", "permanent"])
def test_safety_ban_duration(s, non_admin_id, duration):
    r = s.post(f"{BASE_URL}/api/admin/safety-ban",
               json={"user_id": non_admin_id, "duration": duration, "reason": f"TEST_{duration}"})
    assert r.status_code == 200, r.text[:300]

    # verify in banned list
    lst = s.get(f"{BASE_URL}/api/admin/safety-banned-users")
    assert lst.status_code == 200
    banned = lst.json().get("users") or lst.json().get("banned_users") or []
    match = next((u for u in banned if u.get("id") == non_admin_id), None)
    assert match, "user not in banned list"
    if duration == "permanent":
        assert match.get("is_permanently_banned") is True or match.get("ban_expires_at") in (None, "")
    else:
        assert match.get("ban_expires_at"), f"missing ban_expires_at for {duration}"
        assert match.get("ban_duration") == duration

    # cleanup: unban
    ub = s.post(f"{BASE_URL}/api/admin/safety-unban", json={"user_id": non_admin_id})
    assert ub.status_code in (200, 201)
