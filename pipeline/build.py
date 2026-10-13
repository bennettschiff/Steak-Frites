"""End-to-end: pull from ESPN -> apply overrides -> compute site data.

For an ESPN-free re-process (e.g., after editing pipeline/overrides.py), use:

    python -m pipeline.postprocess && python -m pipeline.records && python -m pipeline.keepers && python -m pipeline.players && python -m pipeline.power_rankings
"""
import json

from . import adp, pull, postprocess, records, keepers, players, power_rankings
from .config import DATA_DIR


def preserve_unchanged_timestamp(path, field, previous):
    """Keep retry runs from committing/redeploying timestamp-only changes."""
    if previous is None or not path.exists():
        return
    current = json.loads(path.read_text())
    old = json.loads(previous)
    if {k: v for k, v in current.items() if k != field} == {
        k: v for k, v in old.items() if k != field
    }:
        path.write_text(previous)


def main():
    timestamp_files = {
        "meta.json": "updated_at",
        "power_rankings.json": "generated_at",
        "adp.json": "pulled_at",
    }
    previous = {
        name: (DATA_DIR / name).read_text() if (DATA_DIR / name).exists() else None
        for name in timestamp_files
    }
    previous_data = {
        path: path.read_text()
        for path in DATA_DIR.rglob("*.json")
        if path.name != "meta.json"
    }
    pull.main()
    # Re-apply overrides to ensure they're consistently applied to the freshly
    # written seasons.json files (pull.py already does this once, but running
    # postprocess here is idempotent and keeps the owners.json index aligned).
    postprocess.main()
    records.main()
    keepers.main()
    try:
        adp.main()
    except Exception as exc:
        # The next season's public ADP feed is normally unavailable during the
        # fall. League standings and the rest of the site must not fail with it.
        print(f"ADP refresh skipped; preserving the last successful file: {exc}")
    players.main()
    power_rankings.main()
    # A new meta timestamp is meaningful when any season data changed, even
    # though the meta object itself contains only configuration and the date.
    # Power rankings/ADP can independently preserve their unchanged timestamps.
    for name, field in timestamp_files.items():
        if name != "meta.json":
            preserve_unchanged_timestamp(DATA_DIR / name, field, previous[name])
    current_data = {
        path: path.read_text()
        for path in DATA_DIR.rglob("*.json")
        if path.name != "meta.json"
    }
    if current_data == previous_data:
        preserve_unchanged_timestamp(DATA_DIR / "meta.json", "updated_at", previous["meta.json"])


if __name__ == "__main__":
    main()
