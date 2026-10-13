# Steak Frites — League History

A living history site for the Steak Frites fantasy football league.

- **Records & fun facts:** all-time leaderboards, blowouts, scoring records, streaks, champions.
- **Per-season recaps:** standings, weekly results, drafts.
- **Owner profiles:** lifetime record, head-to-head matrix, keeper history, full draft history.
- **Weekly power rankings:** phase-aware model scores plus a Google Sheet editor desk for commentary, featured teams, publishing controls, and bounded adjustments.
- **Keeper planner:** pick up to 2 players from your end-of-season roster, see if it's legal under the rules, see the cost (drafted round, or ADP-equivalent for repeat keepers).
  Repeat-keeper costs use current 10-team, 0.5-PPR ADP from Fantasy Football Calculator.

## Architecture

```
.
├── pipeline/        # Python: pulls from ESPN and computes records, keepers, players & rankings
├── data/            # canonical JSON dataset (committed; rebuilt by pipeline)
├── web/             # Next.js 16 app (App Router, TS, Tailwind 4)
├── exports/         # raw CSV + Excel exports (gitignored; from older export_league.py)
└── .github/workflows/              # league + ADP refreshes and auto-redeploys
```

## Local development

```bash
# 1. Pipeline (Python 3.12+)
pip install -r requirements.txt
ESPN_S2='…' SWID='{…}' python -m pipeline.build

# 2. Web app
cd web
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (also catches type errors)
```

### Cookies

ESPN now requires authentication for historical seasons even of public leagues. Get
your cookies from a logged-in browser session at fantasy.espn.com → DevTools →
Application → Cookies. You need `espn_s2` and `SWID` (keep the braces on SWID).

The cookies are read from env vars and never written to disk.

## Adding the next season

When the next ESPN season has data:

```bash
CURRENT_YEAR=2026 NEXT_YEAR=2027 \
ESPN_S2='…' SWID='{…}' \
python -m pipeline.build
```

The pipeline automatically treats the current calendar year as the active season
from August onward (and the prior year before August). Environment variables remain
available for an explicit override.

## Deployment (Vercel)

1. Create a Vercel project pointing at this repo, with **root directory = `web/`**.
2. No env vars are needed at build time. The site reads committed JSON and polls
   the published Google Sheet export for editor commentary and ranking overrides.
3. Push to `main` → Vercel auto-deploys.

## Weekly auto-refresh

`.github/workflows/refresh.yml` starts every Tuesday at 4:11am Eastern during
the season (September through January), with catch-up runs at 8:11am and
12:11pm. GitHub schedules can be delayed or dropped, so these are multiple
opportunities to publish the final week's matchups rather than a timing guarantee:

1. Reads ESPN cookies from repo secrets `ESPN_S2` and `SWID`.
2. Runs the pipeline.
3. Commits any data diff back to `main`.
4. Vercel sees the new commit and rebuilds.

Overlapping league refreshes are serialized and each run has a 15-minute limit.
Active-season pull failures or missing completed-week player lineups fail the
job instead of silently publishing stale records. Unchanged retry runs preserve
generated timestamps and do not create extra commits or deployments.

Set the secrets in GitHub → repo Settings → Secrets → Actions:
- `ESPN_S2` — value of the `espn_s2` cookie
- `SWID` — value of the `SWID` cookie (including the braces)

The refresh also writes `data/power_rankings.json`.
The public `/api/power-rankings-feed` route refreshes the workbook's hidden
`Auto Data` tab. The workbook's hidden `Site Export` tab is read by the site every
five minutes, so commentary and the bounded -5 to +5 adjustment publish without a
new deploy. The model score remains visible beside the edited score for auditability.

Workbook: https://docs.google.com/spreadsheets/d/18-2kfsfmkUnkmHSFqimlgOVYiCECCZ4GQWfSadLS2vM/edit

You can also trigger a manual refresh via the Actions tab → "Refresh league data"
→ Run workflow.

Keeper ADP has its own automatic refresh (`refresh-adp.yml`): daily from May
through August, then weekly on Tuesdays the rest of the year — deliberately
later in the day than the league refresh, which already runs the ADP step.
It uses the free Fantasy Football Calculator half-PPR feed for the league's
current team count, updates the keeper ADP data, and triggers a Vercel rebuild
only through committed data changes.

The retired Newsroom product concept is preserved in
`docs/newsroom-concept.md` for a possible future revival.

## Keeper rules (encoded in `pipeline/config.py`)

- Max 2 keepers per team per season
- Rounds 1-3: cannot be kept
- Rounds 4-7: at most 1
- Rounds 8-16: at most 2
- Free agents count as last-round keepers (round 16)
- If a player is kept by the same team for back-to-back seasons or more,
  from season 2+ their keeper cost is their current **10-team, 0.5-PPR ADP**
  (mapped to the equivalent draft round)

## Known limitations

- **Transactions:** ESPN's `recent_activity` endpoint returns
  "Communication Group does not exist" for this league because chat/activity
  was never initialized. The aggregate per-team counters (acquisitions, drops,
  trades) are still present in standings. See conversation history for full
  investigation.
- **Pre-2019 box scores:** ESPN's API doesn't expose player-level lineups for
  2016-2018. Team-level scores per matchup are still available.
- **Pre-2024 keepers:** ESPN's `keeper_status` flag was sparsely populated; what
  shows up is what ESPN recorded.
