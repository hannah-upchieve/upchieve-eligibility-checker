# Data folder

One CSV per state, named `data/<STATE_CODE>.csv` using the two-letter code in
[`js/states.js`](../js/states.js). All 51 files (50 states + DC) are present, covering
95,461 schools.

## Columns

| column | description |
|---|---|
| `school_name` | Full school name |
| `district_name` | District name (shown with the result) |
| `city_name` | City (shown in search results to disambiguate same-named schools) |
| `total_students` | Total enrollment |
| `frl_eligible_students` | Students eligible for free/reduced lunch; blank when not reported |
| `national_school_lunch_program` | NSLP participation status; blank when not reported |

## Eligibility rule (implemented in `js/app.js`)

A school is **eligible** if either:

- `frl_eligible_students / total_students >= 40%`, or
- `national_school_lunch_program` starts with "Yes under Community Eligibility Option"

Note the NSLP value `Yes participating without using any Provision or the CEO` contains
the string "CEO" but means the school is **not** using it — the match is anchored to the
start of the value for that reason. `Yes under Provision 2` / `Provision 3` are also not
CEO and do not confer eligibility on their own.

Schools with no free/reduced-lunch count and no CEO status come out as not eligible,
since there is nothing to compute from.

## Regenerating from a new NCES export

These files were built from an NCES ELSI public-school export (CCD 2024-25). To refresh:

1. Export from https://nces.ed.gov/ccd/elsi/ with these columns: School Name, State
   Name, Location City, Agency Name, National School Lunch Program, Total Students All
   Grades, Free and Reduced Lunch Students.
2. Run:

```bash
python3 scripts/build_state_csvs.py ~/Downloads/ELSI_csv_export_XXXX.csv
```

The script title-cases ALL-CAPS names (keeping acronyms like ISD, USD, HS, and fixing
McKinley / O'Brien / St. / 10th), maps state names to codes, and drops rows with no
enrollment — closed schools and administrative records, which aren't places a student
would search for.
