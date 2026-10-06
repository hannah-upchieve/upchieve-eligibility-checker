#!/usr/bin/env python3
"""Add an `nces_id` column to every data/<STATE>.csv from an NCES ELSI export.

Usage:  python3 scripts/add_nces_ids.py <ELSI_export.csv>

The export needs these columns (the year suffix may differ):
  School Name / State Name / School ID (12-digit) / Location City / Agency Name

Rows are matched case- and punctuation-insensitively, trying in order:
  state + school + district + city
  state + school + city
  state + school + district
  state + school
A key that points at more than one NCES ID is ambiguous and skipped, so the
next, looser key is tried; a row with no unambiguous match gets a blank ID.
The ID is kept as text so its leading zeros survive.
"""

import csv
import glob
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_state_csvs import STATE_CODES, clean, find_column, match_key  # noqa: E402

KEYS = (
    ("school+district+city", lambda s, n, d, c: (s, n, d, c)),
    ("school+city", lambda s, n, d, c: (s, n, c)),
    ("school+district", lambda s, n, d, c: (s, n, d)),
    ("school", lambda s, n, d, c: (s, n)),
)


def load_ids(source_path):
    with open(source_path, encoding="utf-8-sig") as handle:
        lines = handle.read().split("\n")
    header_index = next(i for i, l in enumerate(lines) if l.startswith("School Name,"))
    reader = csv.DictReader([l for l in lines[header_index:] if l.strip()])

    col_name = find_column(reader.fieldnames, "School Name")
    col_state = find_column(reader.fieldnames, "State Name")
    col_id = find_column(reader.fieldnames, "School ID (12-digit)")
    col_city = find_column(reader.fieldnames, "Location City")
    col_district = find_column(reader.fieldnames, "Agency Name")

    lookups = [defaultdict(set) for _ in KEYS]
    for row in reader:
        if row.get(col_district) is None:  # trailing footnotes
            continue
        state = STATE_CODES.get(clean(row[col_state]).lower())
        nces_id = clean(row[col_id])
        if not state or not nces_id:
            continue
        parts = (state, match_key(row[col_name]),
                 match_key(row[col_district]), match_key(row[col_city]))
        for lookup, (_, make_key) in zip(lookups, KEYS):
            lookup[make_key(*parts)].add(nces_id)
    return lookups


def main(source_path):
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    lookups = load_ids(source_path)

    matched_by = defaultdict(int)
    unmatched = []
    for path in sorted(glob.glob(os.path.join(repo_root, "data", "*.csv"))):
        state = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            columns = [c for c in reader.fieldnames if c != "nces_id"]
            rows = list(reader)

        for row in rows:
            parts = (state, match_key(row["school_name"]),
                     match_key(row["district_name"]), match_key(row["city_name"]))
            row["nces_id"] = ""
            for lookup, (label, make_key) in zip(lookups, KEYS):
                ids = lookup.get(make_key(*parts), ())
                if len(ids) == 1:
                    row["nces_id"] = next(iter(ids))
                    matched_by[label] += 1
                    break
            else:
                unmatched.append((state, row["school_name"], row["city_name"]))

        with open(path, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=["nces_id"] + columns)
            writer.writeheader()
            writer.writerows(rows)

    total = sum(matched_by.values()) + len(unmatched)
    print(f"{total} schools: " + ", ".join(
        f"{matched_by[label]} on {label}" for label, _ in KEYS
    ) + f", {len(unmatched)} unmatched")
    for state, name, city in unmatched[:25]:
        print(f"  unmatched: {state} | {name} | {city}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
