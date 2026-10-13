# Weekly records refresh repair — 2026-10-13

The Tuesday schedule was the bottleneck: the October 6 run did not start until
18:20 UTC (2:20pm Eastern), over six hours after its trigger. At noon Eastern
on October 13, no scheduled run had started. The existing production deployment
was healthy but still served the October 6 data.

A manual catch-up run (GitHub Actions `38427594758`) succeeded and pushed data
commit `45131f7`. ESPN now supplies Jason Myers's 2026 Week 5 starting-lineup
performance for Team Goldstein at 23.00 points; it appears in the all-time kicker
table at row 10. All five completed weeks have team scores and player lineups.

The permanent repair schedules Tuesday runs at 4:11am, 8:11am, and 12:11pm
Eastern, serializes overlapping league refreshes, and caps each run at 15 minutes.
The active season must load successfully, and every completed week must have
scores and lineups for every team. Historical season failures may still retain
cached history. Unchanged generated payloads retain their timestamps; a changed
season score still advances the overall freshness timestamp.

Validation: eight offline regression tests pass, the refreshed active-season
payload passes the completeness gate, and the missing Myers record matches the
user's ESPN screenshot. These tests also run before every GitHub refresh. No
credentials or production environment variables changed. The pre-existing local
`data/adp.json` edit is outside this repair and must remain uncommitted.

Release: push the focused repair to `main`, run the repaired workflow with the
existing GitHub ESPN secrets, then verify a READY production deployment and the
rendered kicker entry at https://steak-frites.vercel.app/records. GitHub cron
remains best-effort; the earlier run and catch-up triggers improve resilience,
but do not guarantee publication at an exact time.
