#!/usr/bin/env python3
"""
Additional test to verify making existing users admin
"""

import requests
import json

BACKEND_URL = "https://dating-admin.preview.emergentagent.com/api"

def test_make_existing_user_admin():
    """Test making an existing non-admin user into admin"""
    print("Testing making existing user admin...")
    
    # Get all users
    response = requests.get(f"{BACKEND_URL}/admin/all-users")
    if response.status_code != 200:
        print("❌ Failed to get users")
        return False
    
    users = response.json()
    
    # Find a non-admin user
    non_admin_user = None
    for user in users:
        if not user.get('is_admin', False):
            non_admin_user = user
            break
    
    if not non_admin_user:
        print("⚠️  No non-admin users found to test with")
        return True
    
    print(f"Making user '{non_admin_user['name']}' admin...")
    
    # Make user admin
    response = requests.post(f"{BACKEND_URL}/admin/make-admin/{non_admin_user['id']}")
    if response.status_code != 200:
        print(f"❌ Failed to make user admin: {response.text}")
        return False
    
    print(f"✅ Successfully made {non_admin_user['name']} admin")
    
    # Verify admin status
    response = requests.get(f"{BACKEND_URL}/admin/all-users")
    if response.status_code != 200:
        print("❌ Failed to verify admin status")
        return False
    
    updated_users = response.json()
    updated_user = None
    for user in updated_users:
        if user['id'] == non_admin_user['id']:
            updated_user = user
            break
    
    if updated_user and updated_user.get('is_admin', False):
        print(f"✅ Verified: {updated_user['name']} is now admin")
        return True
    else:
        print(f"❌ Admin status not updated for {non_admin_user['name']}")
        return False

if __name__ == "__main__":
    success = test_make_existing_user_admin()
    print(f"\nAdditional admin test: {'PASSED' if success else 'FAILED'}")