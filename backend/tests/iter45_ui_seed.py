# Iter45 UI seed/cleanup: python iter45_ui_seed.py create|cleanup
import sys, uuid
from datetime import datetime, timezone, timedelta
sys.path.insert(0, "/app/backend/tests")
from test_iter45_ads_ai_limit_crush import _mk_user, _cleanup, mdb, ist_day

TAG = "iter45ui"
if sys.argv[1] == "create":
    _cleanup([x["id"] for x in mdb.users.find({"test_tag": TAG}, {"id": 1})])
    free = _mk_user("UIFree45", "male", False, test_tag=TAG, email="test_iter45ui_free@example.com",
                    ai_msg_day=ist_day(), ai_msg_count=30, ai_msg_extra=0, profile_completed=True)
    ais = list(mdb.users.find({"is_ai_profile": True, "gender": "female"}, {"id": 1, "name": 1}).limit(3))
    now = datetime.now(timezone.utc)
    mid = str(uuid.uuid4())
    mdb.matches.insert_one({"id": mid, "user1_id": free, "user2_id": ais[0]["id"], "matched": True, "user1_liked": True,
                            "user2_liked": True, "created_at": now.isoformat(), "matched_at": now.isoformat(), "test_tag": TAG})
    for i, a in enumerate(ais):
        mdb.crushes.insert_one({"id": f"TEST_{TAG}_{i}", "crusher_id": a["id"], "crushed_id": free,
                                "created_at": (now - timedelta(minutes=10 - i)).isoformat(), "revealed": False, "test_tag": TAG})
    print("FREE", free, "MATCH", mid, "AI", ais[0]["id"], [a["name"] for a in ais])
else:
    ids = [x["id"] for x in mdb.users.find({"test_tag": TAG}, {"id": 1})]
    _cleanup(ids)
    print("cleaned", ids)
