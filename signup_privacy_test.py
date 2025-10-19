#!/usr/bin/env python3
"""
HeartLink Backend Signup and Privacy Settings Test
Tests new user signup and verifies privacy_settings are set correctly
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

def test_new_user_signup():
    """Test POST /api/auth/signup with specific test data"""
    print_test_header("New User Signup")
    
    signup_data = {
        "email": "testrani@heartlink.com",
        "password": "TestRani123!",
        "name": "Test Rani",
        "age": 25,
        "gender": "Female",
        "looking_for": "Male",
        "bio": "Test user for debugging",
        "location": "Patna, Bihar",
        "interests": ["Music", "Travel"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=signup_data)
        
        if response.status_code == 200:
            result = response.json()
            user_id = result.get("user_id")
            user_data = result.get("user", {})
            
            print_result(True, "User signup successful", {
                "user_id": user_id,
                "name": signup_data["name"],
                "email": signup_data["email"],
                "message": result.get("message")
            })
            return True, user_id, user_data
        else:
            print_result(False, f"Signup failed. Status: {response.status_code}", response.text)
            return False, None, None
    except Exception as e:
        print_result(False, f"Error during signup: {str(e)}")
        return False, None, None

def test_get_profile_privacy_settings(user_id):
    """Test GET /api/profile/{user_id} and verify privacy_settings"""
    print_test_header(f"Get Profile and Verify Privacy Settings (User ID: {user_id})")
    
    try:
        response = requests.get(f"{BACKEND_URL}/profile/{user_id}")
        
        if response.status_code == 200:
            profile_data = response.json()
            privacy_settings = profile_data.get("privacy_settings", {})
            
            # Expected default privacy settings
            expected_privacy = {
                "show_profile": True,
                "show_photos": True,
                "incognito_mode": False
            }
            
            # Check if privacy settings exist and match expected defaults
            privacy_correct = True
            privacy_results = {}
            
            for key, expected_value in expected_privacy.items():
                actual_value = privacy_settings.get(key)
                is_correct = actual_value == expected_value
                privacy_correct = privacy_correct and is_correct
                privacy_results[key] = {
                    "expected": expected_value,
                    "actual": actual_value,
                    "correct": is_correct
                }
            
            if privacy_correct:
                print_result(True, "Privacy settings are correctly set to defaults", {
                    "privacy_settings": privacy_settings,
                    "verification": privacy_results
                })
            else:
                print_result(False, "Privacy settings do not match expected defaults", {
                    "privacy_settings": privacy_settings,
                    "verification": privacy_results
                })
            
            return True, profile_data, privacy_correct
        else:
            print_result(False, f"Failed to get profile. Status: {response.status_code}", response.text)
            return False, None, False
    except Exception as e:
        print_result(False, f"Error getting profile: {str(e)}")
        return False, None, False

def test_demo1_user_login():
    """Test login with demo1@heartlink.com user"""
    print_test_header("Demo1 User Login")
    
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
            
            print_result(True, "Demo1 user login successful", {
                "user_id": user_id,
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "gender": user_data.get("gender"),
                "looking_for": user_data.get("looking_for")
            })
            return True, user_id, user_data
        else:
            print_result(False, f"Demo1 user login failed. Status: {response.status_code}", response.text)
            return False, None, None
    except Exception as e:
        print_result(False, f"Error during demo1 user login: {str(e)}")
        return False, None, None

def create_demo1_user():
    """Create demo1 user if it doesn't exist"""
    print_test_header("Create Demo1 User")
    
    demo1_user_data = {
        "email": "demo1@heartlink.com",
        "password": "Demo123!",
        "name": "Demo User 1",
        "age": 28,
        "gender": "Male",
        "looking_for": "Female",
        "bio": "I love traveling and meeting new people!",
        "location": "Mumbai, Maharashtra",
        "interests": ["Travel", "Photography", "Music"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=demo1_user_data)
        
        if response.status_code == 200:
            user_data = response.json()
            print_result(True, "Demo1 user created successfully", {
                "user_id": user_data.get("user_id"),
                "email": demo1_user_data["email"],
                "name": demo1_user_data["name"]
            })
            return True, user_data.get("user_id")
        else:
            print_result(False, f"Failed to create demo1 user. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error creating demo1 user: {str(e)}")
        return False, None

def test_discover_users(demo1_user_id):
    """Test GET /api/discover/{user_id} to see if new user appears"""
    print_test_header(f"Test Discover Users for Demo1 (User ID: {demo1_user_id})")
    
    try:
        response = requests.get(f"{BACKEND_URL}/discover/{demo1_user_id}")
        
        if response.status_code == 200:
            discovered_users = response.json()
            
            # Look for "Test Rani" in the discovered users
            test_rani_found = False
            test_rani_data = None
            
            for user in discovered_users:
                if user.get("name") == "Test Rani":
                    test_rani_found = True
                    test_rani_data = user
                    break
            
            if test_rani_found:
                print_result(True, "Test Rani appears in discover results", {
                    "total_discovered": len(discovered_users),
                    "test_rani_data": test_rani_data
                })
            else:
                print_result(False, "Test Rani does NOT appear in discover results", {
                    "total_discovered": len(discovered_users),
                    "discovered_users": [{"name": u.get("name"), "id": u.get("id")} for u in discovered_users]
                })
            
            return True, discovered_users, test_rani_found
        else:
            print_result(False, f"Failed to get discover users. Status: {response.status_code}", response.text)
            return False, [], False
    except Exception as e:
        print_result(False, f"Error getting discover users: {str(e)}")
        return False, [], False

def cleanup_test_user(user_email):
    """Attempt to clean up test user (if delete endpoint exists)"""
    print_test_header(f"Cleanup Test User: {user_email}")
    
    # Note: This is just for cleanup, not a critical test
    # The backend might not have a delete user endpoint
    print_result(True, f"Test user {user_email} created for testing - manual cleanup may be needed", {
        "note": "Backend may not have user deletion endpoint"
    })

def main():
    """Main test execution for signup and privacy settings"""
    print(f"HeartLink Backend Signup and Privacy Settings Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    all_tests_passed = True
    
    # Step 1: Test new user signup
    signup_success, new_user_id, new_user_data = test_new_user_signup()
    if not signup_success:
        print("❌ CRITICAL: New user signup failed - cannot proceed")
        return False
    
    all_tests_passed = all_tests_passed and signup_success
    
    # Step 2: Verify privacy settings are set correctly
    profile_success, profile_data, privacy_correct = test_get_profile_privacy_settings(new_user_id)
    if not profile_success:
        print("❌ CRITICAL: Failed to get user profile")
        all_tests_passed = False
    elif not privacy_correct:
        print("❌ CRITICAL: Privacy settings are not set to correct defaults")
        all_tests_passed = False
    
    # Step 3: Test demo1 user login (create if needed)
    demo1_login_success, demo1_user_id, demo1_user_data = test_demo1_user_login()
    if not demo1_login_success:
        print("Demo1 user doesn't exist, creating it...")
        create_success, created_demo1_id = create_demo1_user()
        if create_success:
            # Try login again
            demo1_login_success, demo1_user_id, demo1_user_data = test_demo1_user_login()
        
        if not demo1_login_success:
            print("❌ CRITICAL: Demo1 user login failed even after creation")
            all_tests_passed = False
    
    # Step 4: Test if new user appears in discover for demo1
    if demo1_login_success and demo1_user_id:
        discover_success, discovered_users, test_rani_found = test_discover_users(demo1_user_id)
        if not discover_success:
            print("❌ CRITICAL: Failed to get discover users")
            all_tests_passed = False
        elif not test_rani_found:
            print("❌ CRITICAL: New user 'Test Rani' does not appear in discover results")
            all_tests_passed = False
    
    # Step 5: Additional verification - check gender matching logic
    if demo1_user_data and new_user_data:
        print_test_header("Gender Matching Logic Verification")
        
        demo1_gender = demo1_user_data.get("gender", "").lower()
        demo1_looking_for = demo1_user_data.get("looking_for", "").lower()
        new_user_gender = new_user_data.get("gender", "").lower()
        new_user_looking_for = new_user_data.get("looking_for", "").lower()
        
        # Check if they should match based on gender preferences
        should_match = (demo1_looking_for == new_user_gender and 
                       new_user_looking_for == demo1_gender)
        
        print_result(True, f"Gender matching analysis", {
            "demo1_user": {
                "gender": demo1_gender,
                "looking_for": demo1_looking_for
            },
            "new_user": {
                "gender": new_user_gender,
                "looking_for": new_user_looking_for
            },
            "should_match": should_match,
            "analysis": "Users should appear in each other's discover if gender preferences match"
        })
    
    # Final summary
    print(f"\n{'='*60}")
    print("SIGNUP AND PRIVACY SETTINGS TEST SUMMARY")
    print(f"{'='*60}")
    
    if all_tests_passed:
        print("✅ ALL TESTS PASSED")
        print(f"   New user signup: Working")
        print(f"   Privacy settings defaults: Correct")
        print(f"   User appears in discover: Working")
        print(f"   New user ID: {new_user_id}")
        return True
    else:
        print("❌ SOME TESTS FAILED")
        print("   Check individual test results above for details")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)