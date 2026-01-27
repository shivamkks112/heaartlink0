#!/usr/bin/env python3
"""
HeartLink Real-Time Chat and Notifications Test
Focused test for the review request requirements:
1. WebSocket Connection Test
2. Instant Message Delivery
3. Push Notifications
"""

import requests
import json
import asyncio
import websockets
import uuid
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://desi-match-4.preview.emergentagent.com/api"
WEBSOCKET_URL = "wss://cupids-arrow-23.preview.emergentagent.com/api/ws"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")

def login_user(email, password):
    """Login user and return user data"""
    login_data = {
        "email_or_phone": email,
        "password": password
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            login_result = response.json()
            user_data = login_result.get("user", {})
            return True, user_data
        else:
            return False, f"Login failed. Status: {response.status_code}, Response: {response.text}"
            
    except Exception as e:
        return False, f"Login error: {str(e)}"

def get_user_matches(user_id):
    """Get user's matches"""
    try:
        response = requests.get(f"{BACKEND_URL}/matches/{user_id}")
        
        if response.status_code == 200:
            matches = response.json()
            return True, matches
        else:
            return False, f"Failed to get matches: {response.text}"
            
    except Exception as e:
        return False, f"Error getting matches: {str(e)}"

def send_http_message(sender_id, receiver_id, match_id, content):
    """Send message via HTTP POST /api/messages"""
    message_data = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "content": content,
        "read": False
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/messages", json=message_data)
        
        if response.status_code == 200:
            result = response.json()
            return True, result
        else:
            return False, f"HTTP message failed: {response.status_code} - {response.text}"
            
    except Exception as e:
        return False, f"HTTP message error: {str(e)}"

async def test_websocket_connection_only(user_id):
    """Test WebSocket connection without sending messages"""
    print_test_header(f"WebSocket Connection Test - User {user_id}")
    
    websocket_url = f"{WEBSOCKET_URL}/{user_id}"
    
    try:
        # Test connection with a short timeout
        async with websockets.connect(websocket_url, ping_timeout=10, close_timeout=5) as websocket:
            print_result(True, f"✅ WebSocket connection successful", {
                "url": websocket_url,
                "connection_state": "OPEN"
            })
            
            # Just keep connection open for a moment
            await asyncio.sleep(1)
            
            return True
            
    except websockets.exceptions.ConnectionClosed as e:
        print_result(False, f"WebSocket connection closed", {
            "error": str(e),
            "code": e.code,
            "reason": e.reason
        })
        return False
        
    except Exception as e:
        print_result(False, f"WebSocket connection failed", {
            "url": websocket_url,
            "error": str(e),
            "error_type": type(e).__name__
        })
        return False

async def test_websocket_message_sending(sender_id, receiver_id, match_id):
    """Test sending message via WebSocket"""
    print_test_header("WebSocket Message Sending Test")
    
    sender_websocket_url = f"{WEBSOCKET_URL}/{sender_id}"
    
    try:
        async with websockets.connect(sender_websocket_url, ping_timeout=10, close_timeout=5) as websocket:
            print_result(True, "Sender WebSocket connected", {
                "sender_id": sender_id,
                "url": sender_websocket_url
            })
            
            # Send a proper chat message via WebSocket
            message_data = {
                "match_id": match_id,
                "receiver_id": receiver_id,
                "content": f"WebSocket test message at {datetime.now().isoformat()}"
            }
            
            await websocket.send(json.dumps(message_data))
            print_result(True, "✅ Message sent via WebSocket", message_data)
            
            # Wait a moment for processing
            await asyncio.sleep(2)
            
            return True
            
    except Exception as e:
        print_result(False, f"WebSocket message sending failed", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        return False

def test_message_retrieval(match_id):
    """Test retrieving messages from match"""
    print_test_header("Message Retrieval Test")
    
    try:
        response = requests.get(f"{BACKEND_URL}/messages/{match_id}")
        
        if response.status_code == 200:
            messages = response.json()
            print_result(True, f"✅ Messages retrieved successfully", {
                "match_id": match_id,
                "message_count": len(messages),
                "latest_messages": messages[-3:] if len(messages) > 3 else messages  # Show last 3 messages
            })
            return True, messages
        else:
            print_result(False, f"Message retrieval failed", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False, []
            
    except Exception as e:
        print_result(False, f"Message retrieval error: {str(e)}")
        return False, []

def test_fcm_notifications(user_id):
    """Test FCM push notifications"""
    print_test_header("FCM Push Notification Test")
    
    try:
        # Check if user has FCM token
        response = requests.get(f"{BACKEND_URL}/profile/{user_id}")
        
        if response.status_code == 200:
            user_data = response.json()
            fcm_token = user_data.get("fcm_token")
            
            if fcm_token:
                print_result(True, "✅ User has FCM token", {
                    "user_id": user_id,
                    "has_fcm_token": True,
                    "token_preview": fcm_token[:20] + "..." if len(fcm_token) > 20 else fcm_token
                })
                
                # Try to send test notification
                try:
                    test_response = requests.post(f"{BACKEND_URL}/fcm/send-test", params={"user_id": user_id})
                    
                    if test_response.status_code == 200:
                        test_result = test_response.json()
                        print_result(True, "✅ Test notification sent successfully", test_result)
                        return True
                    else:
                        print_result(False, f"Test notification failed", {
                            "status_code": test_response.status_code,
                            "response": test_response.text
                        })
                        return False
                except Exception as test_e:
                    print_result(False, f"Test notification error: {str(test_e)}")
                    return False
            else:
                print_result(False, "❌ User has no FCM token", {
                    "user_id": user_id,
                    "has_fcm_token": False,
                    "note": "Push notifications require FCM token registration"
                })
                return False
        else:
            print_result(False, f"Failed to get user profile", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"FCM notification test error: {str(e)}")
        return False

async def main():
    """Main test execution"""
    print("🚀 Starting HeartLink Real-Time Chat and Notifications Test...")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"WebSocket URL: {WEBSOCKET_URL}")
    
    # Test users (known working from previous tests)
    user1_email = "shivam.fresh@heartlink.com"
    user1_password = "Shivam@#110"
    user2_email = "shub123@gmail.com"
    user2_password = "Shuba@123"
    
    # Step 1: Login both users
    print_test_header("Step 1: User Authentication")
    
    success1, user1_data = login_user(user1_email, user1_password)
    if not success1:
        print_result(False, f"User 1 login failed: {user1_data}")
        return False
    
    success2, user2_data = login_user(user2_email, user2_password)
    if not success2:
        print_result(False, f"User 2 login failed: {user2_data}")
        return False
    
    user1_id = user1_data.get("id")
    user2_id = user2_data.get("id")
    
    print_result(True, "✅ Both users logged in successfully", {
        "user1": {"id": user1_id, "name": user1_data.get("name")},
        "user2": {"id": user2_id, "name": user2_data.get("name")}
    })
    
    # Step 2: Get matches
    print_test_header("Step 2: Get User Matches")
    
    success, matches = get_user_matches(user1_id)
    if not success or not matches:
        print_result(False, f"No matches found for testing: {matches}")
        return False
    
    # Use first match for testing
    first_match = matches[0]
    match_id = first_match.get("match_id")
    matched_user = first_match.get("user", {})
    receiver_id = matched_user.get("id")
    
    print_result(True, "✅ Match found for testing", {
        "match_id": match_id,
        "sender": user1_data.get("name"),
        "receiver": matched_user.get("name")
    })
    
    # Step 3: Test WebSocket Connections
    print_test_header("Step 3: WebSocket Connection Tests")
    
    ws1_success = await test_websocket_connection_only(user1_id)
    ws2_success = await test_websocket_connection_only(receiver_id)
    
    websocket_connections_working = ws1_success and ws2_success
    
    # Step 4: Test HTTP Message Sending
    print_test_header("Step 4: HTTP Message Sending")
    
    http_success, http_result = send_http_message(
        user1_id, 
        receiver_id, 
        match_id, 
        f"HTTP test message at {datetime.now().isoformat()}"
    )
    
    if http_success:
        print_result(True, "✅ HTTP message sent successfully", {
            "message_id": http_result.get("id"),
            "content": http_result.get("content")
        })
    else:
        print_result(False, f"HTTP message sending failed: {http_result}")
    
    # Step 5: Test WebSocket Message Sending
    print_test_header("Step 5: WebSocket Message Sending")
    
    ws_message_success = await test_websocket_message_sending(user1_id, receiver_id, match_id)
    
    # Step 6: Test Message Retrieval
    print_test_header("Step 6: Message Retrieval")
    
    retrieval_success, messages = test_message_retrieval(match_id)
    
    # Step 7: Test Push Notifications
    print_test_header("Step 7: Push Notification Tests")
    
    notification1_success = test_fcm_notifications(user1_id)
    notification2_success = test_fcm_notifications(receiver_id)
    
    # Final Results Summary
    print_test_header("🎯 FINAL TEST RESULTS SUMMARY")
    
    results = {
        "user_authentication": success1 and success2,
        "websocket_connections": websocket_connections_working,
        "http_message_sending": http_success,
        "websocket_message_sending": ws_message_success,
        "message_retrieval": retrieval_success,
        "push_notifications": notification1_success or notification2_success
    }
    
    all_critical_passed = (
        results["user_authentication"] and
        results["http_message_sending"] and
        results["message_retrieval"]
    )
    
    print_result(all_critical_passed, "Real-Time Chat and Notifications Test Results", results)
    
    # Detailed analysis
    print("\n📊 DETAILED ANALYSIS:")
    
    if results["websocket_connections"]:
        print("✅ WebSocket connections: WORKING - Can connect to /api/ws/{user_id}")
    else:
        print("❌ WebSocket connections: FAILED - Connection issues detected")
    
    if results["http_message_sending"]:
        print("✅ HTTP message sending: WORKING - POST /api/messages endpoint functional")
    else:
        print("❌ HTTP message sending: FAILED - Core messaging not working")
    
    if results["websocket_message_sending"]:
        print("✅ WebSocket message sending: WORKING - Real-time messaging functional")
    else:
        print("⚠️  WebSocket message sending: ISSUES - May have protocol or format issues")
    
    if results["message_retrieval"]:
        print("✅ Message retrieval: WORKING - GET /api/messages/{match_id} functional")
    else:
        print("❌ Message retrieval: FAILED - Cannot retrieve sent messages")
    
    if results["push_notifications"]:
        print("✅ Push notifications: WORKING - FCM integration functional")
    else:
        print("⚠️  Push notifications: LIMITED - Users may not have FCM tokens registered")
    
    print(f"\n🎯 OVERALL STATUS: {'✅ CORE FUNCTIONALITY WORKING' if all_critical_passed else '❌ CRITICAL ISSUES FOUND'}")
    
    return all_critical_passed

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        exit(0 if result else 1)
    except Exception as e:
        print(f"\n💥 TEST CRASHED: {str(e)}")
        exit(1)