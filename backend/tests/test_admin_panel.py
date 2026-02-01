"""
HeartLink Admin Panel Tests - Iteration 2
Tests for:
1. Admin login
2. Admin dashboard stats
3. User filters (gender, status, sort)
4. OneSignal notification integration
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dating-admin-1.preview.emergentagent.com').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "shivamkks112@gmail.com"
ADMIN_PASSWORD = "Test@123"


class TestAdminLogin:
    """Test admin login functionality"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        print(f"Login response status: {response.status_code}")
        print(f"Login response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain user data"
        assert "access_token" in data, "Response should contain access_token"
        
        # Verify user is admin
        user = data["user"]
        assert user.get("is_admin") == True, f"User should be admin, got is_admin={user.get('is_admin')}"
        
        return data
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": ADMIN_EMAIL,
            "password": "WrongPassword123"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestAdminDashboard:
    """Test admin dashboard endpoints"""
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-stats")
        
        print(f"Dashboard stats status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify expected fields
        expected_fields = ["total_users", "male_users", "female_users", "active_today"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Dashboard stats: total_users={data.get('total_users')}, male={data.get('male_users')}, female={data.get('female_users')}")
        return data


class TestUserFilters:
    """Test user filtering functionality in admin panel"""
    
    def test_get_all_users_default(self):
        """Test getting all users with default params"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users")
        
        print(f"All users status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "users" in data, "Response should contain users array"
        assert "total" in data, "Response should contain total count"
        assert "page" in data, "Response should contain page number"
        assert "pages" in data, "Response should contain pages count"
        
        print(f"Total users: {data.get('total')}, Page: {data.get('page')}, Pages: {data.get('pages')}")
        return data
    
    def test_filter_by_gender_male(self):
        """Test filtering users by gender=male"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "gender": "male"
        })
        
        print(f"Male filter status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        users = data.get("users", [])
        
        # Verify all returned users are male
        for user in users:
            gender = user.get("gender", "").lower()
            assert gender == "male", f"Expected male, got {gender} for user {user.get('name')}"
        
        print(f"Male users returned: {len(users)}")
        return data
    
    def test_filter_by_gender_female(self):
        """Test filtering users by gender=female"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "gender": "female"
        })
        
        print(f"Female filter status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        users = data.get("users", [])
        
        # Verify all returned users are female
        for user in users:
            gender = user.get("gender", "").lower()
            assert gender == "female", f"Expected female, got {gender} for user {user.get('name')}"
        
        print(f"Female users returned: {len(users)}")
        return data
    
    def test_filter_by_status_active(self):
        """Test filtering users by status=active"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "status": "active"
        })
        
        print(f"Active filter status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Active users returned: {len(data.get('users', []))}")
        return data
    
    def test_filter_by_status_inactive(self):
        """Test filtering users by status=inactive"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "status": "inactive"
        })
        
        print(f"Inactive filter status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Inactive users returned: {len(data.get('users', []))}")
        return data
    
    def test_filter_by_status_premium(self):
        """Test filtering users by status=premium"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "status": "premium"
        })
        
        print(f"Premium filter status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Premium users returned: {len(data.get('users', []))}")
        return data
    
    def test_filter_by_status_verified(self):
        """Test filtering users by status=verified"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "status": "verified"
        })
        
        print(f"Verified filter status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Verified users returned: {len(data.get('users', []))}")
        return data
    
    def test_filter_by_status_banned(self):
        """Test filtering users by status=banned"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "status": "banned"
        })
        
        print(f"Banned filter status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Banned users returned: {len(data.get('users', []))}")
        return data
    
    def test_sort_by_newest(self):
        """Test sorting users by newest first"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "sort": "newest"
        })
        
        print(f"Newest sort status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        users = data.get("users", [])
        
        # Verify sorting (newest first = descending created_at)
        if len(users) >= 2:
            for i in range(len(users) - 1):
                created_at_1 = users[i].get("created_at", "")
                created_at_2 = users[i+1].get("created_at", "")
                if created_at_1 and created_at_2:
                    assert created_at_1 >= created_at_2, f"Users not sorted by newest: {created_at_1} < {created_at_2}"
        
        print(f"Newest sort returned: {len(users)} users")
        return data
    
    def test_sort_by_oldest(self):
        """Test sorting users by oldest first"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "sort": "oldest"
        })
        
        print(f"Oldest sort status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        users = data.get("users", [])
        
        # Verify sorting (oldest first = ascending created_at)
        if len(users) >= 2:
            for i in range(len(users) - 1):
                created_at_1 = users[i].get("created_at", "")
                created_at_2 = users[i+1].get("created_at", "")
                if created_at_1 and created_at_2:
                    assert created_at_1 <= created_at_2, f"Users not sorted by oldest: {created_at_1} > {created_at_2}"
        
        print(f"Oldest sort returned: {len(users)} users")
        return data
    
    def test_sort_by_last_active(self):
        """Test sorting users by last active"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "sort": "last_active"
        })
        
        print(f"Last active sort status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Last active sort returned: {len(data.get('users', []))} users")
        return data
    
    def test_sort_by_name(self):
        """Test sorting users by name A-Z"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "sort": "name"
        })
        
        print(f"Name sort status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        users = data.get("users", [])
        
        # Verify sorting (name A-Z)
        if len(users) >= 2:
            for i in range(len(users) - 1):
                name_1 = users[i].get("name", "").lower()
                name_2 = users[i+1].get("name", "").lower()
                if name_1 and name_2:
                    assert name_1 <= name_2, f"Users not sorted by name: {name_1} > {name_2}"
        
        print(f"Name sort returned: {len(users)} users")
        return data
    
    def test_combined_filters(self):
        """Test combining gender and status filters"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "gender": "male",
            "status": "active",
            "sort": "newest"
        })
        
        print(f"Combined filters status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        users = data.get("users", [])
        
        # Verify all returned users are male
        for user in users:
            gender = user.get("gender", "").lower()
            assert gender == "male", f"Expected male, got {gender}"
        
        print(f"Combined filters returned: {len(users)} users")
        return data
    
    def test_search_with_filters(self):
        """Test search combined with filters"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "search": "test",
            "gender": "female",
            "sort": "name"
        })
        
        print(f"Search with filters status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Search with filters returned: {len(data.get('users', []))} users")
        return data
    
    def test_pagination(self):
        """Test pagination works correctly"""
        # Get page 1
        response1 = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "page": 1,
            "limit": 5
        })
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get page 2
        response2 = requests.get(f"{BASE_URL}/api/admin/all-users", params={
            "page": 2,
            "limit": 5
        })
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Verify different users on different pages
        users1_ids = [u.get("id") for u in data1.get("users", [])]
        users2_ids = [u.get("id") for u in data2.get("users", [])]
        
        # If there are users on both pages, they should be different
        if users1_ids and users2_ids:
            common_ids = set(users1_ids) & set(users2_ids)
            assert len(common_ids) == 0, f"Same users on different pages: {common_ids}"
        
        print(f"Page 1: {len(users1_ids)} users, Page 2: {len(users2_ids)} users")
        return data1, data2


class TestOneSignalNotifications:
    """Test OneSignal notification integration"""
    
    def test_onesignal_status(self):
        """Test OneSignal status endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/onesignal/status")
        
        print(f"OneSignal status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify expected fields
        expected_fields = ["configured", "total_users", "users_with_onesignal", "can_send_notifications"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"OneSignal configured: {data.get('configured')}, can_send: {data.get('can_send_notifications')}")
        print(f"Total users: {data.get('total_users')}, with OneSignal: {data.get('users_with_onesignal')}")
        return data
    
    def test_send_notification_to_all(self):
        """Test sending notification to all users"""
        response = requests.post(f"{BASE_URL}/api/admin/onesignal/send", json={
            "title": "Test Notification",
            "message": "This is a test notification from admin panel",
            "target": "all"
        })
        
        print(f"Send to all status: {response.status_code}")
        print(f"Send to all response: {response.json()}")
        
        # Should return 200 even if no users have OneSignal IDs
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        return response.json()
    
    def test_send_notification_to_male(self):
        """Test sending notification to male users"""
        response = requests.post(f"{BASE_URL}/api/admin/onesignal/send", json={
            "title": "Test Male Notification",
            "message": "This is a test notification for male users",
            "target": "male"
        })
        
        print(f"Send to male status: {response.status_code}")
        print(f"Send to male response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        return response.json()
    
    def test_send_notification_to_female(self):
        """Test sending notification to female users"""
        response = requests.post(f"{BASE_URL}/api/admin/onesignal/send", json={
            "title": "Test Female Notification",
            "message": "This is a test notification for female users",
            "target": "female"
        })
        
        print(f"Send to female status: {response.status_code}")
        print(f"Send to female response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        return response.json()
    
    def test_send_notification_to_inactive(self):
        """Test sending notification to inactive users"""
        response = requests.post(f"{BASE_URL}/api/admin/onesignal/send", json={
            "title": "We Miss You!",
            "message": "Come back and find your match!",
            "target": "inactive"
        })
        
        print(f"Send to inactive status: {response.status_code}")
        print(f"Send to inactive response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        return response.json()
    
    def test_notification_history(self):
        """Test notification history endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/notification-history")
        
        print(f"Notification history status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Notification history count: {len(data) if isinstance(data, list) else 'N/A'}")
        return data


class TestPendingVerifications:
    """Test pending verifications endpoint"""
    
    def test_get_pending_verifications(self):
        """Test getting pending verifications"""
        response = requests.get(f"{BASE_URL}/api/admin/pending-verifications")
        
        print(f"Pending verifications status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Pending verifications count: {len(data) if isinstance(data, list) else 'N/A'}")
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
