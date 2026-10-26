# UPstars HRMS — Backend

Standalone Human Resource Management System API.

## Stack

- Node.js + Express + TypeScript
- Sequelize with PostgreSQL, or a **SQLite fallback** when `DATABASE_URL` is empty
- JWT (Bearer) auth + permission-based RBAC (`employee:view`, `leave:approve`, …)
- Multi-tenant: `tenant_id` always comes from the verified JWT/user, never from client input

## Setup

```bash
npm install
cp .env.example .env      # a ready-to-use .env is already provided for local dev
npm run db:migrate        # creates/updates the schema (sequelize.sync({ alter: true }))
npm run db:seed           # demo tenant, roles, users, sample data (idempotent)
npm run dev               # http://localhost:5001
```

With `DATABASE_URL` empty the API uses `./data/hrms.sqlite`. Set a real
`postgresql://…` URL to use PostgreSQL instead (no code change needed).

## Demo logins

Tenant: **UPstars Demo** (`upstars-demo`, Asia/Kolkata). Password for every user: **`Admin@12345`**

| Email | Role | Notes |
|---|---|---|
| `admin@upstars.local` | COMPANY_ADMIN | EMP-004, full tenant access |
| `hr@upstars.local` | HR_MANAGER | EMP-003 |
| `manager@upstars.local` | MANAGER | EMP-002, manages EMP-001 |
| `employee@upstars.local` | EMPLOYEE | EMP-001, holds the assigned phone |
| `assets@upstars.local` | ASSET_MANAGER | EMP-005 |

```bash
curl http://localhost:5001/api/health
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@upstars.local","password":"Admin@12345"}'
```

Login returns `{ success, data: { token, user } }` where
`user = { id, email, name, roles, permissions, employeeId, tenantId, tenantName }`.
Send `Authorization: Bearer <token>` on every other request.

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start API with hot reload |
| `npm run db:migrate` | Sync schema |
| `npm run db:seed` | Seed demo data |
| `npm run build` / `npm start` | Compile / run production build |
| `npm run typecheck` | Type-check only |

## API overview (`/api/v1`)

Responses: `{ success: true, data, pagination? }`; errors: `{ success: false, error: { code, message, details? } }`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`; `GET /auth/me` |
| Org | `GET/PATCH /tenant`; CRUD `/branches`, `/departments`, `/designations` (also under `/org/…`) |
| Employees | CRUD `/employees`, `POST /employees/:id/deactivate`, `POST /employees/import/preview`, `/import/confirm` |
| Leave | `/leave/types`, `/leave/balances`, `/leave/requests` (+ `/:id/approve`, `/reject`, `/cancel`) |
| Attendance | `POST /attendance/check-in`, `/check-out`; `GET /attendance/events`, `/status`; `/attendance/corrections` (+ approve/reject) |
| Assets | CRUD `/assets`; `/assets/assignments` (assign, `/:id/acknowledge`, `/:id/return`) |
| Documents | CRUD `/document-templates`; `/generated-documents/preview`, `/:id/submit`, `/approve`, `/issue`, `GET /:id/download` |
| Teams & work | `/teams` (+ `/:id/members`), `/tasks`, `/onboarding/checklists`, `POST /onboarding/items/:id/complete` |
| Other | `/geofences`, `/notifications` (+ `/unread-count`, `/:id/read`, `/read-all`), `/reports/:employees|attendance|leave|assets/export`, `/audit-events`, `/dashboard` |

Generated PDFs are written to `STORAGE_DIR` and are only served through the authenticated
download route — there is no public static file directory.

In non-production environments `POST /auth/forgot-password` returns the reset token in the
response (no mail transport is configured); it is omitted when `NODE_ENV=production`.
