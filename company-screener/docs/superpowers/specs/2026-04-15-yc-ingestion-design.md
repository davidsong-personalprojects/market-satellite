# YC Company Ingestion Design

## Goal

Replace the static 15-company seed dataset with a live database of YC companies sourced from the YC Algolia index, enriched with careers page data and Crunchbase funding information. Refresh monthly.

## Architecture

Three-stage ingestion pipeline writes to a Neon Postgres database via Prisma. The Next.js dashboard switches from a static import to an API route backed by Prisma queries. A `npm run sync` command runs the full pipeline in sequence.

**Tech additions:** Prisma ORM, Neon Postgres (free tier), `node-fetch` (careers check), Playwright (Crunchbase scraping, already installed)

---

## Data Model

### `Company` table

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | String (PK) | Slugified name | e.g. `"stripe"` |
| `name` | String | YC / Algolia | |
| `website` | String | YC / Algolia | |
| `description` | String | YC / Algolia | One-liner |
| `batch` | String | YC / Algolia | e.g. `"W21"` |
| `sector` | String | YC / Algolia | Primary tag |
| `location` | String | YC / Algolia | |
| `employeeCount` | Int | YC team size midpoint | e.g. `"11-50"` → `30` |
| `type` | String | Hardcoded `"venture"` | All YC companies |
| `openRoles` | Int | Careers page | Current count |
| `isActivelyHiring` | Boolean | Derived: `openRoles > 0` | |
| `valuation` | Float? | Crunchbase | Billions USD, nullable |
| `lastRound` | String? | Crunchbase | e.g. `"Series B · Jan 2023"`, nullable |
| `hcGrowthPct` | Float? | Computed from snapshots | MoM open roles delta %, nullable |
| `updatedAt` | DateTime | Auto | Last sync timestamp |

### `CompanySnapshot` table

| Field | Type | Notes |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `companyId` | String (FK) | References `Company.id` |
| `openRoles` | Int | Captured at sync time |
| `scrapedAt` | DateTime | Sync timestamp |

`hcGrowthPct` is computed after each sync as `(current openRoles - previous openRoles) / previous openRoles * 100`, written back to `Company.hcGrowthPct`. Requires at least two snapshots to produce a value. On the first sync, all companies will have `hcGrowthPct = null` — the dashboard renders `—` for null growth, which is correct behaviour.

---

## Ingestion Pipeline

Three scripts run in sequence via `npm run sync`. Each script is idempotent — safe to re-run, upserts on `Company.id`.

### `scripts/scrape-yc.ts`

- Queries YC's Algolia index (`https://45bwzj1sgc-dsn.algolia.net/1/indexes/*/queries`) with `hitsPerPage=1000`, paginating until all companies are fetched
- Maps each hit to a `Company` upsert: name, website, description, batch, sector, location, employeeCount (team size range midpoint)
- Duration: ~30 seconds
- Output: ~4,000 rows in `Company` with `openRoles=0`, `isActivelyHiring=false`

### `scripts/check-careers.ts`

- Iterates all companies in DB
- For each, does a `fetch()` to find a careers page: checks `website/careers`, `website/jobs`, and looks for Greenhouse/Lever embed URLs in the homepage HTML
- Counts job listings by looking for known patterns (Greenhouse `gh-button`, Lever `posting`, raw `<li>` job entries)
- Updates `openRoles` and `isActivelyHiring`
- Creates a `CompanySnapshot` row for this run
- After all companies processed, computes `hcGrowthPct` from the two most recent snapshots per company and writes it back
- Rate limit: 100ms delay between requests
- Duration: ~2-3 hours for 4,000 companies

### `scripts/scrape-crunchbase.ts`

- Queries DB for `isActivelyHiring = true` companies (expected 200-800)
- For each, launches a Playwright browser, navigates to `crunchbase.com/organization/{slug}`
- Extracts last funding round (type + date) and post-money valuation if present
- Upserts `valuation` and `lastRound` on `Company`
- Rate limit: 2-3 second delay between requests, randomised
- Duration: ~1-2 hours for the filtered set

### `npm run sync`

```bash
tsx scripts/scrape-yc.ts && tsx scripts/check-careers.ts && tsx scripts/scrape-crunchbase.ts
```

For monthly cron: GitHub Actions `schedule` workflow on the free tier calls `npm run sync`.

---

## API Layer

### `app/api/companies/route.ts`

GET endpoint. Accepts query params:

| Param | Type | Maps to |
|---|---|---|
| `type` | `"venture" \| "public"` | `WHERE type = ?` |
| `sectors` | comma-separated strings | `WHERE sector IN (?)` |
| `batches` | comma-separated strings | `WHERE batch IN (?)` |
| `locations` | comma-separated strings | `WHERE location IN (?)` |
| `sizes` | comma-separated size bands | `WHERE employeeCount BETWEEN ? AND ?` |
| `valuationTiers` | comma-separated tiers | `WHERE valuation BETWEEN ? AND ?` |
| `activeOnly` | `"true"` | `WHERE isActivelyHiring = true` |
| `search` | string | `WHERE name ILIKE '%?%'` |

Returns `Company[]` as JSON. Filtering moves server-side — browser downloads only the matching subset, not all 4,000 rows.

`lib/filterCompanies.ts` is kept for unit tests but no longer used at runtime.
`lib/data.ts` is deleted.

---

## Dashboard Changes

### Types (`types/company.ts`)

**Remove:** `techStack`, `cultureScore`, `stage`, `investors`, `engBlogUrl`, `FundingStage`, `HiringSignal`, `CultureBand`, `ValuationTier`

**Add:** `batch: string`, `description: string`, `isActivelyHiring: boolean`

**`FilterState` remove:** `stages`, `hiringSignals`, `cultureScores`, `techStack`

**`FilterState` add:** `batches: string[]`, `activeOnly: boolean`

### Table columns (`components/CompanyRow.tsx`, `components/CompanyTable.tsx`)

| Column | Data |
|---|---|
| Company | Name + truncated description |
| Batch | e.g. `W21` |
| Growth | MoM open roles delta (▲/▼ %) from `hcGrowthPct` |
| Valuation | From Crunchbase (`—` if null) |
| Employees | `employeeCount` formatted |
| Open Roles | `openRoles` |

### Sidebar filters (`components/Sidebar.tsx`, `components/ui/FilterAccordion.tsx`)

**Remove:** Culture Score, Hiring Signal, Tech Stack, Stage

**Keep:** Sector, Location, Company Size, Valuation

**Add:**
- Batch multi-select (W24, S23, W23, S22, W22… last 10 batches)
- Active Hiring toggle (maps to `activeOnly: boolean`)

### Dashboard page (`app/page.tsx`)

Replaces static `COMPANIES` import with a `fetch('/api/companies?...')` call. Filter state changes trigger a new fetch. Loading state shows a skeleton or row count placeholder.

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Create |
| `lib/prisma.ts` | Create — singleton Prisma client |
| `scripts/scrape-yc.ts` | Create |
| `scripts/check-careers.ts` | Create |
| `scripts/scrape-crunchbase.ts` | Create |
| `app/api/companies/route.ts` | Create |
| `types/company.ts` | Modify — remove/add fields |
| `lib/data.ts` | Delete |
| `lib/filterCompanies.ts` | Modify — update for new FilterState shape |
| `lib/filterCompanies.test.ts` | Modify — update tests for new types |
| `lib/formatters.ts` | No change |
| `components/Sidebar.tsx` | Modify — new filter groups |
| `components/CompanyRow.tsx` | Modify — new columns |
| `components/CompanyTable.tsx` | Modify — new column headers |
| `app/page.tsx` | Modify — fetch from API route |
| `.env.local` | Create — `DATABASE_URL` from Neon |
| `.env.example` | Create — placeholder `DATABASE_URL` |
| `package.json` | Modify — add `sync` script, add `@prisma/client` |
