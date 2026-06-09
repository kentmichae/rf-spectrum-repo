# Security Architecture Document: RF-SOR

## 1. Overview
The RF Spectrum Observation Repository (RF-SOR) is designed around Zero-Trust principles, ensuring that all data movement is authenticated, authorized, and audited. Given the sensitivity of signal characterization metadata, security is integrated into every layer of the stack.

## 2. Identity and Access Management (IAM)
### 2.1 Authentication
- **Protocol:** OpenID Connect (OIDC) / OAuth2.
- **Provider:** Centralized Identity Provider (IdP) such as Keycloak.
- **Mechanism:** JWT (JSON Web Tokens) used for stateless session management.
- **MFA:** Multi-factor authentication required for all administrative and power-user roles.

### 2.2 Authorization (RBAC)
Role-Based Access Control is enforced at the API layer.
- **Viewer:** Read-only access to records within assigned regions.
- **Technician:** Create new observations, edit their own records, read regional data.
- **Lead Engineer:** Global read access, verify/classify signal records, manage technician assignments.
- **Admin:** System configuration, user management, audit log review.

## 3. Data Security
### 3.1 Encryption
- **In Transit:** TLS 1.3 for all communications (HTTPS).
- **At Rest:** AES-256 encryption for the PostgreSQL volume.
- **Secrets:** Environment variables managed via Docker Secrets or a dedicated Vault; no plaintext secrets in code.

### 3.2 Data Integrity & Audit
- **Immutable Logs:** Every change to a signal record creates a new entry in the `audit_trail` table.
- **Versioning:** Records are versioned using a `valid_from` / `valid_to` temporal pattern or a simple version counter.
- **Validation:** Strict schema validation at the API gateway to prevent injection and malformed data.

## 4. Network Security
- **Reverse Proxy:** Single entry point via Nginx/Traefik.
- **Network Isolation:**
  - Frontend and Backend communicate over a private Docker network.
  - Database is isolated on a backend-only network, inaccessible from the internet.
- **Rate Limiting:** Implemented at the proxy level to prevent DoS attacks.

## 5. Threat Model & Mitigations
- **Unauthorized Access:** Mitigated by OIDC + RBAC.
- **SQL Injection:** Mitigated by SQLAlchemy ORM and PostGIS parameterized queries.
- **XSS/CSRF:** Mitigated by React (auto-escaping) and secure JWT cookie/header configurations.
- **Data Leakage:** Mitigated by strict row-level security (RLS) in PostgreSQL based on user region.
