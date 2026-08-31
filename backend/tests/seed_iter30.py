"""Seed a mutual match + messages between admin and review accounts for chat-filter UI testing."""
import os
import time
import requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
ADMIN_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
REVIEW_ID = "cca39b3f-9f7e-485d-9ae3-d6b210d424fb"

s = requests.Session()

# mutual like
for actor, target in [(ADMIN_ID, REVIEW_ID), (REVIEW_ID, ADMIN_ID)]:
    r = s.post(f"{BASE_URL}/api/action/{actor}", json={"target_user_id": target, "action": "like"}, timeout=60)
    print("action", actor[:8], r.status_code, r.text[:200])

matches = s.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30).json()
print("admin matches:", len(matches))
if not matches:
    raise SystemExit("no matches created")
match_id = matches[0]["match_id"]
other = matches[0].get("user", {}).get("id") or REVIEW_ID
print("match_id", match_id, "other", other)

for i, (sender, receiver) in enumerate([(other, ADMIN_ID), (ADMIN_ID, other), (other, ADMIN_ID)]):
    r = s.post(f"{BASE_URL}/api/messages", json={
        "match_id": match_id, "sender_id": sender, "receiver_id": receiver,
        "content": f"TEST_seed message {i+1}"
    }, timeout=60)
    print("msg", i, r.status_code, r.text[:200])
    time.sleep(1)

print("last:", s.get(f"{BASE_URL}/api/messages/{match_id}/last", timeout=30).text[:200])
print("unread:", s.get(f"{BASE_URL}/api/messages/{match_id}/unread-count/{ADMIN_ID}", timeout=30).text[:200])
