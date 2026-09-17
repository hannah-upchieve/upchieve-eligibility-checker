# Data folder

Each file is named `data/<STATE_CODE>.csv` using the two-letter state code shown in
[`js/states.js`](../js/states.js) (e.g. `CA.csv`, `NY.csv`, `TX.csv`).

## Required columns

| column | description |
|---|---|
| `school_name` | Full school name |
| `district_name` | District name (shown alongside the school once selected) |
| `city_name` | City the school is in (shown in search results to disambiguate same-named schools) |
| `total_students` | Total enrollment |
| `frl_eligible_students` | Number of students eligible for free/reduced lunch |
| `national_school_lunch_program` | NSLP participation status, e.g. `No`, `Yes`, or `Yes under Community Eligibility Option (CEO)` |

Column order doesn't matter, but the header names must match exactly.

## Eligibility rule (implemented in `js/app.js`)

A school is **eligible** if either:

- `frl_eligible_students / total_students >= 40%`, OR
- `national_school_lunch_program` indicates participation in the Community Eligibility
  Option (any value containing both "yes" and "community eligibility"/"ceo", case-insensitive)

`CA.csv` in this folder is sample/placeholder data for testing only — replace it and add
the other 49 states + DC as you get real data. A state with no CSV file simply shows a
"no data yet" message instead of erroring.
