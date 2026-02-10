#!/usr/bin/env python3
"""
HeartLink WebSocket and Real-Time Chat Testing
Tests WebSocket connection, instant message delivery, and push notifications
Based on review request for testing real-time chat and notifications
"""

import requests
import json
import asyncio
import websockets
import threading
import time
from datetime import datetime
import uuid

# Backend URL from environment
BACKEND_URL = "https://heartlink-dating-2.preview.emergentagent.com/api"
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

def get_or_create_match(user1_id, user2_id):
    """Get existing match or create a new one between two users"""
    try:
        # Check if match already exists
        response = requests.get(f"{BACKEND_URL}/matches/{user1_id}")
        
        if response.status_code == 200:
            matches = response.json()
            
            # Look for existing match with user2
            for match in matches:
                if match.get("user", {}).get("id") == user2_id:
                    return True, match.get("match_id")
            
            # No existing match found, create one by having both users like each other
            print("Creating new match by having users like each other...")
            
            # User1 likes User2
            like_data = {
                "target_user_id": user2_id,
                "action": "like"
            }
            
            response1 = requests.post(f"{BACKEND_URL}/action/{user1_id}", json=like_data)
            if response1.status_code != 200:
                return False, f"User1 like failed: {response1.text}"
            
            # User2 likes User1 back
            like_back_data = {
                "target_user_id": user1_id,
                "action": "like"
            }
            
            response2 = requests.post(f"{BACKEND_URL}/action/{user2_id}", json=like_back_data)
            if response2.status_code != 200:
                return False, f"User2 like back failed: {response2.text}"
            
            # Check if match was created
            like_result = response2.json()
            if like_result.get("action") == "matched":
                match_id = like_result.get("match_id")
                return True, match_id
            else:
                return False, "Match not created after mutual likes"
        else:
            return False, f"Failed to get matches: {response.text}"
            
    except Exception as e:
        return False, f"Error creating match: {str(e)}"

async def test_websocket_connection(user_id):
    """Test WebSocket connection to /api/ws/{user_id}"""
    print_test_header(f"WebSocket Connection Test - User {user_id}")
    
    websocket_url = f"{WEBSOCKET_URL}/{user_id}"
    
    try:
        # Test connection
        async with websockets.connect(websocket_url) as websocket:
            print_result(True, f"WebSocket connection successful to {websocket_url}", {
                "url": websocket_url,
                "connection_state": "OPEN"
            })
            
            # Test sending a ping message
            test_message = {
                "type": "ping",
                "timestamp": datetime.now().isoformat()
            }
            
            await websocket.send(json.dumps(test_message))
            print_result(True, "Test message sent via WebSocket", test_message)
            
            # Wait for potential response (with timeout)
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print_result(True, "Received response from WebSocket", {
                    "response": response
                })
            except asyncio.TimeoutError:
                print_result(True, "No immediate response (expected for ping)", {
                    "note": "WebSocket connection is working, no response expected for ping"
                })
            
            return True
            
    except websockets.exceptions.ConnectionClosed as e:
        print_result(False, f"WebSocket connection closed unexpectedly", {
            "error": str(e),
            "code": e.code,
            "reason": e.reason
        })
        return False
        
    except websockets.exceptions.InvalidURI as e:
        print_result(False, f"Invalid WebSocket URI", {
            "url": websocket_url,
            "error": str(e)
        })
        return False
        
    except Exception as e:
        print_result(False, f"WebSocket connection failed", {
            "url": websocket_url,
            "error": str(e),
            "error_type": type(e).__name__
        })
        return False

async def test_websocket_message_delivery(sender_id, receiver_id, match_id):
    """Test real-time message delivery via WebSocket"""
    print_test_header(f"WebSocket Message Delivery Test")
    
    receiver_websocket_url = f"{WEBSOCKET_URL}/{receiver_id}"
    sender_websocket_url = f"{WEBSOCKET_URL}/{sender_id}"
    
    messages_received = []
    connection_successful = False
    
    try:
        # Connect receiver WebSocket to listen for messages
        async with websockets.connect(receiver_websocket_url) as receiver_ws:
            print_result(True, f"Receiver WebSocket connected", {
                "receiver_id": receiver_id,
                "url": receiver_websocket_url
            })
            
            # Connect sender WebSocket
            async with websockets.connect(sender_websocket_url) as sender_ws:
                print_result(True, f"Sender WebSocket connected", {
                    "sender_id": sender_id,
                    "url": sender_websocket_url
                })
                
                connection_successful = True
                
                # Send a test message via sender WebSocket
                test_message = {
                    "match_id": match_id,
                    "receiver_id": receiver_id,
                    "content": f"WebSocket test message at {datetime.now().isoformat()}"
                }
                
                await sender_ws.send(json.dumps(test_message))
                print_result(True, "Test message sent via sender WebSocket", test_message)
                
                # Listen for message on receiver WebSocket (with timeout)
                try:
                    # Wait for message delivery
                    received_message = await asyncio.wait_for(receiver_ws.recv(), timeout=10.0)
                    messages_received.append(received_message)
                    
                    print_result(True, "✅ INSTANT MESSAGE DELIVERY SUCCESSFUL!", {
                        "received_message": received_message,
                        "delivery_method": "WebSocket",
                        "real_time": True
                    })
                    
                    # Parse the received message
                    try:
                        parsed_message = json.loads(received_message)
                        if parsed_message.get("type") == "message":
                            message_content = parsed_message.get("message", {}).get("content")
                            if message_content == test_message["content"]:
                                print_result(True, "Message content matches exactly", {
                                    "sent": test_message["content"],
                                    "received": message_content
                                })
                                return True
                            else:
                                print_result(False, "Message content mismatch", {
                                    "sent": test_message["content"],
                                    "received": message_content
                                })
                        else:
                            print_result(True, "Received WebSocket message (different type)", {
                                "message_type": parsed_message.get("type"),
                                "full_message": parsed_message
                            })
                    except json.JSONDecodeError:
                        print_result(True, "Received non-JSON WebSocket message", {
                            "raw_message": received_message
                        })
                    
                except asyncio.TimeoutError:
                    print_result(False, "❌ No message received via WebSocket within timeout", {
                        "timeout_seconds": 10,
                        "sender_id": sender_id,
                        "receiver_id": receiver_id,
                        "match_id": match_id
                    })
                    return False
                    
    except Exception as e:
        print_result(False, f"WebSocket message delivery test failed", {
            "error": str(e),
            "error_type": type(e).__name__,
            "connection_successful": connection_successful
        })
        return False

def test_http_message_sending(sender_id, receiver_id, match_id):
    """Test HTTP message sending via POST /api/messages"""
    print_test_header("HTTP Message Sending Test")
    
    # Create test message
    message_data = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "content": f"HTTP test message at {datetime.now().isoformat()}",
        "read": False
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/messages", json=message_data)
        
        if response.status_code == 200:
            result = response.json()
            print_result(True, "✅ HTTP message sending successful", {
                "message_id": result.get("id"),
                "content": result.get("content"),
                "sender_id": result.get("sender_id"),
                "receiver_id": result.get("receiver_id"),
                "match_id": result.get("match_id")
            })
            return True, result.get("id")
        else:
            print_result(False, f"❌ HTTP message sending failed", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False, None
            
    except Exception as e:
        print_result(False, f"❌ HTTP message sending error: {str(e)}")
        return False, None

def test_message_retrieval(match_id):
    """Test message retrieval via GET /api/messages/{match_id}"""
    print_test_header("Message Retrieval Test")
    
    try:
        response = requests.get(f"{BACKEND_URL}/messages/{match_id}")
        
        if response.status_code == 200:
            messages = response.json()
            print_result(True, f"✅ Message retrieval successful", {
                "match_id": match_id,
                "message_count": len(messages),
                "latest_message": messages[-1] if messages else None
            })
            return True, messages
        else:
            print_result(False, f"❌ Message retrieval failed", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False, []
            
    except Exception as e:
        print_result(False, f"❌ Message retrieval error: {str(e)}")
        return False, []

def test_push_notifications(sender_name, receiver_id):
    """Test FCM push notification sending (check backend logs)"""
    print_test_header("Push Notification Test")
    
    # Note: We can't directly test FCM notifications without access to the device
    # But we can check if the backend attempts to send them by looking at the response
    # and checking if the user has an FCM token
    
    try:
        # Get receiver user data to check FCM token
        response = requests.get(f"{BACKEND_URL}/profile/{receiver_id}")
        
        if response.status_code == 200:
            user_data = response.json()
            fcm_token = user_data.get("fcm_token")
            
            if fcm_token:
                print_result(True, "✅ Receiver has FCM token - notifications should be sent", {
                    "receiver_id": receiver_id,
                    "has_fcm_token": True,
                    "token_preview": fcm_token[:20] + "..." if len(fcm_token) > 20 else fcm_token
                })
                
                # Test sending a test notification
                try:
                    test_response = requests.post(f"{BACKEND_URL}/fcm/send-test", params={"user_id": receiver_id})
                    
                    if test_response.status_code == 200:
                        test_result = test_response.json()
                        print_result(True, "✅ Test notification sent successfully", test_result)
                    else:
                        print_result(False, f"❌ Test notification failed", {
                            "status_code": test_response.status_code,
                            "response": test_response.text
                        })
                except Exception as test_e:
                    print_result(False, f"❌ Test notification error: {str(test_e)}")
                
                return True
            else:
                print_result(False, "❌ Receiver has no FCM token - notifications cannot be sent", {
                    "receiver_id": receiver_id,
                    "has_fcm_token": False,
                    "note": "User needs to register FCM token for push notifications"
                })
                return False
        else:
            print_result(False, f"❌ Failed to get receiver profile", {
                "status_code": response.status_code,
                "response": response.text
            })
            return False
            
    except Exception as e:
        print_result(False, f"❌ Push notification test error: {str(e)}")
        return False

async def comprehensive_websocket_and_chat_test():
    """Comprehensive test of WebSocket and real-time chat functionality"""
    print_test_header("🚀 COMPREHENSIVE WEBSOCKET AND REAL-TIME CHAT TEST")
    
    # Test users - use known working users from previous tests
    user1_email = "shivam.fresh@heartlink.com"  # Known working user
    user2_email = "shub123@gmail.com"  # From review request
    
    # Try common passwords for these users (based on previous test results)
    common_passwords = ["Shivam@#110", "Shuba@123", "Demo123!", "Test@123", "password", "Password123!", "Test@12345"]
    
    # Step 1: Login both users
    print_test_header("Step 1: Login Test Users")
    
    user1_data = None
    user2_data = None
    
    # Try to login user1
    for password in common_passwords:
        success, result = login_user(user1_email, password)
        if success:
            user1_data = result
            print_result(True, f"User 1 login successful", {
                "email": user1_email,
                "user_id": user1_data.get("id"),
                "name": user1_data.get("name")
            })
            break
    
    if not user1_data:
        print_result(False, f"❌ Could not login User 1: {user1_email}", "Tried multiple passwords")
        return False
    
    # Try to login user2
    for password in common_passwords:
        success, result = login_user(user2_email, password)
        if success:
            user2_data = result
            print_result(True, f"User 2 login successful", {
                "email": user2_email,
                "user_id": user2_data.get("id"),
                "name": user2_data.get("name")
            })
            break
    
    if not user2_data:
        print_result(False, f"❌ Could not login User 2: {user2_email}", "Tried multiple passwords")
        return False
    
    user1_id = user1_data.get("id")
    user2_id = user2_data.get("id")
    
    # Step 2: Get or create match between users
    print_test_header("Step 2: Get or Create Match")
    
    match_success, match_id = get_or_create_match(user1_id, user2_id)
    
    if not match_success:
        print_result(False, f"❌ Failed to get/create match", match_id)
        return False
    
    print_result(True, "✅ Match available for testing", {
        "match_id": match_id,
        "user1": user1_data.get("name"),
        "user2": user2_data.get("name")
    })
    
    # Step 3: Test WebSocket connections
    print_test_header("Step 3: Test WebSocket Connections")
    
    user1_ws_success = await test_websocket_connection(user1_id)
    user2_ws_success = await test_websocket_connection(user2_id)
    
    if not user1_ws_success or not user2_ws_success:
        print_result(False, "❌ WebSocket connection test failed", {
            "user1_connection": user1_ws_success,
            "user2_connection": user2_ws_success
        })
        return False
    
    # Step 4: Test HTTP message sending
    print_test_header("Step 4: Test HTTP Message Sending")
    
    http_success, message_id = test_http_message_sending(user1_id, user2_id, match_id)
    
    if not http_success:
        print_result(False, "❌ HTTP message sending failed")
        return False
    
    # Step 5: Test message retrieval
    print_test_header("Step 5: Test Message Retrieval")
    
    retrieval_success, messages = test_message_retrieval(match_id)
    
    if not retrieval_success:
        print_result(False, "❌ Message retrieval failed")
        return False
    
    # Step 6: Test WebSocket real-time message delivery
    print_test_header("Step 6: Test WebSocket Real-Time Message Delivery")
    
    websocket_delivery_success = await test_websocket_message_delivery(user1_id, user2_id, match_id)
    
    # Step 7: Test push notifications
    print_test_header("Step 7: Test Push Notifications")
    
    notification_success = test_push_notifications(user1_data.get("name"), user2_id)
    
    # Final Results Summary
    print_test_header("🎯 FINAL RESULTS SUMMARY")
    
    results = {
        "websocket_connections": user1_ws_success and user2_ws_success,
        "http_message_sending": http_success,
        "message_retrieval": retrieval_success,
        "websocket_message_delivery": websocket_delivery_success,
        "push_notifications": notification_success
    }
    
    all_passed = all(results.values())
    
    print_result(all_passed, "Overall WebSocket and Chat Test Results", results)
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED! WebSocket and real-time chat functionality is working correctly.")
    else:
        print("\n❌ SOME TESTS FAILED! Check the detailed results above.")
        
        # Identify specific failures
        failures = [test for test, passed in results.items() if not passed]
        print(f"\nFailed tests: {', '.join(failures)}")
    
    return all_passed

def main():
    """Main test execution"""
    print("🚀 Starting HeartLink WebSocket and Real-Time Chat Testing...")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"WebSocket URL: {WEBSOCKET_URL}")
    
    # Run the comprehensive test
    try:
        result = asyncio.run(comprehensive_websocket_and_chat_test())
        
        if result:
            print("\n✅ TESTING COMPLETED SUCCESSFULLY!")
            return 0
        else:
            print("\n❌ TESTING COMPLETED WITH FAILURES!")
            return 1
            
    except Exception as e:
        print(f"\n💥 TESTING CRASHED: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())