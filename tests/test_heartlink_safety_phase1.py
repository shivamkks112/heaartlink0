"""
HeartLink Safety Phase 1 - Backend API Tests
Tests for: Gender Lock, Profile Enhancement, Women Safety, Profile Viewers, Admin Controls
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dating-app-debug-1.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "shivam.fresh@heartlink.com"
TEST_USER_PASSWORD = "Shivam@#110"
TEST_USER_ID = "4f67c382-84dd-4cf1-a455-d554210fd47c"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        assert data["user"]["id"] == TEST_USER_ID
        print(f"✅ Login successful for {TEST_USER_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid credentials correctly rejected")


class TestGenderLock:
    """Test Gender Lock feature endpoints"""
    
    def test_update_gender_lock_enable(self):
        """Test enabling gender lock"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/gender-lock", json={
            "gender_lock_enabled": True,
            "show_to_gender": "female",
            "hide_profile_from_gender": "none"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["updates"]["gender_lock_enabled"] == True
        assert data["updates"]["show_to_gender"] == "female"
        print("✅ Gender lock enabled successfully")
    
    def test_update_gender_lock_show_to_both(self):
        """Test setting show_to_gender to both"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/gender-lock", json={
            "show_to_gender": "both"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["updates"]["show_to_gender"] == "both"
        print("✅ Show to both genders set successfully")
    
    def test_update_gender_lock_hide_from_male(self):
        """Test hiding profile from males"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/gender-lock", json={
            "hide_profile_from_gender": "male"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["updates"]["hide_profile_from_gender"] == "male"
        print("✅ Hide from males set successfully")
    
    def test_update_gender_lock_invalid_value(self):
        """Test invalid show_to_gender value"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/gender-lock", json={
            "show_to_gender": "invalid_value"
        })
        assert response.status_code == 400
        print("✅ Invalid gender value correctly rejected")
    
    def test_update_gender_lock_nonexistent_user(self):
        """Test gender lock update for non-existent user"""
        response = requests.put(f"{BASE_URL}/api/user/nonexistent-user-id/gender-lock", json={
            "gender_lock_enabled": True
        })
        assert response.status_code == 404
        print("✅ Non-existent user correctly returns 404")


class TestProfileEnhancement:
    """Test Profile Enhancement feature endpoints"""
    
    def test_update_about_me(self):
        """Test updating about_me field"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "about_me": "I love traveling and exploring new places!"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["about_me"] == "I love traveling and exploring new places!"
        print("✅ About me updated successfully")
    
    def test_update_values(self):
        """Test updating values"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "values": ["respect", "family", "ambition"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "respect" in data["values"]
        assert "family" in data["values"]
        assert "ambition" in data["values"]
        print("✅ Values updated successfully")
    
    def test_update_relationship_intent(self):
        """Test updating relationship intent"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "relationship_intent": "serious"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["relationship_intent"] == "serious"
        print("✅ Relationship intent updated successfully")
    
    def test_update_lifestyle_tags(self):
        """Test updating lifestyle tags"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "lifestyle_tags": ["non-smoker", "fitness", "travel"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "non-smoker" in data["lifestyle_tags"]
        assert "fitness" in data["lifestyle_tags"]
        print("✅ Lifestyle tags updated successfully")
    
    def test_update_invalid_values(self):
        """Test updating with invalid values"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "values": ["invalid_value"]
        })
        assert response.status_code == 400
        print("✅ Invalid values correctly rejected")
    
    def test_update_invalid_lifestyle_tag(self):
        """Test updating with invalid lifestyle tag"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "lifestyle_tags": ["invalid_tag"]
        })
        assert response.status_code == 400
        print("✅ Invalid lifestyle tag correctly rejected")
    
    def test_update_invalid_relationship_intent(self):
        """Test updating with invalid relationship intent"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "relationship_intent": "invalid_intent"
        })
        assert response.status_code == 400
        print("✅ Invalid relationship intent correctly rejected")
    
    def test_update_voice_intro_url(self):
        """Test updating voice intro URL"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-enhancement", json={
            "bio_voice_intro_url": "https://example.com/voice_intro.webm"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["bio_voice_intro_url"] == "https://example.com/voice_intro.webm"
        print("✅ Voice intro URL updated successfully")


class TestWomenSafety:
    """Test Women Safety Mode endpoints"""
    
    def test_enable_women_safety_mode(self):
        """Test enabling women safety mode"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/women-safety", json={
            "women_safety_mode": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["women_safety_mode"] == True
        print("✅ Women safety mode enabled successfully")
    
    def test_enable_night_quiet_hours(self):
        """Test enabling night quiet hours"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/women-safety", json={
            "night_quiet_hours_enabled": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["night_quiet_hours_enabled"] == True
        print("✅ Night quiet hours enabled successfully")
    
    def test_disable_women_safety_mode(self):
        """Test disabling women safety mode"""
        response = requests.put(f"{BASE_URL}/api/user/{TEST_USER_ID}/women-safety", json={
            "women_safety_mode": False,
            "night_quiet_hours_enabled": False
        })
        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["women_safety_mode"] == False
        print("✅ Women safety mode disabled successfully")
    
    def test_women_safety_nonexistent_user(self):
        """Test women safety update for non-existent user"""
        response = requests.put(f"{BASE_URL}/api/user/nonexistent-user-id/women-safety", json={
            "women_safety_mode": True
        })
        assert response.status_code == 404
        print("✅ Non-existent user correctly returns 404")


class TestProfileViewers:
    """Test Profile Viewers feature endpoints"""
    
    def test_get_profile_viewers(self):
        """Test getting profile viewers"""
        response = requests.get(f"{BASE_URL}/api/user/{TEST_USER_ID}/profile-viewers")
        assert response.status_code == 200
        data = response.json()
        assert "viewers" in data
        assert "total_views" in data
        assert isinstance(data["viewers"], list)
        print(f"✅ Profile viewers retrieved: {len(data['viewers'])} viewers, {data['total_views']} total views")
    
    def test_get_profile_viewers_nonexistent_user(self):
        """Test getting profile viewers for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/user/nonexistent-user-id/profile-viewers")
        assert response.status_code == 404
        print("✅ Non-existent user correctly returns 404")
    
    def test_track_profile_view(self):
        """Test tracking a profile view"""
        # Create a second test user or use existing
        response = requests.post(f"{BASE_URL}/api/user/{TEST_USER_ID}/track-view?viewer_id={TEST_USER_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "tracked" in data
        print(f"✅ Profile view tracked: {data}")


class TestDiscoverWithFilters:
    """Test Discover endpoint with safety filters"""
    
    def test_discover_users_basic(self):
        """Test basic discover endpoint"""
        response = requests.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Discover returned {len(data)} users")
    
    def test_discover_with_relationship_intent_filter(self):
        """Test discover with relationship intent filter"""
        response = requests.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?relationship_intent=serious")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Discover with intent filter returned {len(data)} users")
    
    def test_discover_with_trust_badge_filter(self):
        """Test discover with trust badge filter"""
        response = requests.get(f"{BASE_URL}/api/discover/{TEST_USER_ID}?trust_badge_level=high")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Discover with trust badge filter returned {len(data)} users")
    
    def test_discover_nonexistent_user(self):
        """Test discover for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/discover/nonexistent-user-id")
        assert response.status_code == 404
        print("✅ Non-existent user correctly returns 404")


class TestAdminUserSettings:
    """Test Admin user management endpoints"""
    
    def test_admin_update_trust_badge(self):
        """Test admin updating trust badge level"""
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": TEST_USER_ID,
            "trust_badge_level": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["updates"]["trust_badge_level"] == "medium"
        print("✅ Admin trust badge update successful")
    
    def test_admin_update_risk_score(self):
        """Test admin updating risk score"""
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": TEST_USER_ID,
            "risk_score": 25
        })
        assert response.status_code == 200
        data = response.json()
        assert data["updates"]["risk_score"] == 25
        print("✅ Admin risk score update successful")
    
    def test_admin_update_verified_male(self):
        """Test admin updating verified male status"""
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": TEST_USER_ID,
            "is_verified_male": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["updates"]["is_verified_male"] == True
        print("✅ Admin verified male update successful")
    
    def test_admin_shadow_ban_user(self):
        """Test admin shadow banning a user"""
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": TEST_USER_ID,
            "is_shadow_banned": True,
            "ban_reason": "Test shadow ban"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["updates"]["is_shadow_banned"] == True
        print("✅ Admin shadow ban successful")
        
        # Unban the user
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": TEST_USER_ID,
            "is_shadow_banned": False,
            "ban_reason": None
        })
        assert response.status_code == 200
        print("✅ Admin shadow unban successful")
    
    def test_admin_invalid_trust_badge(self):
        """Test admin with invalid trust badge level"""
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": TEST_USER_ID,
            "trust_badge_level": "invalid"
        })
        assert response.status_code == 400
        print("✅ Invalid trust badge correctly rejected")
    
    def test_admin_invalid_risk_score(self):
        """Test admin with invalid risk score"""
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": TEST_USER_ID,
            "risk_score": 150  # Out of range
        })
        assert response.status_code == 400
        print("✅ Invalid risk score correctly rejected")
    
    def test_admin_update_nonexistent_user(self):
        """Test admin update for non-existent user"""
        response = requests.put(f"{BASE_URL}/api/admin/user-settings", json={
            "user_id": "nonexistent-user-id",
            "trust_badge_level": "high"
        })
        assert response.status_code == 404
        print("✅ Non-existent user correctly returns 404")


class TestProfileEndpoint:
    """Test profile endpoint to verify data persistence"""
    
    def test_get_profile_with_new_fields(self):
        """Test that profile returns all new safety fields"""
        response = requests.get(f"{BASE_URL}/api/profile/{TEST_USER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Check new fields exist
        assert "gender_lock_enabled" in data
        assert "show_to_gender" in data
        assert "hide_profile_from_gender" in data or data.get("hide_profile_from_gender") is None
        assert "about_me" in data
        assert "values" in data
        assert "relationship_intent" in data
        assert "lifestyle_tags" in data
        assert "women_safety_mode" in data or data.get("women_safety_mode") is None
        assert "trust_badge_level" in data or data.get("trust_badge_level") is None
        
        print("✅ Profile contains all new safety fields")
        print(f"   - gender_lock_enabled: {data.get('gender_lock_enabled')}")
        print(f"   - show_to_gender: {data.get('show_to_gender')}")
        print(f"   - values: {data.get('values')}")
        print(f"   - relationship_intent: {data.get('relationship_intent')}")
        print(f"   - lifestyle_tags: {data.get('lifestyle_tags')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
