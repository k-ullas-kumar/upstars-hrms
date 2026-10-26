# UPstars HRMS

Standalone Human Resource Management System (multi-tenant SaaS MVP).

Built from the UPstars product pack with **Sequelize** (not Prisma).

## Repositories in this project

| Folder | App | Default URL |
|---|---|---|
| `hrms_BE` | Express + TypeScript + Sequelize API | http://localhost:5001 |
| `hrms_FE` | React + Vite + Tailwind SPA | http://localhost:3000 |

## Quick start

### 1. Backend

```bash
cd hrms_BE
npm install
cp .env.example .env   # already present as .env for local SQLite
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

Password for all: `Admin@12345`

| Email | Role |
|---|---|
| `admin@upstars.local` | Company Admin |
| `hr@upstars.local` | HR Manager |
| `manager@upstars.local` | Manager |
| `employee@upstars.local` | Employee |
| `assets@upstars.local` | Asset Manager |

## MVP modules

- Organisation setup (tenant, branches, departments, designations)
- Authentication + RBAC
- Employee records, import, deactivate
- Leave types, balances, request / approve
- Attendance check-in/out, corrections, geofence verification
- Asset register, assign / acknowledge / return
- Document templates + PDF issue
- Teams, tasks, onboarding checklists
- Notifications, audit log, reports (CSV export)

Out of MVP scope (by design): chat, full payroll engine, recruitment ATS, sales CRM.
