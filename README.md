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

This manual step goes away once the QuickBooks Online API integration
(`src/lib/qbo/`) is connected — see Roadmap below.

## Architecture

```
src/
  app/
    page.tsx                 Overview: KPI cards + trend charts
    income-statement/        Full P&L, monthly/weekly x accrual/cash toggle
    balance-sheet/           Full balance sheet + liquidity KPIs
    integrations/            Connection status + what's needed for each data source
    sign-in/                 Google sign-in
    api/auth/[...nextauth]/  NextAuth route handler
    api/integrations/quickbooks/   QuickBooks OAuth connect/callback routes
  components/                 Presentational components (KpiCard, PLTable, nav, charts/)
  lib/
    data/                     Report loading + derived metrics (reports.ts, metrics.ts, types.ts)
    qbo/                      QuickBooks OAuth client + token storage (client.ts, tokenStore.ts)
  auth.ts                     NextAuth config (Google provider, allowlist)
  proxy.ts                    Route protection (Next.js's replacement for middleware.ts)
scripts/
  import_qbo_export.py        xlsx -> JSON importer, see above
data/
  source/                     Raw QBO Excel exports (checked in — see note below)
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
