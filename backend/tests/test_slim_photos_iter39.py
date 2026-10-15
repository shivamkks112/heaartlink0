"""
Tests for iter39: slim_photos replaces inline base64 photos with URL endpoints.
Covers: /api/likes, /api/crushes, /api/profile-viewers, /api/matches,
        /api/conversations, /api/chat/{match_id}/info, and /api/photo/{uid}/{slot}.
"""
import os
import re
import json
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "shivamkks112@gmail.com"
ADMIN_PASS = "Shivam@2026"
ADMIN_USER_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
BASE64_USER_ID = "4fc1d920-f8c7-4192-82d6-adfb77b5670c"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": ADMIN_EMAIL,
        "password": ADMIN_PASS,
    }, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    user = data.get("user") or {}
    uid = user.get("id") or ADMIN_USER_ID
    if token:
        session.headers["Authorization"] = f"Bearer {token}"
    return {"token": token, "user_id": uid}


def _assert_no_inline_base64(payload):
    text = json.dumps(payload)
    # Must not contain inline base64 image data
    assert "data:image" not in text, "Found inline data:image in response — slim_photos not applied"


def _photo_url_pattern(uid):
    # {host}/api/photo/{uid}/p?v=... or /api/photo/{uid}/{index}?v=...
    return re.compile(rf"/api/photo/{re.escape(uid)}/(p|\d+)\?v=[a-f0-9]+")


def test_likes_endpoint_no_base64(session, auth):
    t0 = time.time()
    r = session.get(f"{BASE_URL}/api/likes/{auth['user_id']}", timeout=60)
    elapsed = time.time() - t0
    print(f"/api/likes took {elapsed:.2f}s, size={len(r.content)} bytes")
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    _assert_no_inline_base64(data)
    # Size should be well under 1MB now (was 13.8MB)
    assert len(r.content) < 2 * 1024 * 1024, f"Response too large: {len(r.content)} bytes"


def test_crushes_endpoint_no_base64(session, auth):
    r = session.get(f"{BASE_URL}/api/crushes/{auth['user_id']}", timeout=60)
    assert r.status_code == 200, r.text[:300]
    _assert_no_inline_base64(r.json())


def test_profile_viewers_endpoint_no_base64(session, auth):
    r = session.get(f"{BASE_URL}/api/profile-viewers/{auth['user_id']}", timeout=60)
    assert r.status_code == 200, r.text[:300]
    _assert_no_inline_base64(r.json())


def test_matches_endpoint_no_base64(session, auth):
    """Also verifies no 500 when matched user lacks 'age' field."""
    r = session.get(f"{BASE_URL}/api/matches/{auth['user_id']}", timeout=60)
    assert r.status_code == 200, f"matches failed: {r.status_code} {r.text[:300]}"
    _assert_no_inline_base64(r.json())


def test_conversations_endpoint_no_base64(session, auth):
    r = session.get(f"{BASE_URL}/api/conversations/{auth['user_id']}", timeout=60)
    assert r.status_code == 200, r.text[:300]
    _assert_no_inline_base64(r.json())


def test_chat_info_no_base64(session, auth):
    # Grab a match_id from matches endpoint
    r = session.get(f"{BASE_URL}/api/matches/{auth['user_id']}", timeout=60)
    assert r.status_code == 200
    matches = r.json()
    if not matches:
        pytest.skip("No matches available for chat info test")
    match_id = matches[0]["match_id"]
    r2 = session.get(f"{BASE_URL}/api/chat/{match_id}/info", params={"user_id": auth["user_id"]}, timeout=30)
    assert r2.status_code == 200, r2.text[:300]
    _assert_no_inline_base64(r2.json())


def test_photo_endpoint_profile_picture(session):
    """GET /api/photo/{uid}/p returns image bytes with cache-control."""
    r = session.get(f"{BASE_URL}/api/photo/{BASE64_USER_ID}/p", timeout=30, allow_redirects=False)
    print(f"photo /p status={r.status_code} ct={r.headers.get('content-type')} len={len(r.content)}")
    assert r.status_code in (200, 302), f"unexpected: {r.status_code}"
    if r.status_code == 200:
        ct = r.headers.get("content-type", "")
        assert ct.startswith("image/"), f"content-type not image: {ct}"
        cc = r.headers.get("cache-control", "")
        assert "max-age=31536000" in cc, f"cache-control missing: {cc}"
        assert len(r.content) > 0


def test_photo_endpoint_index_0(session):
    r = session.get(f"{BASE_URL}/api/photo/{BASE64_USER_ID}/0", timeout=30, allow_redirects=False)
    assert r.status_code in (200, 302, 404)
    if r.status_code == 200:
        assert r.headers.get("content-type", "").startswith("image/")
        assert "max-age=31536000" in r.headers.get("cache-control", "")


def test_photo_endpoint_unknown_user_404(session):
    r = session.get(f"{BASE_URL}/api/photo/nonexistent-user-xyz/p", timeout=30, allow_redirects=False)
    assert r.status_code == 404


def test_photo_endpoint_out_of_range(session):
    r = session.get(f"{BASE_URL}/api/photo/{BASE64_USER_ID}/99", timeout=30, allow_redirects=False)
    assert r.status_code == 404


def test_likes_non_premium_locked_behavior(session, auth):
    """Non-premium users should see masked names '???' and is_locked=true."""
    r = session.get(f"{BASE_URL}/api/likes/{auth['user_id']}", timeout=60)
    assert r.status_code == 200
    data = r.json()
    likes = data.get("likes", []) if isinstance(data, dict) else data
    is_premium = data.get("is_premium") if isinstance(data, dict) else None
    print(f"likes count={len(likes)} is_premium={is_premium}")
    if likes and is_premium is False:
        # non-premium: at least some should be locked
        has_locked = any(l.get("is_locked") for l in likes)
        has_masked = any(l.get("name") == "???" for l in likes)
        assert has_locked or has_masked, "non-premium should mask names/lock"
