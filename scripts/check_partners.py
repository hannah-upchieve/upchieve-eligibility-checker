#!/usr/bin/env python3
"""Tidy and check data/partners.csv, the list of schools already partnered
with UPchieve. The checker shows these as not eligible.

Usage:  python3 scripts/check_partners.py [new_list.csv]

To update the list, export it (e.g. from Retool) with the columns
NCES ID, School Name, City, State, and either save it over data/partners.csv
or pass it to this script, which copies it there. Any title rows above the
header are skipped.

The script rewrites data/partners.csv with standard headers, restores leading
zeros a spreadsheet dropped (IDs are 12 digits), sorts it by name, and
reports rows to fix by hand:
  - no NCES ID
  - an NCES ID that isn't in the checker's data
  - the same NCES ID listed twice
  - a name that looks unlike the checker's name for that ID (often just an
    abbreviation, but worth a glance: it is how a wrong ID shows up)
Only the NCES ID is used by the checker; the other columns are for people.
"""

import csv
import glob
import os
import re
import sys
from collections import Counter

COLUMNS = ["nces_id", "school_name", "city", "state"]
HEADER_ALIASES = {
    "nces id": "nces_id", "nces_id": "nces_id",
    "school name": "school_name", "school_name": "school_name",
    "city": "city", "state": "state",
}
STOP_WORDS = {"school", "schools", "high", "middle", "elementary", "academy",
              "charter", "the", "of", "and", "hs", "ms", "es", "sch", "jr", "sr"}


def words(name):
    return set(re.sub(r"[^a-z0-9]+", " ", name.lower()).split()) - STOP_WORDS


def names_overlap(a, b):
    squash_a = re.sub(r"[^a-z0-9]", "", a.lower())
    squash_b = re.sub(r"[^a-z0-9]", "", b.lower())
    return bool(words(a) & words(b)) or squash_a in squash_b or squash_b in squash_a


def read_list(path):
    with open(path, encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    header_at = next(
        (i for i, row in enumerate(rows)
         if any(cell.strip().lower() in ("nces id", "nces_id") for cell in row)),
        None,
    )
    if header_at is None:
        raise SystemExit(f"No 'NCES ID' column found in {path}")
    header = [HEADER_ALIASES.get(c.strip().lower(), "") for c in rows[header_at]]
    out = []
    for row in rows[header_at + 1:]:
        record = {col: "" for col in COLUMNS}
        for name, value in zip(header, row):
            if name:
                record[name] = value.strip()
        if any(record.values()):
            if record["nces_id"].isdigit():
                record["nces_id"] = record["nces_id"].zfill(12)
            out.append(record)
    return out


def main(source=None):
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target = os.path.join(repo_root, "data", "partners.csv")
    partners = read_list(source or target)
    partners.sort(key=lambda r: (r["school_name"].lower(), r["state"]))

    with open(target, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(partners)

    schools = {}
    for path in glob.glob(os.path.join(repo_root, "data", "[A-Z][A-Z].csv")):
        with open(path, encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                schools[row["nces_id"]] = row
    counts = Counter(r["nces_id"] for r in partners if r["nces_id"])

    problems = []
    for r in partners:
        label = f"{r['school_name']} ({r['city']}, {r['state']})"
        school = schools.get(r["nces_id"])
        if not r["nces_id"]:
            problems.append(f"no NCES ID: {label}")
        elif not school:
            problems.append(f"ID not in checker data: {r['nces_id']} {label}")
        else:
            if counts[r["nces_id"]] > 1:
                problems.append(f"ID listed more than once: {r['nces_id']} {label}")
            if not names_overlap(r["school_name"], school["school_name"]):
                problems.append(
                    f"name differs: {r['nces_id']} {label} -> checker has "
                    f"{school['school_name']} ({school['city_name']})"
                )

    found = sum(1 for r in partners if r["nces_id"] in schools)
    print(f"Wrote {len(partners)} partners to data/partners.csv; "
          f"{found} match a school in the checker")
    for problem in problems:
        print(f"  {problem}")


if __name__ == "__main__":
    if len(sys.argv) > 2:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
