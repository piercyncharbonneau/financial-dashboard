#!/usr/bin/env python3
"""
Converts the "Sales Team Performance Tracker" Google Sheet (commission/new-
business tracker) export into normalized JSON the dashboard reads.

Source: data/source/sales-team-performance-tracker.csv, a plain CSV export
of the sheet (Google Sheets export as text/csv). The sheet's own layout is:
  row 1: a free-text instruction line
  row 2: real header row
  row 3..N: one row per signed account/deal
  after that: a hand-built pivot/summary block (Average:, Total ARR Added,
  by-rep and by-category breakdowns, a legend) that this script ignores —
  the dashboard computes its own summaries from the parsed deal rows instead.

To refresh: re-export the sheet as CSV to the same path and re-run this
script (requires no dependencies beyond the standard library).

Usage:
  python3 scripts/import_sales_tracker.py
"""
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "data" / "source" / "sales-team-performance-tracker.csv"
OUT_PATH = ROOT / "data" / "seed" / "sales-tracker.json"

REP_COLUMNS = ["Brian", "Justin", "Myles", "Levi", "Shania", "Colin", "Eric", "Piercyn"]


def parse_money(raw: str):
    raw = (raw or "").strip()
    if not raw or raw in ("#VALUE!", "#DIV/0!"):
        return None
    cleaned = raw.replace("$", "").replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_int(raw: str):
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return int(float(raw))
    except ValueError:
        return None


def parse_date(raw: str):
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in ("%m/%d/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return None  # non-date text like "X - Sent to Collections" lives in payStatus/notes instead


def main():
    if not SOURCE_PATH.exists():
        print(f"Missing {SOURCE_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(SOURCE_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    header = rows[1]
    records = []
    for row in rows[2:]:
        row = row + [""] * (len(header) - len(row))
        if row[9].strip() == "Average:":
            break  # start of the hand-built summary/pivot block
        account = row[2].strip()
        value = parse_money(row[0])
        if not account:
            continue  # blank spacer row (some carry a stray $0 in Value/ARR)

        commissions = {rep: parse_money(row[13 + i]) or 0 for i, rep in enumerate(REP_COLUMNS)}
        records.append({
            "value": value,
            "payStatus": row[1].strip() or None,
            "account": account,
            "category": row[3].strip() or None,
            "origination": row[4].strip() or None,
            "sourcedBy": row[5].strip() or None,
            "closedBy": row[6].strip() or None,
            "signDate": parse_date(row[7]),
            "firstServiceDate": parse_date(row[8]),
            "payrollDate": parse_date(row[9]),
            "grossTicket": parse_money(row[10]),
            "frequencyPerYear": parse_int(row[11]),
            "arr": parse_money(row[12]),
            "commissions": commissions,
        })

    out = {
        "source": "Sales Team Performance Tracker (Google Sheet)",
        "sourceFileId": "1gO4I6fB0GfD9R-TIkXJO21_Lr4fNH4caQ2Gd5ti-0dY",
        "importedAt": datetime.utcnow().isoformat() + "Z",
        "recordCount": len(records),
        "records": records,
    }
    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT_PATH.relative_to(ROOT)} ({len(records)} deal records)")


if __name__ == "__main__":
    main()
