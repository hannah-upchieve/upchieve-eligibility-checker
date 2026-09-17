# UPchieve School Eligibility Checker

A single-purpose static page that lets a visitor pick their state, search for their
school, and see whether it's eligible. No backend — all data lives in per-state CSV
files and eligibility is calculated in the browser.

```
index.html            page markup
css/tokens.css        UPchieve design system tokens (color, type, spacing, radii)
css/style.css         page styles, built on those tokens
fonts/                Work Sans variable fonts
assets/logos/         UPchieve logo
js/states.js          state list → CSV filename mapping
js/app.js             CSV loading, search, eligibility calculation
data/<STATE>.csv      one file per state (see data/README.md)
scripts/              rebuild the state CSVs from an NCES ELSI export
```

## Before launch

Set `NOMINATION_URL` at the top of [`js/app.js`](js/app.js) — it's currently a `#`
placeholder behind the "Nominate your school" button.

## State data

All 51 files (50 states + DC) are in `data/`, covering 95,461 schools, built from an NCES
ELSI export of CCD 2024-25 data. Columns, the eligibility rule, and how to regenerate
from a newer export are documented in [`data/README.md`](data/README.md).

## Eligibility rule

A school is eligible if **either**:

- `frl_eligible_students / total_students >= 40%`, or
- `national_school_lunch_program` indicates Community Eligibility Option participation

The threshold lives in `FRL_THRESHOLD` at the top of [`js/app.js`](js/app.js). The page
shows only the verdict plus district and city — the underlying numbers stay hidden.

## Test locally

CSVs are loaded with `fetch()`, which browsers block on `file://` URLs, so you need a
local server:

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123.

## Deployment

Live at **https://hannah-upchieve.github.io/upchieve-eligibility-checker/**, served by
GitHub Pages from the `main` branch, root folder.

To publish a change (new state CSVs, copy edits, the nomination URL):

```bash
git add . && git commit -m "Add NY and TX school data" && git push
```

Pages rebuilds automatically, usually within a minute.

### Custom domain (optional)

To serve it at something like `eligibility.upchieve.org`, add the domain under
**Settings → Pages → Custom domain** in the repo, then create a CNAME record pointing at
`hannah-upchieve.github.io` with your DNS provider.

### Moving it to the UPchieve org later

**Settings → General → Transfer ownership.** The Pages URL changes to
`https://upchieve.github.io/upchieve-eligibility-checker/`, so update any links from the
program landing page.
