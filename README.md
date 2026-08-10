# Mini ERP + CRM Operations Portal

Full-stack case study submission: a small ERP/CRM system for a wholesale/distribution
company covering customers (CRM), products/inventory, and sales challans, with
role-based auth for Admin, Sales, Warehouse, and Accounts.

## Architecture

- **Backend**: Node.js + TypeScript + Express, PostgreSQL via Prisma ORM, JWT auth,
  Zod input validation, centralized error handling.
- **Frontend**: React + TypeScript (Vite), React Router, Axios, role-aware UI.
- **Database**: PostgreSQL (works with any provider — local, Neon, Supabase, Render Postgres).
- Business logic of note: sales challans store a **product snapshot** (name, SKU, price)
  at the time of creation rather than only a foreign key, so historical challans remain
  accurate even if a product is later renamed or repriced. Confirming a challan checks
  stock availability inside a database transaction and rejects the request with a clear
  error if stock is insufficient, so stock can never go negative. Cancelling a previously
  confirmed challan restocks the items and logs the reversal in the stock movement log.

## Project Structure

```
erp-crm/
├── backend/          Express + TypeScript API
│   ├── prisma/        schema.prisma, seed.ts
│   └── src/           routes, middleware, prisma client
├── frontend/         React + TypeScript (Vite) app
│   └── src/            pages, components, api client, auth context
├── docker-compose.yml          local Postgres for development
├── ERP-CRM.postman_collection.json   Postman collection for all APIs
└── README.md
```

## Local Setup

### 1. Database

Easiest local option — start Postgres with Docker:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with user `erp_user`, password
`erp_password`, database `erp_crm` (matches the example `.env` below). If you don't
have Docker, use a free hosted Postgres instead (Neon, Supabase, or Render Postgres)
and put its connection string in `DATABASE_URL`.

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env if you're using your own DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate dev --name init   # creates tables
npm run seed                          # creates test users + sample data
npm run dev                           # starts API on http://localhost:4000
```

> **Note on `prisma generate`**: this step needs to download a Prisma query-engine
> binary from `binaries.prisma.sh` the first time. It works fine on a normal machine
> with internet access — it was only blocked in the sandboxed environment this repo
> was drafted in (which allow-lists a fixed set of domains). If `npm install` doesn't
> trigger it automatically, run `npx prisma generate` once before `npm run dev`.

Seeded login credentials (all use password `Password@123`):

| Role      | Email              |
|-----------|--------------------|
| Admin     | admin@erp.test     |
| Sales     | sales@erp.test     |
| Warehouse | warehouse@erp.test |
| Accounts  | accounts@erp.test  |

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:4000
npm install
npm run dev             # starts UI on http://localhost:5173
```

Open `http://localhost:5173`, log in with any seeded user above, and you'll land on
the Customers page with nav to Products and Challans.

## Environment Variables

**backend/.env**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret used to sign auth tokens
- `PORT` — API port (default 4000)

**frontend/.env**
- `VITE_API_URL` — base URL of the backend API

## API Overview

All routes except `/auth/login` require `Authorization: Bearer <token>`.

- `POST /auth/login`
- `GET/POST /customers`, `GET/PUT /customers/:id`, `POST /customers/:id/notes`
- `GET/POST /products`, `GET/PUT /products/:id`, `POST /products/:id/stock-movements`
- `GET/POST /challans`, `GET /challans/:id`, `PUT /challans/:id/confirm`, `PUT /challans/:id/cancel`

Full request/response examples are in `ERP-CRM.postman_collection.json` — import it
into Postman and set the `token` collection variable after logging in.

## Deployment (free-tier options)

- **Frontend** → Vercel or Netlify: point at `frontend/`, build command
  `npm run build`, output directory `dist`, set `VITE_API_URL` to your deployed
  backend URL.
- **Backend** → Render or Railway: point at `backend/`, build command
  `npm install && npx prisma generate && npm run build`, start command `npm start`,
  set `DATABASE_URL` and `JWT_SECRET` env vars, run `npx prisma migrate deploy`
  once against the production database.
- **Database** → Neon, Supabase, or Render Postgres free tier.

AWS deployment (EC2 + RDS, or Elastic Beanstalk) is a bonus per the brief but not
required — the free-tier path above satisfies "a working local setup" plus optional
live URLs if you choose to deploy.

## Assumptions Made

- Purchase orders were listed in the business context but not in the required
  modules list, so they were left out of scope; stock is adjusted either manually
  (Warehouse "Adjust Stock" action) or automatically when a challan is confirmed.
- User creation/management UI wasn't specified as a required feature, so accounts
  are provisioned via the seed script rather than a signup flow — reasonable for an
  internal tool where an Admin would typically provision accounts directly in the DB
  or via a future "Users" admin screen.
- Invoices were mentioned in the business context but not in the required modules;
  only the Sales Challan module (explicitly required) was built.

## Known Limitations

- No PDF export or Docker setup for the app itself (only Postgres) — listed as bonus
  items in the brief, not implemented here.
- No automated test suite (unit/integration tests) — given the 48-hour window,
  effort went into getting the core required flows correct end-to-end.
- Pagination exists on all list endpoints but the frontend doesn't yet expose
  pagination controls (loads first page, up to 100 rows per request via `pageSize`).

## Recording Your Walkthrough

Since the recording is a mandatory submission requirement, a natural flow to record is:

1. Log in as each role once, to show the different nav/permissions.
2. Add a customer, open its detail page, add a follow-up note.
3. Add a product, then use "Adjust Stock" to show the IN/OUT movement log.
4. Create a sales challan as Draft, then Confirm it — point out the stock count
   dropping on the Products page afterward.
5. Try creating a challan with a quantity greater than available stock, to show the
   "insufficient stock" validation error.
6. Cancel a confirmed challan and show the stock being restored.
