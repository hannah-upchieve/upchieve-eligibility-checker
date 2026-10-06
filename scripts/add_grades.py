#!/usr/bin/env python3
"""Add `min_grade` and `max_grade` columns to every data/<STATE>.csv.

Usage:  python3 scripts/add_grades.py <grades.csv>

The grades file needs the columns nces_id, min_grade, max_grade (e.g. an ELSI
export of lowest/highest grade offered, renamed). Rows are joined on nces_id,
so run scripts/add_nces_ids.py first. ELSI's missing/not-applicable markers
become blanks; other values are kept as given ("Kindergarten", "6th Grade").
"""

import csv
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_state_csvs import clean  # noqa: E402

GRADE_COLUMNS = ["min_grade", "max_grade"]


def main(grades_path):
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(grades_path, encoding="utf-8-sig") as handle:
        grades = {row["nces_id"].strip(): row for row in csv.DictReader(handle)}

    matched = 0
    unmatched = []
    for path in sorted(glob.glob(os.path.join(repo_root, "data", "*.csv"))):
        with open(path, encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            columns = [c for c in reader.fieldnames if c not in GRADE_COLUMNS]
            rows = list(reader)

        for row in rows:
            source = grades.get(row["nces_id"])
            if source:
                matched += 1
            else:
                unmatched.append(row["nces_id"] or row["school_name"])
            for column in GRADE_COLUMNS:
                row[column] = clean(source[column]) if source else ""

        with open(path, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns + GRADE_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)

    print(f"{matched} schools matched, {len(unmatched)} unmatched")
    for item in unmatched[:25]:
        print(f"  unmatched: {item}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
