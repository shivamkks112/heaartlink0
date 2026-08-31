"""Seed a second conversation for admin so chat filter ordering can be verified in UI."""
import os, time, requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
ADMIN_ID = "89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c"
s = requests.Session()

disc = s.get(f"{BASE_URL}/api/discover/{ADMIN_ID}", timeout=60)
print("discover", disc.status_code)
users = disc.json() if disc.status_code == 200 else []
if isinstance(users, dict):
    users = users.get("users", [])
print("candidates", len(users))
target = None
for u in users:
    if u.get("id") and u.get("is_ai_profile"):
        target = u
        break
if not target and users:
    target = users[0]
if not target:
    raise SystemExit("no discover candidates")
print("target", target["id"], target.get("name"))

r = s.post(f"{BASE_URL}/api/action/{ADMIN_ID}", json={"target_user_id": target["id"], "action": "like"}, timeout=90)
print("action", r.status_code, r.text[:200])
match_id = None
try:
    match_id = r.json().get("match_id")
except Exception:
    pass
if not match_id:
    ms = s.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30).json()
    for m in ms:
        if m.get("user", {}).get("id") == target["id"]:
            match_id = m["match_id"]
print("match_id", match_id)
if match_id:
    r2 = s.post(f"{BASE_URL}/api/messages", json={
        "match_id": match_id, "sender_id": ADMIN_ID, "receiver_id": target["id"],
        "content": "TEST_seed second conversation"}, timeout=90)
    print("msg", r2.status_code, r2.text[:200])
print("matches now:", len(s.get(f"{BASE_URL}/api/matches/{ADMIN_ID}", timeout=30).json()))
