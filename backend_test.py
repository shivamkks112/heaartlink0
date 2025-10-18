#!/usr/bin/env python3
"""
HeartLink Backend Profile Update Functionality Test
Tests profile GET and PUT endpoints with various field updates
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://heartlink-dating.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")

def test_get_all_users():
    """Test GET /api/admin/all-users to see existing users"""
    print_test_header("Get All Users")
    
    try:
        response = requests.get(f"{BACKEND_URL}/admin/all-users")
        
        if response.status_code == 200:
            users = response.json()
            print_result(True, f"Successfully retrieved {len(users)} users", users)
            return users
        else:
            print_result(False, f"Failed to get users. Status: {response.status_code}", response.text)
            return []
    except Exception as e:
        print_result(False, f"Error getting users: {str(e)}")
        return []

def create_test_user():
    """Create a test user for admin testing"""
    print_test_header("Create Test User")
    
    test_user_data = {
        "email": "admin@heartlink.com",
        "password": "AdminPass123!",
        "name": "Admin User",
        "age": 30,
        "gender": "male",
        "looking_for": "female",
        "bio": "Test admin user for HeartLink",
        "location": "San Francisco, CA",
        "interests": ["technology", "dating apps", "admin work"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=test_user_data)
        
        if response.status_code == 200:
            user_data = response.json()
            print_result(True, "Test user created successfully", {
                "user_id": user_data.get("user_id"),
                "email": test_user_data["email"],
                "name": test_user_data["name"]
            })
            return user_data.get("user_id"), test_user_data
        else:
            print_result(False, f"Failed to create user. Status: {response.status_code}", response.text)
            return None, None
    except Exception as e:
        print_result(False, f"Error creating user: {str(e)}")
        return None, None

def make_user_admin(user_id):
    """Make a user admin using POST /api/admin/make-admin/{user_id}"""
    print_test_header(f"Make User Admin (ID: {user_id})")
    
    try:
        response = requests.post(f"{BACKEND_URL}/admin/make-admin/{user_id}")
        
        if response.status_code == 200:
            result = response.json()
            print_result(True, "User successfully made admin", result)
            return True
        else:
            print_result(False, f"Failed to make user admin. Status: {response.status_code}", response.text)
            return False
    except Exception as e:
        print_result(False, f"Error making user admin: {str(e)}")
        return False

def verify_admin_status(expected_admin_user_id):
    """Verify admin status by checking all users again"""
    print_test_header("Verify Admin Status")
    
    try:
        response = requests.get(f"{BACKEND_URL}/admin/all-users")
        
        if response.status_code == 200:
            users = response.json()
            admin_user = None
            
            for user in users:
                if user["id"] == expected_admin_user_id:
                    admin_user = user
                    break
            
            if admin_user:
                is_admin = admin_user.get("is_admin", False)
                if is_admin:
                    print_result(True, f"User {admin_user['name']} is confirmed as admin", {
                        "user_id": admin_user["id"],
                        "name": admin_user["name"],
                        "email": admin_user.get("email"),
                        "is_admin": is_admin
                    })
                    return True, admin_user
                else:
                    print_result(False, f"User {admin_user['name']} is NOT admin", admin_user)
                    return False, admin_user
            else:
                print_result(False, f"User with ID {expected_admin_user_id} not found")
                return False, None
        else:
            print_result(False, f"Failed to get users. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error verifying admin status: {str(e)}")
        return False, None

def test_admin_login(email, password):
    """Test login with admin user and verify is_admin in response"""
    print_test_header("Test Admin Login")
    
    login_data = {
        "email_or_phone": email,
        "password": password
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            login_result = response.json()
            user_data = login_result.get("user", {})
            is_admin = user_data.get("is_admin", False)
            
            if is_admin:
                print_result(True, "Admin login successful with is_admin: true", {
                    "user_id": user_data.get("id"),
                    "name": user_data.get("name"),
                    "email": user_data.get("email"),
                    "is_admin": is_admin
                })
                return True, user_data
            else:
                print_result(False, "Login successful but is_admin is false", user_data)
                return False, user_data
        else:
            print_result(False, f"Login failed. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error during login: {str(e)}")
        return False, None

def test_demo_user_login():
    """Test login with demo user credentials"""
    print_test_header("Demo User Login")
    
    login_data = {
        "email_or_phone": "demo1@heartlink.com",
        "password": "Demo123!"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            login_result = response.json()
            user_data = login_result.get("user", {})
            user_id = user_data.get("id")
            
            print_result(True, "Demo user login successful", {
                "user_id": user_id,
                "name": user_data.get("name"),
                "email": user_data.get("email")
            })
            return True, user_id, user_data
        else:
            print_result(False, f"Demo user login failed. Status: {response.status_code}", response.text)
            return False, None, None
    except Exception as e:
        print_result(False, f"Error during demo user login: {str(e)}")
        return False, None, None

def test_get_profile(user_id):
    """Test GET /api/profile/{user_id}"""
    print_test_header(f"Get Profile (User ID: {user_id})")
    
    try:
        response = requests.get(f"{BACKEND_URL}/profile/{user_id}")
        
        if response.status_code == 200:
            profile_data = response.json()
            print_result(True, "Profile retrieved successfully", {
                "user_id": profile_data.get("id"),
                "name": profile_data.get("name"),
                "age": profile_data.get("age"),
                "bio": profile_data.get("bio"),
                "location": profile_data.get("location"),
                "gender": profile_data.get("gender")
            })
            return True, profile_data
        else:
            print_result(False, f"Failed to get profile. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error getting profile: {str(e)}")
        return False, None

def test_update_profile_field(user_id, field_name, new_value, original_profile):
    """Test updating a specific profile field"""
    print_test_header(f"Update Profile Field: {field_name}")
    
    update_data = {field_name: new_value}
    
    try:
        response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=update_data)
        
        if response.status_code == 200:
            updated_profile = response.json()
            updated_value = updated_profile.get(field_name)
            
            if updated_value == new_value:
                print_result(True, f"Profile field '{field_name}' updated successfully", {
                    "field": field_name,
                    "old_value": original_profile.get(field_name),
                    "new_value": updated_value
                })
                return True, updated_profile
            else:
                print_result(False, f"Profile field '{field_name}' not updated correctly", {
                    "expected": new_value,
                    "actual": updated_value
                })
                return False, updated_profile
        else:
            print_result(False, f"Failed to update profile field '{field_name}'. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error updating profile field '{field_name}': {str(e)}")
        return False, None

def test_profile_persistence(user_id, expected_values):
    """Test that profile updates persist by fetching profile again"""
    print_test_header("Test Profile Update Persistence")
    
    try:
        response = requests.get(f"{BACKEND_URL}/profile/{user_id}")
        
        if response.status_code == 200:
            profile_data = response.json()
            all_correct = True
            results = {}
            
            for field, expected_value in expected_values.items():
                actual_value = profile_data.get(field)
                is_correct = actual_value == expected_value
                all_correct = all_correct and is_correct
                results[field] = {
                    "expected": expected_value,
                    "actual": actual_value,
                    "correct": is_correct
                }
            
            if all_correct:
                print_result(True, "All profile updates persisted correctly", results)
                return True
            else:
                print_result(False, "Some profile updates did not persist", results)
                return False
        else:
            print_result(False, f"Failed to verify persistence. Status: {response.status_code}", response.text)
            return False
    except Exception as e:
        print_result(False, f"Error verifying persistence: {str(e)}")
        return False

def main():
    """Main test execution for profile update functionality"""
    print(f"HeartLink Backend Profile Update Functionality Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    # Step 1: Login with demo user
    login_success, user_id, user_data = test_demo_user_login()
    if not login_success:
        print("❌ CRITICAL: Demo user login failed - cannot proceed with profile tests")
        return False
    
    # Step 2: Get initial profile
    profile_success, original_profile = test_get_profile(user_id)
    if not profile_success:
        print("❌ CRITICAL: Failed to get user profile")
        return False
    
    # Step 3: Test profile field updates
    test_updates = [
        ("age", 28),
        ("bio", "Updated bio for HeartLink profile testing - passionate about technology and meaningful connections!"),
        ("location", "Los Angeles, CA"),
        ("gender", "female")
    ]
    
    updated_values = {}
    all_updates_successful = True
    
    for field_name, new_value in test_updates:
        update_success, updated_profile = test_update_profile_field(user_id, field_name, new_value, original_profile)
        if update_success:
            updated_values[field_name] = new_value
        else:
            all_updates_successful = False
    
    # Step 4: Test persistence of updates
    if updated_values:
        persistence_success = test_profile_persistence(user_id, updated_values)
        if not persistence_success:
            all_updates_successful = False
    
    # Final summary
    print(f"\n{'='*60}")
    print("PROFILE UPDATE TEST SUMMARY")
    print(f"{'='*60}")
    
    if all_updates_successful:
        print("✅ ALL PROFILE UPDATE TESTS PASSED")
        print(f"   User ID: {user_id}")
        print(f"   Profile GET endpoint: Working")
        print(f"   Profile PUT endpoint: Working")
        print(f"   Field updates tested: {len(test_updates)}")
        print(f"   Persistence verification: Passed")
        return True
    else:
        print("❌ SOME PROFILE UPDATE TESTS FAILED")
        print("   Check individual test results above for details")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)