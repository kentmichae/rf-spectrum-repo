# RF Spectrum Observation Repository (RF-SOR)

**RF-SOR** is an enterprise-grade, containerized application designed for field technicians to record, manage, and share RF spectrum observation records and signal characterization metadata in a centralized, secure repository.

## 🎯 Objectives
The system provides a structured workflow for capturing RF signal fingerprints and associated metadata, ensuring data integrity via audit trails, geospatial precision via PostGIS, and secure synchronization between field deployments and a central core.

## ✨ Key Features
- **Advanced Data Ingestion:** Support for manual entry, CSV/JSON bulk imports, and API-based ingestion with strict validation.
- **Signal Record Management:** Comprehensive tracking of observation IDs, timestamps, frequency ranges, bandwidth, modulation types, and classification status.
- **Geospatial Intelligence:** 
  - Coordinate storage (Lat/Long, GeoJSON, Polygon regions).
  - Interactive map visualization.
  - Spatial filtering by location and region.
- **Offline-First Synchronization:** Secure, incremental synchronization between field nodes and the central database with built-in conflict resolution.
- **Zero-Trust Security:** 
  - Role-Based Access Control (RBAC).
  - OIDC/OAuth2 integration (Keycloak).
  - Full audit lineage for every modification.
  - Encryption in transit (TLS 1.3) and at rest (AES-256).
- **Developer Friendly:** Fully documented REST API (OpenAPI/Swagger) and a responsive, dark-mode enabled React dashboard.

## 🏗️ System Architecture
The application follows a modular microservices architecture deployed via Docker Compose:
- **Frontend:** React + TypeScript + Tailwind + Leaflet.
- **Backend:** FastAPI + SQLAlchemy + PostGIS.
- **Database:** PostgreSQL 16 + PostGIS.
- **Identity:** OIDC / OAuth2.
- **Gateway:** Reverse Proxy (Nginx/Traefik).

Detailed architectural blueprints can be found in `docs/architecture/`.

## 🛠️ Tech Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Leaflet |
| **Backend** | Python, FastAPI, SQLAlchemy |
| **Database** | PostgreSQL, PostGIS |
| **Security** | OIDC, OAuth2, JWT, AES-256 |
| **DevOps** | Docker, Docker Compose, Git |

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
   docker-compose up -d
   ```
4. Access the Dashboard:
   - Web UI: `http://localhost:3000`
   - API Docs: `http://localhost:8000/docs`

## 📂 Project Structure
```text
rf-spectrum-repo/
├── backend/              # FastAPI Backend
│   ├── app/              # Application logic
│   ├── migrations/       # PostGIS initialization scripts
│   └── tests/            # Integration and Unit tests
├── frontend/             # React Frontend
│   ├── src/              # Source code
│   └── public/           # Static assets
├── docs/                 # Architecture and Security docs
│   └── architecture/     # Blueprints and Schemas
├── data/                 # Sample datasets for testing
├── docker-compose.yml    # Orchestration config
└── README.md             # Project Guide
```

## 🛡️ Security Note
This project is designed for the lawful storage and management of observation metadata. It does not implement offensive, targeting, or surveillance capabilities.
