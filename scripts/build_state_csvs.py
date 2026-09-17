#!/usr/bin/env python3
"""Turn an NCES ELSI public-school export into one CSV per state for the checker.

Usage:  python3 scripts/build_state_csvs.py <ELSI_export.csv>

Expects these ELSI columns (the year suffix may differ between exports):
  School Name / State Name / Location City / Agency Name /
  National School Lunch Program / Total Students All Grades / Free and Reduced Lunch Students

Writes data/<STATE_CODE>.csv with the columns the checker reads. Rows with no
enrollment (missing or 0 students) are dropped: those are closed schools and
administrative records, not places a student would search for.
"""

import csv
import os
import re
import sys
from collections import defaultdict

STATE_CODES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI",
    "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
    "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
    "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
    "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
    "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
}

# Tokens that stay uppercase through title-casing.
KEEP_UPPER = {
    "ISD", "USD", "CSD", "RSD", "UFSD", "CUSD", "CCSD", "SD", "ESD", "ESU",
    "AEA", "BOCES", "SDA", "ALC", "AEC", "SPED", "CTE", "ROP", "IB", "AP",
    "STEM", "STEAM", "ROTC", "JROTC", "TK", "PK", "YMCA", "YWCA", "USA",
    "MLK", "JFK", "FDR", "LBJ", "NE", "NW", "SE", "SW",
    "HS", "MS", "JHS", "SHS", "ES", "CS", "PCS",
    "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII",
}

# Lowercased when they fall in the middle of a name.
SMALL_WORDS = {
    "a", "an", "and", "at", "by", "for", "from", "in", "nor", "of", "on",
    "or", "the", "to", "with",
}

ELSI_MISSING = {"†", "–", "‡", "-", "—", ""}


def capitalize_word(word):
    lower = word.lower()
    first_letter = next((i for i, ch in enumerate(lower) if ch.isalpha()), None)
    if first_letter is None:
        return word
    # Keep any leading punctuation, e.g. "(calvin" -> "(Calvin"
    prefix, rest = lower[:first_letter], lower[first_letter:]

    if rest.startswith("mc") and len(rest) > 3 and rest[2].isalpha():
        return prefix + "Mc" + rest[2].upper() + rest[3:]

    if "'" in rest:
        head, _, tail = rest.partition("'")
        if not head:  # leading apostrophe, e.g. "'O Me-Nok"
            return prefix + "'" + tail[:1].upper() + tail[1:]
        head = head[:1].upper() + head[1:]
        if len(tail) == 1:  # possessive: Mary's, not Mary'S
            return prefix + head + "'" + tail
        return prefix + head + "'" + tail[:1].upper() + tail[1:]

    return prefix + rest[:1].upper() + rest[1:]


def convert_token(token, is_edge):
    if not token:
        return token

    for sep in ("-", "/"):
        if sep in token:
            return sep.join(convert_token(p, is_edge) for p in token.split(sep))

    core = token.strip(".,()\"'&")
    if core.upper() in KEEP_UPPER:
        return token
    if core[:1].isdigit():  # 10TH -> 10th, 1ST -> 1st
        return re.sub(r"(?<=\d)(ST|ND|RD|TH)\b", lambda m: m.group(1).lower(), token)
    # Only bare words get lowercased, so "(THE)" stays "(The)".
    if not is_edge and core == token and core.lower() in SMALL_WORDS:
        return token.lower()
    return capitalize_word(token)


def smart_title(text):
    """Title-case a value, but only if it arrived in ALL CAPS."""
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text or text != text.upper():
        return text
    tokens = text.split(" ")
    last = len(tokens) - 1
    return " ".join(
        convert_token(t, is_edge=(i == 0 or i == last)) for i, t in enumerate(tokens)
    )


def clean(value):
    value = (value or "").strip()
    return "" if value in ELSI_MISSING else value


def count(value):
    value = clean(value).replace(",", "")
    return value if value.isdigit() else ""


def find_column(fieldnames, prefix):
    for name in fieldnames:
        if name.startswith(prefix):
            return name
    raise SystemExit(f"Could not find a column starting with {prefix!r}")


def main(source_path):
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(repo_root, "data")

    with open(source_path, encoding="utf-8-sig") as handle:
        lines = [line for line in handle.read().split("\n")]

    header_index = next(i for i, l in enumerate(lines) if l.startswith("School Name,"))
    reader = csv.DictReader([l for l in lines[header_index:] if l.strip()])

    col_name = find_column(reader.fieldnames, "School Name")
    col_state = find_column(reader.fieldnames, "State Name")
    col_city = find_column(reader.fieldnames, "Location City")
    col_district = find_column(reader.fieldnames, "Agency Name")
    col_nslp = find_column(reader.fieldnames, "National School Lunch Program")
    col_total = find_column(reader.fieldnames, "Total Students All Grades")
    col_frl = find_column(reader.fieldnames, "Free and Reduced Lunch Students")

    by_state = defaultdict(list)
    skipped_no_enrollment = 0
    skipped_unknown_state = 0
    footer_rows = 0

    for row in reader:
        # Trailing footnote lines parse as short rows.
        if row.get(col_state) is None or row.get(col_frl) is None:
            footer_rows += 1
            continue

        state_code = STATE_CODES.get(clean(row[col_state]).lower())
        if not state_code:
            skipped_unknown_state += 1
            continue

        total = count(row[col_total])
        if not total or int(total) == 0:
            skipped_no_enrollment += 1
            continue

        by_state[state_code].append({
            "school_name": smart_title(row[col_name]),
            "district_name": smart_title(row[col_district]),
            "city_name": smart_title(row[col_city]),
            "total_students": total,
            "frl_eligible_students": count(row[col_frl]),
            "national_school_lunch_program": clean(row[col_nslp]),
        })

    columns = ["school_name", "district_name", "city_name", "total_students",
               "frl_eligible_students", "national_school_lunch_program"]

    os.makedirs(out_dir, exist_ok=True)
    written = 0
    for state_code, schools in sorted(by_state.items()):
        schools.sort(key=lambda s: (s["school_name"].lower(), s["city_name"].lower()))
        path = os.path.join(out_dir, f"{state_code}.csv")
        with open(path, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            writer.writerows(schools)
        written += len(schools)

    print(f"Wrote {len(by_state)} state files, {written} schools, to {out_dir}")
    print(f"Skipped {skipped_no_enrollment} rows with no enrollment")
    if skipped_unknown_state:
        print(f"Skipped {skipped_unknown_state} rows with an unrecognized state")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
