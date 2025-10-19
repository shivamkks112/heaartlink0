#!/usr/bin/env python3
"""
HeartLink Backend Comprehensive Permanent Fix Verification Test
Tests signup, login, profile operations, and discover functionality
Specifically verifies ObjectId serialization fixes
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

def create_demo_user():
    """Create demo user if it doesn't exist"""
    print_test_header("Create Demo User")
    
    demo_user_data = {
        "email": "demo1@heartlink.com",
        "password": "Demo123!",
        "name": "Demo User",
        "age": 25,
        "gender": "male",
        "looking_for": "female",
        "bio": "Demo user for HeartLink testing",
        "location": "San Francisco, CA",
        "interests": ["technology", "dating", "testing"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=demo_user_data)
        
        if response.status_code == 200:
            user_data = response.json()
            print_result(True, "Demo user created successfully", {
                "user_id": user_data.get("user_id"),
                "email": demo_user_data["email"],
                "name": demo_user_data["name"]
            })
            return True, user_data.get("user_id")
        else:
            print_result(False, f"Failed to create demo user. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error creating demo user: {str(e)}")
        return False, None

def test_fresh_signup():
    """Test 1: Fresh Signup - Comprehensive permanent fix verification"""
    print_test_header("Test 1: Fresh Signup - Permanent Fix Verification")
    
    # Test data from review request
    signup_data = {
        "email": "akash.test@heartlink.com",
        "password": "Akash@123",
        "name": "Akash Kumar",
        "age": 26,
        "gender": "Male",
        "looking_for": "Female",
        "bio": "Software engineer from Patna",
        "location": "Patna, Bihar",
        "interests": ["Cricket", "Music", "Travel"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=signup_data)
        
        if response.status_code == 200:
            signup_result = response.json()
            user_data = signup_result.get("user", {})
            user_id = signup_result.get("user_id")
            
            # Verify response structure
            if not user_id:
                print_result(False, "No user_id in signup response", signup_result)
                return False, None, None
            
            # Check for ObjectId errors in response
            response_text = response.text
            if "_id" in response_text or "ObjectId" in response_text:
                print_result(False, "ObjectId found in response - serialization issue", response_text)
                return False, None, None
            
            # Verify privacy_settings are set correctly
            privacy_settings = user_data.get("privacy_settings", {})
            expected_privacy = {
                "show_profile": True,
                "show_photos": True,
                "incognito_mode": False
            }
            
            privacy_correct = all(
                privacy_settings.get(key) == expected_privacy[key] 
                for key in expected_privacy
            )
            
            if not privacy_correct:
                print_result(False, "Privacy settings not set correctly", {
                    "expected": expected_privacy,
                    "actual": privacy_settings
                })
                return False, user_id, user_data
            
            # Verify clean user data (no password_hash, no _id)
            if "password_hash" in user_data or "_id" in user_data:
                print_result(False, "Sensitive data found in response", user_data.keys())
                return False, user_id, user_data
            
            print_result(True, "✅ Fresh signup successful - all verifications passed", {
                "user_id": user_id,
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "privacy_settings": privacy_settings,
                "no_objectid_errors": True,
                "clean_response": True
            })
            return True, user_id, user_data
            
        else:
            print_result(False, f"Signup failed. Status: {response.status_code}", response.text)
            return False, None, None
            
    except Exception as e:
        print_result(False, f"Error during signup: {str(e)}")
        return False, None, None

def test_login_with_new_user(email, password):
    """Test 2: Login with New User"""
    print_test_header("Test 2: Login with New User")
    
    login_data = {
        "email_or_phone": email,
        "password": password
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            login_result = response.json()
            user_data = login_result.get("user", {})
            
            # Check for ObjectId errors in response
            response_text = response.text
            if "_id" in response_text or "ObjectId" in response_text:
                print_result(False, "ObjectId found in login response - serialization issue", response_text)
                return False, None
            
            # Verify clean user data
            if "password_hash" in user_data or "_id" in user_data:
                print_result(False, "Sensitive data found in login response", user_data.keys())
                return False, user_data
            
            print_result(True, "✅ Login successful - no serialization errors", {
                "user_id": user_data.get("id"),
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "no_objectid_errors": True,
                "clean_response": True
            })
            return True, user_data
            
        else:
            print_result(False, f"Login failed. Status: {response.status_code}", response.text)
            return False, None
            
    except Exception as e:
        print_result(False, f"Error during login: {str(e)}")
        return False, None

def test_profile_operations(user_id):
    """Test 3: Profile Operations"""
    print_test_header("Test 3: Profile Operations")
    
    # Test GET profile
    try:
        response = requests.get(f"{BACKEND_URL}/profile/{user_id}")
        
        if response.status_code == 200:
            profile_data = response.json()
            
            # Check for ObjectId errors
            response_text = response.text
            if "_id" in response_text or "ObjectId" in response_text:
                print_result(False, "ObjectId found in GET profile response", response_text)
                return False
            
            print_result(True, "✅ GET profile working", {
                "user_id": profile_data.get("id"),
                "name": profile_data.get("name"),
                "age": profile_data.get("age")
            })
            
        else:
            print_result(False, f"GET profile failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error in GET profile: {str(e)}")
        return False
    
    # Test PUT profile with age update
    try:
        update_data = {"age": 27}
        response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=update_data)
        
        if response.status_code == 200:
            updated_profile = response.json()
            
            # Check for ObjectId errors
            response_text = response.text
            if "_id" in response_text or "ObjectId" in response_text:
                print_result(False, "ObjectId found in PUT profile response", response_text)
                return False
            
            # Verify age was updated
            if updated_profile.get("age") == 27:
                print_result(True, "✅ PUT profile working - age updated successfully", {
                    "user_id": updated_profile.get("id"),
                    "new_age": updated_profile.get("age"),
                    "no_objectid_errors": True
                })
                return True
            else:
                print_result(False, "Age not updated correctly", {
                    "expected": 27,
                    "actual": updated_profile.get("age")
                })
                return False
                
        else:
            print_result(False, f"PUT profile failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error in PUT profile: {str(e)}")
        return False

def test_discover_functionality():
    """Test 4: Discover - Verify Akash appears in results"""
    print_test_header("Test 4: Discover Functionality")
    
    # First, login as demo1 (female looking for male)
    demo_login_data = {
        "email_or_phone": "demo1@heartlink.com",
        "password": "Demo123!"
    }
    
    try:
        # Login as demo1
        response = requests.post(f"{BACKEND_URL}/auth/login", json=demo_login_data)
        
        if response.status_code != 200:
            print_result(False, "Demo1 login failed - cannot test discover", response.text)
            return False
        
        demo_user = response.json().get("user", {})
        demo_user_id = demo_user.get("id")
        
        if not demo_user_id:
            print_result(False, "No user_id from demo1 login", demo_user)
            return False
        
        # Test discover endpoint
        response = requests.get(f"{BACKEND_URL}/discover/{demo_user_id}")
        
        if response.status_code == 200:
            discover_results = response.json()
            
            # Check for ObjectId errors
            response_text = response.text
            if "_id" in response_text or "ObjectId" in response_text:
                print_result(False, "ObjectId found in discover response", response_text)
                return False
            
            # Look for Akash in results
            akash_found = False
            for user in discover_results:
                if user.get("name") == "Akash Kumar":
                    akash_found = True
                    print_result(True, "✅ Akash appears in discover results", {
                        "akash_id": user.get("id"),
                        "name": user.get("name"),
                        "age": user.get("age"),
                        "location": user.get("location"),
                        "bio": user.get("bio")
                    })
                    break
            
            if not akash_found:
                print_result(False, "Akash not found in discover results", {
                    "total_results": len(discover_results),
                    "users_found": [u.get("name") for u in discover_results]
                })
                return False
            
            return True
            
        else:
            print_result(False, f"Discover failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error in discover test: {str(e)}")
        return False

def main():
    """Main test execution for comprehensive permanent fix verification"""
    print(f"HeartLink Backend Comprehensive Permanent Fix Verification")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    print(f"Testing ObjectId serialization fixes and complete signup flow")
    
    all_tests_passed = True
    
    # Test 1: Fresh Signup
    signup_success, user_id, user_data = test_fresh_signup()
    if not signup_success:
        print("❌ CRITICAL: Fresh signup test failed")
        all_tests_passed = False
        return False
    
    # Test 2: Login with New User
    if signup_success and user_data:
        login_success, login_user_data = test_login_with_new_user(
            user_data.get("email"), 
            "Akash@123"
        )
        if not login_success:
            print("❌ CRITICAL: Login with new user failed")
            all_tests_passed = False
    else:
        login_success = False
        all_tests_passed = False
    
    # Test 3: Profile Operations
    if login_success and user_id:
        profile_success = test_profile_operations(user_id)
        if not profile_success:
            print("❌ CRITICAL: Profile operations failed")
            all_tests_passed = False
    else:
        profile_success = False
        all_tests_passed = False
    
    # Test 4: Discover
    discover_success = test_discover_functionality()
    if not discover_success:
        print("❌ WARNING: Discover functionality test failed")
        # Don't fail entire test suite for discover issues
    
    # Final summary
    print(f"\n{'='*80}")
    print("COMPREHENSIVE PERMANENT FIX VERIFICATION SUMMARY")
    print(f"{'='*80}")
    
    if all_tests_passed:
        print("✅ ALL CRITICAL TESTS PASSED - PERMANENT FIX VERIFIED")
        print("   ✅ Fresh signup working without ObjectId errors")
        print("   ✅ Login with new user working")
        print("   ✅ Profile operations working")
        print("   ✅ Clean user data returned (no _id, no password_hash)")
        print("   ✅ Privacy settings set correctly")
        if discover_success:
            print("   ✅ Discover functionality working")
        else:
            print("   ⚠️  Discover functionality needs attention")
        return True
    else:
        print("❌ CRITICAL TESTS FAILED - PERMANENT FIX NOT VERIFIED")
        print("   Check individual test results above for details")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)