"""Tests for POST /api/admin/reset-user-password endpoint"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://heartlink-safe.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "review@heartlink.co.in"
ADMIN_PASSWORD = "HeartLink@2026"

# We'll use a test user to reset. Use demo/testmale account carefully OR find a non-admin user.
# To avoid breaking the admin, we'll target the testmale account and restore afterwards.
TARGET_EMAIL = "testmale@heartlink.co.in"
TARGET_ORIGINAL_PASSWORD = "Test@2026"


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email_or_phone": email, "password": password}, timeout=30)
    return r


@pytest.fixture(scope="module")
def target_user_id():
    r = login(TARGET_EMAIL, TARGET_ORIGINAL_PASSWORD)
    assert r.status_code == 200, f"Cannot login target user: {r.status_code} {r.text}"
    data = r.json()
    user = data.get("user") or data
    uid = user.get("id") or user.get("user_id")
    assert uid, f"No user id in login response: {data}"
    return uid


def test_reset_weak_password_rejected(target_user_id):
    r = requests.post(f"{API}/admin/reset-user-password",
                      json={"user_id": target_user_id, "new_password": "123"}, timeout=30)
    assert r.status_code == 400, f"Expected 400 for weak password, got {r.status_code}: {r.text}"


def test_reset_nonexistent_user_404():
    r = requests.post(f"{API}/admin/reset-user-password",
                      json={"user_id": "nonexistent-user-id-xyz-12345", "new_password": "NewPass@2026"}, timeout=30)
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_reset_password_success_and_login(target_user_id):
    new_password = "TempReset@2026"
    r = requests.post(f"{API}/admin/reset-user-password",
                      json={"user_id": target_user_id, "new_password": new_password}, timeout=30)
    assert r.status_code == 200, f"Reset failed: {r.status_code} {r.text}"
    body = r.json()
    assert "message" in body
    assert "reset" in body["message"].lower() or "success" in body["message"].lower()

    # Verify login with new password
    r2 = login(TARGET_EMAIL, new_password)
    assert r2.status_code == 200, f"Login with new password failed: {r2.status_code} {r2.text}"

    # Verify old password no longer works
    r3 = login(TARGET_EMAIL, TARGET_ORIGINAL_PASSWORD)
    assert r3.status_code != 200, "Old password should no longer work"

    # Restore original password
    r4 = requests.post(f"{API}/admin/reset-user-password",
                       json={"user_id": target_user_id, "new_password": TARGET_ORIGINAL_PASSWORD}, timeout=30)
    assert r4.status_code == 200, f"Failed to restore password: {r4.text}"

    # Verify restore works
    r5 = login(TARGET_EMAIL, TARGET_ORIGINAL_PASSWORD)
    assert r5.status_code == 200, "Restore login failed"
