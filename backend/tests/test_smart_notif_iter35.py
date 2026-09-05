"""Iteration 35 — Smart Notification Config admin endpoints tests."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

TOGGLES = [
    "welcome_enabled", "profile_reminder_enabled", "new_user_discovery_enabled",
    "comeback_3d_enabled", "comeback_7d_enabled", "daily_engagement_enabled",
    "weekend_special_enabled",
]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def original_config(client):
    r = client.get(f"{BASE_URL}/api/admin/notification-config", timeout=30)
    assert r.status_code == 200, r.text
    cfg = r.json()["config"]
    yield cfg
    # restore
    restore = {k: cfg[k] for k in TOGGLES if k in cfg}
    restore["max_notifications_per_user_per_day"] = cfg.get("max_notifications_per_user_per_day", 3)
    client.put(f"{BASE_URL}/api/admin/notification-config", json=restore, timeout=30)


# --- GET /api/admin/notification-config ---
class TestGetConfig:
    def test_get_config_structure(self, client):
        r = client.get(f"{BASE_URL}/api/admin/notification-config", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("config", "analytics", "recent_24h", "type_breakdown_24h"):
            assert key in d, f"missing {key}"
        cfg = d["config"]
        for t in TOGGLES:
            assert t in cfg, f"missing toggle {t}"
            assert isinstance(cfg[t], bool)
        assert isinstance(cfg["max_notifications_per_user_per_day"], int)
        assert isinstance(d["recent_24h"], int)
        assert isinstance(d["type_breakdown_24h"], dict)
        assert "_id" not in str(d)


# --- PUT /api/admin/notification-config ---
class TestUpdateConfig:
    def test_toggle_update_persists(self, client, original_config):
        current = original_config["welcome_enabled"]
        r = client.put(f"{BASE_URL}/api/admin/notification-config",
                       json={"welcome_enabled": not current}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["welcome_enabled"] is (not current)
        g = client.get(f"{BASE_URL}/api/admin/notification-config", timeout=30).json()
        assert g["config"]["welcome_enabled"] is (not current)
        # revert
        client.put(f"{BASE_URL}/api/admin/notification-config",
                   json={"welcome_enabled": current}, timeout=30)

    def test_all_toggles_updatable(self, client):
        payload = {t: False for t in TOGGLES}
        r = client.put(f"{BASE_URL}/api/admin/notification-config", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for t in TOGGLES:
            assert body[t] is False, f"{t} not saved as False"
        g = client.get(f"{BASE_URL}/api/admin/notification-config", timeout=30).json()["config"]
        for t in TOGGLES:
            assert g[t] is False
        # restore to True
        client.put(f"{BASE_URL}/api/admin/notification-config",
                   json={t: True for t in TOGGLES}, timeout=30)

    def test_frequency_limit_update(self, client):
        r = client.put(f"{BASE_URL}/api/admin/notification-config",
                       json={"max_notifications_per_user_per_day": 5}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["max_notifications_per_user_per_day"] == 5
        g = client.get(f"{BASE_URL}/api/admin/notification-config", timeout=30).json()["config"]
        assert g["max_notifications_per_user_per_day"] == 5

    def test_invalid_fields_rejected(self, client):
        r = client.put(f"{BASE_URL}/api/admin/notification-config",
                       json={"bogus_field": True}, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        assert "detail" in r.json()

    def test_empty_body_rejected(self, client):
        r = client.put(f"{BASE_URL}/api/admin/notification-config", json={}, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_invalid_json_rejected(self, client):
        r = requests.put(f"{BASE_URL}/api/admin/notification-config",
                         data="not-json", headers={"Content-Type": "application/json"}, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_out_of_range_frequency(self, client):
        """Frequency should be validated 1-10 (report if unbounded)."""
        r = client.put(f"{BASE_URL}/api/admin/notification-config",
                       json={"max_notifications_per_user_per_day": 9999}, timeout=30)
        assert r.status_code in (400, 422), (
            f"Backend accepted out-of-range value 9999 (status {r.status_code}) -> no server-side validation")


# --- GET /api/admin/notification-analytics-chart ---
class TestAnalyticsChart:
    def test_chart_default_7_days(self, client):
        r = client.get(f"{BASE_URL}/api/admin/notification-analytics-chart?days=7", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["period_days"] == 7
        assert isinstance(d["chart"], list)
        assert len(d["chart"]) == 7
        for e in d["chart"]:
            assert set(("date", "total", "breakdown")).issubset(e.keys())
            assert isinstance(e["total"], int)
            assert isinstance(e["breakdown"], dict)

    def test_chart_no_param(self, client):
        r = client.get(f"{BASE_URL}/api/admin/notification-analytics-chart", timeout=30)
        assert r.status_code == 200
        assert len(r.json()["chart"]) == 7

    def test_chart_custom_days(self, client):
        r = client.get(f"{BASE_URL}/api/admin/notification-analytics-chart?days=3", timeout=30)
        assert r.status_code == 200
        assert len(r.json()["chart"]) == 3

    def test_chart_invalid_days(self, client):
        r = client.get(f"{BASE_URL}/api/admin/notification-analytics-chart?days=abc", timeout=30)
        assert r.status_code == 422
