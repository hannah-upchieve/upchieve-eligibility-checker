#!/usr/bin/env python3
"""Set the `admin_approved` column in every data/<STATE>.csv from
scripts/admin_approved.csv, a list of NCES school IDs UPchieve has approved.

Usage:  python3 scripts/apply_admin_approvals.py [new_list.csv]

To update the approvals, export the full list of approved NCES IDs (one
column, headed `ncessch` or `nces_id`) and pass it to this script. It replaces
scripts/admin_approved.csv with it, keeping the IDs marked as added by hand
(MANUAL_APPROVALS below), and then applies it: every school in the list is
approved and every other school is not. Run it after scripts/add_nces_ids.py.

IDs are 12 digits; leading zeros a spreadsheet dropped are restored. Values
that aren't numbers are skipped and reported, as are IDs with no matching
school in data/ (usually schools NCES doesn't list, or ones dropped from the
data for having no enrollment).
"""

import csv
import glob
import os
import sys

# Approved by hand, outside the exported list. Kept when the list is replaced.
MANUAL_APPROVALS = {
    "420321004930": "Belle Vernon Area HS (PA): NCES reports no FRL count; ~90% FRL",
    "420321007513": "Belle Vernon Area MS (PA): NCES reports no FRL count; ~90% FRL",
}

ID_HEADERS = ("ncessch", "nces_id", "nces id")


def read_ids(path):
    with open(path, encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        column = next(
            (c for c in reader.fieldnames if c.strip().lower() in ID_HEADERS), None
        )
        if column is None:
            raise SystemExit(f"No ncessch / nces_id column in {path}")
        ids, skipped = set(), []
        for row in reader:
            value = (row[column] or "").strip()
            if value.isdigit():
                ids.add(value.zfill(12))
            elif value:
                skipped.append(value)
    return ids, skipped


def main(source=None):
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    list_path = os.path.join(repo_root, "scripts", "admin_approved.csv")

    ids, skipped = read_ids(source or list_path)
    ids |= set(MANUAL_APPROVALS)
    with open(list_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["nces_id"])
        writer.writerows([i] for i in sorted(ids))

    found = set()
    approved = 0
    for path in sorted(glob.glob(os.path.join(repo_root, "data", "[A-Z][A-Z].csv"))):
        with open(path, encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            columns = reader.fieldnames
            rows = list(reader)
        for row in rows:
            is_approved = row["nces_id"] in ids
            row["admin_approved"] = "true" if is_approved else "false"
            if is_approved:
                found.add(row["nces_id"])
                approved += 1
        with open(path, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)

    print(f"{len(ids)} approved IDs ({len(MANUAL_APPROVALS)} added by hand); "
          f"{approved} schools approved in data/")
    print(f"  {len(ids - found)} IDs have no matching school in data/")
    for value in skipped:
        print(f"  skipped, not an NCES ID: {value}")


if __name__ == "__main__":
    if len(sys.argv) > 2:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
