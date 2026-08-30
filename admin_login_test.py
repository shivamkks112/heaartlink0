#!/usr/bin/env python3
"""
HeartLink Admin Login Test
Specifically tests the admin@heartlink.com login issue
"""

import requests
import json
import sys
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

def check_admin_user_exists():
    """Check if admin@heartlink.com exists and has is_admin: true"""
    print_test_header("Check Admin User Exists")
    
    try:
        response = requests.get(f"{BACKEND_URL}/admin/all-users")
        
        if response.status_code == 200:
            users = response.json()
            admin_user = None
            
            for user in users:
                if user.get("email") == "admin@heartlink.com":
                    admin_user = user
                    break
            
            if admin_user:
                is_admin = admin_user.get("is_admin", False)
                print_result(True, f"Admin user found with is_admin: {is_admin}", admin_user)
                return admin_user, is_admin
            else:
                print_result(False, "Admin user admin@heartlink.com not found")
                return None, False
        else:
            print_result(False, f"Failed to get users. Status: {response.status_code}", response.text)
            return None, False
    except Exception as e:
        print_result(False, f"Error checking admin user: {str(e)}")
        return None, False

def test_admin_login():
    """Test login with admin@heartlink.com and AdminPass123!"""
    print_test_header("Test Admin Login")
    
    login_data = {
        "email_or_phone": "admin@heartlink.com",
        "password": "AdminPass123!"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            login_result = response.json()
            user_data = login_result.get("user", {})
            is_admin = user_data.get("is_admin", False)
            
            print_result(True, f"Login successful! is_admin: {is_admin}", {
                "user_id": user_data.get("id"),
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "is_admin": is_admin,
                "message": login_result.get("message")
            })
            return True, user_data
        else:
            error_detail = response.text
            try:
                error_json = response.json()
                error_detail = error_json.get("detail", error_detail)
            except:
                pass
            
            print_result(False, f"Login failed. Status: {response.status_code}, Error: {error_detail}")
            return False, None
    except Exception as e:
        print_result(False, f"Error during login: {str(e)}")
        return False, None

def create_new_admin_if_needed():
    """Create a new admin user if the current one doesn't work"""
    print_test_header("Create New Admin User")
    
    # Try to create with a different email first
    test_admin_data = {
        "email": "newadmin@heartlink.com",
        "password": "AdminPass123!",
        "name": "New Admin User",
        "age": 30,
        "gender": "male",
        "looking_for": "female",
        "bio": "New admin user for HeartLink",
        "location": "San Francisco, CA",
        "interests": ["technology", "dating apps", "admin work"]
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/signup", json=test_admin_data)
        
        if response.status_code == 200:
            user_data = response.json()
            user_id = user_data.get("user_id")
            
            print_result(True, "New admin user created successfully", {
                "user_id": user_id,
                "email": test_admin_data["email"],
                "name": test_admin_data["name"]
            })
            
            # Make this user admin
            admin_response = requests.post(f"{BACKEND_URL}/admin/make-admin/{user_id}")
            if admin_response.status_code == 200:
                print_result(True, "New user made admin successfully")
                return user_id, test_admin_data
            else:
                print_result(False, f"Failed to make new user admin. Status: {admin_response.status_code}")
                return None, None
        else:
            print_result(False, f"Failed to create new admin user. Status: {response.status_code}", response.text)
            return None, None
    except Exception as e:
        print_result(False, f"Error creating new admin user: {str(e)}")
        return None, None

def main():
    """Main test execution"""
    print(f"HeartLink Admin Login Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    # Step 1: Check if admin user exists
    admin_user, is_admin = check_admin_user_exists()
    
    if not admin_user:
        print("❌ CRITICAL: Admin user admin@heartlink.com does not exist")
        return False
    
    if not is_admin:
        print("❌ CRITICAL: User admin@heartlink.com exists but is_admin is false")
        return False
    
    # Step 2: Test login with admin credentials
    login_success, login_data = test_admin_login()
    
    if login_success:
        print(f"\n{'='*60}")
        print("✅ SUCCESS: Admin login is working properly!")
        print(f"{'='*60}")
        print(f"Admin User ID: {login_data.get('id')}")
        print(f"Admin Name: {login_data.get('name')}")
        print(f"Admin Email: {login_data.get('email')}")
        print(f"Is Admin: {login_data.get('is_admin')}")
        return True
    else:
        print(f"\n{'='*60}")
        print("❌ ISSUE FOUND: Admin login is failing")
        print(f"{'='*60}")
        
        # Try to create a new admin user
        print("\nAttempting to create a new working admin user...")
        new_user_id, new_user_data = create_new_admin_if_needed()
        
        if new_user_id and new_user_data:
            # Test login with new admin
            print("\nTesting login with new admin user...")
            new_login_data = {
                "email_or_phone": new_user_data["email"],
                "password": new_user_data["password"]
            }
            
            try:
                response = requests.post(f"{BACKEND_URL}/auth/login", json=new_login_data)
                if response.status_code == 200:
                    result = response.json()
                    user_data = result.get("user", {})
                    print_result(True, "New admin login successful!", {
                        "email": new_user_data["email"],
                        "password": new_user_data["password"],
                        "user_id": user_data.get("id"),
                        "is_admin": user_data.get("is_admin")
                    })
                    return True
                else:
                    print_result(False, f"New admin login also failed. Status: {response.status_code}")
            except Exception as e:
                print_result(False, f"Error testing new admin login: {str(e)}")
        
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)