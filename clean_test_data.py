"""Clean test data before rerunning smoke tests."""
import requests
import uuid

BASE = "http://localhost:8000"

# Delete all observations (soft delete)
r = requests.get(f"{BASE}/api/observations")
if r.status_code == 200:
    for obs in r.json():
        requests.patch(f"{BASE}/api/observations/{obs['id']}", json={"classification_status": "DISCARDED"})
    print(f"Soft-deleted {len(r.json())} observations")

# Delete all test equipment
r = requests.get(f"{BASE}/api/equipment")
if r.status_code == 200:
    for eq in r.json():
        if "EQ-TEST-" in eq["serial_number"] or "test" in eq["model"].lower():
            requests.delete(f"{BASE}/api/equipment/{eq['id']}")
            print(f"Deleted equipment {eq['id']}")

# Delete all test users
r = requests.get(f"{BASE}/api/users")
if r.status_code == 200:
    for u in r.json():
        if "u_" in u["username"] or "test" in u["email"] or "regtest" in u["username"]:
            requests.delete(f"{BASE}/api/users/{u['id']}")
            print(f"Deleted user {u['username']}")

# Delete all regions
r = requests.get(f"{BASE}/api/spatial/regions")
if r.status_code == 200:
    for reg in r.json():
        requests.delete(f"{BASE}/api/spatial/regions/{reg['id']}")
        print(f"Deleted region {reg['name']}")

print("Clean complete.")
