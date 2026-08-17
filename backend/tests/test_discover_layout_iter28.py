"""Backend tests for HeartLink Discover page layout fix (iteration 28).
Verifies: health, login, discover profiles, city filter (Mumbai/Delhi).
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")
TEST_USER_ID = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"
ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PW = "HeartLink@2026"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def test_health(s):
    r = s.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") in ("healthy", "ok") or "status" in j


def test_login_returns_user_fields(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    # Look for user + token structures
    user = j.get("user") or j
    assert user.get("id") or user.get("user_id")
    assert "email" in user or user.get("email") == ADMIN_EMAIL


def test_discover_returns_profiles(s):
    r = s.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    if len(data) == 0:
        pytest.skip("No profiles returned for test user")
    p = data[0]
    # required fields for card render
    for field in ("id", "name", "age"):
        assert field in p, f"missing {field} in profile"
    # optional but expected
    assert "location" in p or "distance_km" in p or "shared_interests_count" in p


def test_discover_city_filter_mumbai(s):
    r = s.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?city=Mumbai", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for p in data:
        loc = (p.get("location") or "").lower()
        assert "mumbai" in loc, f"Non-Mumbai profile leaked: {p.get('location')}"


def test_discover_city_filter_delhi(s):
    r = s.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?city=Delhi", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for p in data:
        loc = (p.get("location") or "").lower()
        assert "delhi" in loc, f"Non-Delhi profile leaked: {p.get('location')}"


# ─── Layout file-level assertions ─────────────────────────────
def test_discover_page_no_fixed_inset_wrapper():
    path = "/app/frontend/src/pages/DiscoverPage.jsx"
    with open(path) as f:
        src = f.read()
    # Wrapper divs — first non-comment className should NOT contain 'fixed inset-0'
    wrappers = re.findall(r'<div className="([^"]*)"[^>]*style=\{\{ height: \'calc\(100vh', src)
    assert wrappers, "Expected calc(100vh - var(--nav-total…)) wrapper style"
    for cls in wrappers:
        assert "fixed" not in cls and "inset-0" not in cls, f"wrapper still uses fixed inset-0: {cls}"


def test_appcss_discover_card_area_uses_flex():
    path = "/app/frontend/src/App.css"
    with open(path) as f:
        css = f.read()
    m = re.search(r"\.discover-card-area\s*\{([^}]*)\}", css)
    assert m, ".discover-card-area rule missing"
    body = m.group(1)
    assert "flex" in body and "1 1 0%" in body.replace(" ", " "), f"flex:1 missing in: {body}"
    assert "dvh" not in body, f"dvh should be removed: {body}"
    assert "calc" not in body, f"fixed calc height should be removed: {body}"
