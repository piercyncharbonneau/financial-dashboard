#!/usr/bin/env python3
"""
Converts QuickBooks Online Profit & Loss / Balance Sheet Excel exports
(data/source/*.xlsx) into normalized JSON (data/seed/*.json) that the
dashboard reads at build/request time.

This is the manual-import path used until the live QuickBooks Online API
integration (see src/lib/qbo/) is connected. Drop a new monthly export
into data/source/ following the naming convention below and re-run this
script to refresh the dashboard's seed data.

Naming convention for files in data/source/:
  <YYYY-MM>_profit-and-loss_<monthly|weekly>_<accrual|cash>.xlsx
  <YYYY-MM>_balance-sheet_<accrual|cash>.xlsx

Usage:
  python3 scripts/import_qbo_export.py
"""
import json
import re
import sys
from pathlib import Path
from datetime import datetime, date

try:
    import openpyxl
except ImportError:
    print("This script requires openpyxl. Install with: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "source"
SEED_DIR = ROOT / "data" / "seed"

# Row labels QuickBooks bolds as grand totals in a P&L export, in the
# order they appear. Used to tag which section/summary a total belongs to.
PL_SUMMARY_LABELS = {
    "Total for Income": "totalIncome",
    "Total for Cost of Goods Sold": "costOfGoodsSold",
    "Gross Profit": "grossProfit",
    "Total for Expenses": "totalExpenses",
    "Net Operating Income": "netOperatingIncome",
    "Total for Other Income": "otherIncome",
    "Total for Other Expenses": "otherExpenses",
    "Net Other Income": "netOtherIncome",
    "Net Income": "netIncome",
}

BS_SUMMARY_LABELS = {
    "Total for Current Assets": "totalCurrentAssets",
    "Total for Fixed Assets": "totalFixedAssets",
    "Total for Other Assets": "totalOtherAssets",
    "Total for Assets": "totalAssets",
    "Total for Current Liabilities": "totalCurrentLiabilities",
    "Total for Long-term Liabilities": "totalLongTermLiabilities",
    "Total for Liabilities": "totalLiabilities",
    "Total for Equity": "totalEquity",
    "Total for Liabilities and Equity": "totalLiabilitiesAndEquity",
}


def parse_footer_basis(ws) -> str:
    """QBO stamps 'Accrual Basis <timestamp>' or 'Cash Basis <timestamp>' in
    the last populated row of column A."""
    for row in range(ws.max_row, 0, -1):
        val = ws.cell(row=row, column=1).value
        if val:
            if "Accrual Basis" in str(val):
                return "accrual"
            if "Cash Basis" in str(val):
                return "cash"
    return "unknown"


def parse_report(path: Path, summary_labels: dict) -> dict:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Sheet1"]

    company = ws.cell(row=1, column=1).value
    report_name = ws.cell(row=2, column=1).value
    period_label = ws.cell(row=3, column=1).value
    basis = parse_footer_basis(ws)

    # header row: first row where column B (or later) has a non-empty value
    # and column A is blank/empty (the period-label row)
    header_row = None
    for r in range(1, min(ws.max_row, 10) + 1):
        a_val = ws.cell(row=r, column=1).value
        b_val = ws.cell(row=r, column=2).value
        if (a_val is None or str(a_val).strip() == "") and b_val is not None:
            header_row = r
            break
    if header_row is None:
        raise ValueError(f"Could not find header row in {path.name}")

    periods = []
    last_col = ws.max_column
    for c in range(2, last_col + 1):
        v = ws.cell(row=header_row, column=c).value
        periods.append(str(v) if v is not None else f"col{c}")

    rows = []
    summary = {}
    current_section = None

    for r in range(header_row + 1, ws.max_row + 1):
        cell = ws.cell(row=r, column=1)
        label = cell.value
        if label is None or str(label).strip() == "":
            continue
        label = str(label).strip()

        if "Basis" in label and ("Accrual Basis" in label or "Cash Basis" in label):
            # footer stamp row, not report data
            continue

        indent = cell.alignment.indent if cell.alignment and cell.alignment.indent else 0
        depth = int(indent)
        bold = bool(cell.font.bold) if cell.font else False

        values = {}
        has_value = False
        for i, c in enumerate(range(2, last_col + 1)):
            v = ws.cell(row=r, column=c).value
            if isinstance(v, (int, float)):
                values[periods[i]] = v
                has_value = True
            else:
                values[periods[i]] = None

        if depth == 0 and not bold and label not in summary_labels:
            # top-level section header, e.g. "Income", "Expenses", "Assets"
            current_section = label
            continue

        if label in summary_labels:
            summary[summary_labels[label]] = values
            continue

        if not has_value:
            # section/subsection header with no numbers of its own
            continue

        account_match = re.match(r"^(\d{3,5}(?:\.\d+)?)\s+(.*)$", label)
        account_code = account_match.group(1) if account_match else None
        display_name = account_match.group(2) if account_match else re.sub(r"^Total for\s+", "", label)

        rows.append({
            "label": label,
            "displayName": display_name,
            "accountCode": account_code,
            "depth": depth,
            "isSubtotal": bold,
            "section": current_section,
            "values": values,
        })

    return {
        "company": company,
        "reportName": report_name,
        "periodLabel": period_label,
        "basis": basis,
        "periods": periods,
        "rows": rows,
        "summary": summary,
        "sourceFile": path.name,
        "importedAt": datetime.utcnow().isoformat() + "Z",
    }


FILENAME_RE = re.compile(
    r"^(?P<period>\d{4}-\d{2})_(?P<type>profit-and-loss|balance-sheet)"
    r"(?:_(?P<granularity>monthly|weekly))?_(?P<basis>accrual|cash)\.xlsx$"
)


def main():
    SEED_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []

    if not SOURCE_DIR.exists() or not any(SOURCE_DIR.glob("*.xlsx")):
        print(f"No .xlsx files found in {SOURCE_DIR}", file=sys.stderr)
        sys.exit(1)

    for path in sorted(SOURCE_DIR.glob("*.xlsx")):
        m = FILENAME_RE.match(path.name)
        if not m:
            print(f"Skipping {path.name}: doesn't match naming convention", file=sys.stderr)
            continue

        report_type = m.group("type")
        summary_labels = PL_SUMMARY_LABELS if report_type == "profit-and-loss" else BS_SUMMARY_LABELS
        data = parse_report(path, summary_labels)

        out_name = path.stem + ".json"
        out_path = SEED_DIR / out_name
        out_path.write_text(json.dumps(data, indent=2))

        manifest.append({
            "id": path.stem,
            "reportType": report_type,
            "granularity": m.group("granularity"),
            "basis": m.group("basis"),
            "period": m.group("period"),
            "file": out_name,
        })
        print(f"Wrote {out_path.relative_to(ROOT)} ({len(data['rows'])} rows, basis={data['basis']})")

    manifest_path = SEED_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(sorted(manifest, key=lambda m: (m["reportType"], m["period"])), indent=2))
    print(f"Wrote {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
