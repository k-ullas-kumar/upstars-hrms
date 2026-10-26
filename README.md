# UPstars HRMS

Standalone Human Resource Management System (multi-tenant SaaS MVP).

Built from the UPstars product pack with **Sequelize** (not Prisma).

| Folder | App | Default URL |
|---|---|---|
| `hrms_BE` | Express + TypeScript + Sequelize API | http://localhost:5001 |
| `hrms_FE` | React + Vite + Tailwind SPA | http://localhost:3000 |
| `docs/` | End-to-end tutorial (HTML + PDF) | — |

GitHub: https://github.com/k-ullas-kumar/upstars-hrms

## Quick start (local dev)

### 1. Backend

```bash
cd hrms_BE
npm install
cp .env.example .env   # SQLite fallback when DATABASE_URL is empty
npm run db:migrate
npm run db:seed
npm run dev
```

### 2. Frontend

```bash
cd hrms_FE
npm install
npm run dev
```

Open **http://localhost:3000** and sign in.

## Demo logins

Password for all: `Ullas@Intern`

| Email | Role |
|---|---|
| `admin@upstars.in` | Company Admin |
| `hr@upstars.in` | HR Manager |
| `manager@upstars.in` | Manager |
| `employee@upstars.in` | Employee |
| `assets@upstars.in` | Asset Manager |

## Deploy (Docker / VPS / PaaS)

Full instructions: **[DEPLOYMENT.md](./DEPLOYMENT.md)**

Fastest path (Postgres + API + nginx web):

```bash
cp .env.deploy.example .env.deploy
# set JWT_SECRET and POSTGRES_PASSWORD
docker compose --env-file .env.deploy up -d --build
```

Then open http://localhost:8080

Supporting files included:

- `docker-compose.yml`
- `.env.deploy.example`
- `hrms_BE/Dockerfile`, `docker-entrypoint.sh`
- `hrms_FE/Dockerfile`, `nginx.conf`
- `.github/workflows/ci.yml`

## Product tutorial

Complete end-to-end user guide (branded PDF):

- [`docs/UPstars-HRMS-Complete-Tutorial.pdf`](./docs/UPstars-HRMS-Complete-Tutorial.pdf)
- HTML source: [`docs/UPstars-HRMS-Complete-Tutorial.html`](./docs/UPstars-HRMS-Complete-Tutorial.html)

## MVP modules

- Organisation setup (tenant, branches, departments, designations)
- Authentication + RBAC
- Employee records, import, deactivate
- Leave types, balances, request / approve
- Attendance check-in/out, header timer, 5s cancelable check-out shortcut, corrections, geofence verification
- Asset register, assign / acknowledge / return
- Document templates + PDF issue
- Teams, tasks, onboarding checklists
- Notifications, audit log, reports (CSV export)

Out of MVP scope (by design): chat, full payroll engine, recruitment ATS, sales CRM.
