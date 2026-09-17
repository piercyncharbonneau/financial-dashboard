#!/usr/bin/env python3
"""
Rebuilds the company-wide monthly Payroll Detail report from a raw ADP-style
"Payroll Detail" export.

The raw export (data/source/payroll-detail-raw.xlsx, or any file with the
same layout) is a hierarchical report: 5 metadata rows, a header row, then
one block per employee — a row naming the employee and their pay type,
followed by one row per payroll check date, followed by one row per earning
line (Regular/Overtime/Holiday/Sick/Bonus) on that check date with a dollar
amount and (for hourly types) an hourly rate.

This script flattens that into the single-sheet, three-block report format
specified directly by the user (see the "finished product" example they
uploaded): a full transaction list grouped by pay type, a month x pay-type
company-wide total table, and a month total table — all styled to match
that example (Arial, bold white-on-#666666 headers, matching number
formats), with the two summary blocks computed via live SUMIFS formulas
against the transaction list rather than hardcoded, so editing a value in
the transaction block recalculates the summaries.

Usage:
  python3 scripts/build_payroll_detail_report.py <raw_payroll_detail.xlsx> [output.xlsx]

Note: this only produces correct cached values for the SUMIFS formulas when
opened in Excel/Google Sheets/LibreOffice Calc directly (they recalculate on
open) — this script does not run a recalculation pass itself.
"""
import sys
from datetime import datetime
from pathlib import Path

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

EARNING_TYPES_ALPHA = ["Bonus", "Holiday", "Overtime", "Regular", "Sick"]
MONTH_TYPE_ORDER = ["Regular", "Overtime", "Bonus", "Holiday", "Sick"]
MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

HEADER_FILL = PatternFill("solid", fgColor="666666")
HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFFFF")
TITLE_FONT = Font(name="Arial", bold=True, size=18)
META_FONT = Font(name="Arial", bold=True, size=12)
BODY_FONT = Font(name="Arial")

AMOUNT_FORMAT = "$#,##0.00;-$#,##0.00"
TOTAL_FORMAT = '"$"#,##0'


def _fill_missing_rates(transactions):
    """A handful of hourly earning rows come through with a blank rate even
    though the employee clearly has one (every other row for them is
    populated) — an export quirk, not a missing-data case. Backfill each
    blank from that employee's nearest-by-date known rate (same employee,
    non-Bonus, rate not null); ties and no-earlier-value both resolve
    toward the closest date. Leaves Bonus rows (no rate concept) alone."""
    known_by_employee = {}
    for employee, check_date, earn_type, amount, rate in transactions:
        if earn_type != "Bonus" and rate is not None:
            known_by_employee.setdefault(employee, []).append((check_date, rate))
    for dates_rates in known_by_employee.values():
        dates_rates.sort(key=lambda dr: dr[0])

    filled = []
    unresolved = []
    for employee, check_date, earn_type, amount, rate in transactions:
        if rate is None and earn_type != "Bonus":
            candidates = known_by_employee.get(employee, [])
            if candidates:
                rate = min(candidates, key=lambda dr: abs((dr[0] - check_date).days))[1]
            else:
                unresolved.append((employee, check_date, earn_type, amount))
        filled.append((employee, check_date, earn_type, amount, rate))

    if unresolved:
        print(
            f"WARNING: {len(unresolved)} hourly earning row(s) have no rate anywhere "
            f"for that employee, left blank: {unresolved[:5]}"
            + (" ..." if len(unresolved) > 5 else ""),
            file=sys.stderr,
        )
    return filled


def parse_raw_export(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.worksheets[0]

    meta = [ws.cell(row=r, column=1).value for r in range(1, 6)]

    transactions = []  # (employee, check_date, earning_type, amount, rate)
    current_employee = None
    for r in range(7, ws.max_row + 1):
        name = ws.cell(row=r, column=1).value
        if name:
            current_employee = name
        check_date = ws.cell(row=r, column=4).value
        earn_desc = ws.cell(row=r, column=5).value
        amount = ws.cell(row=r, column=6).value
        rate = ws.cell(row=r, column=7).value
        if earn_desc and isinstance(check_date, datetime):
            transactions.append((current_employee, check_date, earn_desc, amount, rate))

    unknown = {t[2] for t in transactions} - set(EARNING_TYPES_ALPHA)
    if unknown:
        raise ValueError(
            f"Unexpected earning types not handled by this script: {unknown}. "
            "Update EARNING_TYPES_ALPHA / MONTH_TYPE_ORDER before rerunning."
        )

    transactions = _fill_missing_rates(transactions)
    return ws.title, meta, transactions


def build_report(sheet_title, meta, transactions, out_path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title

    # --- Title / metadata rows, merged A:E, matching the target format ---
    ws.merge_cells("A1:E1")
    ws["A1"] = meta[0]
    ws["A1"].font = TITLE_FONT
    for i, row in enumerate(meta[1:], start=2):
        ws.merge_cells(f"A{i}:E{i}")
        ws.cell(row=i, column=1, value=row).font = META_FONT

    # --- Headers (row 6), three blocks ---
    def header(col_letter, row, text):
        cell = ws[f"{col_letter}{row}"]
        cell.value = text
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="left")

    for col, text in zip("ABCDE", [
        "Employee Name", "Payroll Check Date", "Payroll Earning Description",
        "Payroll Earning Amount", "Payroll Hourly Earning Rate",
    ]):
        header(col, 6, text)
    for col, text in zip("HIJ", ["Month", "Pay Type", "Amount"]):
        header(col, 6, text)
    for col, text in zip("MN", ["Month", "Total Month Pay"]):
        header(col, 6, text)

    # --- Block 1: full transaction list, grouped by earning type (alpha),
    # then chronological month, then employee name ---
    def sort_key(t):
        employee, check_date, earn_type, amount, rate = t
        return (
            EARNING_TYPES_ALPHA.index(earn_type),
            (check_date.year, check_date.month),
            employee,
            check_date,
        )

    ordered = sorted(transactions, key=sort_key)
    last_row = 6 + len(ordered)
    for i, (employee, check_date, earn_type, amount, rate) in enumerate(ordered, start=7):
        ws.cell(row=i, column=1, value=employee).font = BODY_FONT
        ws.cell(row=i, column=2, value=MONTH_NAMES[check_date.month - 1]).font = BODY_FONT
        ws.cell(row=i, column=3, value=earn_type).font = BODY_FONT
        amt_cell = ws.cell(row=i, column=4, value=amount)
        amt_cell.font = BODY_FONT
        amt_cell.number_format = AMOUNT_FORMAT
        rate_cell = ws.cell(row=i, column=5, value=rate)
        rate_cell.font = BODY_FONT
        if rate is not None:
            rate_cell.number_format = "$#,##0.00"

    # --- Block 2: month x pay-type company-wide totals (only months with data),
    # fixed type order Regular/Overtime/Bonus/Holiday/Sick, values via SUMIFS
    # against Block 1 so this stays live if Block 1 is edited ---
    months_present = sorted({(t[1].year, t[1].month) for t in transactions})
    row = 7
    for (year, month) in months_present:
        month_name = MONTH_NAMES[month - 1]
        for earn_type in MONTH_TYPE_ORDER:
            ws.cell(row=row, column=8, value=month_name).font = BODY_FONT
            ws.cell(row=row, column=9, value=earn_type).font = BODY_FONT
            formula = (
                f'=SUMIFS($D$7:$D${last_row},$B$7:$B${last_row},H{row},'
                f'$C$7:$C${last_row},I{row})'
            )
            c = ws.cell(row=row, column=10, value=formula)
            c.font = BODY_FONT
            c.number_format = TOTAL_FORMAT
            row += 1
    block2_last_row = row - 1

    # --- Block 3: month totals across ALL 12 months of the report's year,
    # 0 for months with no data yet, via SUMIFS against Block 1 ---
    years = {t[1].year for t in transactions}
    report_year = min(years) if years else datetime.now().year
    for i, month_name in enumerate(MONTH_NAMES):
        r = 7 + i
        ws.cell(row=r, column=13, value=month_name).font = BODY_FONT
        formula = f'=SUMIFS($D$7:$D${last_row},$B$7:$B${last_row},M{r})'
        c = ws.cell(row=r, column=14, value=formula)
        c.font = BODY_FONT
        c.number_format = TOTAL_FORMAT

    # --- Column widths ---
    widths = {"A": 30, "B": 19, "C": 26, "D": 20, "E": 24, "H": 12, "I": 12, "J": 14, "M": 12, "N": 16}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    ws.auto_filter.ref = f"A6:E{last_row}"

    wb.save(out_path)
    return last_row - 6, block2_last_row - 6


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_name(src.stem + "_report.xlsx")

    sheet_title, meta, transactions = parse_raw_export(src)
    n_transactions, n_block2 = build_report(sheet_title, meta, transactions, out)
    print(f"Wrote {out}")
    print(f"  {n_transactions} transactions, {n_block2} month/type summary rows")


if __name__ == "__main__":
    main()
