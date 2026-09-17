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
```

## Before launch

Set `NOMINATION_URL` at the top of [`js/app.js`](js/app.js) — it's currently a `#`
placeholder behind the "Nominate your school" button.

## Adding state data

Drop a CSV into `data/` named with the two-letter state code (`data/NY.csv`). Required
columns and the eligibility rule are documented in [`data/README.md`](data/README.md).

States without a CSV show a "no data yet" message rather than breaking, so you can ship
with a few states and add the rest over time.

**`data/CA.csv` is fake sample data for testing — replace it before launch.**

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

## Deploy to GitHub Pages

1. Create a new repo on github.com (e.g. `upchieve-eligibility-checker`). Public repos
   get Pages for free.
2. From this folder:

```bash
git init && git add . && git commit -m "UPchieve school eligibility checker" && git branch -M main
```

3. Connect and push (replace `ORG` with your GitHub org or username):

```bash
git remote add origin https://github.com/ORG/upchieve-eligibility-checker.git && git push -u origin main
```

4. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from
   a branch**, branch `main`, folder `/ (root)`. Save.
5. After a minute the site is live at `https://ORG.github.io/upchieve-eligibility-checker/`.

Every later `git push` to `main` redeploys automatically.

### Custom domain (optional)

To serve it at something like `eligibility.upchieve.org`, add the domain under
**Settings → Pages → Custom domain** and create a CNAME record pointing at
`ORG.github.io` with your DNS provider.
