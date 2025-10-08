#!/usr/bin/env python3
"""
HeartLink Backend Admin Functionality Test
Tests admin user creation, verification, and login functionality
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://linkhearts-app.preview.emergentagent.com/api"

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

def main():
    """Main test execution"""
    print(f"HeartLink Backend Admin Functionality Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    # Step 1: Check existing users
    existing_users = test_get_all_users()
    
    # Step 2: Always create a new test user with known credentials for reliable testing
    print("\nCreating new test user with known credentials for reliable admin testing...")
    admin_user_id, user_data = create_test_user()
    admin_credentials = None
    
    if admin_user_id:
        admin_credentials = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
    else:
        # Fallback to existing user if creation fails
        if existing_users:
            print(f"\nFallback: Using existing user for admin testing")
            for user in existing_users:
                print(f"  - {user['name']} (ID: {user['id']}, Email: {user.get('email', 'N/A')}, Admin: {user.get('is_admin', False)})")
            
            # Use the first non-admin user for testing
            for user in existing_users:
                if not user.get('is_admin', False):
                    admin_user_id = user["id"]
                    break
            
            if not admin_user_id and existing_users:
                admin_user_id = existing_users[0]["id"]
    
    if not admin_user_id:
        print("❌ CRITICAL: Could not get or create a user for testing")
        return False
    
    # Step 3: Make user admin
    admin_success = make_user_admin(admin_user_id)
    if not admin_success:
        print("❌ CRITICAL: Failed to make user admin")
        return False
    
    # Step 4: Verify admin status
    is_admin_verified, admin_user_data = verify_admin_status(admin_user_id)
    if not is_admin_verified:
        print("❌ CRITICAL: Admin status not verified")
        return False
    
    # Step 5: Test login with admin user
    if admin_credentials and admin_credentials["email"]:
        login_success, login_data = test_admin_login(admin_credentials["email"], admin_credentials["password"])
        if not login_success:
            print("⚠️  WARNING: Admin login test failed, but admin creation was successful")
    else:
        print("⚠️  WARNING: Cannot test login - no email credentials available")
    
    # Final summary
    print(f"\n{'='*60}")
    print("FINAL SUMMARY")
    print(f"{'='*60}")
    
    if admin_user_data:
        print("✅ ADMIN USER READY FOR FRONTEND:")
        print(f"   User ID: {admin_user_data['id']}")
        print(f"   Name: {admin_user_data['name']}")
        print(f"   Email: {admin_user_data.get('email', 'N/A')}")
        print(f"   Is Admin: {admin_user_data.get('is_admin', False)}")
        
        if admin_credentials and admin_credentials["email"]:
            print(f"\n✅ ADMIN CREDENTIALS:")
            print(f"   Email: {admin_credentials['email']}")
            print(f"   Password: {admin_credentials['password']}")
        
        return True
    else:
        print("❌ ADMIN SETUP FAILED")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)