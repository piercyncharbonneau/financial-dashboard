# HOODZ Financial Dashboard

Internal financial dashboard and reporting tool for HOODZ of Kansas City: key
metrics at a glance, plus deep-dive views into the income statement and
balance sheet. Built to eventually pull live data from QuickBooks Online,
ServiceBridge (GPSI), ADP, Slack, and the team's Google Docs/Sheets trackers.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Recharts** for charts
- **NextAuth v5** (Google sign-in, restricted to an email allowlist/domain)
- **Server components + filesystem-backed JSON** for report data (no database yet — see [Roadmap](#roadmap))

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
`/sign-in` — until `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` and either
`ALLOWED_EMAIL_DOMAIN` or `ALLOWED_EMAILS` are set, nobody can sign in
(fails closed by design).

### Required environment variables

See `.env.example` for the full list and where to get each value:

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — sign-in
- `ALLOWED_EMAIL_DOMAIN` / `ALLOWED_EMAILS` — who's allowed in
- `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` — QuickBooks Online OAuth (optional until you're ready to connect live data)

## Data model: how financials get into the dashboard today

There's no live QuickBooks connection yet, so the dashboard reads from
JSON seed files generated from QuickBooks Online Excel exports:

```
data/source/*.xlsx   # raw QBO exports (P&L monthly/weekly x cash/accrual, balance sheet)
data/seed/*.json      # normalized JSON generated from data/source/, read by the app
```

**To refresh with a new month's exports:**

1. In QuickBooks Online, export Profit & Loss (monthly, accrual), Profit & Loss (monthly, cash), Profit & Loss (weekly, accrual), Profit & Loss (weekly, cash), and Balance Sheet as Excel files.
2. Drop them in `data/source/` following the naming convention:
   `<YYYY-MM>_profit-and-loss_<monthly|weekly>_<accrual|cash>.xlsx` and
   `<YYYY-MM>_balance-sheet_<accrual|cash>.xlsx`
3. Run the importer (requires Python 3 + `openpyxl`: `pip install openpyxl`):
   ```bash
   python3 scripts/import_qbo_export.py
   ```
4. Commit the updated `data/seed/*.json`.

The parser is generic — it reads QuickBooks' own indentation and bold-total
formatting to reconstruct the account hierarchy, so it should keep working
as your chart of accounts changes. See `scripts/import_qbo_export.py`.

### Going live: QuickBooks

`src/lib/qbo/` is a working live-data path, not just OAuth scaffolding:

- `client.ts` — OAuth handshake + an authenticated client that auto-refreshes
  an expiring token.
- `reports.ts` — pulls a Profit & Loss report (any date range, summarized by
  month) from the QBO Reports API and reshapes it into the same `ReportData`
  structure the xlsx importer produces, so every page that reads a report
  works unchanged regardless of source.
- `sync.ts` — pulls trailing 24 months of monthly P&L (accrual + cash) and
  caches it in the KV store (`src/lib/kv.ts`).
- `tokenStore.ts` — OAuth tokens, also in the KV store.

`src/lib/data/reports.ts`'s `getLatestProfitAndLoss` checks that cache first
and only falls back to the seed JSON if nothing's been synced yet — so once
QuickBooks is connected, the whole app (Overview, Income Statement, Forecast)
switches to live data with no further changes needed.

**Refresh happens two ways:** `vercel.json` schedules `/api/cron/refresh`
daily; the sidebar's "Refresh data" button hits `/api/refresh` on demand.
Both call the same `syncQboProfitAndLoss()`.

**What's deliberately not live yet:** the Balance Sheet. The Reports API's
group taxonomy for a balance sheet wasn't something this code could be
tested against (no network access to Intuit's API from the environment it
was built in), and a wrong cash figure is worse than a stale one — it feeds
the cash-on-hand projection directly. It stays on the manual xlsx import
until someone validates that parser against a real response.

**Known gap:** `reports.ts`'s P&L parser is written against QuickBooks'
documented Report API shape but has never run against a live response
either, for the same reason. Treat the first real sync as a validation
pass — pull up the same month in QuickBooks Online directly and compare.

**Storage:** tokens and cached reports live in Upstash Redis in production
(add the "Upstash for Redis" integration from the Vercel Storage tab — one
click, it sets `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
automatically) or a local file in dev. Without it in production, tokens
written by one serverless invocation aren't visible to the next — Vercel
functions don't share a disk.

**Sandbox vs. production keys:** an Intuit Developer app issues separate
Development (sandbox — a fake test company) and Production credentials.
Make sure `QBO_CLIENT_ID`/`QBO_CLIENT_SECRET` in Vercel are the Production
ones before expecting real company data.

### Sales tracker (Google Sheet)

The Sales page reads from `data/seed/sales-tracker.json`, generated by
`scripts/import_sales_tracker.py` from a CSV export of the "Sales Team
Performance Tracker" Google Sheet
(`data/source/sales-team-performance-tracker.csv`). This was pulled once via
an interactive session with Drive access — it is a snapshot, not a live
connection, and won't update on its own.

**To refresh:** re-export that sheet as CSV to the same path and re-run
`python3 scripts/import_sales_tracker.py` (standard library only, no deps).

**For a live connection** (the deployed app fetching it on its own, not a
person re-exporting it): create a Google Cloud service account, share the
sheet with its email address (Viewer is enough), and use the Sheets API
(`spreadsheets.values.get`) with that service account's credentials from a
server-side route — parallel to how `src/lib/qbo/` talks to QuickBooks.
Nobody has built this route yet.

The Master Schedule and Inventory & Fleet Tracking sheets are not wired up
yet — see the Integrations page for what's blocking each one.

### 2026 forecast + cash projection

The Forecast page (`src/app/forecast/`, logic in `src/lib/data/forecast.ts`)
builds revenue bottom-up from the Sales Tracker rather than extrapolating a
flat run-rate — HOODZ contracts auto-renew, so once ARR is added it recurs
in perpetuity instead of being a one-time bump, and a flat run-rate model
understates that:

- **Signed accounts, recurring forever** — every Sales Tracker deal bills
  its Gross Ticket amount on first service and every N months after (N
  implied by its billing frequency — quarterly, semi-annual, etc.), with no
  end date. A deal signed in June keeps contributing revenue in every
  future month its billing cycle lands on.
- **Untracked baseline** — the Sales Tracker only goes back to Sept 2024, so
  it doesn't explain 100% of actual revenue (legacy accounts, one-off
  product sales). The gap between actual revenue and what the tracker's
  model explains, for the trailing 3 actual months, is carried forward flat
  as this baseline.
- **Assumed new business** — future months also get an assumed new-deal
  cohort sized off the trailing 3 months of actual signings (not a flat
  full-year average), so a rep ramping up — or slowing down — shows up in
  the forecast rather than getting smoothed away.
- **Cost of Goods Sold** — the YTD aggregate ratio (sum of COGS / sum of
  revenue) applied to forecast revenue, since it scales with volume.
  **Operating expenses** are held flat at the YTD monthly average, since
  G&A and salaries are largely fixed.
- Deals signed but without a first-service date yet aren't placed in any
  month — they're surfaced separately so nothing is silently dropped or
  guessed into a month it might not land in.

**Cash-on-hand projection** starts from the actual bank balance on the
balance sheet and rolls forward projected net income, adjusted by the
historical average gap between cash-basis and accrual-basis net income
(quarterly billings and AR collection timing make accrual and cash income
diverge in any given month, even when they roughly net out over time). That
gap swings widely month to month in the 8 months of history available (one
month alone swung over $50k) — the projection reports a low/high band that
widens for further-out months rather than a false-precision point estimate.

The full methodology, with the actual numbers behind every assumption, is
rendered on the page itself and recalculates on every refresh. This is a
first pass — worth revisiting once there's a second year of data to detect
real seasonality, and once ServiceBridge is live to see committed future
work (open work orders), not just signed deals.

## Architecture

```
src/
  app/
    page.tsx                 Overview: KPI cards + trend charts
    income-statement/        Full P&L, monthly/weekly x accrual/cash toggle
    balance-sheet/           Full balance sheet + liquidity KPIs
    sales/                   Sales tracker: KPIs, ARR trend, by category/closer
    forecast/                2026 full-year forecast: actuals + run-rate + sales pipeline
    integrations/            Connection status + what's needed for each data source
    sign-in/                 Google sign-in
    api/auth/[...nextauth]/  NextAuth route handler
    api/integrations/quickbooks/   QuickBooks OAuth connect/callback routes
    api/refresh/             Manual "Refresh data" button, behind sign-in
    api/cron/refresh/        Daily auto-refresh (Vercel Cron), CRON_SECRET-protected, excluded from sign-in gate
  components/                 Presentational components (KpiCard, PLTable, nav, charts/, RefreshButton)
  lib/
    data/                     Report loading + derived metrics (reports.ts, metrics.ts, salesTracker.ts, salesMetrics.ts, forecast.ts, types.ts)
    qbo/                      client.ts, reports.ts (live P&L fetch), sync.ts (cache refresh), tokenStore.ts
    kv.ts                     Upstash Redis in prod / local file in dev — see "Going live: QuickBooks" above
  auth.ts                     NextAuth config (Google provider, allowlist)
  proxy.ts                    Route protection (Next.js's replacement for middleware.ts)
vercel.json                   Cron schedule for the daily refresh
scripts/
  import_qbo_export.py        QBO xlsx -> JSON importer, see above
  import_sales_tracker.py     Sales tracker CSV -> JSON importer, see below
data/
  source/                     Raw QBO Excel exports + sales tracker CSV (checked in — see note below)
  seed/                       Generated JSON the app reads
```

### A note on this repo containing real financial data

`data/source/` and `data/seed/` contain real HOODZ revenue, payroll, and
bank balance figures. **Make sure this GitHub repository is private.**
Nothing here is more sensitive than what's already in the P&L/balance sheet
files themselves, but there's no reason to make it public. OAuth tokens are
never committed — they're written to `.local/` (gitignored) and should move
to a proper secrets store before more than one person operates the
QuickBooks connection.

## Roadmap

Tracked in more detail on the [Integrations](/integrations) page in the app
itself, which shows live connection status per source. Rough order:

1. **QuickBooks Online** — replace the manual xlsx import with the live
   Accounting API (OAuth scaffold already in `src/lib/qbo/` and
   `/api/integrations/quickbooks/*`; needs a real Intuit Developer app).
2. **ServiceBridge (GPSI)** — dispatch/job data (jobs completed, technician
   utilization, revenue per job). Needs confirmation from GPSI on API
   availability for your plan.
3. **ADP** — payroll/labor cost, to compute labor cost as % of revenue.
   Likely needs an ADP Marketplace partner agreement; may use a recurring
   manual export as a stopgap in the meantime, same pattern as QuickBooks.
4. **Slack** — push weekly summaries / threshold alerts (e.g. cash below X,
   a month closes with negative net income).
5. **Google Docs/Sheets** — pull in the team's existing sales, scheduling,
   and expense trackers.

## Auth model

Sign-in is Google OAuth restricted by `ALLOWED_EMAIL_DOMAIN` and/or
`ALLOWED_EMAILS`. All routes except `/sign-in` and the NextAuth API routes
are gated by `src/proxy.ts`, which redirects unauthenticated requests to
`/sign-in`. There's no role/permission tiering yet — every signed-in user
sees everything, including payroll detail on the income statement. Worth
revisiting before adding non-leadership users.
