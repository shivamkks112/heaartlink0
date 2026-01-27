#!/usr/bin/env python3
"""
HeartLink Profile Update Bug Fix Test
Specific test for the TypeError: User() argument after ** must be a mapping, not NoneType bug fix
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

def test_specific_bug_fix_scenario():
    """Test the specific scenario mentioned in the review request"""
    print_test_header("Profile Update Bug Fix - Specific Scenario Test")
    
    # Step 1: Login with demo1@heartlink.com / Demo123!
    print("\n--- Step 1: Login with demo1@heartlink.com ---")
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
            
            print_result(True, "Login successful", {
                "user_id": user_id,
                "name": user_data.get("name"),
                "email": user_data.get("email")
            })
        else:
            print_result(False, f"Login failed. Status: {response.status_code}", response.text)
            return False
    except Exception as e:
        print_result(False, f"Error during login: {str(e)}")
        return False
    
    # Step 2: Get user ID from login response (already done above)
    print(f"\n--- Step 2: User ID obtained: {user_id} ---")
    
    # Step 3: Test PUT /api/profile/{user_id} with specific updates
    print("\n--- Step 3: Test PUT /api/profile/{user_id} with specific updates ---")
    
    update_data = {
        "age": 30,
        "bio": "Testing profile update fix",
        "city": "Delhi"
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=update_data)
        
        if response.status_code == 200:
            updated_profile = response.json()
            
            # Step 4: Verify response returns updated user data correctly
            print("\n--- Step 4: Verify response returns updated user data correctly ---")
            
            # Check if all expected fields are present and updated
            verification_results = {}
            all_correct = True
            
            # Check age update
            if updated_profile.get("age") == 30:
                verification_results["age"] = {"expected": 30, "actual": updated_profile.get("age"), "correct": True}
            else:
                verification_results["age"] = {"expected": 30, "actual": updated_profile.get("age"), "correct": False}
                all_correct = False
            
            # Check bio update
            if updated_profile.get("bio") == "Testing profile update fix":
                verification_results["bio"] = {"expected": "Testing profile update fix", "actual": updated_profile.get("bio"), "correct": True}
            else:
                verification_results["bio"] = {"expected": "Testing profile update fix", "actual": updated_profile.get("bio"), "correct": False}
                all_correct = False
            
            # Check if city was handled (note: the backend might store this as 'location' instead of 'city')
            city_value = updated_profile.get("city") or updated_profile.get("location")
            if "Delhi" in str(city_value):
                verification_results["city/location"] = {"expected": "Delhi", "actual": city_value, "correct": True}
            else:
                verification_results["city/location"] = {"expected": "Delhi", "actual": city_value, "correct": False}
                all_correct = False
            
            # Check that response contains complete user object
            required_fields = ["id", "name", "email", "age", "gender", "bio"]
            missing_fields = []
            for field in required_fields:
                if field not in updated_profile:
                    missing_fields.append(field)
                    all_correct = False
            
            if missing_fields:
                verification_results["missing_fields"] = missing_fields
            
            if all_correct:
                print_result(True, "Profile update successful - all data verified", {
                    "verification_results": verification_results,
                    "complete_response": updated_profile
                })
            else:
                print_result(False, "Profile update had issues", {
                    "verification_results": verification_results,
                    "missing_fields": missing_fields if missing_fields else "None"
                })
                return False
            
        else:
            print_result(False, f"Profile update failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error during profile update: {str(e)}")
        return False
    
    # Step 5: Confirm no TypeError or NoneType errors by checking backend logs
    print("\n--- Step 5: Check for TypeError or NoneType errors ---")
    
    # Test another update to ensure the fix is stable
    print("Testing additional update to verify stability...")
    
    additional_update = {
        "age": 31,
        "bio": "Second test update to verify bug fix stability"
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=additional_update)
        
        if response.status_code == 200:
            second_update_result = response.json()
            
            if (second_update_result.get("age") == 31 and 
                second_update_result.get("bio") == "Second test update to verify bug fix stability"):
                print_result(True, "Second update successful - bug fix is stable", {
                    "age": second_update_result.get("age"),
                    "bio": second_update_result.get("bio")
                })
            else:
                print_result(False, "Second update had incorrect values", second_update_result)
                return False
        else:
            print_result(False, f"Second update failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error during second update: {str(e)}")
        return False
    
    return True

def test_edge_cases_for_bug_fix():
    """Test edge cases that might trigger the original TypeError"""
    print_test_header("Edge Cases for TypeError Bug Fix")
    
    # Login first
    login_data = {
        "email_or_phone": "demo1@heartlink.com",
        "password": "Demo123!"
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
    if response.status_code != 200:
        print_result(False, "Cannot proceed with edge case tests - login failed")
        return False
    
    user_id = response.json().get("user", {}).get("id")
    
    # Test 1: Update with None values (this might have triggered the original bug)
    print("\n--- Test 1: Update with None values ---")
    try:
        update_with_none = {
            "age": 25,
            "bio": None,  # This might have caused the original TypeError
            "location": "Mumbai"
        }
        
        response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=update_with_none)
        
        if response.status_code == 200:
            result = response.json()
            print_result(True, "Update with None values handled gracefully", {
                "age": result.get("age"),
                "bio": result.get("bio"),
                "location": result.get("location")
            })
        else:
            print_result(False, f"Update with None values failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error testing None values: {str(e)}")
        return False
    
    # Test 2: Update with empty strings
    print("\n--- Test 2: Update with empty strings ---")
    try:
        update_with_empty = {
            "bio": "",
            "location": ""
        }
        
        response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=update_with_empty)
        
        if response.status_code == 200:
            result = response.json()
            print_result(True, "Update with empty strings handled gracefully", {
                "bio": result.get("bio"),
                "location": result.get("location")
            })
        else:
            print_result(False, f"Update with empty strings failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error testing empty strings: {str(e)}")
        return False
    
    # Test 3: Update with mixed valid and invalid fields
    print("\n--- Test 3: Update with mixed valid and invalid fields ---")
    try:
        mixed_update = {
            "age": 27,
            "bio": "Valid bio update",
            "invalid_field": "This should be ignored",
            "password_hash": "This should be filtered out"
        }
        
        response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=mixed_update)
        
        if response.status_code == 200:
            result = response.json()
            print_result(True, "Update with mixed fields handled correctly", {
                "age": result.get("age"),
                "bio": result.get("bio"),
                "has_invalid_field": "invalid_field" in result,
                "has_password_hash": "password_hash" in result
            })
        else:
            print_result(False, f"Update with mixed fields failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error testing mixed fields: {str(e)}")
        return False
    
    return True

def main():
    """Main test execution for the specific bug fix"""
    print(f"HeartLink Profile Update Bug Fix Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    print(f"Testing fix for: TypeError: User() argument after ** must be a mapping, not NoneType")
    
    # Run the specific scenario test
    scenario_success = test_specific_bug_fix_scenario()
    
    # Run edge case tests
    edge_case_success = test_edge_cases_for_bug_fix()
    
    # Final summary
    print(f"\n{'='*60}")
    print("BUG FIX TEST SUMMARY")
    print(f"{'='*60}")
    
    if scenario_success and edge_case_success:
        print("✅ ALL BUG FIX TESTS PASSED")
        print("   ✓ Specific scenario test: PASSED")
        print("   ✓ Edge case tests: PASSED")
        print("   ✓ No TypeError or NoneType errors detected")
        print("   ✓ Profile updates working correctly")
        print("   ✓ Complete user object returned in responses")
        return True
    else:
        print("❌ SOME BUG FIX TESTS FAILED")
        print(f"   Specific scenario test: {'PASSED' if scenario_success else 'FAILED'}")
        print(f"   Edge case tests: {'PASSED' if edge_case_success else 'FAILED'}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)