"""Comprehensive smoke test for all RF-SOR API endpoints — based on actual route definitions."""
import json
import uuid
import requests

BASE = "http://localhost:8000"
RESULTS = []
cleanup_users = []
cleanup_equip = []
cleanup_obs = []
cleanup_regions = []
obs_id = None

def j(obj):
    if isinstance(obj, (dict, list)):
        return json.dumps(obj)[:120]
    return str(obj)[:120]

def test(name, status_code, expected_ok=True, detail=""):
    RESULTS.append((name, status_code, expected_ok, str(detail)[:120]))
    icon = "✅" if expected_ok else "❌"
    print(f"  {icon} {name} \u2192 {status_code}  {str(detail)[:80]}")
    return expected_ok

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

section("1. BASE HEALTH")

r = requests.get(f"{BASE}/health")
test("GET /health", r.status_code, r.status_code == 200, j(r.json()))

r = requests.get(f"{BASE}/api/health/db-check")
test("GET /api/health/db-check", r.status_code, r.status_code == 200, j(r.json()))

r = requests.get(f"{BASE}/docs")
test("GET /docs", r.status_code, r.status_code == 200, "Swagger OK")

r = requests.get(f"{BASE}/redoc")
test("GET /redoc", r.status_code, r.status_code == 200, "Redoc OK")

r = requests.get(f"{BASE}/api/health/health")
test("GET /api/health/health (router)", r.status_code, r.status_code in (200,), j(r.json()))

r = requests.get(f"{BASE}/api/health/db-check")
test("GET /api/health/db-check (router)", r.status_code, r.status_code in (200,), j(r.json()))

print("\n  --- Swagger route discovery ---")
docs = requests.get(f"{BASE}/openapi.json").json()
paths = list(docs.get("paths", {}).keys())
print(f"  Total API paths defined: {len(paths)}")
for p in sorted(paths):
    methods = ", ".join(k.upper() for k in docs["paths"][p].keys())
    print(f"    {p:45s}  {methods}")

section("2. AUTH ENDPOINTS (prefix: /api/auth)")

# POST /api/auth/register — Create a unique test user for auth tests
test_user_email = f"regtest_{uuid.uuid4().hex}@test.com"
r = requests.post(f"{BASE}/api/auth/register", json={
    "username": f"regtest_{uuid.uuid4().hex[:6]}",
    "email": test_user_email,
    "password": "TestPass123!",
    "role": "VIEWER"
})
reg_status = r.status_code
test("POST /api/auth/register", reg_status, reg_status in (200, 201), j(r.json()) if reg_status in (200, 201) else r.text[:120])

# POST /api/auth/login — Use the test user we just created (root doesn't exist in default DB)
login_user = f"login_test_{uuid.uuid4().hex[:6]}"
r = requests.post(f"{BASE}/api/auth/register", json={
    "username": login_user,
    "email": f"{login_user}@test.com",
    "password": "TestPass123!",
    "role": "TECHNICIAN"
})
test("POST /api/auth/register (login user)", r.status_code, r.status_code in (200, 201, 409), j(r.json()) if r.status_code in (200, 201, 409) else r.text[:120])

# Now login with that user
r = requests.post(f"{BASE}/api/auth/login", json={
    "username": login_user,
    "password": "TestPass123!"
})
login_ok = r.status_code == 200
token = r.json().get("access_token", "") if login_ok else ""
test("POST /api/auth/login", r.status_code, login_ok, j(r.json()) if r.status_code == 200 else r.text[:120])

# Login with wrong creds
r = requests.post(f"{BASE}/api/auth/login", json={
    "username": "root",
    "password": "wrongpassword"
})
test("POST /api/auth/login (wrong creds)", r.status_code, r.status_code == 401, j(r.json()) if r.status_code == 401 else r.text[:80])

# GET /api/auth/me (with token)
if token:
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE}/api/auth/me", headers=headers)
    test("GET /api/auth/me", r.status_code, r.status_code == 200, j(r.json()))
else:
    test("GET /api/auth/me", "N/A", False, "No token")

# GET /api/auth/me (without token)
r = requests.get(f"{BASE}/api/auth/me")
test("GET /api/auth/me (no auth)", r.status_code, r.status_code in (401, 422), j(r.json()) if r.status_code != 200 else "Should NOT be 200")

# GET /api/auth/roles
r = requests.get(f"{BASE}/api/auth/roles")
test("GET /api/auth/roles", r.status_code, r.status_code == 200, j(r.json()))

# GET /api/auth/logout — TEST: does it exist?
r = requests.post(f"{BASE}/api/auth/logout")
test("POST /api/auth/logout", r.status_code, r.status_code in (200, 500, 405), "May not exist")

section("3. USERS ENDPOINTS (prefix: /api/users)")

# GET /
r = requests.get(f"{BASE}/api/users")
users_before = r.json() if r.status_code == 200 else []
test("GET /api/users", r.status_code, r.status_code == 200, f"{len(users_before)} users")

# POST /
uid = uuid.uuid4().hex[:6]
u = {
    "username": f"u_{uid}",
    "email": f"u_{uid}@test.com",
    "password": "TestPass123!",
    "role": "TECHNICIAN"
}
r = requests.post(f"{BASE}/api/users", json=u)
user_resp = r.json() if r.status_code == 201 else {}
test("POST /api/users", r.status_code, r.status_code == 201, j(r.json()))
if user_resp.get("id"):
    uid_val = user_resp["id"]
    cleanup_users.append(uid_val)
    # GET /{id}
    r = requests.get(f"{BASE}/api/users/{uid_val}")
    test(f"GET /api/users/{{id}}", r.status_code, r.status_code == 200, j(r.json()))
    # PUT /{id}
    r = requests.put(f"{BASE}/api/users/{uid_val}", json={"role": "LEAD"})
    test(f"PUT /api/users/{{id}}", r.status_code, r.status_code in (200, 404), j(r.json()))
    # PATCH /{id}
    r = requests.patch(f"{BASE}/api/users/{uid_val}", json={"role": "TECHNICIAN" if r.status_code == 200 else "LEAD"})
    test(f"PATCH /api/users/{{id}}", r.status_code, r.status_code in (200, 404), j(r.json()))
    # DELETE /{id}
    r = requests.delete(f"{BASE}/api/users/{uid_val}")
    test(f"DELETE /api/users/{{id}}", r.status_code, r.status_code == 204, j(r.json()))

section("4. EQUIPMENT ENDPOINTS (prefix: /api/equipment)")

# GET /
r = requests.get(f"{BASE}/api/equipment")
eqs_before = r.json() if r.status_code == 200 else []
test("GET /api/equipment", r.status_code, r.status_code == 200, f"{len(eqs_before)} items")

# POST /
uid = uuid.uuid4().hex[:6]
eq = {
    "model": "RTL-SDR Blog V4",
    "serial_number": f"EQ-TEST-{uid}",
    "firmware_version": "1.0"
}
r = requests.post(f"{BASE}/api/equipment", json=eq)
eq_resp = r.json() if r.status_code == 201 else {}
test("POST /api/equipment", r.status_code, r.status_code == 201, j(r.json()))
if eq_resp.get("id"):
    eid = eq_resp["id"]
    cleanup_equip.append(eid)
    # GET /{id}
    r = requests.get(f"{BASE}/api/equipment/{eid}")
    test(f"GET /api/equipment/{{id}}", r.status_code, r.status_code == 200, j(r.json()))
    # PUT /{id}
    r = requests.put(f"{BASE}/api/equipment/{eid}", json={"firmware_version": "2.0"})
    test(f"PUT /api/equipment/{{id}}", r.status_code, r.status_code == 200, j(r.json()))
    # DELETE /{id}
    r = requests.delete(f"{BASE}/api/equipment/{eid}")
    test(f"DELETE /api/equipment/{{id}}", r.status_code, r.status_code == 204, j(r.json()))

section("5. OBSERVATIONS ENDPOINTS (prefix: /api/observations)")

# GET / (list)
r = requests.get(f"{BASE}/api/observations")
obs_before = r.json() if r.status_code == 200 else []
test("GET /api/observations (list)", r.status_code, r.status_code == 200, f"{len(obs_before)} items")

# POST / (create single)
obs_data = {
    "timestamp": "2026-06-12T10:00:00Z",
    "frequency_start": 100.0,
    "frequency_end": 200.0,
    "bandwidth": 100.0,
    "modulation_type": "FM",
    "signal_strength": -45.5,
    "classification_status": "VERIFIED",
    "notes": "Smoke test observation",
    "location_wkt": "POINT(-77.0 38.9)"
}
r = requests.post(f"{BASE}/api/observations", json=obs_data)
obs_resp = r.json() if r.status_code == 201 else {}
test("POST /api/observations", r.status_code, r.status_code == 201, j(r.json()))
if obs_resp.get("id"):
    oid = obs_resp["id"]
    obs_id = oid
    cleanup_obs.append(oid)
    # GET /{id}
    r = requests.get(f"{BASE}/api/observations/{oid}")
    test(f"GET /api/observations/{{id}}", r.status_code, r.status_code == 200, j(r.json()))
    # PUT /{id} (update = version bump)
    r = requests.put(f"{BASE}/api/observations/{oid}", json={"classification_status": "DISCARDED", "notes": "Updated via PUT"})
    test(f"PUT /api/observations/{{id}}", r.status_code, r.status_code == 201, j(r.json()))
    # PATCH /{id} — TEST: does it exist?
    r = requests.patch(f"{BASE}/api/observations/{oid}", json={"notes": "via PATCH"})
    test(f"PATCH /api/observations/{{id}}", r.status_code, r.status_code in (405, 200), f"PATCH exist: {r.status_code}")
    # DELETE /{id} (soft delete)
    r = requests.delete(f"{BASE}/api/observations/{oid}")
    test(f"DELETE /api/observations/{{id}}", r.status_code, r.status_code == 200, j(r.json()))
    # GET again after delete (should not see it — is_current=False)
    r = requests.get(f"{BASE}/api/observations")
    obs_after = r.json() if r.status_code == 200 else []
    still_there = any(o.get("id") == oid for o in obs_after)
    test(f"Get all: soft-deleted obs hidden?", still_there is False, not still_there, f"is_current=2, still visible: {still_there}")

# POST /observations/bulk — TEST: does it exist?
bulk = {
    "records": [
        {"timestamp": "2026-06-12T10:01:00Z", "frequency_start": 150.0, "frequency_end": 250.0, "bandwidth": 100.0, "modulation_type": "AM", "signal_strength": -50.0, "classification_status": "UNCERTAIN", "location_wkt": "POINT(-77.1 38.9)"},
        {"timestamp": "2026-06-12T10:02:00Z", "frequency_start": 300.0, "frequency_end": 400.0, "bandwidth": 100.0, "modulation_type": "SSB", "signal_strength": -55.0, "classification_status": "UNCERTAIN", "location_wkt": "POINT(-77.2 38.9)"}
    ]
}
r = requests.post(f"{BASE}/api/observations/bulk", json=bulk)
test("POST /api/observations/bulk", r.status_code, r.status_code in (200, 201), j(r.json()) if r.status_code in (200,201) else r.text[:120])

# Query with filters
r = requests.get(f"{BASE}/api/observations", params={
    "classification": "UNCERTAIN",
    "freq_min": 50.0,
    "freq_max": 500.0,
    "lat": 38.9,
    "lng": -77.0,
    "km_radius_km": 200
})
test("GET /api/observations (filters)", r.status_code, r.status_code in (200, 400, 422), f"count={len(r.json()) if r.status_code == 200 else '?'}")

section("6. SPATIAL ENDPOINTS (prefix: /api/spatial)")

# GET / (catch-all) — TEST
r = requests.get(f"{BASE}/api/spatial")
test("GET /api/spatial (root)", r.status_code, False, f"root GET should not exist ({r.status_code})")

# POST / (catch-all) — TEST
r = requests.post(f"{BASE}/api/spatial", json={"name": "x", "boundary": "x"})
test("POST /api/spatial (root)", r.status_code, False, f"root POST should not exist ({r.status_code})")

# GET /{region_id} (catch-all) — TEST
r = requests.get(f"{BASE}/api/spatial/{uuid.uuid4()}")
test("GET /api/spatial/{{id}} (catch-all)", r.status_code, False, f"catch-all GET should not exist ({r.status_code})")

# GET /regions
r = requests.get(f"{BASE}/api/spatial/regions")
regions_before = r.json() if r.status_code == 200 else []
test("GET /api/spatial/regions", r.status_code, r.status_code == 200, f"{len(regions_before)} regions")

# POST /regions
region_data = {
    "name": f"Test Area {uuid.uuid4().hex[:6]}",
    "boundary": "POLYGON((-77.5 38.5, -77.5 39.0, -76.5 39.0, -76.5 38.5, -77.5 38.5))"
}
r = requests.post(f"{BASE}/api/spatial/regions", json=region_data)
reg_resp = r.json() if r.status_code == 201 else {}
test("POST /api/spatial/regions", r.status_code, r.status_code == 201, j(r.json()))
rid = reg_resp.get("id")
if rid:
    cleanup_regions.append(rid)
    # GET /regions/{id}
    r = requests.get(f"{BASE}/api/spatial/regions/{rid}")
    test(f"GET /api/spatial/regions/{{id}}", r.status_code, r.status_code == 200, j(r.json()))
    # DELETE /regions/{id} — TEST
    r = requests.delete(f"{BASE}/api/spatial/regions/{rid}")
    test(f"DELETE /api/spatial/regions/{{id}}", r.status_code, r.status_code in (204, 200, 405), f"DELETE: {r.status_code}")

# GET /observations/nearby — TEST (should be /observations/by_distance)
r = requests.get(f"{BASE}/api/spatial/observations/nearby", params={"lat": 38.9, "lng": -77.0, "radius_km": 100})
test("GET /api/spatial/observations/nearby", r.status_code, r.status_code in (404, 405, 500), f"Endpoint: {r.status_code}")

# GET /observations/by_distance (actual endpoint)
r = requests.get(f"{BASE}/api/spatial/observations/by_distance", params={"lat": 38.9, "lng": -77.0, "radius_km": 100})
test("GET /api/spatial/observations/by_distance", r.status_code, r.status_code == 200, j(r.json()))

# GET /observations/by_bbox
r = requests.get(f"{BASE}/api/spatial/observations/by_bbox", params={
    "lng_min": -77.5, "lat_min": 38.5, "lng_max": -76.5, "lat_max": 39.0
})
test("GET /api/spatial/observations/by_bbox", r.status_code, r.status_code == 200, j(r.json()))

# GET /observations/by_region — requires valid region_id
r = requests.get(f"{BASE}/api/spatial/observations/by_region", params={"region_id": uuid.uuid4()})
test("GET /api/spatial/observations/by_region (invalid)", r.status_code, r.status_code == 404, f"Should be 404 ({r.status_code})")

section("7. SYNC ENDPOINTS (prefix: /api/sync)")

# GET / (with client_id)
r = requests.get(f"{BASE}/api/sync", params={"client_id": "test"})
test("GET /api/sync", r.status_code, r.status_code == 200, j(r.json()))

# POST / (with SyncRequest body)
r = requests.post(f"{BASE}/api/sync", json={
    "client_id": "test-node-1",
    "last_sync_epoch": 0,
    "deltas": []
})
test("POST /api/sync", r.status_code, r.status_code == 200, j(r.json()))

# GET /status (alias)
r = requests.get(f"{BASE}/api/sync/status")
test("GET /api/sync/status", r.status_code, r.status_code == 200, j(r.json()))

# POST /trigger
r = requests.post(f"{BASE}/api/sync/trigger")
test("POST /api/sync/trigger", r.status_code, r.status_code in (200, 201), j(r.json()))

# POST /json (alias)
r = requests.post(f"{BASE}/api/sync/json", json={
    "client_id": "test",
    "last_sync_epoch": 0,
    "deltas": []
})
test("POST /api/sync/json (alias)", r.status_code, r.status_code in (200, 201), j(r.json()))

# POST /csv (alias)
r = requests.post(f"{BASE}/api/sync/csv", json={
    "client_id": "test",
    "last_sync_epoch": 0,
    "deltas": []
})
test("POST /api/sync/csv (alias)", r.status_code, r.status_code in (200, 201), j(r.json()))

# GET /sync/json — TEST: does it exist?
r = requests.get(f"{BASE}/api/sync/json")
test("GET /api/sync/json", r.status_code, r.status_code in (405, 500), f"GET should not exist ({r.status_code})")

# GET /sync/csv — TEST
r = requests.get(f"{BASE}/api/sync/csv")
test("GET /api/sync/csv", r.status_code, r.status_code in (405, 500), f"GET should not exist ({r.status_code})")

section("8. INGESTION ENDPOINTS (prefix: /api/ingestion)")

# GET / — TEST
r = requests.get(f"{BASE}/api/ingestion")
test("GET /api/ingestion (root)", r.status_code, r.status_code in (404, 405), f"GET should not exist ({r.status_code})")

# GET /csv — TEST (should be POST /csv)
r = requests.get(f"{BASE}/api/ingestion/csv")
test("GET /api/ingestion/csv", r.status_code, r.status_code in (405, 500), f"GET should not exist ({r.status_code})")

# GET /json — TEST
r = requests.get(f"{BASE}/api/ingestion/json")
test("GET /api/ingestion/json", r.status_code, r.status_code in (405, 500), f"GET should not exist ({r.status_code})")

# POST /json
r = requests.post(f"{BASE}/api/ingestion/json", json={
    "data": [
        {"timestamp": "2026-06-12T11:00:00Z", "frequency_start": 500.0, "frequency_end": 600.0, "bandwidth": 100.0, "modulation_type": "NBFM", "signal_strength": -60.0, "classification_status": "UNCERTAIN", "location_wkt": "POINT(-77.0 38.9)"}
    ],
    "source": "test"
})
test("POST /api/ingestion/json", r.status_code, r.status_code == 200, j(r.json()))

# POST /csv
r = requests.post(f"{BASE}/api/ingestion/csv", json={
    "data": [
        {"timestamp": "2026-06-12T12:00:00Z", "frequency_start": 700.0, "frequency_end": 800.0, "bandwidth": 100.0, "modulation_type": "LSB", "signal_strength": -55.0, "classification_status": "UNCERTAIN", "location_wkt": "POINT(-77.1 38.9)"}
    ],
    "source": "test"
})
test("POST /api/ingestion/csv", r.status_code, r.status_code == 200, j(r.json()))

# POST /upload (with file)
test_json = json.dumps([{"timestamp": "2026-06-12T13:00:00Z", "frequency_start": 900.0, "frequency_end": 1000.0, "modulation_type": "CW", "signal_strength": -65.0, "classification_status": "UNCERTAIN", "location_wkt": "POINT(-77.2 38.9)"}])
r = requests.post(f"{BASE}/api/ingestion/upload", files={"file": ("test.json", test_json.encode(), "application/json")})
test("POST /api/ingestion/upload", r.status_code, r.status_code == 200, j(r.json()))

section("9. FINAL DB STATE")

r = requests.get(f"{BASE}/api/observations")
all_obs = r.json() if r.status_code == 200 else []
print(f"  Final observation count in DB: {len(all_obs)}")

r = requests.get(f"{BASE}/api/users")
all_users = r.json() if r.status_code == 200 else []
print(f"  Final user count in DB: {len(all_users)}")

r = requests.get(f"{BASE}/api/equipment")
all_equipment = r.json() if r.status_code == 200 else []
print(f"  Final equipment count in DB: {len(all_equipment)}")

section("FINAL RESULTS SUMMARY")
passed = sum(1 for _, _, ok, _ in RESULTS if ok)
total = len(RESULTS)
failed = [(n, sc, d) for n, sc, ok, d in RESULTS if not ok]
print(f"\n  {'='*60}")
print(f"  TOTAL: {passed}/{total} passed  |  {total - passed} FAILED")
print(f"  {'='*60}")
if failed:
    print("\n  === FAILED ITEMS ===")
    for n, sc, d in failed:
        print(f"    ❌ {n:50s} \u2192 {sc}  {d}")
else:
    print("\n  \u2705 ALL TESTS PASSED")

# Print a categorized summary of routes found
print(f"\n  === ROUTE SUMMARY ===")
print(f"  Auth:       POST /login, GET /me, GET /roles")
print(f"  Users:      GET/POST / , GET/PUT/PATCH/DELETE /{{id}}")
print(f"  Equipment:  GET/POST / , GET/PUT/DELETE /{{id}}")
print(f"  Observations: GET/POST / , GET/PUT/DELETE /{{id}}, spatial filters in list")
print(f"  Spatial:    GET/POST /regions, GET /regions/{{id}}, GET /observations/* ")
print(f"  Sync:       POST (SyncRequest), GET (status), GET/POST /trigger, /json, /csv")
print(f"  Ingestion:  POST /upload, /json, /csv")
