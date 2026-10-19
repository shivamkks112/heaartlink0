# Iter44 UI seed/cleanup: python iter44_ui_seed.py create|cleanup
import sys, uuid
from datetime import datetime, timezone, timedelta
sys.path.insert(0, "/app/backend/tests")
from test_iter44_paid_views_crush import _mk_user, _cleanup, mdb

TAG = "iter44ui"
if sys.argv[1] == "create":
    _cleanup([x["id"] for x in mdb.users.find({"test_tag": TAG}, {"id": 1})])
    free = _mk_user("UIFree", "male", False, test_tag=TAG, email="test_iter44ui_free@example.com")
    prem = _mk_user("UIPrem", "male", True, test_tag=TAG, email="test_iter44ui_prem@example.com",
                    premium_expires_at=(datetime.now(timezone.utc) + timedelta(days=30)).isoformat())
    ais = list(mdb.users.find({"is_ai_profile": True, "gender": "female"}, {"id": 1, "name": 1}).limit(3))
    now = datetime.now(timezone.utc)
    for owner in (free, prem):
        for i, a in enumerate(ais):
            mdb.profile_views.insert_one({"viewed_user_id": owner, "profile_id": owner, "viewer_id": a["id"],
                                          "viewed_at": (now - timedelta(minutes=10 * i)).isoformat(), "test_tag": TAG})
        mdb.crushes.insert_one({"id": str(uuid.uuid4()), "crusher_id": ais[0]["id"], "crushed_id": owner,
                                "created_at": now.isoformat(), "revealed": False})
    print("FREE", free, "PREM", prem, "AIS", [a["name"] for a in ais])
else:
    ids = [x["id"] for x in mdb.users.find({"test_tag": TAG}, {"id": 1})]
    _cleanup(ids)
    print("cleaned", ids)
