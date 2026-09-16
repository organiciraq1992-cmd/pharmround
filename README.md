# PharmRound

A mobile-first web app for **hospital clinical pharmacists** doing morning ward rounds for up to 50 patients on a smartphone or tablet. Built with Next.js 16, Prisma, and Supabase Postgres.

## Features

### Phase 1 — Rapid Patient Entry
- **Sticky, scrollable ward drug list** + a single editable quantity column per patient.
- **Category filters** — Tabs 💊 / Fluids 💧 / Supplies 💉 icon filters, plus A–Z letter chips.
- **Direct number entry** — type the quantity next to each prescribed drug; empty cells aren't saved.
- **Save & Next Patient** — records the patient and clears the column for the next one.
- **Patient counter badge** with progress ring (X / 50).

### Phase 2 — Ward Round Matrix
- **Matrix grid** with only the drugs actually used by patients as columns.
- **Sticky headers** — top drug header, left patient column, bottom totals row.
- **Aggregated totals** row so the pharmacist can order total ward quantities.
- **Print / Export to PDF** — A4 landscape, 7pt compact cells, vertical drug headers.

### Database
- **Supabase Postgres** via Prisma ORM.
- **Admin Inventory** (hospital-level, seeded) → **Ward Side List** (user-curated) → **Patients + prescriptions**.

## Tech Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM + Supabase Postgres
- TanStack Query (server state) + Framer Motion (UI)

## Local Development

```bash
bun install

# Set up the database (uses DATABASE_URL from .env.local)
bun run db:push    # create/sync tables
bun run db:seed    # seed 24 hospital inventory drugs

bun run dev        # start dev server on :3000
```

Create a `.env.local` (see `.env.example`) with your Supabase connection string:
```
DATABASE_URL=postgresql://postgres.<REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```

## Database Commands
```bash
bun run db:push      # apply schema changes
bun run db:seed      # seed hospital inventory (24 drugs)
bun run db:generate  # regenerate Prisma Client
bun run db:reset     # full reset
```

## Deployment (Vercel)
1. Push to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Add environment variable `DATABASE_URL` (your Supabase pooler URL).
4. Deploy.

> Use the **pooler** hostname (`aws-0-<region>.pooler.supabase.com`) — the direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from serverless platforms.
