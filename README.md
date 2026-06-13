# RF Spectrum Observation Repository (RF-SOR)

**RF-SOR** is an enterprise-grade, containerized application designed for field technicians to record, manage, and share RF spectrum observation records and signal characterization metadata in a centralized, secure repository.

## 🎯 Objectives
The system provides a structured workflow for capturing RF signal fingerprints and associated metadata, ensuring data integrity via audit trails, geospatial precision via PostGIS, and secure synchronization between field deployments and a central core.

## ✨ Architecture & Design Goals
This project is an architectural scaffold with the data models, API structure, and UI layout for a full RF signal observation system. The current deployment provides the foundation; the following sections describe what is implemented vs. intended.

### Implemented Today (v0.3.0)
- **Container Stack:** Fully running Docker Compose with PostgreSQL 16/PostGIS, FastAPI backend, React frontend, and Nginx reverse proxy.
- **Database Schema:** SQLAlchemy models for `Region`, `User`, `Equipment`, `Observation`, and `AuditTrail` with PostGIS geometry support.
- **Authentication & RBAC:** Auth context with Keycloak OIDC + local JWT, login modal, role-based menu access (VIEWER/OPERATOR/ADMIN), Settings configuration.
- **Signal Record Management:** Observations page with full CRUD API-bound table — frequency ranges, bandwidth, modulation, classification, timestamp — search, classification filter, pagination.
- **Spatial Filtering:** Map with real-time markers from backend, lat/lng coordinate search + radius filtering, polygon drawing mode for region-based filtering, classification color-coded markers.
- **Data Ingestion:** Import page with CSV/JSON drag-and-drop upload, auto column detection and mapping, data preview before upload, API submission with error reporting.
- **Sync Status:** Real-time sync status with polling (30s interval), pending uploads/downloads counters, node management, sync history log, manual sync trigger with direction selection.
- **Map View:** Leaflet map with OpenStreetMap tiles, click-to-add coordinates, GeoJSON region overlay.
- **Settings Page:** Configurable API endpoint, Keycloak URL/realm/client ID persistence to localStorage.

## 🏗️ System Architecture
The application follows a modular microservices architecture deployed via Docker Compose:

```
┌──────────────────────────────────────────────────────────────┐
│                    Client / Browser                          │
│                      Port 3001                               │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Nginx Proxy                               │
│                    Port 8080 (host)                          │
├──────────────────┬───────────────────┬───────────────────────┤
│ SPA Routing      │ API Proxy         │ Static Assets         │
│ (/)              │ (/api/) → backend │ (30d cache)           │
│ (try_files)      │ (rate limit 30r/s)│                       │
└──────────────┬───────────────────────┴───────────────────────┘
               │
       ┌───────▼─────────┐         ┌────────────────────────────┐
       │   Backend API   │←───────→│   PostGIS 16 Database      │
       │   FastAPI +     │  5432   │   PostgreSQL + PostGIS     │
       │   uvicorn       │         │   + custom mappings        │
       └─────────────────┘         └────────────────────────────┘
```

### Services
| Service      | Container          | Image                          | Port (host) | Purpose                         |
|--------------|--------------------|--------------------------------|-------------|---------------------------------|
| Database     | `rf_sor_db`        | postgis/postgis:16-3.4         | 5432        | PostgreSQL 16 + PostGIS         |
| Backend API  | `rf_sor_backend`   | rf-spectrum-repo-backend       | 8000        | FastAPI + uvicorn               |
| Frontend     | `rf_sor_frontend`  | node:20-alpine + serve         | 3001        | React SPA (Vite build)          |
| Reverse Proxy| `rf_sor_nginx`     | nginx:1.25-alpine              | 8082        | SPA routing + API reverse proxy |

## 🛠️ Tech Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS 3, Leaflet, react-leaflet, lucide-react, react-router-dom |
| **Backend** | Python 3.11, FastAPI 0.111, SQLAlchemy 2.0, psycopg2, pydantic, shapely, geojson, numpy |
| **Database** | PostgreSQL 16 + PostGIS 3.4 + GeoAlchemy2 |
| **Security** | OIDC/OAuth2, JWT, bcrypt, CORS, rate limiting |
| **DevOps** | Docker Compose, multi-stage builds, Nginx, Python 11-slim, Node 20-alpine |

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed.
- A text editor (VS Code recommended).

### Deployment
1. Clone the repository:
   ```bash
   git clone https://github.com/kentmichae/rf-spectrum-repo.git
   cd rf-spectrum-repo
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your specific credentials
   ```

3. Spin up the stack:
   ```bash
   docker compose up -d
   ```

4. Access the Dashboard:
   - **Web UI**: `http://localhost:3001`
   - **API Docs (direct)**: `http://localhost:8000/docs`
   - **API Docs (via proxy)**: `http://localhost:8082/docs`
   - **Proxy endpoint**: `http://localhost:8082` (reverse proxy)

### Port Configuration
| Service | Container Port | Host Port | Notes |
|---------|---------------|-----------|-------|
| Frontend | 3000 | **3001** | Changed to avoid conflict with WorldwideView |
| Backend | 8000 | 8000 | FastAPI / uvicorn |
| Reverse Proxy | 80 | **8082** | Changed to avoid conflict with cew-dashboard |
| Database | 5432 | none | Internal networking only |

### Docker Compose Configuration
The project uses an arm64-based PostGIS image (linux/amd64 + QEMU emulation) since the host is ARM64 architecture. All volumes and networks are managed through docker-compose v2.

## 📂 Project Structure
```text
rf-spectrum-repo/
├── backend/              # FastAPI Backend
│   ├── app/              # Application logic
│   │   ├── main.py       # FastAPI edoclntry point
│   │   ├── database.py   # SQLAlchemy session + Base
│   │   ├── models.py     # SQLAlchemy models (Region, User, Observation, etc.)
│   │   ├── config.py     # Environment settings
│   │   └── routes/       # API route modules
│   │       ├── health.py
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── observations.py
│   │       ├── spatial.py
│   │       ├── sync.py
│   │       └── ingestion.py
│   ├── migrations/       # PostGIS initialization scripts
│   ├── Dockerfile        # Multi-stage build (python:3.11-slim)
│   └── requirements.txt  # Python dependencies
├── frontend/             # React Frontend
│   ├── src/              # Source code
│   │   ├── components/   # Layout, Navigation
│   │   ├── pages/        # Dashboard, Observations, Map, Users, etc.
│   │   └── main.tsx      # Entry point
│   ├── Dockerfile        # Multi-stage build (node:20-alpine)
│   └── nginx/            # Static file configuration
├── nginx/                # Reverse proxy configuration
│   └── conf.d/           # Default server config
├── docs/                 # Architecture and Security docs
│   └── architecture/     # Blueprints (HTML diagrams)
├── data/                 # Sample datasets for testing
├── docker-compose.yml    # Orchestration config
├── .env.example          # Template environment variables
└── README.md             # This file
```

## 🧪 Development Commands
```bash
# Start the full stack
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f nginx

# Rebuild and restart
docker compose up -d --build

# Stop all services
docker compose down --remove-orphans

# Check health status
docker compose ps
```

## 🛡️ Security Note
This project is designed for the lawful storage and management of observation metadata. It does not implement offensive, targeting, or surveillance capabilities.

## 📋 Current Status
| Component | Status |
| :--- | :--- |
| **Database Schema** | `backend/migrations/init.sql` - full init script |
| **Backend API** | `backend/app/` - SQLAlchemy models, Pydantic schemas, 6 route modules (health, auth, observations, users, spatial, sync), ingestion router, CORS, multi-stage Dockerfile. *API endpoints exist; frontend data binding is pending.* |
| **Frontend** | `frontend/src/` - Layout (dark-mode sidebar), Dashboard (static stats), Observations (empty table), Map (Leaflet + OSM tiles), Users (empty table), Sync (static), Import (drag-and-drop scaffold), Settings (config forms). *All pages render; API hooks and state management are not connected.* |
| **Docker** | `docker-compose.yml` - PostgreSQL 16, backend with CORS, frontend via serve. *All 4 services running.* |
| **Nginx** | `nginx/nginx.conf` - SPA routing, API proxy, rate limiting (30r/s), security headers. |
| **Test Data** | `data/sample_observations.json` |
