#!/usr/bin/env python3
"""
Comprehensive Admin Login Test
Tests various scenarios including wrong credentials
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://desi-match-4.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")

def test_login_scenario(email, password, expected_success=True, scenario_name=""):
    """Test login with given credentials"""
    print_test_header(f"Login Test: {scenario_name}")
    
    login_data = {
        "email_or_phone": email,
        "password": password
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if expected_success:
            if response.status_code == 200:
                login_result = response.json()
                user_data = login_result.get("user", {})
                is_admin = user_data.get("is_admin", False)
                
                print_result(True, f"Login successful as expected. is_admin: {is_admin}", {
                    "user_id": user_data.get("id"),
                    "name": user_data.get("name"),
                    "email": user_data.get("email"),
                    "is_admin": is_admin
                })
                return True, user_data
            else:
                print_result(False, f"Expected success but got status: {response.status_code}, Error: {response.text}")
                return False, None
        else:
            if response.status_code == 401:
                print_result(True, "Login failed as expected (invalid credentials)")
                return True, None
            else:
                print_result(False, f"Expected 401 but got status: {response.status_code}")
                return False, None
                
    except Exception as e:
        print_result(False, f"Error during login: {str(e)}")
        return False, None

def main():
    """Main test execution"""
    print(f"Comprehensive Admin Login Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    test_results = []
    
    # Test 1: Correct admin credentials
    success, data = test_login_scenario(
        "admin@heartlink.com", 
        "AdminPass123!", 
        expected_success=True,
        scenario_name="Correct Admin Credentials"
    )
    test_results.append(("Admin Login", success))
    
    # Test 2: Wrong password
    success, data = test_login_scenario(
        "admin@heartlink.com", 
        "WrongPassword", 
        expected_success=False,
        scenario_name="Wrong Password"
    )
    test_results.append(("Wrong Password", success))
    
    # Test 3: Wrong email
    success, data = test_login_scenario(
        "wrong@heartlink.com", 
        "AdminPass123!", 
        expected_success=False,
        scenario_name="Wrong Email"
    )
    test_results.append(("Wrong Email", success))
    
    # Test 4: Empty credentials
    success, data = test_login_scenario(
        "", 
        "", 
        expected_success=False,
        scenario_name="Empty Credentials"
    )
    test_results.append(("Empty Credentials", success))
    
    # Test 5: Test with another existing user (non-admin)
    print_test_header("Get Non-Admin User for Testing")
    try:
        response = requests.get(f"{BACKEND_URL}/admin/all-users")
        if response.status_code == 200:
            users = response.json()
            non_admin_user = None
            for user in users:
                if not user.get("is_admin", False) and user.get("email"):
                    non_admin_user = user
                    break
            
            if non_admin_user:
                print(f"Found non-admin user: {non_admin_user['name']} ({non_admin_user['email']})")
                # We can't test login for this user as we don't know their password
                # But we can verify they exist
                print_result(True, f"Non-admin user found: {non_admin_user['name']}")
            else:
                print_result(False, "No non-admin user with email found")
    except Exception as e:
        print_result(False, f"Error getting users: {str(e)}")
    
    # Final Summary
    print(f"\n{'='*60}")
    print("FINAL TEST SUMMARY")
    print(f"{'='*60}")
    
    all_passed = True
    for test_name, passed in test_results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print(f"\n🎉 ALL TESTS PASSED!")
        print(f"✅ Admin login with admin@heartlink.com / AdminPass123! is working correctly")
        print(f"✅ Invalid credentials are properly rejected")
        print(f"✅ Backend authentication system is functioning properly")
    else:
        print(f"\n⚠️  SOME TESTS FAILED!")
        print(f"Please check the individual test results above")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)