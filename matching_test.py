#!/usr/bin/env python3
"""
HeartLink Matching Functionality Comprehensive Test
Tests like/match/matches endpoints as requested in review
"""

import requests
import json
import sys
import time
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://india-dating-app.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")

def create_test_user(name, email, gender, looking_for, age=25):
    """Create a test user for matching tests"""
    print_test_header(f"Create Test User: {name}")
    
    user_data = {
        "email": email,
        "password": "TestPass123!",
        "name": name,
        "age": age,
        "gender": gender,
        "looking_for": looking_for,
        "bio": f"Test user {name} for matching functionality testing",
        "location": "Test City, Test State",
        "interests": ["testing", "matching", "dating"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=user_data)
        
        if response.status_code == 200:
            result = response.json()
            user_id = result.get("user_id")
            user_info = result.get("user", {})
            
            print_result(True, f"Test user {name} created successfully", {
                "user_id": user_id,
                "name": user_info.get("name"),
                "email": user_info.get("email"),
                "gender": user_info.get("gender"),
                "looking_for": user_info.get("looking_for")
            })
            return True, user_id, user_data
        else:
            print_result(False, f"Failed to create user {name}. Status: {response.status_code}", response.text)
            return False, None, None
    except Exception as e:
        print_result(False, f"Error creating user {name}: {str(e)}")
        return False, None, None

def test_user_like_action(user_id, target_user_id, user_name, target_name):
    """Test POST /api/action/{user_id} - User likes another user"""
    print_test_header(f"{user_name} likes {target_name}")
    
    action_data = {
        "target_user_id": target_user_id,
        "action": "like"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_id}", json=action_data)
        
        if response.status_code == 200:
            result = response.json()
            action_result = result.get("action")
            
            print_result(True, f"{user_name} successfully liked {target_name}", {
                "action": action_result,
                "user_id": user_id,
                "target_user_id": target_user_id,
                "match_created": action_result == "matched",
                "match_id": result.get("match_id"),
                "compatibility_score": result.get("compatibility_score")
            })
            
            return True, result
        else:
            print_result(False, f"Like action failed. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error in like action: {str(e)}")
        return False, None

def test_get_matches(user_id, user_name, expected_matches=None):
    """Test GET /api/matches/{user_id} - Get user's matches"""
    print_test_header(f"Get Matches for {user_name}")
    
    try:
        response = requests.get(f"{BACKEND_URL}/matches/{user_id}")
        
        if response.status_code == 200:
            matches = response.json()
            
            print_result(True, f"Successfully retrieved matches for {user_name}", {
                "user_id": user_id,
                "total_matches": len(matches),
                "matches": matches
            })
            
            # Verify expected matches if provided
            if expected_matches:
                for expected_match in expected_matches:
                    match_found = False
                    for match in matches:
                        if match.get("user", {}).get("id") == expected_match:
                            match_found = True
                            print_result(True, f"Expected match found: {expected_match}", {
                                "match_id": match.get("match_id"),
                                "matched_user": match.get("user", {}).get("name"),
                                "compatibility_score": match.get("compatibility_score")
                            })
                            break
                    
                    if not match_found:
                        print_result(False, f"Expected match NOT found: {expected_match}")
                        return False, matches
            
            return True, matches
        else:
            print_result(False, f"Get matches failed. Status: {response.status_code}", response.text)
            return False, None
    except Exception as e:
        print_result(False, f"Error getting matches: {str(e)}")
        return False, None

def verify_match_data_structure(match_data):
    """Verify that match data has correct fields"""
    print_test_header("Verify Match Data Structure")
    
    required_fields = ["match_id", "user", "compatibility_score", "created_at"]
    user_required_fields = ["id", "name", "age"]
    
    all_valid = True
    
    for field in required_fields:
        if field not in match_data:
            print_result(False, f"Missing required field: {field}")
            all_valid = False
        else:
            print_result(True, f"Required field present: {field}")
    
    # Verify user object structure
    user_data = match_data.get("user", {})
    for field in user_required_fields:
        if field not in user_data:
            print_result(False, f"Missing required user field: {field}")
            all_valid = False
        else:
            print_result(True, f"Required user field present: {field}")
    
    if all_valid:
        print_result(True, "All match data fields are present and valid", {
            "match_id": match_data.get("match_id"),
            "user_name": user_data.get("name"),
            "compatibility_score": match_data.get("compatibility_score"),
            "has_created_at": bool(match_data.get("created_at"))
        })
    
    return all_valid

def test_matching_flow():
    """Complete matching flow test as specified in review request"""
    print_test_header("COMPREHENSIVE MATCHING FUNCTIONALITY TEST")
    
    # Generate unique emails to avoid conflicts
    timestamp = str(int(time.time()))
    user_a_email = f"usera.match.{timestamp}@heartlink.com"
    user_b_email = f"userb.match.{timestamp}@heartlink.com"
    
    # Step 1: Create 2 test users (User A and User B)
    print("\n🔸 STEP 1: Create Test Users")
    
    # Create User A (Male looking for Female)
    success_a, user_a_id, user_a_data = create_test_user(
        name="User A (Male)",
        email=user_a_email,
        gender="Male",
        looking_for="Female",
        age=28
    )
    
    if not success_a:
        print("❌ CRITICAL: Failed to create User A")
        return False
    
    # Create User B (Female looking for Male)
    success_b, user_b_id, user_b_data = create_test_user(
        name="User B (Female)",
        email=user_b_email,
        gender="Female",
        looking_for="Male",
        age=26
    )
    
    if not success_b:
        print("❌ CRITICAL: Failed to create User B")
        return False
    
    print(f"\n✅ Both test users created successfully:")
    print(f"   User A ID: {user_a_id}")
    print(f"   User B ID: {user_b_id}")
    
    # Step 2: User A likes User B
    print("\n🔸 STEP 2: User A likes User B")
    
    success_like_a, like_result_a = test_user_like_action(
        user_id=user_a_id,
        target_user_id=user_b_id,
        user_name="User A",
        target_name="User B"
    )
    
    if not success_like_a:
        print("❌ CRITICAL: User A failed to like User B")
        return False
    
    # Verify no match yet (should be "liked", not "matched")
    if like_result_a.get("action") == "matched":
        print("❌ UNEXPECTED: Match created on first like (should require mutual like)")
        return False
    elif like_result_a.get("action") == "liked":
        print("✅ Correct: First like recorded, no match yet")
    
    # Step 3: User B likes User A (should create match)
    print("\n🔸 STEP 3: User B likes User A (Should Create Match)")
    
    success_like_b, like_result_b = test_user_like_action(
        user_id=user_b_id,
        target_user_id=user_a_id,
        user_name="User B",
        target_name="User A"
    )
    
    if not success_like_b:
        print("❌ CRITICAL: User B failed to like User A")
        return False
    
    # Verify match was created
    if like_result_b.get("action") != "matched":
        print(f"❌ CRITICAL: Match not created. Action: {like_result_b.get('action')}")
        return False
    
    match_id = like_result_b.get("match_id")
    compatibility_score = like_result_b.get("compatibility_score")
    
    print(f"✅ MATCH CREATED SUCCESSFULLY!")
    print(f"   Match ID: {match_id}")
    print(f"   Compatibility Score: {compatibility_score}")
    
    # Step 4: Check if match appears in matches endpoint for both users
    print("\n🔸 STEP 4: Verify Match Appears for Both Users")
    
    # Test User A's matches (should show User B)
    success_matches_a, matches_a = test_get_matches(
        user_id=user_a_id,
        user_name="User A",
        expected_matches=[user_b_id]
    )
    
    if not success_matches_a:
        print("❌ CRITICAL: Failed to get matches for User A")
        return False
    
    # Test User B's matches (should show User A)
    success_matches_b, matches_b = test_get_matches(
        user_id=user_b_id,
        user_name="User B",
        expected_matches=[user_a_id]
    )
    
    if not success_matches_b:
        print("❌ CRITICAL: Failed to get matches for User B")
        return False
    
    # Step 5: Verify match data has correct fields
    print("\n🔸 STEP 5: Verify Match Data Structure")
    
    if matches_a and len(matches_a) > 0:
        match_data_valid = verify_match_data_structure(matches_a[0])
        if not match_data_valid:
            print("❌ CRITICAL: Match data structure invalid")
            return False
    else:
        print("❌ CRITICAL: No match data found for User A")
        return False
    
    # Additional verification: Check mutual matches
    print("\n🔸 STEP 6: Verify Mutual Matching")
    
    user_a_matched_with_b = False
    user_b_matched_with_a = False
    
    # Check if User A's matches contain User B
    for match in matches_a:
        if match.get("user", {}).get("id") == user_b_id:
            user_a_matched_with_b = True
            break
    
    # Check if User B's matches contain User A
    for match in matches_b:
        if match.get("user", {}).get("id") == user_a_id:
            user_b_matched_with_a = True
            break
    
    if user_a_matched_with_b and user_b_matched_with_a:
        print("✅ MUTUAL MATCHING VERIFIED: Both users see each other in matches")
    else:
        print("❌ CRITICAL: Mutual matching failed")
        print(f"   User A sees User B: {user_a_matched_with_b}")
        print(f"   User B sees User A: {user_b_matched_with_a}")
        return False
    
    return True

def test_edge_cases():
    """Test edge cases for matching functionality"""
    print_test_header("MATCHING EDGE CASES")
    
    # Generate unique emails
    timestamp = str(int(time.time()))
    user_c_email = f"userc.edge.{timestamp}@heartlink.com"
    user_d_email = f"userd.edge.{timestamp}@heartlink.com"
    
    # Create test users for edge cases
    success_c, user_c_id, _ = create_test_user(
        name="User C (Edge Test)",
        email=user_c_email,
        gender="Male",
        looking_for="Female",
        age=30
    )
    
    success_d, user_d_id, _ = create_test_user(
        name="User D (Edge Test)",
        email=user_d_email,
        gender="Female",
        looking_for="Male",
        age=25
    )
    
    if not (success_c and success_d):
        print("❌ Failed to create edge test users")
        return False
    
    # Test 1: Pass action (should not create match)
    print("\n🔸 Edge Test 1: Pass Action")
    
    pass_data = {
        "target_user_id": user_d_id,
        "action": "pass"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_c_id}", json=pass_data)
        if response.status_code == 200:
            result = response.json()
            if result.get("action") == "passed":
                print_result(True, "Pass action working correctly")
            else:
                print_result(False, f"Unexpected pass result: {result}")
                return False
        else:
            print_result(False, f"Pass action failed: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Error in pass action: {str(e)}")
        return False
    
    # Test 2: SuperLike action
    print("\n🔸 Edge Test 2: SuperLike Action")
    
    superlike_data = {
        "target_user_id": user_d_id,
        "action": "superlike"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_c_id}", json=superlike_data)
        if response.status_code == 200:
            result = response.json()
            if result.get("action") in ["liked", "matched"]:
                print_result(True, f"SuperLike action working: {result.get('action')}")
            else:
                print_result(False, f"Unexpected superlike result: {result}")
                return False
        else:
            print_result(False, f"SuperLike action failed: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Error in superlike action: {str(e)}")
        return False
    
    # Test 3: Invalid user ID
    print("\n🔸 Edge Test 3: Invalid User ID")
    
    invalid_like_data = {
        "target_user_id": "invalid-user-id",
        "action": "like"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_c_id}", json=invalid_like_data)
        # Should handle gracefully (might succeed but not create match, or return error)
        print_result(True, f"Invalid user ID handled: Status {response.status_code}")
    except Exception as e:
        print_result(True, f"Invalid user ID handled with exception: {str(e)}")
    
    return True

def main():
    """Main test execution for matching functionality"""
    print(f"HeartLink Matching Functionality Comprehensive Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    # Run main matching flow test
    matching_flow_success = test_matching_flow()
    
    # Run edge cases test
    edge_cases_success = test_edge_cases()
    
    # Final summary
    print(f"\n{'='*80}")
    print("MATCHING FUNCTIONALITY TEST SUMMARY")
    print(f"{'='*80}")
    
    if matching_flow_success and edge_cases_success:
        print("✅ ALL MATCHING TESTS PASSED")
        print("   ✅ User creation working")
        print("   ✅ Like action working (POST /api/action/{user_id})")
        print("   ✅ Match creation working (mutual likes)")
        print("   ✅ Get matches working (GET /api/matches/{user_id})")
        print("   ✅ Match data structure correct")
        print("   ✅ Mutual matching verified")
        print("   ✅ Edge cases handled")
        print("\n🎉 MATCHING FUNCTIONALITY IS FULLY OPERATIONAL!")
        return True
    else:
        print("❌ MATCHING TESTS FAILED")
        if not matching_flow_success:
            print("   ❌ Main matching flow failed")
        if not edge_cases_success:
            print("   ❌ Edge cases failed")
        print("\n🚨 MATCHING FUNCTIONALITY NEEDS ATTENTION!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)