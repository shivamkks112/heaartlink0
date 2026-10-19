# AI Chat Style admin tab: prompts overrides, personas editing, LLM preview
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
KEYS = ["ai_template", "flirty_fun", "sweet_caring", "witty_smart", "neutral_real",
        "stealth_template", "custom_persona_template"]


@pytest.fixture(scope="module")
def s():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email_or_phone": "shivamkks112@gmail.com", "password": "Shivam@2026"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text[:200]}")
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    yield sess
    # reset all prompts
    sess.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {k: "" for k in KEYS}})


@pytest.fixture(scope="module")
def persona(s):
    lst = s.get(f"{BASE_URL}/api/admin/ai-personas").json()
    p = lst[0]
    orig = {k: p.get(k) for k in ("ai_personality", "bio", "persona_context")}
    yield p
    body = {"ai_personality": orig["ai_personality"] or "sweet_caring", "bio": orig["bio"] or "",
            "persona_context": orig["persona_context"] or ""}
    r = s.put(f"{BASE_URL}/api/admin/ai-personas/{p['id']}", json=body)
    print("restore persona", r.status_code)


# Prompts GET
def test_get_prompts_unauth():
    assert requests.get(f"{BASE_URL}/api/admin/ai-prompts").status_code in (401, 403)


def test_get_prompts(s):
    r = s.get(f"{BASE_URL}/api/admin/ai-prompts")
    assert r.status_code == 200
    d = r.json()
    for k in KEYS:
        assert k in d["labels"] and k in d["defaults"] and len(d["defaults"][k]) > 20
    assert "name" in d["placeholders"]["ai_template"]
    assert isinstance(d["overrides"], dict)


# Prompts PUT
def test_put_override_and_reset(s):
    r = s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"witty_smart": "TEST_ witty override"}})
    assert r.status_code == 200 and r.json()["overrides"]["witty_smart"] == "TEST_ witty override"
    assert s.get(f"{BASE_URL}/api/admin/ai-prompts").json()["overrides"]["witty_smart"] == "TEST_ witty override"
    r = s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"witty_smart": ""}})
    assert r.status_code == 200 and "witty_smart" not in r.json()["overrides"]
    assert "witty_smart" not in s.get(f"{BASE_URL}/api/admin/ai-prompts").json()["overrides"]


def test_put_unknown_key(s):
    r = s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"bogus": "x"}})
    assert r.status_code == 400


def test_put_broken_braces(s):
    for bad in ["Tu {name hai", "Tu name} hai", "{0} hai", "{age:zz}"]:
        r = s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"ai_template": bad}})
        assert r.status_code == 400, f"{bad} -> {r.status_code}"
    assert "ai_template" not in s.get(f"{BASE_URL}/api/admin/ai-prompts").json()["overrides"]


def test_put_unknown_placeholder_allowed(s):
    r = s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"stealth_template": "Tu {name} {foo} hai"}})
    assert r.status_code == 200
    assert r.json()["overrides"]["stealth_template"] == "Tu {name} {foo} hai"
    s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"stealth_template": ""}})


def test_put_too_long(s):
    r = s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"flirty_fun": "a" * 20001}})
    assert r.status_code == 400


def test_put_unauth():
    assert requests.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {}}).status_code in (401, 403)


# Personas
def test_list_personas(s):
    r = s.get(f"{BASE_URL}/api/admin/ai-personas")
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) > 0 and "id" in lst[0] and "name" in lst[0]
    assert all("_id" not in p and "password_hash" not in p for p in lst)


def test_update_persona_validation(s, persona):
    pid = persona["id"]
    assert s.put(f"{BASE_URL}/api/admin/ai-personas/{pid}", json={"ai_personality": "evil"}).status_code == 400
    assert s.put(f"{BASE_URL}/api/admin/ai-personas/{pid}", json={"persona_context": "a" * 4001}).status_code == 400
    assert s.put(f"{BASE_URL}/api/admin/ai-personas/{pid}", json={"bio": "a" * 501}).status_code == 400
    assert s.put(f"{BASE_URL}/api/admin/ai-personas/{pid}", json={}).status_code == 400
    assert s.put(f"{BASE_URL}/api/admin/ai-personas/nonexistent-id", json={"bio": "x"}).status_code == 404
    # real non-AI user id
    assert s.put(f"{BASE_URL}/api/admin/ai-personas/89a6e3b5-f911-4246-b5a6-9e6dbf9dc22c",
                 json={"bio": "x"}).status_code == 404


def test_update_persona_persist(s, persona):
    pid = persona["id"]
    r = s.put(f"{BASE_URL}/api/admin/ai-personas/{pid}",
              json={"ai_personality": "witty_smart", "persona_context": "Tu Indore se hai aur chai bahut pasand hai"})
    assert r.status_code == 200
    p = next(x for x in s.get(f"{BASE_URL}/api/admin/ai-personas").json() if x["id"] == pid)
    assert p["ai_personality"] == "witty_smart"
    assert p["persona_context"] == "Tu Indore se hai aur chai bahut pasand hai"


# Preview (LLM) — 2 calls
def test_preview_validation(s, persona):
    assert s.post(f"{BASE_URL}/api/admin/ai-prompts/preview", json={"profile_id": "nope", "message": "hi"}).status_code == 404
    assert s.post(f"{BASE_URL}/api/admin/ai-prompts/preview", json={"profile_id": persona["id"], "message": "  "}).status_code == 400


def test_preview_uses_context(s, persona):
    s.put(f"{BASE_URL}/api/admin/ai-personas/{persona['id']}",
          json={"persona_context": "Tu Indore se hai aur chai bahut pasand hai"})
    r = s.post(f"{BASE_URL}/api/admin/ai-prompts/preview",
               json={"profile_id": persona["id"], "message": "kahan se ho aap?"}, timeout=90)
    assert r.status_code == 200
    reply = r.json()["reply"]
    print("REPLY1:", reply)
    assert "indore" in reply.lower()


def test_preview_personality_override_immediate(s, persona):
    s.put(f"{BASE_URL}/api/admin/ai-personas/{persona['id']}", json={"ai_personality": "witty_smart", "persona_context": ""})
    r = s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {
        "witty_smart": "IMPORTANT RULE: Har reply ke end mein exactly ye word likho: BANANA42. Kabhi mat bhoolna."}})
    assert r.status_code == 200
    r = s.post(f"{BASE_URL}/api/admin/ai-prompts/preview",
               json={"profile_id": persona["id"], "message": "hi kya kar rahi ho"}, timeout=90)
    assert r.status_code == 200
    reply = r.json()["reply"]
    print("REPLY2:", reply)
    s.put(f"{BASE_URL}/api/admin/ai-prompts", json={"prompts": {"witty_smart": ""}})
    assert "banana42" in reply.lower()
