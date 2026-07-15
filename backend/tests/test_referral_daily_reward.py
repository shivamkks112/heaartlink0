"""
Test suite for HeartLink Referral System and Daily Login Rewards
Features tested:
- P1: Referral System (Invite 3 friends -> Get 10 FREE Superlikes)
- P2: Daily Login Rewards (7-day streak cycle with superlikes and profile boost rewards)
"""
import pytest
import requests
import os
import uuid
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://heartlink-safe.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "shivamkks112@gmail.com"
ADMIN_PASSWORD = "Test@123"
FEMALE_TEST_EMAIL = "femaletest@heartlink.com"
FEMALE_TEST_PASSWORD = "Test@123"

# Global session to reuse login tokens
_session_data = {}

def get_user_ids():
    """Get user IDs with caching to avoid rate limits"""
    global _session_data
    
    if "admin_id" in _session_data and "female_id" in _session_data:
        return _session_data["admin_id"], _session_data["female_id"]
    
    # Login as admin
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    admin_user = response.json()["user"]
    _session_data["admin_id"] = admin_user["id"]
    _session_data["admin_user"] = admin_user
    
    time.sleep(1)  # Avoid rate limit
    
    # Login as female test user
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": FEMALE_TEST_EMAIL,
        "password": FEMALE_TEST_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Female test login failed: {response.text}")
    female_user = response.json()["user"]
    _session_data["female_id"] = female_user["id"]
    _session_data["female_user"] = female_user
    
    return _session_data["admin_id"], _session_data["female_id"]


# ==================== REFERRAL SYSTEM TESTS ====================

def test_health_check():
    """Verify API is healthy"""
    response = requests.get(f"{BASE_URL}/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✅ API health check passed")


def test_get_referral_data_admin():
    """GET /api/referral/{user_id} - Get referral code and stats for admin"""
    admin_id, _ = get_user_ids()
    
    response = requests.get(f"{BASE_URL}/api/referral/{admin_id}")
    assert response.status_code == 200, f"Failed to get referral data: {response.text}"
    
    data = response.json()
    # Verify response structure
    assert "referral_code" in data, "Missing referral_code in response"
    assert "referral_link" in data, "Missing referral_link in response"
    assert "total_referrals" in data, "Missing total_referrals in response"
    assert "pending_referrals" in data, "Missing pending_referrals in response"
    assert "rewards_earned" in data, "Missing rewards_earned in response"
    assert "referrals_for_next_reward" in data, "Missing referrals_for_next_reward in response"
    
    # Verify referral code format (HLXXX + 6 chars)
    code = data["referral_code"]
    assert code.startswith("HL"), f"Referral code should start with 'HL', got: {code}"
    assert len(code) >= 8, f"Referral code too short: {code}"
    
    # Verify referral link contains the code
    assert code in data["referral_link"], "Referral link should contain the code"
    
    # Store for later tests
    _session_data["admin_referral_code"] = code
    
    print(f"✅ Admin referral code: {code}")
    print(f"✅ Total referrals: {data['total_referrals']}")
    print(f"✅ Rewards earned: {data['rewards_earned']}")


def test_get_referral_data_female_user():
    """GET /api/referral/{user_id} - Get referral code for female test user"""
    _, female_id = get_user_ids()
    
    response = requests.get(f"{BASE_URL}/api/referral/{female_id}")
    assert response.status_code == 200, f"Failed to get referral data: {response.text}"
    
    data = response.json()
    assert "referral_code" in data
    assert "referral_link" in data
    print(f"✅ Female user referral code: {data['referral_code']}")


def test_get_referral_leaderboard():
    """GET /api/referral/{user_id}/leaderboard - Get top referrers"""
    admin_id, _ = get_user_ids()
    
    response = requests.get(f"{BASE_URL}/api/referral/{admin_id}/leaderboard")
    assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
    
    data = response.json()
    assert "leaderboard" in data, "Missing leaderboard in response"
    
    leaderboard = data["leaderboard"]
    assert isinstance(leaderboard, list), "Leaderboard should be a list"
    
    # If there are entries, verify structure
    if len(leaderboard) > 0:
        entry = leaderboard[0]
        assert "rank" in entry, "Missing rank in leaderboard entry"
        assert "name" in entry, "Missing name in leaderboard entry"
        assert "referrals" in entry, "Missing referrals count in leaderboard entry"
        assert "is_you" in entry, "Missing is_you flag in leaderboard entry"
        print(f"✅ Leaderboard has {len(leaderboard)} entries")
        print(f"✅ Top referrer: {entry['name']} with {entry['referrals']} referrals")
    else:
        print("✅ Leaderboard is empty (no referrals yet)")


def test_apply_referral_invalid_code():
    """POST /api/referral/apply - Should reject invalid referral code"""
    response = requests.post(f"{BASE_URL}/api/referral/apply", json={
        "referral_code": "INVALID123",
        "user_id": str(uuid.uuid4())  # Random user ID
    })
    assert response.status_code == 404, f"Expected 404 for invalid code, got: {response.status_code}"
    assert "Invalid referral code" in response.json().get("detail", "")
    print("✅ Invalid referral code correctly rejected")


def test_apply_referral_self_refer():
    """POST /api/referral/apply - Should reject self-referral"""
    admin_id, _ = get_user_ids()
    
    # Get the admin's referral code
    admin_code = _session_data.get("admin_referral_code")
    if not admin_code:
        ref_response = requests.get(f"{BASE_URL}/api/referral/{admin_id}")
        admin_code = ref_response.json()["referral_code"]
    
    # Try to apply own code
    response = requests.post(f"{BASE_URL}/api/referral/apply", json={
        "referral_code": admin_code,
        "user_id": admin_id
    })
    assert response.status_code == 400, f"Expected 400 for self-referral, got: {response.status_code}"
    assert "Cannot refer yourself" in response.json().get("detail", "")
    print("✅ Self-referral correctly rejected")


def test_apply_referral_missing_fields():
    """POST /api/referral/apply - Should reject missing fields"""
    # Missing user_id
    response = requests.post(f"{BASE_URL}/api/referral/apply", json={
        "referral_code": "HLTEST123"
    })
    assert response.status_code == 400, f"Expected 400 for missing user_id, got: {response.status_code}"
    
    # Missing referral_code
    response = requests.post(f"{BASE_URL}/api/referral/apply", json={
        "user_id": str(uuid.uuid4())
    })
    assert response.status_code == 400, f"Expected 400 for missing referral_code, got: {response.status_code}"
    print("✅ Missing fields correctly rejected")


def test_referral_nonexistent_user():
    """GET /api/referral/{user_id} - Should handle non-existent user"""
    fake_id = str(uuid.uuid4())
    response = requests.get(f"{BASE_URL}/api/referral/{fake_id}")
    # Should either return 404 or create a new referral code
    assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
    print(f"✅ Non-existent user handled with status {response.status_code}")


# ==================== DAILY REWARDS TESTS ====================

def test_get_daily_reward_status_admin():
    """GET /api/daily-reward/{user_id} - Get streak status for admin"""
    admin_id, _ = get_user_ids()
    
    response = requests.get(f"{BASE_URL}/api/daily-reward/{admin_id}")
    assert response.status_code == 200, f"Failed to get daily reward status: {response.text}"
    
    data = response.json()
    # Verify response structure
    assert "current_streak" in data, "Missing current_streak"
    assert "next_day" in data, "Missing next_day"
    assert "already_claimed_today" in data, "Missing already_claimed_today"
    assert "all_rewards" in data, "Missing all_rewards"
    assert "total_claims" in data, "Missing total_claims"
    
    # Verify all_rewards has 7 days
    assert len(data["all_rewards"]) == 7, f"Expected 7 rewards, got {len(data['all_rewards'])}"
    
    # Verify reward structure
    for reward in data["all_rewards"]:
        assert "day" in reward, "Missing day in reward"
        assert "type" in reward, "Missing type in reward"
        assert "amount" in reward, "Missing amount in reward"
        assert "label" in reward, "Missing label in reward"
    
    # Store for later tests
    _session_data["admin_daily_status"] = data
    
    print(f"✅ Admin streak: {data['current_streak']} days")
    print(f"✅ Already claimed today: {data['already_claimed_today']}")
    print(f"✅ Next day reward: Day {data['next_day']}")


def test_get_daily_reward_status_female_user():
    """GET /api/daily-reward/{user_id} - Get streak status for female user"""
    _, female_id = get_user_ids()
    
    response = requests.get(f"{BASE_URL}/api/daily-reward/{female_id}")
    assert response.status_code == 200, f"Failed to get daily reward status: {response.text}"
    
    data = response.json()
    assert "current_streak" in data
    assert "already_claimed_today" in data
    
    _session_data["female_daily_status"] = data
    
    print(f"✅ Female user streak: {data['current_streak']} days")
    print(f"✅ Already claimed today: {data['already_claimed_today']}")


def test_claim_daily_reward_admin():
    """POST /api/daily-reward/{user_id}/claim - Claim daily reward for admin"""
    admin_id, _ = get_user_ids()
    
    # First check if already claimed
    status_data = _session_data.get("admin_daily_status")
    if not status_data:
        status_response = requests.get(f"{BASE_URL}/api/daily-reward/{admin_id}")
        status_data = status_response.json()
    
    if status_data["already_claimed_today"]:
        # Try to claim again - should fail
        response = requests.post(f"{BASE_URL}/api/daily-reward/{admin_id}/claim")
        assert response.status_code == 400, f"Expected 400 for already claimed, got: {response.status_code}"
        assert "Already claimed" in response.json().get("detail", "")
        print("✅ Admin already claimed today - correctly rejected duplicate claim")
    else:
        # Claim the reward
        response = requests.post(f"{BASE_URL}/api/daily-reward/{admin_id}/claim")
        assert response.status_code == 200, f"Failed to claim reward: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Claim should be successful"
        assert "reward" in data, "Missing reward in response"
        assert "new_streak" in data, "Missing new_streak in response"
        
        print(f"✅ Admin claimed reward: {data['reward']['label']}")
        print(f"✅ New streak: {data['new_streak']} days")


def test_claim_daily_reward_female_user():
    """POST /api/daily-reward/{user_id}/claim - Claim daily reward for female user"""
    _, female_id = get_user_ids()
    
    # First check if already claimed
    status_data = _session_data.get("female_daily_status")
    if not status_data:
        status_response = requests.get(f"{BASE_URL}/api/daily-reward/{female_id}")
        status_data = status_response.json()
    
    if status_data["already_claimed_today"]:
        # Try to claim again - should fail
        response = requests.post(f"{BASE_URL}/api/daily-reward/{female_id}/claim")
        assert response.status_code == 400, f"Expected 400 for already claimed, got: {response.status_code}"
        print("✅ Female user already claimed today - correctly rejected duplicate claim")
    else:
        # Claim the reward
        response = requests.post(f"{BASE_URL}/api/daily-reward/{female_id}/claim")
        assert response.status_code == 200, f"Failed to claim reward: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        print(f"✅ Female user claimed reward: {data['reward']['label']}")


def test_daily_reward_nonexistent_user():
    """GET /api/daily-reward/{user_id} - Should handle non-existent user"""
    fake_id = str(uuid.uuid4())
    response = requests.get(f"{BASE_URL}/api/daily-reward/{fake_id}")
    assert response.status_code == 404, f"Expected 404 for non-existent user, got: {response.status_code}"
    print("✅ Non-existent user correctly returns 404")


def test_claim_reward_nonexistent_user():
    """POST /api/daily-reward/{user_id}/claim - Should handle non-existent user"""
    fake_id = str(uuid.uuid4())
    response = requests.post(f"{BASE_URL}/api/daily-reward/{fake_id}/claim")
    assert response.status_code == 404, f"Expected 404 for non-existent user, got: {response.status_code}"
    print("✅ Claim for non-existent user correctly returns 404")


def test_reward_types_structure():
    """Verify all 7 daily rewards have correct structure"""
    admin_id, _ = get_user_ids()
    
    response = requests.get(f"{BASE_URL}/api/daily-reward/{admin_id}")
    data = response.json()
    
    expected_rewards = [
        {"day": 1, "type": "superlikes"},
        {"day": 2, "type": "superlikes"},
        {"day": 3, "type": "profile_boost"},
        {"day": 4, "type": "superlikes"},
        {"day": 5, "type": "superlikes"},
        {"day": 6, "type": "profile_boost"},
        {"day": 7, "type": "superlikes_badge"},
    ]
    
    for i, expected in enumerate(expected_rewards):
        actual = data["all_rewards"][i]
        assert actual["day"] == expected["day"], f"Day mismatch at index {i}"
        assert actual["type"] == expected["type"], f"Type mismatch at day {expected['day']}"
    
    print("✅ All 7 daily rewards have correct structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
