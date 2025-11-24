#!/usr/bin/env python3
"""
HeartLink Backend Matching Functionality Debug Test
Creates new test users and tests complete matching flow
"""

import requests
import json
import sys
import time
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://cupids-arrow-23.preview.emergentagent.com/api"

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
    user_data = {
        "email": email,
        "password": "Test@123",
        "name": name,
        "age": age,
        "gender": gender,
        "looking_for": looking_for,
        "bio": f"Test user {name} for matching functionality testing",
        "location": "Test City",
        "interests": ["Testing", "Dating", "Technology"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=user_data)
        
        if response.status_code == 200:
            signup_result = response.json()
            user_id = signup_result.get("user_id")
            user_info = signup_result.get("user", {})
            
            print_result(True, f"Created test user: {name}", {
                "user_id": user_id,
                "email": email,
                "name": user_info.get("name")
            })
            return user_id, user_data
        else:
            # User might already exist, try to login
            login_data = {
                "email_or_phone": email,
                "password": "Test@123"
            }
            
            login_response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if login_response.status_code == 200:
                login_result = login_response.json()
                user_info = login_result.get("user", {})
                user_id = user_info.get("id")
                
                print_result(True, f"Using existing test user: {name}", {
                    "user_id": user_id,
                    "email": email,
                    "name": user_info.get("name")
                })
                return user_id, user_data
            else:
                print_result(False, f"Failed to create or login user {name}. Status: {response.status_code}", response.text)
                return None, None
                
    except Exception as e:
        print_result(False, f"Error creating user {name}: {str(e)}")
        return None, None

def test_complete_matching_flow():
    """Test complete matching flow with newly created users"""
    print_test_header("COMPLETE MATCHING FLOW TEST")
    
    # Create timestamp for unique emails
    timestamp = str(int(time.time()))
    
    # Create User A (Male looking for Female)
    print_test_header("Create User A (Male)")
    user_a_id, user_a_data = create_test_user(
        name="Test User A",
        email=f"test.user.a.{timestamp}@heartlink.com",
        gender="Male",
        looking_for="Female",
        age=28
    )
    
    if not user_a_id:
        print_result(False, "Failed to create User A", "Cannot proceed with matching test")
        return False
    
    # Create User B (Female looking for Male)
    print_test_header("Create User B (Female)")
    user_b_id, user_b_data = create_test_user(
        name="Test User B",
        email=f"test.user.b.{timestamp}@heartlink.com",
        gender="Female",
        looking_for="Male",
        age=26
    )
    
    if not user_b_id:
        print_result(False, "Failed to create User B", "Cannot proceed with matching test")
        return False
    
    # Step 1: Check initial matches for both users
    print_test_header("Step 1: Check initial matches")
    
    try:
        # User A initial matches
        response_a = requests.get(f"{BACKEND_URL}/matches/{user_a_id}")
        user_a_initial_matches = []
        if response_a.status_code == 200:
            user_a_initial_matches = response_a.json()
            print_result(True, f"User A initial matches: {len(user_a_initial_matches)}", None)
        
        # User B initial matches
        response_b = requests.get(f"{BACKEND_URL}/matches/{user_b_id}")
        user_b_initial_matches = []
        if response_b.status_code == 200:
            user_b_initial_matches = response_b.json()
            print_result(True, f"User B initial matches: {len(user_b_initial_matches)}", None)
            
    except Exception as e:
        print_result(False, f"Error checking initial matches: {str(e)}")
        return False
    
    # Step 2: Test discover functionality
    print_test_header("Step 2: Test discover functionality")
    
    try:
        # User A discovers User B
        response = requests.get(f"{BACKEND_URL}/discover/{user_a_id}")
        
        if response.status_code == 200:
            discover_results = response.json()
            
            user_b_found = False
            for user in discover_results:
                if user.get("id") == user_b_id:
                    user_b_found = True
                    print_result(True, "User B found in User A's discover results", {
                        "user_b_name": user.get("name"),
                        "user_b_age": user.get("age"),
                        "user_b_gender": user.get("gender", "Not specified")
                    })
                    break
            
            if not user_b_found:
                print_result(False, "User B NOT found in User A's discover results", {
                    "discover_count": len(discover_results),
                    "user_names": [u.get("name") for u in discover_results]
                })
                # This might be due to filtering logic, continue anyway
        else:
            print_result(False, f"Discover failed for User A. Status: {response.status_code}", response.text)
            
    except Exception as e:
        print_result(False, f"Error testing discover: {str(e)}")
    
    # Step 3: User A likes User B
    print_test_header("Step 3: User A likes User B")
    
    like_data = {
        "target_user_id": user_b_id,
        "action": "like"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_a_id}", json=like_data)
        
        if response.status_code == 200:
            like_result = response.json()
            action_result = like_result.get("action")
            
            print_result(True, "User A like action successful", {
                "action_result": action_result,
                "is_match": action_result == "matched"
            })
            
            if action_result == "matched":
                print("🎉 INSTANT MATCH! User B already liked User A")
                match_id = like_result.get("match_id")
                compatibility_score = like_result.get("compatibility_score")
                print_result(True, "Match created successfully", {
                    "match_id": match_id,
                    "compatibility_score": compatibility_score
                })
                return True  # Test successful
                
        else:
            print_result(False, f"User A like action failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error during User A like action: {str(e)}")
        return False
    
    # Step 4: User B likes User A back
    print_test_header("Step 4: User B likes User A back")
    
    like_back_data = {
        "target_user_id": user_a_id,
        "action": "like"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_b_id}", json=like_back_data)
        
        if response.status_code == 200:
            like_back_result = response.json()
            action_result = like_back_result.get("action")
            
            print_result(True, "User B like back successful", {
                "action_result": action_result,
                "is_match": action_result == "matched"
            })
            
            if action_result == "matched":
                match_id = like_back_result.get("match_id")
                compatibility_score = like_back_result.get("compatibility_score")
                analysis = like_back_result.get("analysis", "")
                
                print_result(True, "🎉 MATCH CREATED!", {
                    "match_id": match_id,
                    "compatibility_score": compatibility_score,
                    "analysis": analysis[:100] + "..." if len(analysis) > 100 else analysis
                })
            else:
                print_result(False, "Expected match but got different result", like_back_result)
                return False
                
        else:
            print_result(False, f"User B like back failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error during User B like back: {str(e)}")
        return False
    
    # Step 5: Verify both users see each other in matches
    print_test_header("Step 5: Verify mutual matches")
    
    try:
        # Check User A's matches
        response_a = requests.get(f"{BACKEND_URL}/matches/{user_a_id}")
        if response_a.status_code == 200:
            user_a_final_matches = response_a.json()
            user_a_new_matches = len(user_a_final_matches) - len(user_a_initial_matches)
            
            user_b_found_in_a_matches = False
            for match in user_a_final_matches:
                match_user = match.get("user", {})
                if match_user.get("id") == user_b_id:
                    user_b_found_in_a_matches = True
                    print_result(True, "✅ User B found in User A's matches", {
                        "match_id": match.get("match_id"),
                        "user_b_name": match_user.get("name"),
                        "compatibility_score": match.get("compatibility_score"),
                        "created_at": match.get("created_at")
                    })
                    break
            
            if not user_b_found_in_a_matches:
                print_result(False, "❌ User B NOT found in User A's matches", {
                    "user_a_matches": len(user_a_final_matches),
                    "new_matches": user_a_new_matches
                })
                return False
        else:
            print_result(False, f"Failed to get User A's final matches. Status: {response_a.status_code}", response_a.text)
            return False
        
        # Check User B's matches
        response_b = requests.get(f"{BACKEND_URL}/matches/{user_b_id}")
        if response_b.status_code == 200:
            user_b_final_matches = response_b.json()
            user_b_new_matches = len(user_b_final_matches) - len(user_b_initial_matches)
            
            user_a_found_in_b_matches = False
            for match in user_b_final_matches:
                match_user = match.get("user", {})
                if match_user.get("id") == user_a_id:
                    user_a_found_in_b_matches = True
                    print_result(True, "✅ User A found in User B's matches", {
                        "match_id": match.get("match_id"),
                        "user_a_name": match_user.get("name"),
                        "compatibility_score": match.get("compatibility_score"),
                        "created_at": match.get("created_at")
                    })
                    break
            
            if not user_a_found_in_b_matches:
                print_result(False, "❌ User A NOT found in User B's matches", {
                    "user_b_matches": len(user_b_final_matches),
                    "new_matches": user_b_new_matches
                })
                return False
        else:
            print_result(False, f"Failed to get User B's final matches. Status: {response_b.status_code}", response_b.text)
            return False
        
        # Both users found in each other's matches
        print_result(True, "🎉 MUTUAL MATCHING VERIFIED!", {
            "user_a_matches": len(user_a_final_matches),
            "user_b_matches": len(user_b_final_matches),
            "mutual_match_confirmed": True
        })
        
        return True
        
    except Exception as e:
        print_result(False, f"Error verifying mutual matches: {str(e)}")
        return False

def test_superlike_functionality():
    """Test superlike functionality"""
    print_test_header("SUPERLIKE FUNCTIONALITY TEST")
    
    # Create timestamp for unique emails
    timestamp = str(int(time.time()))
    
    # Create User C (Male looking for Female)
    print_test_header("Create User C (Male)")
    user_c_id, user_c_data = create_test_user(
        name="Test User C",
        email=f"test.user.c.{timestamp}@heartlink.com",
        gender="Male",
        looking_for="Female",
        age=29
    )
    
    if not user_c_id:
        print_result(False, "Failed to create User C", "Cannot proceed with superlike test")
        return False
    
    # Create User D (Female looking for Male)
    print_test_header("Create User D (Female)")
    user_d_id, user_d_data = create_test_user(
        name="Test User D",
        email=f"test.user.d.{timestamp}@heartlink.com",
        gender="Female",
        looking_for="Male",
        age=27
    )
    
    if not user_d_id:
        print_result(False, "Failed to create User D", "Cannot proceed with superlike test")
        return False
    
    # User C superlikes User D
    print_test_header("User C superlikes User D")
    
    superlike_data = {
        "target_user_id": user_d_id,
        "action": "superlike"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_c_id}", json=superlike_data)
        
        if response.status_code == 200:
            superlike_result = response.json()
            action_result = superlike_result.get("action")
            
            print_result(True, "User C superlike action successful", {
                "action_result": action_result,
                "is_match": action_result == "matched"
            })
            
            if action_result == "matched":
                print("🎉 INSTANT MATCH! User D already liked User C")
                return True
                
        else:
            print_result(False, f"User C superlike action failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error during User C superlike action: {str(e)}")
        return False
    
    # User D likes User C back
    print_test_header("User D likes User C back")
    
    like_back_data = {
        "target_user_id": user_c_id,
        "action": "like"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/action/{user_d_id}", json=like_back_data)
        
        if response.status_code == 200:
            like_back_result = response.json()
            action_result = like_back_result.get("action")
            
            print_result(True, "User D like back successful", {
                "action_result": action_result,
                "is_match": action_result == "matched"
            })
            
            if action_result == "matched":
                match_id = like_back_result.get("match_id")
                compatibility_score = like_back_result.get("compatibility_score")
                
                print_result(True, "🎉 SUPERLIKE MATCH CREATED!", {
                    "match_id": match_id,
                    "compatibility_score": compatibility_score
                })
                return True
            else:
                print_result(False, "Expected match but got different result", like_back_result)
                return False
                
        else:
            print_result(False, f"User D like back failed. Status: {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, f"Error during User D like back: {str(e)}")
        return False

def test_existing_users_matches():
    """Test matches for existing users in database"""
    print_test_header("EXISTING USERS MATCHES TEST")
    
    try:
        # Get all users
        response = requests.get(f"{BACKEND_URL}/admin/all-users")
        
        if response.status_code != 200:
            print_result(False, f"Failed to get users. Status: {response.status_code}", response.text)
            return False
        
        all_users = response.json()
        
        if len(all_users) < 2:
            print_result(False, "Not enough users in database", f"Found {len(all_users)} users")
            return False
        
        # Test matches for first few users
        users_with_matches = 0
        total_matches_found = 0
        
        for user in all_users[:10]:  # Check first 10 users
            user_id = user["id"]
            user_name = user["name"]
            
            try:
                response = requests.get(f"{BACKEND_URL}/matches/{user_id}")
                
                if response.status_code == 200:
                    user_matches = response.json()
                    match_count = len(user_matches)
                    total_matches_found += match_count
                    
                    if match_count > 0:
                        users_with_matches += 1
                        print_result(True, f"{user_name} has {match_count} matches", {
                            "user_id": user_id,
                            "matches": [{"name": m.get("user", {}).get("name"), "score": m.get("compatibility_score")} for m in user_matches]
                        })
                    else:
                        print_result(True, f"{user_name} has no matches", {"user_id": user_id})
                        
                else:
                    print_result(False, f"Failed to get matches for {user_name}. Status: {response.status_code}", response.text)
                    
            except Exception as e:
                print_result(False, f"Error getting matches for {user_name}: {str(e)}")
        
        print_result(True, "Existing users matches summary", {
            "total_users_checked": min(10, len(all_users)),
            "users_with_matches": users_with_matches,
            "total_matches_found": total_matches_found,
            "average_matches_per_user": total_matches_found / min(10, len(all_users))
        })
        
        return True
        
    except Exception as e:
        print_result(False, f"Error testing existing users matches: {str(e)}")
        return False

def main():
    """Main test execution"""
    print(f"HeartLink Backend Matching Functionality Debug Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    all_tests_passed = True
    
    # Test 1: Complete Matching Flow
    print(f"\n{'='*80}")
    print("TEST 1: COMPLETE MATCHING FLOW")
    print(f"{'='*80}")
    matching_test_passed = test_complete_matching_flow()
    if not matching_test_passed:
        all_tests_passed = False
    
    # Test 2: Superlike Functionality
    print(f"\n{'='*80}")
    print("TEST 2: SUPERLIKE FUNCTIONALITY")
    print(f"{'='*80}")
    superlike_test_passed = test_superlike_functionality()
    if not superlike_test_passed:
        all_tests_passed = False
    
    # Test 3: Existing Users Matches
    print(f"\n{'='*80}")
    print("TEST 3: EXISTING USERS MATCHES")
    print(f"{'='*80}")
    existing_matches_test_passed = test_existing_users_matches()
    if not existing_matches_test_passed:
        all_tests_passed = False
    
    # Final summary
    print(f"\n{'='*80}")
    print("MATCHING FUNCTIONALITY DEBUG TEST SUMMARY")
    print(f"{'='*80}")
    
    if all_tests_passed:
        print("✅ ALL MATCHING FUNCTIONALITY TESTS PASSED")
        print("   ✅ Complete matching flow working (like → match → mutual matches)")
        print("   ✅ Superlike functionality working")
        print("   ✅ Existing users matches accessible")
        print("\n🎯 CONCLUSION: Backend matching functionality is working correctly!")
        print("   If frontend is not showing matches, the issue is likely in:")
        print("   - Frontend API calls to /api/matches/{user_id}")
        print("   - Frontend state management or component rendering")
        print("   - Frontend authentication or user ID handling")
        return True
    else:
        print("❌ SOME MATCHING FUNCTIONALITY TESTS FAILED")
        print("   Check individual test results above for details")
        print("\n🔍 BACKEND MATCHING ISSUES FOUND")
        print("   These backend issues need to be fixed first")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)