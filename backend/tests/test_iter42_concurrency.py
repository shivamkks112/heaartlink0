# Iteration 42: concurrency check of extra_swipes daily cap (5) and like reveal cap (3) — TOCTOU race detection
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import requests
from test_iter42_swipes_reveal import API, mk_user, mk_like, cleanup  # noqa: F401
from test_iter42_swipes_reveal import db


def test_parallel_extra_swipes_cap():
    uid = mk_user()
    body = {"user_id": uid, "reward_type": "extra_swipes", "amount": 10, "timestamp": datetime.now(timezone.utc).isoformat()}
    with ThreadPoolExecutor(15) as ex:
        codes = list(ex.map(lambda _: requests.post(f"{API}/ads/reward", json=body).status_code, range(15)))
    ok = codes.count(200)
    extra = db.users.find_one({"id": uid})["extra_swipes"]
    print("200s:", ok, "extra:", extra)
    assert ok <= 5, f"cap bypassed: {ok} successes"
    assert extra == ok * 10, f"lost update: extra={extra} for {ok} rewards"


def test_parallel_reveal_cap():
    uid = mk_user()
    likers = [mk_user(gender="Female") for _ in range(8)]
    for lk in likers:
        mk_like(lk, uid)
    with ThreadPoolExecutor(8) as ex:
        codes = list(ex.map(lambda lk: requests.post(f"{API}/likes/{uid}/reveal", json={"liker_id": lk}).status_code, likers))
    print("codes:", codes)
    assert codes.count(200) <= 3
