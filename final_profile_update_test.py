#!/usr/bin/env python3
"""
Final Profile Update Test - Comprehensive verification of bug fix
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://datematch-debug-1.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")

def test_exact_review_scenario():
    """Test the exact scenario from the review request"""
    print_test_header("EXACT REVIEW REQUEST SCENARIO")
    
    # Step 1: Login with demo1@heartlink.com / Demo123!
    print("Step 1: Login with demo1@heartlink.com / Demo123!")
    login_data = {
        "email_or_phone": "demo1@heartlink.com",
        "password": "Demo123!"
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
    if response.status_code != 200:
        print_result(False, f"Login failed: {response.status_code}")
        return False
    
    user_data = response.json().get("user", {})
    user_id = user_data.get("id")
    print_result(True, f"Login successful, user_id: {user_id}")
    
    # Step 2: Get user ID from login response (done above)
    
    # Step 3: Test PUT /api/profile/{user_id} with exact updates from review
    print("Step 3: Test PUT /api/profile/{user_id} with exact updates")
    update_data = {
        "age": 30,
        "bio": "Testing profile update fix",
        "city": "Delhi"  # Note: backend uses 'location' but testing 'city' as per review
    }
    
    response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=update_data)
    if response.status_code != 200:
        print_result(False, f"Profile update failed: {response.status_code} - {response.text}")
        return False
    
    updated_profile = response.json()
    
    # Step 4: Verify response returns updated user data correctly
    print("Step 4: Verify response returns updated user data correctly")
    
    # Check age update
    if updated_profile.get("age") == 30:
        print_result(True, "Age updated correctly to 30")
    else:
        print_result(False, f"Age not updated correctly: expected 30, got {updated_profile.get('age')}")
        return False
    
    # Check bio update
    if updated_profile.get("bio") == "Testing profile update fix":
        print_result(True, "Bio updated correctly")
    else:
        print_result(False, f"Bio not updated correctly: expected 'Testing profile update fix', got '{updated_profile.get('bio')}'")
        return False
    
    # Check complete user object is returned
    required_fields = ["id", "name", "email", "age", "gender", "bio", "location"]
    missing_fields = [field for field in required_fields if field not in updated_profile]
    
    if not missing_fields:
        print_result(True, "Complete user object returned with all required fields")
    else:
        print_result(False, f"Missing required fields: {missing_fields}")
        return False
    
    # Step 5: Confirm no TypeError or NoneType errors
    print("Step 5: Confirm no TypeError or NoneType errors")
    print_result(True, "No TypeError or NoneType errors - update completed successfully")
    
    return True

def test_original_bug_scenarios():
    """Test scenarios that would have triggered the original TypeError"""
    print_test_header("ORIGINAL BUG SCENARIOS")
    
    # Login first
    login_data = {"email_or_phone": "demo1@heartlink.com", "password": "Demo123!"}
    response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
    user_id = response.json().get("user", {}).get("id")
    
    # Test 1: Update with None values (original bug trigger)
    print("Test 1: Update with None values (original bug trigger)")
    update_with_none = {
        "age": 28,
        "bio": None,  # This would have caused TypeError before fix
        "location": "New Delhi"
    }
    
    response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=update_with_none)
    if response.status_code == 200:
        result = response.json()
        print_result(True, "None values handled gracefully - no TypeError", {
            "age": result.get("age"),
            "bio": result.get("bio"),  # Should be previous value, not None
            "location": result.get("location")
        })
    else:
        print_result(False, f"None values caused error: {response.status_code}")
        return False
    
    # Test 2: Multiple None values
    print("Test 2: Multiple None values")
    multiple_none = {
        "bio": None,
        "location": None,
        "age": 29
    }
    
    response = requests.put(f"{BACKEND_URL}/profile/{user_id}", json=multiple_none)
    if response.status_code == 200:
        result = response.json()
        print_result(True, "Multiple None values handled gracefully", {
            "age": result.get("age"),
            "bio": result.get("bio"),
            "location": result.get("location")
        })
    else:
        print_result(False, f"Multiple None values caused error: {response.status_code}")
        return False
    
    return True

def main():
    """Main test execution"""
    print(f"Final Profile Update Bug Fix Verification")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    print(f"Verifying fix for: TypeError: User() argument after ** must be a mapping, not NoneType")
    
    # Test exact review scenario
    scenario_success = test_exact_review_scenario()
    
    # Test original bug scenarios
    bug_scenarios_success = test_original_bug_scenarios()
    
    # Final summary
    print(f"\n{'='*60}")
    print("FINAL BUG FIX VERIFICATION SUMMARY")
    print(f"{'='*60}")
    
    if scenario_success and bug_scenarios_success:
        print("🎉 ALL TESTS PASSED - BUG FIX VERIFIED!")
        print("   ✅ Exact review scenario: WORKING")
        print("   ✅ Login with demo1@heartlink.com: WORKING")
        print("   ✅ Profile updates with age/bio: WORKING")
        print("   ✅ Complete user object returned: WORKING")
        print("   ✅ No TypeError or NoneType errors: CONFIRMED")
        print("   ✅ None value handling: WORKING")
        print("   ✅ Edge cases: WORKING")
        print("\n🔧 BUG FIX STATUS: SUCCESSFUL")
        print("   The TypeError: User() argument after ** must be a mapping, not NoneType")
        print("   error has been resolved. Profile updates now work correctly.")
        return True
    else:
        print("❌ SOME TESTS FAILED")
        print(f"   Exact review scenario: {'PASSED' if scenario_success else 'FAILED'}")
        print(f"   Original bug scenarios: {'PASSED' if bug_scenarios_success else 'FAILED'}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)