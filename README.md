## Project: Role-Based Access Control System

This repository contains a NestJS application implementing a Role-Based Access Control (RBAC) system for managing access to patient records within organizational hierarchies.

---

### 1. Setup Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/shivamkumraa9/medguard.git
   cd medguard
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   - Copy `.env.test` to `.env`
   - Set the following variables in `.env`:

     ```dotenv
     DB_HOST=your_db_host
     DB_PORT=5432
     DB_USERNAME=your_db_username
     DB_PASSWORD=your_db_password
     DB_NAME=your_db_name
     ```

4. Run database migrations (optional if using `synchronize: true`):

   ```bash
   npm run typeorm migration:run
   ```

5. Start the application:

   ```bash
   npm run start:dev
   ```

6. The server will be running at `http://localhost:3000`.

---

### 2. API Documentation

All endpoints require a header `x-user-id` with a valid user ID.

| Method | Endpoint                | Description                                       | Body Parameters    | Response                 |
| ------ | ----------------------- | ------------------------------------------------- | ------------------ | ------------------------ |
| GET    | `/resources/:id`        | Fetch a single patient record by ID               | N/A                | `PatientRecord` object   |
| GET    | `/resources`            | Fetch all accessible patient records              | N/A                | Array of `PatientRecord` |
| POST   | `/resources`            | Create a new patient record                       | `{ data: string }` | Created `PatientRecord`  |
| PUT    | `/resources/:id`        | Update an existing patient record by ID           | `{ data: string }` | Updated `PatientRecord`  |
| GET    | `/resources/audit-logs` | Fetch audit logs (requires `read-all` permission) | N/A                | Array of `AuditLog`      |

**Request Headers**:

```http
x-user-id: <number>
Content-Type: application/json
```

---

### 3. Data Model

- **User**: Represents an application user.

  - `id`: Primary key
  - `name`: User name
  - Relations:

    - `organization`: Many-to-one to `Organization`
    - `role`: Many-to-one to `Role`
    - `ownedRecords`: One-to-many to `PatientRecord`

- **Organization**: Represents an organizational unit, supports two-level hierarchy.

  - `id`, `name`
  - `parent`: nullable many-to-one to parent organization
  - `children`: one-to-many back to sub-organizations
  - `users`: one-to-many to `User`

- **Role**: Defines a set of permissions.

  - `id`, `name` (unique)
  - `permissions`: many-to-many to `Permission`
  - `users`: one-to-many to `User`

- **Permission**: Atomic action on a resource.

  - `id`, `action` (e.g. `read`, `write`, `update`, `read-all`)
  - `resource` (e.g. `patient_record`)

- **PatientRecord**: Sensitive data entity.

  - `id`, `data`
  - `owner`: many-to-one to `User`

- **AuditLog**: Tracks access attempts.

  - `id`, `userId`, `resourceId`, `outcome` (boolean), `reason`, `timestamp`

---

### 4. Access Control Implementation

- **Permission Retrieval**: `getPermissionsForRole(role: Role)` fetches all actions associated with a role.
- **Scope Enforcement**:

  1. **Organization Scope**: Users can only access records owned by users in their organization or its immediate sub-organizations.
  2. **Owner Bypass**: Owners always have full rights on their own records.
  3. **Action Check**: Users must hold the specific permission (e.g., `read`, `write`, `update`) on `patient_record` to perform the action.

- **Audit Logging**: Every access attempt (allowed or denied) is saved to `AuditLog` with reason and timestamp.
- **Endpoints Security**: Controller methods call the service to enforce access control and throw `ForbiddenException` when checks fail.

---

### 5. Future Considerations for Data Access

#### a) Extending for Complex Scenarios

1. **Multi-Layer Role Inheritance**: Implement role hierarchies where roles inherit permissions from parent roles (e.g., `Manager` > `Staff`).
2. **Dynamic Permission Scopes**: Introduce context-aware policies (e.g., time-based, location-based access).
3. **Attribute-Based Access Control (ABAC)**: Combine user attributes (e.g., department, seniority) with roles for fine-grained policies.

#### b) Security Considerations for Production

1. **Authentication**: Integrate strong authentication mechanisms (e.g., OAuth2, OpenID Connect).
2. **Encryption at Rest and Transit**: Use TLS for all communications and encrypt sensitive fields in the database.
3. **Input Validation & Sanitization**: Validate and sanitize all inputs to prevent injection attacks.
4. **Rate Limiting & Throttling**: Protect against brute-force and denial-of-service attacks.
5. **Audit Integrity**: Ensure logs are immutable (e.g., write-only storage or append-only streams).

#### c) Performance Optimizations at Scale

1. **Caching Permissions**: Cache role-permission mappings (e.g., in Redis) to reduce database lookups.
2. **Batch Fetching**: Use JOINs or batch queries to retrieve related entities in a single call.
3. **Indexing**: Add database indexes on frequently queried columns (e.g., `user.organizationId`, `AuditLog.timestamp`).
4. **Async Logging**: Queue audit log writes (e.g., with a message broker) to decouple from request latency.
5. **Pagination**: Implement pagination on list endpoints to limit payload size.

#### d) Additional Features with More Time

1. **JWT Authentication**:

   - Issue JWTs upon login containing user, role, and organization claims.
   - Validate and decode JWTs in middleware instead of `x-user-id`.
   - Support token refresh and revocation.

2. **Role Management UI**: Build an admin dashboard to manage users, roles, permissions, and organizations.
3. **Policy Editor**: Provide a UI to compose and test ABAC or dynamic policies.
4. **Reporting & Analytics**: Dashboards to visualize audit logs and access patterns.
5. **Webhook Notifications**: Notify external systems on critical events (e.g., failed access attempts).
