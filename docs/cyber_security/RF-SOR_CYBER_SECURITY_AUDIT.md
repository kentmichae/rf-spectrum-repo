# Cyber Security Audit Report: RF Spectrum Observation Repository (RF-SOR)

**Project:** rf-spectrum-repo
**Version:** 0.4.0
**Audit Date:** 2026-06-13
**Auditor:** Automated Static Analysis
**Classification:** CONFIDENTIAL
**Scope:** Full source code, configuration, Docker infrastructure, nginx proxy, and test suite

---

## Executive Summary

RF-SOR is a containerized FastAPI/React application for RF spectrum observation data management with PostGIS geospatial capabilities, JWT-based authentication, and field-sync support. This audit identifies **10 critical and high-severity issues**, including plaintext credentials in source code, open user registration with self-assigned roles, forgeable JWT tokens, and missing role-based access control across all endpoints.

**Overall Risk: CRITICAL**

### Findings at a Glance

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 3 | Plaintext credentials, open registration, forgeable JWT secrets |
| HIGH | 5 | Missing file size limits, WKT injection, no refresh rotation, no RBAC, unauthenticated sync |
| MEDIUM | 7 | CORS misconfiguration, missing JWT claims, no auth rate limiting, debug exposure, nginx config drift |
| LOW | 5 | Default test credentials, missing TLS, Docker security hardening, missing health checks |

---

## CRITICAL Findings

### C-1: Plaintext Database Credentials in Source Code

**File:** `backend/app/config.py` (lines 5-6)

```python
POSTGRES_PASSWORD: str = "rf_password"
API_SECRET_KEY: str = "dev-secret-key"
```

Default values are baked into the code. When `.env` is absent or incomplete, these plaintext credentials are used. Anyone with source access can connect to the database as `rf_user` / `rf_password`.

**Impact:** Full database access, all RF observation data exposed.

**Remediation:**
- Remove all default password values; require `POSTGRES_PASSWORD` to be set at runtime.
- Use Docker secrets or a secrets vault for production.
- Validate required secrets at startup and fail fast if missing.

---

### C-2: Open User Registration with Self-Assigned Roles

**File:** `backend/app/routes/auth.py` (lines 78-99)

```python
@router.post("/register", tags=["auth"])
def register(payload: UserCreate, db: Session = Depends(get_db)):
    user = UserModel(
        password_hash=_hash_password(payload.password),
        role=payload.role,   # User self-assigns any role including ADMIN
    )
```

- No authentication required to register.
- No rate limiting or CAPTCHA protection.
- **Users can self-assign any role**, including `ADMIN`.
- No admin approval workflow.

**Impact:** Any unauthenticated user can create an admin account and take full control.

**Remediation:**
- Remove the public registration endpoint.
- If registration is needed, require admin approval and hardcode a default role of `VIEWER`.
- Add rate limiting (e.g., `slowapi` at 5 requests/hour).

---

### C-3: Forgeable JWT Secret Key

**Files:** `backend/app/config.py` (line 9), `backend/app/routes/auth.py` (line 18, 38)

```python
API_SECRET_KEY: str = "dev-secret-key"   # 13 characters
ALGORITHM = "HS256"
# ...
jwt.encode(payload, settings.API_SECRET_KEY, algorithm=ALGORITHM)
```

The secret is publicly known (13 characters of ASCII). Any attacker can forge arbitrary JWT tokens with any role (e.g., `ADMIN`) without knowing any user's password.

**Impact:** Complete authentication bypass. Attackers can forge admin tokens.

**Remediation:**
- Use `secrets.token_urlsafe(64)` for the secret key.
- Enforce minimum key length (32+ bytes).
- Implement key versioning for rotation.

---

## HIGH Findings

### H-1: No File Upload Size Limit

**File:** `backend/app/routes/ingestion.py` (lines 34-40)

```python
def upload_observations(file: UploadFile = File(...), ...):
    content = file.file.read()  # Reads entire file into memory, no size check
```

Any file size is accepted. An attacker can cause memory exhaustion (DoS) or database overflow.

**Impact:** Denial of service, potential database overflow.

**Remediation:** Use FastAPI's `Limits` or set a 10 MB max. Process in chunks for large files.

---

### H-2: WKT Geometry Injection

**File:** `backend/app/routes/ingestion.py` (lines 102-115)

```python
loc_wkt = raw.get("location_wkt")
loc_raw = loc_wkt.strip()
coords = loc_raw.split()
loc = WKTElement(f"POINT({coords[0]} {coords[1]})", srid=4326)
```

User-supplied WKT is passed directly to `WKTElement` without validation. Malformed WKT (e.g., `POINT(POINT(0 0) EMPTY)`) can cause geometry parsing errors. No bounds checking on lat/lng coordinates.

**Impact:** DoS via geometry parsing errors, invalid spatial data in database.

**Remediation:**
- Validate with `shapely.wkt.loads()` in a try/except.
- Enforce coordinate ranges: `-180 <= lng <= 180`, `-90 <= lat <= 90`.
- Limit input string length.

---

### H-3: No Role-Based Access Control (RBAC) Enforcement

**Files:** All route files (`observations.py`, `equipment.py`, `users.py`, `sync.py`, etc.)

None of the route handlers check the authenticated user's role. For example, `PUT /api/observations/{id}` and `DELETE /api/equipment/{id}` accept requests from any authenticated user regardless of role.

The role definitions exist in `auth.py` and `schemas.py` but are never enforced:

```python
# auth.py - roles are defined but never checked in callers
@router.get("/roles")
def get_roles():
    return {"roles": {"VIEWER": ["read"], ...}}  # Informational only
```

**Impact:** Any authenticated user can modify/delete any record. No separation of duties.

**Remediation:**
- Implement a `@requires_role(min_role)` decorator.
- Add role checks to all write/delete/mutation endpoints.
- Implement row-level security for data isolation.

---

### H-4: No Refresh Token Rotation or Revocation

**File:** `backend/app/routes/auth.py` (lines 39-48)

```python
refresh = jwt.encode({
    "sub": str(user.id), "exp": datetime.utcnow() + timedelta(hours=72),
    "type": "refresh",
}, settings.API_SECRET_KEY, algorithm=ALGORITHM)
```

- Refresh tokens are valid for 72 hours with no revocation mechanism.
- No token binding to device/session.
- No key versioning for rotation.

**Impact:** Stolen refresh tokens provide persistent access for 72 hours.

**Remediation:** Implement a `revoked_tokens` PostgreSQL table. Rotate refresh tokens on each use. Bind to device. Consider short-lived access tokens (5-15 min) with silent refresh.

---

### H-5: Unauthenticated Sync Endpoint

**File:** `backend/app/routes/sync.py` (lines 46-117)

```python
@router.post("", tags=["sync"])
def sync(payload: SyncRequest, db: Session = Depends(get_db)):
    for delta in payload.deltas:
        # SyncRequest has a client_id field but no auth is checked
        existing = db.query(Observation).filter(...).first()
        # Any client can overwrite any record
```

The sync endpoint accepts deltas from any `client_id` without authentication. Allows data fabrication and corruption.

**Impact:** Data fabrication, unauthorized data overwrite.

**Remediation:**
- Require valid JWT authentication.
- Validate `client_id` against an authorized device registry.
- Add delta verification and signature matching.

---

## MEDIUM Findings

### M-1: CORS Wildcard with Credentials

**File:** `backend/app/cors_config.py` (lines 22-29)

```python
def setup_cors_dev(app):
    app.add_middleware(CORSMiddleware,
        allow_origins=["*"],       # Wildcard
        allow_credentials=True,    # Security conflict
    )
```

`allow_origins=["*"]` with `allow_credentials=True` is a security conflict.

**Remediation:** Explicitly enumerate origins from config. Never combine wildcard with credentials.

---

### M-2: Missing JWT Audience/Issuer Validation

**File:** `backend/app/routes/auth.py` (lines 65-66)

```python
payload = jwt.decode(token, settings.API_SECRET_KEY, algorithms=[ALGORITHM])
# No audience or issuer validation
```

Tokens from other JWT services can authenticate as RF-SOR users.

**Remediation:** Add `aud="rf-sor-api"` and `issuer=JWT_ISSUER` to decode parameters.

---

### M-3: No Rate Limiting on Auth Endpoints

**File:** `backend/app/routes/auth.py` (lines 29-54)

The login endpoint has unlimited attempts. No account lockout, no CAPTCHA.

**Impact:** Brute-force password attacks are possible.

**Remediation:** Add `slowapi` rate limiter (5 req/hour), exponential backoff, account lockout after N failures.

---

### M-4: Debug Mode Exposes Internal Details

**File:** `backend/app/config.py` (line 10)

```python
API_DEBUG: bool = True  # Exposes Swagger, tracebacks
```

Combined with the global exception handler in `main.py`, full Python tracebacks are returned to clients.

**Remediation:** Disable Swagger/OpenAPI in production. Sanitize error responses when `DEBUG=False`.

---

### M-5: Nginx Configuration Drift

**Files:** `nginx/nginx.conf`, `nginx/conf.d/default.conf`

Both files contain server blocks but:
1. `conf.d/default.conf` is a bare `server` block without `events`/`http` wrappers (non-standard)
2. Two configs present risk of one being loaded over the other
3. No duplicate gzip directives
4. No TLS/HTTPS on port 443

**Remediation:** Consolidate into a single config. Add TLS listener. Remove duplicates.

---

### M-6: Cross-Origin Header in Wrong Context

**File:** `nginx/nginx.conf` (lines 77-79)

CORS headers are set inside the `/api/` location block but also in the backend. The Nginx headers override the backend headers and hardcode `http://localhost:3001`.

**Remediation:** Let the backend handle CORS (which it already does). Remove Nginx CORS headers.

---

### M-7: Timestamp Manipulation via `datetime.utcnow()`

**File:** `backend/app/config.py` (throughout ingestion routes and sync)

`datetime.utcnow()` is used in multiple places without timezone normalization. In ingestion (`ingestion.py` line 11), user-supplied timestamps are accepted without validation.

**Remediation:** Use `datetime.now(timezone.utc)` everywhere. Validate user-supplied timestamps against reasonable bounds.

---

## LOW Findings

### L-1: Test Credentials in Test Suite

**File:** `test_all_endpoints.py` (lines 70-73)

```python
r = requests.post(f"{BASE}/api/auth/login", json={
    "username": "root",
    "password": "changeme"
})
```

Default test credentials suggest default accounts exist.

**Remediation:** Use environment variables for test credentials. Create fixture accounts programmatically.

---

### L-2: Missing TLS/HTTPS

**File:** `nginx/nginx.conf` (line 16)

Only port 80 is listened to. No `listen 443 ssl` directive.

**Remediation:** Add SSL listener. Configure certificate and key paths. Add HSTS header.

---

### L-3: Docker Security Hardening

**File:** `docker-compose.yml`

1. No seccomp/AppArmor profiles
2. No resource limits on PostGIS container
3. No `security_opt` on any container
4. No `read_only` filesystem options

**Remediation:** Add `security_opt: [no-new-privileges:true]`, resource limits, `read_only: true` for containers that don't need writes.

---

### L-4: Missing Frontend Health Check

**File:** `docker-compose.yml` (line 51-62)

The frontend service has no health check defined.

**Remediation:** Add a health check for the serve process.

---

### L-5: Silent bcrypt Failure

**File:** `backend/app/routes/users.py` (lines 16-18)

```python
def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
```

If bcrypt fails, the exception propagates silently without logging.

**Remediation:** Add try/except with logging.

---

## Compliance Mapping

- **NIST 800-53:** AC-17 (Remote Access), SC-8 (Transmission Confidentiality), IA-5 (Account Management) - NOT MET
- **OWASP Top 10 2023:** A01 (Broken Access Control), A02 (Cryptographic Failures), A03 (Injection), A04 (Insecure Design) - NOT MET
- **MITRE ATT&CK:** T1078 (Valid Accounts), T1190 (Exploit Public-Facing Application), T1110 (Brute Force) - VULNERABLE

---

## Remediation Priority

### Phase 1: Block immediately (Before any deployment)
1. Remove default credentials from `config.py` (C-1)
2. Remove or gate the registration endpoint (C-2)
3. Replace JWT secret with cryptographically strong key (C-3)
4. Remove public Swagger/OpenAPI endpoints (C-3 mitigation)

### Phase 2: Before Production
5. Add role-based access control to all endpoints (H-3)
6. Add file upload size limits (H-1)
7. Sanitize WKT inputs (H-2)
8. Implement refresh token rotation (H-4)
9. Authenticate sync endpoint (H-5)
10. Fix CORS and JWT claims validation (M-1, M-2)
11. Add rate limiting (M-3)
12. Consolidate nginx configs and add TLS (M-5, L-2)

### Phase 3: As Improvements
13. Harden Docker security (L-3, L-4)
14. Remove test credentials from code (L-1)
15. Add HSTS and security headers

---

*Report generated 2026-06-13 by automated static analysis of the rf-spectrum-repo source codebase.*
