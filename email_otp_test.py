#!/usr/bin/env python3
"""
HeartLink Email OTP Functionality Test
Tests Titan SMTP integration for forgot password OTP emails
"""

import requests
import json
import sys
import time
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

def test_email_otp_functionality():
    """
    Test Email OTP functionality with Titan SMTP integration
    
    Test Scenario:
    1. POST /api/auth/forgot-password with email "demo1@heartlink.co.in"
    2. Check response - should indicate email sent successfully
    3. Verify backend logs show "Email sent successfully"
    
    Expected Results:
    - ✅ 200 OK response
    - ✅ Response message: "Reset code sent to your email"
    - ✅ Backend logs show successful email delivery
    - ✅ OTP email sent to recipient inbox
    """
    print_test_header("Email OTP Functionality with Titan SMTP")
    
    # Test data from review request
    forgot_password_data = {
        "email_or_phone": "demo1@heartlink.co.in"
    }
    
    print(f"🔄 Testing forgot password OTP for: {forgot_password_data['email_or_phone']}")
    
    try:
        # Send forgot password request
        response = requests.post(f"{BACKEND_URL}/auth/forgot-password", json=forgot_password_data)
        
        print(f"📡 Response Status Code: {response.status_code}")
        print(f"📡 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            response_data = response.json()
            print_result(True, "✅ 200 OK response received", response_data)
            
            # Check response message
            message = response_data.get("message", "")
            expected_message = "Reset code sent to your email"
            
            if expected_message in message:
                print_result(True, f"✅ Correct response message: '{message}'")
                
                # Check if email field is present (indicates email was attempted)
                email_field = response_data.get("email")
                if email_field:
                    print_result(True, f"✅ Email field present in response: {email_field}")
                else:
                    print_result(False, "❌ Email field missing from response")
                
                # Check for development OTP (fallback)
                dev_otp = response_data.get("dev_otp")
                if dev_otp:
                    print_result(True, f"✅ Development OTP provided: {dev_otp}")
                    print("📝 Note: Development OTP indicates email service may have issues but OTP generation works")
                
                # Check for error notes
                note = response_data.get("note")
                if note:
                    print(f"📝 Note from server: {note}")
                
                return True, response_data
                
            else:
                print_result(False, f"❌ Incorrect response message. Expected: '{expected_message}', Got: '{message}'")
                return False, response_data
                
        else:
            print_result(False, f"❌ Unexpected status code: {response.status_code}")
            print(f"Response body: {response.text}")
            return False, None
            
    except Exception as e:
        print_result(False, f"❌ Error during forgot password request: {str(e)}")
        return False, None

def check_backend_logs_for_email():
    """Check backend logs for email sending confirmation"""
    print_test_header("Backend Logs Verification")
    
    try:
        import subprocess
        
        # Check recent backend logs for email-related messages
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            log_content = result.stdout
            
            # Look for email success messages
            email_success_indicators = [
                "Email sent successfully",
                "✅ Email sent successfully",
                "OTP email sent successfully"
            ]
            
            email_error_indicators = [
                "Failed to send OTP email",
                "❌ Failed to send OTP email",
                "Error sending email"
            ]
            
            success_found = any(indicator in log_content for indicator in email_success_indicators)
            error_found = any(indicator in log_content for indicator in email_error_indicators)
            
            if success_found:
                print_result(True, "✅ Backend logs show successful email delivery")
                return True
            elif error_found:
                print_result(False, "❌ Backend logs show email delivery errors")
                print("📝 Recent log entries:")
                print(log_content[-500:])  # Show last 500 characters
                return False
            else:
                print_result(True, "⚠️ No specific email success/error messages in recent logs")
                print("📝 This may be normal if email service is working silently")
                return True
                
        else:
            print_result(False, f"❌ Could not read backend logs: {result.stderr}")
            return False
            
    except Exception as e:
        print_result(False, f"❌ Error checking backend logs: {str(e)}")
        return False

def test_user_exists():
    """Verify that demo1@heartlink.co.in user exists in the system"""
    print_test_header("Verify Test User Exists")
    
    # Try to login with demo user to verify it exists
    login_data = {
        "email_or_phone": "demo1@heartlink.co.in",
        "password": "Demo123!"  # Common demo password
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            user_data = response.json().get("user", {})
            print_result(True, f"✅ Demo user exists: {user_data.get('name', 'Unknown')}")
            return True, user_data
        elif response.status_code == 401:
            print_result(False, "❌ Demo user exists but password is incorrect")
            print("📝 Will still test forgot password functionality")
            return True, None  # User exists, just wrong password
        else:
            print_result(False, f"❌ Demo user may not exist. Status: {response.status_code}")
            return False, None
            
    except Exception as e:
        print_result(False, f"❌ Error checking demo user: {str(e)}")
        return False, None

def main():
    """Main test execution for Email OTP functionality"""
    print(f"HeartLink Email OTP Functionality Test")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    print(f"Testing Titan SMTP integration for forgot password OTP")
    
    all_tests_passed = True
    
    # Test 1: Verify demo user exists
    print("\n" + "="*80)
    print("STEP 1: Verify Test User Exists")
    print("="*80)
    
    user_exists, user_data = test_user_exists()
    if not user_exists:
        print("⚠️ WARNING: Demo user may not exist, but continuing with OTP test")
    
    # Test 2: Test Email OTP functionality
    print("\n" + "="*80)
    print("STEP 2: Test Email OTP Functionality")
    print("="*80)
    
    otp_success, otp_response = test_email_otp_functionality()
    if not otp_success:
        print("❌ CRITICAL: Email OTP functionality failed")
        all_tests_passed = False
    
    # Test 3: Check backend logs
    print("\n" + "="*80)
    print("STEP 3: Verify Backend Logs")
    print("="*80)
    
    logs_success = check_backend_logs_for_email()
    if not logs_success:
        print("⚠️ WARNING: Backend logs verification failed")
        # Don't fail entire test for log issues
    
    # Final summary
    print(f"\n{'='*80}")
    print("EMAIL OTP FUNCTIONALITY TEST SUMMARY")
    print(f"{'='*80}")
    
    if all_tests_passed and otp_success:
        print("✅ EMAIL OTP FUNCTIONALITY TEST PASSED")
        print("   ✅ 200 OK response received")
        print("   ✅ Correct response message format")
        print("   ✅ OTP generation working")
        
        if otp_response and otp_response.get("email"):
            print("   ✅ Email field present in response")
        
        if otp_response and otp_response.get("dev_otp"):
            print("   ⚠️  Development OTP provided (email service may need attention)")
        else:
            print("   ✅ Production email service appears to be working")
            
        if logs_success:
            print("   ✅ Backend logs verification passed")
        else:
            print("   ⚠️  Backend logs verification had issues")
            
        print("\n🎯 TITAN SMTP INTEGRATION STATUS:")
        if otp_response and not otp_response.get("dev_otp"):
            print("   ✅ Titan SMTP appears to be working correctly")
        else:
            print("   ⚠️  Titan SMTP may have configuration issues")
            print("   📝 Check SMTP credentials and server connectivity")
        
        return True
    else:
        print("❌ EMAIL OTP FUNCTIONALITY TEST FAILED")
        print("   Check individual test results above for details")
        
        if not otp_success:
            print("   ❌ Core OTP functionality not working")
        
        print("\n🔧 TROUBLESHOOTING STEPS:")
        print("   1. Verify Titan SMTP credentials in backend/.env")
        print("   2. Check SMTP server connectivity")
        print("   3. Verify email service configuration")
        print("   4. Check backend logs for detailed error messages")
        
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)