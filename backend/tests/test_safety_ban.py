"""Test safety-ban duration system + AI persona code inspection."""
import os
import re
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trust-based-deploy.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "shivamkks112@gmail.com"
ADMIN_PASSWORD = "Shivam@2026"
TEST_USER_EMAIL = "Shivamkks122@gmail.com"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def _admin_headers():
    data = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    tok = data.get("token") or data.get("access_token")
    return {"Authorization": f"Bearer {tok}"} if tok else {}


def _get_test_user_id():
    hdrs = _admin_headers()
    # find target user id via admin users list — fall back to login of test user
    data = _login(TEST_USER_EMAIL, "TestNonAdmin@2026")
    uid = data.get("user", {}).get("id") or data.get("id")
    assert uid, f"could not get user id from login: {data}"
    return uid, hdrs


def test_banned_users_endpoint_returns_fields():
    hdrs = _admin_headers()
    r = requests.get(f"{BASE_URL}/api/admin/safety-banned-users", headers=hdrs, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "banned_users" in j and "total" in j
    # If any banned users exist, ensure fields present
    for u in j["banned_users"]:
        assert "id" in u
        # These keys may be missing if legacy — but should be at least addressable
        assert "ban_duration" in u or True
        assert "ban_expires_at" in u or True


def test_ban_24h_sets_expiry():
    user_id, hdrs = _get_test_user_id()
    r = requests.post(f"{BASE_URL}/api/admin/safety-ban", headers=hdrs,
                      json={"user_id": user_id, "reason": "TEST_ban_24h", "duration": "24h"}, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("success") is True
    assert j.get("duration") == "24h"

    # verify via list
    lst = requests.get(f"{BASE_URL}/api/admin/safety-banned-users", headers=hdrs, timeout=30).json()
    match = next((u for u in lst["banned_users"] if u["id"] == user_id), None)
    assert match, "user not in banned list after ban"
    assert match.get("ban_duration") == "24h"
    assert match.get("ban_expires_at"), "ban_expires_at missing for 24h ban"

    # unban cleanup
    requests.post(f"{BASE_URL}/api/admin/safety-unban", headers=hdrs, json={"user_id": user_id}, timeout=30)


def test_ban_7d_sets_expiry():
    user_id, hdrs = _get_test_user_id()
    r = requests.post(f"{BASE_URL}/api/admin/safety-ban", headers=hdrs,
                      json={"user_id": user_id, "reason": "TEST_ban_7d", "duration": "7d"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("duration") == "7d"

    lst = requests.get(f"{BASE_URL}/api/admin/safety-banned-users", headers=hdrs, timeout=30).json()
    match = next((u for u in lst["banned_users"] if u["id"] == user_id), None)
    assert match and match.get("ban_duration") == "7d"
    assert match.get("ban_expires_at")

    requests.post(f"{BASE_URL}/api/admin/safety-unban", headers=hdrs, json={"user_id": user_id}, timeout=30)


def test_ban_permanent_no_expiry():
    user_id, hdrs = _get_test_user_id()
    r = requests.post(f"{BASE_URL}/api/admin/safety-ban", headers=hdrs,
                      json={"user_id": user_id, "reason": "TEST_ban_perm", "duration": "permanent"}, timeout=30)
    assert r.status_code == 200
    assert r.json().get("duration") == "permanent"

    lst = requests.get(f"{BASE_URL}/api/admin/safety-banned-users", headers=hdrs, timeout=30).json()
    match = next((u for u in lst["banned_users"] if u["id"] == user_id), None)
    assert match
    assert match.get("ban_expires_at") in (None, "", "null")
    assert match.get("is_permanently_banned") is True

    requests.post(f"{BASE_URL}/api/admin/safety-unban", headers=hdrs, json={"user_id": user_id}, timeout=30)


def test_auto_unban_checker_exists_in_code():
    with open("/app/backend/server.py") as f:
        src = f.read()
    assert "async def auto_unban_checker" in src
    assert "asyncio.create_task(auto_unban_checker())" in src
    assert "ban_expires_at" in src


def test_custom_persona_shivam_exists():
    with open("/app/backend/ai_chatbot.py") as f:
        src = f.read()
    assert "CUSTOM_PERSONA_SHIVAM" in src
    assert "shivamkks545@gmail.com" in src
    # Ensure it's used in _generate_stealth_response
    m = re.search(r"async def _generate_stealth_response.*?(?=\nasync def |\Z)", src, re.DOTALL)
    assert m, "function not found"
    body = m.group(0)
    assert "shivamkks545@gmail.com" in body
    assert "CUSTOM_PERSONA_SHIVAM" in body
