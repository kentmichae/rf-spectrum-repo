# RF-SOR Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a containerized RF spectrum observation repository with geospatial capabilities, a REST API, and a responsive dashboard.

**Architecture:** 
- Frontend: React + TS + Tailwind + Leaflet.
- Backend: FastAPI + SQLAlchemy + PostGIS.
- Database: PostgreSQL 16 + PostGIS.
- Auth: OIDC / OAuth2 (Keycloak).
- Deployment: Docker Compose.

**Tech Stack:** `FastAPI`, `PostgreSQL/PostGIS`, `React`, `Vite`, `Docker`, `Keycloak`, `SQLAlchemy`.

---

## Phase 1: Infrastructure & Foundations
### Task 1: Project Skeleton Setup
**Objective:** Create directory structure and base config files.
**Files:** 
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `backend/requirements.txt`
- Create: `frontend/package.json`

### Task 2: Database Initialization (PostGIS)
**Objective:** Set up PostgreSQL with PostGIS and initial schema.
**Files:**
- Create: `backend/migrations/init.sql` (PostGIS extension and base tables)
- Create: `backend/app/models.py` (SQLAlchemy models)

### Task 3: Base Backend API Structure
**Objective:** Implement FastAPI skeleton with database connection and health check.
**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/database.py`
- Create: `backend/app/config.py`

---

## Phase 2: Core Data Management
### Task 4: Signal Record CRUD
**Objective:** Implement API endpoints for Creating, Reading, Updating, and Deleting RF observations.
**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/app/schemas.py` (Pydantic models)
- Create: `backend/app/crud.py`

### Task 5: Data Ingestion Pipeline
**Objective:** Implement JSON/CSV bulk import with validation.
**Files:**
- Create: `backend/app/services/ingestion.py`
- Modify: `backend/app/main.py`

### Task 6: Audit Trail & Versioning
**Objective:** Implement the temporal versioning and audit logging logic.
**Files:**
- Modify: `backend/app/crud.py`
- Modify: `backend/app/models.py`

---

## Phase 3: Geospatial & Sync
### Task 7: PostGIS Integration & Spatial Queries
**Objective:** Implement filtering by location (Points in Polygons) and range.
**Files:**
- Modify: `backend/app/crud.py`
- Create: `backend/app/api/endpoints/spatial.py`

### Task 8: Incremental Sync Logic
**Objective:** Implement the sync endpoint supporting version-based delta updates.
**Files:**
- Create: `backend/app/services/sync.py`
- Modify: `backend/app/main.py`

---

## Phase 4: Frontend Development
### Task 9: Dashboard Layout & Theming
**Objective:** Build the React skeleton with Tailwind and Dark Mode support.
**Files:**
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/components/Layout.tsx`

### Task 10: Interactive RF Map
**Objective:** Integrate Leaflet/OpenLayers to visualize observations as markers/polygons.
**Files:**
- Create: `frontend/src/components/RFMap.tsx`

### Task 11: Observation Management UI
**Objective:** Build forms for manual entry and tables for record management.
**Files:**
- Create: `frontend/src/components/ObservationForm.tsx`
- Create: `frontend/src/components/ObservationTable.tsx`

---

## Phase 5: Security & DevOps
### Task 12: OIDC Integration
**Objective:** Integrate Keycloak/OAuth2 for authentication and RBAC.
**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/app/auth.py`

### Task 13: Production Dockerization
**Objective:** Optimize Dockerfiles for production (multi-stage builds).
**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml`

### Task 14: Testing & Validation
**Objective:** Write integration tests for API and Geospatial queries.
**Files:**
- Create: `backend/tests/test_api.py`
- Create: `backend/tests/test_spatial.py`

---

## Phase 6: Final Delivery
### Task 15: Documentation & Samples
**Objective:** Generate OpenAPI docs and create sample datasets.
**Files:**
- Create: `docs/deployment-guide.md`
- Create: `data/sample_observations.json`
