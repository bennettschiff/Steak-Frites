"""Pull every season into typed JSON in data/seasons/<year>.json + owners/meta."""
from __future__ import annotations

import json
import traceback
from datetime import datetime, timezone
from pathlib import Path

from .config import YEARS, DATA_DIR, SEASONS_DIR, LEAGUE_ID, CURRENT_YEAR, NEXT_YEAR, EXCLUDED_RECORD_YEARS
from .espn import load_league
from .overrides import (
    CO_OWNER_MERGES,
    CO_OWNER_SOURCE_NAMES,
    DISPLAY_NAME_OVERRIDES,
    apply_overrides_to_members,
    apply_overrides_to_team,
    canonical_id,
    canonical_name,
)


def _owner_label(o):
    if isinstance(o, dict):
        fn = (o.get("firstName") or "").strip()
        ln = (o.get("lastName") or "").strip()
        dn = (o.get("displayName") or "").strip()
        return (f"{fn} {ln}".strip()) or dn or str(o.get("id", ""))
    return str(o)


def _owner_id(o):
    if isinstance(o, dict):
        return o.get("id")
    return str(o)


def season_to_dict(year: int) -> dict:
    print(f"  pulling {year}…")
    league = load_league(year)
    s = getattr(league, "settings", None)

    members = [
        {
            "id": getattr(m, "id", None) or m.get("id") if isinstance(m, dict) else getattr(m, "id", None),
            "name": _owner_label(m if isinstance(m, dict) else vars(m)),
        }
        for m in (getattr(league, "members", []) or [])
    ]

    teams = []
    for t in league.teams:
        teams.append(
            {
                "team_id": t.team_id,
                "name": getattr(t, "team_name", ""),
                "abbrev": getattr(t, "team_abbrev", ""),
                "owner_ids": [_owner_id(o) for o in (getattr(t, "owners", []) or [])],
                "owner_names": [_owner_label(o) for o in (getattr(t, "owners", []) or [])],
                "wins": getattr(t, "wins", 0) or 0,
                "losses": getattr(t, "losses", 0) or 0,
                "ties": getattr(t, "ties", 0) or 0,
                "points_for": float(getattr(t, "points_for", 0) or 0),
                "points_against": float(getattr(t, "points_against", 0) or 0),
                "acquisitions": getattr(t, "acquisitions", 0) or 0,
                "drops": getattr(t, "drops", 0) or 0,
                "trades": getattr(t, "trades", 0) or 0,
                "standing": getattr(t, "standing", None),
                "final_standing": getattr(t, "final_standing", None),
                "division_id": getattr(t, "division_id", None),
                "division_name": getattr(t, "division_name", None),
            }
        )

    # Draft
    draft = []
    n_teams = len(league.teams)
    for pick in getattr(league, "draft", []) or []:
        team = pick.team
        rd = getattr(pick, "round_num", None)
        rp = getattr(pick, "round_pick", None)
        draft.append(
            {
                "round": rd,
                "round_pick": rp,
                "overall_pick": (rd - 1) * n_teams + rp if rd and rp else None,
                "team_id": getattr(team, "team_id", None) if team else None,
                "player_id": getattr(pick, "playerId", None),
                "player_name": getattr(pick, "playerName", None),
                "keeper_status": bool(getattr(pick, "keeper_status", False)),
                "bid_amount": getattr(pick, "bid_amount", None),
            }
        )

    # Matchups + box scores
    matchups = []
    box_scores: dict[int, list[dict]] = {}  # week -> rows
    max_weeks = 18
    for week in range(1, max_weeks + 1):
        boxes = None
        used_scoreboard = False
        try:
            boxes = league.box_scores(week)
        except Exception:
            boxes = None
        if not boxes:
            try:
                boxes = league.scoreboard(week)
                used_scoreboard = bool(boxes)
            except Exception:
                boxes = None
        if not boxes:
            continue
        for bx in boxes:
            home = getattr(bx, "home_team", None)
            away = getattr(bx, "away_team", None)
            if home is None and away is None:
                continue
            hs = getattr(bx, "home_score", None)
            aws = getattr(bx, "away_score", None)
            mtype = getattr(bx, "matchup_type", None) or getattr(bx, "playoff_tier_type", None)
            home_id = getattr(home, "team_id", None) if home else None
            away_id = getattr(away, "team_id", None) if away else None
            matchups.append(
                {
                    "week": week,
                    "matchup_type": mtype,
                    "home_team_id": home_id,
                    "away_team_id": away_id,
                    "home_score": float(hs) if hs is not None else None,
                    "away_score": float(aws) if aws is not None else None,
                    "is_playoff": bool(getattr(bx, "is_playoff", False)) if hasattr(bx, "is_playoff") else (mtype not in (None, "NONE")),
                }
            )
            if used_scoreboard:
                continue  # no lineup data on scoreboard
            wk_rows = box_scores.setdefault(week, [])
            for side, team, lineup in (
                ("home", home, getattr(bx, "home_lineup", []) or []),
                ("away", away, getattr(bx, "away_lineup", []) or []),
            ):
                for p in lineup:
                    wk_rows.append(
                        {
                            "side": side,
                            "team_id": getattr(team, "team_id", None) if team else None,
                            "player_id": getattr(p, "playerId", None),
                            "player_name": getattr(p, "name", None),
                            "position": getattr(p, "position", None),
                            "slot_position": getattr(p, "slot_position", None),
                            "pro_team": getattr(p, "proTeam", None),
                            "points": float(getattr(p, "points", 0) or 0),
                            "projected_points": float(getattr(p, "projected_points", 0) or 0),
                            "injury_status": getattr(p, "injuryStatus", None),
                        }
                    )

    settings_dict = {
        "name": getattr(s, "name", None),
        "team_count": getattr(s, "team_count", None),
        "playoff_team_count": getattr(s, "playoff_team_count", None),
        "reg_season_count": getattr(s, "reg_season_count", None),
        "keeper_count": getattr(s, "keeper_count", None),
        "scoring_type": getattr(s, "scoring_type", None),
        "playoff_matchup_period_length": getattr(s, "playoff_matchup_period_length", None),
    }

    # Apply manual overrides (co-owner merges, name corrections) before writing.
    apply_overrides_to_members(members)
    for t in teams:
        apply_overrides_to_team(t)

    return {
        "year": year,
        "settings": settings_dict,
        "members": members,
        "teams": teams,
        "draft": draft,
        "matchups": matchups,
        "box_scores": box_scores,
    }


def write_season(year: int, payload: dict):
    path = SEASONS_DIR / f"{year}.json"
    path.write_text(json.dumps(payload, indent=2, default=str))
    bx_total = sum(len(v) for v in payload["box_scores"].values())
    print(
        f"  {year}: {len(payload['teams'])} teams, "
        f"{len(payload['matchups'])} matchups, {len(payload['draft'])} picks, {bx_total} box rows"
    )


def validate_current_season(payload: dict) -> None:
    """Do not publish a partial pull as a successful weekly records refresh."""
    teams = payload.get("teams") or []
    if not teams:
        raise ValueError("Active season has no teams")
    completed_weeks = max(t["wins"] + t["losses"] + t["ties"] for t in teams)
    team_ids = {t["team_id"] for t in teams}
    for week in range(1, completed_weeks + 1):
        matchups = [m for m in payload["matchups"] if m["week"] == week]
        scored_teams = {
            m[f"{side}_team_id"]
            for m in matchups
            for side in ("home", "away")
            if m.get(f"{side}_score") is not None
        }
        rows = payload["box_scores"].get(week, payload["box_scores"].get(str(week), []))
        lineup_teams = {r["team_id"] for r in rows}
        if not team_ids.issubset(scored_teams) or not team_ids.issubset(lineup_teams):
            raise ValueError(f"Active season Week {week} is missing scores or player lineups")


def build_owners_index() -> list[dict]:
    """Walk every season to build a canonical owner table keyed on member id.

    Distinguishes:
      - `primary_aliases`: names attached to the canonical id directly (the
        actual long-time owner). Used to pick the display name.
      - `co_owner_names`: names attached to merged-in ids (co-owners absorbed
        by the canonical owner via overrides.MERGES).
    """
    owners: dict[str, dict] = {}
    seen_appearance: dict[str, set] = {}  # canonical_id -> set of (year, team_id)

    for year in YEARS:
        p = SEASONS_DIR / f"{year}.json"
        if not p.exists():
            continue
        data = json.loads(p.read_text())
        for t in data["teams"]:
            ids = t.get("owner_ids", [])
            originals = t.get("owner_original_ids") or ids  # fallback for legacy data
            names = t.get("owner_names", [])
            for oid, original_id, oname in zip(ids, originals, names):
                if not oid:
                    continue
                ow = owners.setdefault(
                    oid,
                    {
                        "owner_id": oid,
                        "display_name": oname,
                        "aliases": [],
                        "primary_aliases": [],
                        "co_owner_names": [],
                        "appearances": [],
                    },
                )
                # Track all names ever associated with this canonical owner.
                if oname and oname not in ow["aliases"]:
                    ow["aliases"].append(oname)
                # Did this (id, name) pair come from the canonical id itself,
                # or from a merged source id? Two signals: (1) original_id !=
                # canonical (reliable on freshly canonicalized data); (2) name
                # appears in CO_OWNER_SOURCE_NAMES (fallback for already-
                # canonicalized data without owner_original_ids).
                is_merged = (original_id != oid) or (oname in CO_OWNER_SOURCE_NAMES)
                # If merged, was it a co-owner merge (separate person) or an
                # alias merge (same person, different ESPN account)?
                is_co_owner_merge = (
                    original_id in CO_OWNER_MERGES
                    or oname in CO_OWNER_SOURCE_NAMES
                )
                if not is_merged:
                    if oname and oname not in ow["primary_aliases"]:
                        ow["primary_aliases"].append(oname)
                elif is_co_owner_merge:
                    if oname and oname not in ow["co_owner_names"]:
                        ow["co_owner_names"].append(oname)
                # else: alias merge — name still lands in `aliases` above,
                # but isn't a primary nor a co-owner.

                key = (year, t["team_id"])
                appeared = seen_appearance.setdefault(oid, set())
                if key in appeared:
                    continue
                appeared.add(key)
                ow["appearances"].append(
                    {
                        "year": year,
                        "team_id": t["team_id"],
                        "team_name": t["name"],
                        "wins": t["wins"],
                        "losses": t["losses"],
                        "ties": t["ties"],
                        "points_for": t["points_for"],
                        "final_standing": t["final_standing"],
                    }
                )

    # Finalize: sort appearances, choose display name.
    for ow in owners.values():
        ow["appearances"].sort(key=lambda a: a["year"])
        # Display name precedence:
        #   1. Explicit DISPLAY_NAME_OVERRIDES
        #   2. Most recent primary alias (i.e., a name that belonged to the
        #      canonical id itself — not a merged co-owner)
        #   3. Most recent alias of any kind (safety net)
        if ow["owner_id"] in DISPLAY_NAME_OVERRIDES:
            ow["display_name"] = DISPLAY_NAME_OVERRIDES[ow["owner_id"]]
        elif ow["primary_aliases"]:
            ow["display_name"] = ow["primary_aliases"][-1]
        elif ow["aliases"]:
            ow["display_name"] = ow["aliases"][-1]
    return list(owners.values())


def main():
    print(f"Pulling years {YEARS[0]}–{YEARS[-1]} for league {LEAGUE_ID}…")
    for year in YEARS:
        try:
            payload = season_to_dict(year)
            if year == CURRENT_YEAR:
                validate_current_season(payload)
            write_season(year, payload)
        except Exception as e:
            print(f"  FAILED {year}: {e}")
            if year == CURRENT_YEAR:
                # Historical seasons can retain their cached files, but an
                # active-season failure must stop before records are rebuilt
                # and meta.updated_at claims a successful fresh pull.
                raise
            traceback.print_exc()

    owners = build_owners_index()
    (DATA_DIR / "owners.json").write_text(json.dumps(owners, indent=2, default=str))
    print(f"\nOwners: {len(owners)} unique")

    meta = {
        "league_id": LEAGUE_ID,
        "years": YEARS,
        "current_year": CURRENT_YEAR,
        "next_year": NEXT_YEAR,
        "excluded_record_years": {str(y): note for y, note in EXCLUDED_RECORD_YEARS.items()},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    (DATA_DIR / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"\nDone → {DATA_DIR}")


if __name__ == "__main__":
    main()
