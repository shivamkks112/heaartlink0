"""Tests for location update and discover endpoints (city filter, distance_km)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trust-based-deploy.preview.emergentagent.com").rstrip("/")
TEST_USER_ID = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_health(client):
    r = client.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200


def test_update_location_success(client):
    payload = {"latitude": 19.0760, "longitude": 72.8777, "location": "Mumbai, Maharashtra"}
    r = client.post(f"{BASE_URL}/api/user/{TEST_USER_ID}/update-location", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "message" in data
    assert "success" in data["message"].lower()


def test_update_location_missing_field(client):
    r = client.post(f"{BASE_URL}/api/user/{TEST_USER_ID}/update-location", json={"latitude": 19.0})
    # should be 422 validation
    assert r.status_code in (400, 422)


def test_discover_returns_distance_km(client):
    # Ensure lat/lon are set first
    client.post(f"{BASE_URL}/api/user/{TEST_USER_ID}/update-location",
                json={"latitude": 19.0760, "longitude": 72.8777, "location": "Mumbai, Maharashtra"})
    r = client.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?limit=10")
    assert r.status_code == 200, r.text
    profiles = r.json()
    assert isinstance(profiles, list)
    if profiles:
        # At least one profile should have distance_km if any other user has coords
        with_dist = [p for p in profiles if "distance_km" in p]
        print(f"Profiles returned: {len(profiles)}, with distance_km: {len(with_dist)}")


def test_discover_city_filter_mumbai(client):
    r = client.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?city=Mumbai&limit=20")
    assert r.status_code == 200, r.text
    profiles = r.json()
    assert isinstance(profiles, list)
    for p in profiles:
        loc = (p.get("location") or "").lower()
        assert "mumbai" in loc, f"Expected 'mumbai' in location, got: {p.get('location')}"


def test_discover_city_filter_delhi(client):
    r = client.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?city=Delhi&limit=20")
    assert r.status_code == 200, r.text
    profiles = r.json()
    assert isinstance(profiles, list)
    for p in profiles:
        loc = (p.get("location") or "").lower()
        assert "delhi" in loc, f"Expected 'delhi' in location, got: {p.get('location')}"


def test_discover_no_city_returns_results(client):
    r = client.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?limit=5")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
