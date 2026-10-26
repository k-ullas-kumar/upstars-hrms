# UPstars HRMS — Deployment guide

This repo is a monorepo:

| Path | Service | Port |
|---|---|---|
| `hrms_BE` | Express + Sequelize API | `5001` |
| `hrms_FE` | React (Vite) SPA | `3000` (dev) / `80` (Docker nginx) |

Supporting files for deploy:

- `docker-compose.yml` — Postgres + API + Web
- `.env.deploy.example` — secrets template (copy to `.env.deploy`)
- `hrms_BE/Dockerfile` + `docker-entrypoint.sh` (migrate, optional seed, start)
- `hrms_FE/Dockerfile` + `nginx.conf` (SPA + `/api` reverse proxy)
- `hrms_BE/.env.example` / `hrms_FE/.env.example`
- `.github/workflows/ci.yml` — typecheck/build on push

---

## Option A — Docker Compose (recommended for VPS / localhost prod-like)

### 1. Prepare secrets

```bash
cp .env.deploy.example .env.deploy
# Edit JWT_SECRET and POSTGRES_PASSWORD (required)
```

### 2. Build & start

```bash
docker compose --env-file .env.deploy up -d --build
```

### 3. Open the app

- Web: http://localhost:8080 (or `WEB_PORT`)
- API health: http://localhost:5001/api/health

Demo logins (when `SEED_ON_START=true`): password `Ullas@Intern`

| Email | Role |
|---|---|
| admin@upstars.in | Company Admin |
| hr@upstars.in | HR Manager |
| manager@upstars.in | Manager |
| employee@upstars.in | Employee |
| assets@upstars.in | Asset Manager |

After the first successful boot, set `SEED_ON_START=false` and recreate the API container so demo seed does not re-run on every restart.

### 4. Useful commands

```bash
docker compose --env-file .env.deploy logs -f api
docker compose --env-file .env.deploy ps
docker compose --env-file .env.deploy down
```

---

## Option B — Manual (Node on a server)

### Backend

```bash
cd hrms_BE
cp .env.example .env
# Set NODE_ENV=production, JWT_SECRET, DATABASE_URL (Postgres), FRONTEND_URL
npm ci
npm run build
npm run db:migrate:prod
# optional: npm run db:seed:prod
npm start
```

### Frontend

```bash
cd hrms_FE
cp .env.example .env
# Leave VITE_API_BASE empty if you reverse-proxy /api to the API
# Or set VITE_API_BASE=https://api.your-domain.com
npm ci
npm run build
# Serve dist/ with nginx/Caddy; proxy /api -> API :5001
```

Example nginx location (same host):

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:5001/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## Option C — Managed PaaS (Render / Railway / Fly)

1. **Database** — provision managed Postgres; copy the connection URL.
2. **API service** — root `hrms_BE`, build `npm ci && npm run build`, start `npm run db:migrate:prod && npm start`.
3. **Env** — `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true` (if required), `JWT_SECRET`, `FRONTEND_URL=https://your-web-host`.
4. **Web service** — root `hrms_FE`, build `npm ci && npm run build`, publish `dist`, set `VITE_API_BASE` to the public API origin at **build** time if you are not proxying `/api`.

---

## Production checklist

- [ ] Strong `JWT_SECRET` (≥ 32 chars)
- [ ] Postgres (not SQLite) for multi-instance / durability
- [ ] `FRONTEND_URL` matches the real browser origin(s)
- [ ] HTTPS terminator (nginx, Caddy, cloud LB)
- [ ] Persistent volume for `uploads/` (generated PDFs)
- [ ] `SEED_ON_START=false` after first demo seed
- [ ] Change demo passwords or disable seed users in real tenants

---

## Health & smoke

```bash
curl -s http://localhost:5001/api/health
# expect: {"success":true,"service":"hrms-backend","status":"ok",...}
```

Tutorial PDF (product walkthrough): `docs/UPstars-HRMS-Complete-Tutorial.pdf`
