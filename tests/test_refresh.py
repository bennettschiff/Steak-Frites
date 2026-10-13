"""Regression checks for incomplete pulls and redundant catch-up deployments."""
import json
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from pipeline import build, pull


class PullValidationTests(unittest.TestCase):
    def setUp(self):
        self.season = {
            "teams": [
                {"team_id": 1, "wins": 1, "losses": 0, "ties": 0},
                {"team_id": 2, "wins": 0, "losses": 1, "ties": 0},
            ],
            "matchups": [{"week": 1, "home_team_id": 1, "away_team_id": 2,
                          "home_score": 100, "away_score": 90}],
            "box_scores": {1: [{"team_id": 1}, {"team_id": 2}]},
        }

    def test_complete_week_and_string_week_keys_pass(self):
        pull.validate_current_season(self.season)
        self.season["box_scores"] = {"1": self.season["box_scores"][1]}
        pull.validate_current_season(self.season)

    def test_scoreboard_without_player_lineups_fails(self):
        self.season["box_scores"] = {}
        with self.assertRaisesRegex(ValueError, "Week 1"):
            pull.validate_current_season(self.season)

    def test_one_missing_team_lineup_fails(self):
        self.season["box_scores"][1].pop()
        with self.assertRaisesRegex(ValueError, "Week 1"):
            pull.validate_current_season(self.season)

    def test_missing_final_score_fails(self):
        self.season["matchups"][0]["away_score"] = None
        with self.assertRaisesRegex(ValueError, "Week 1"):
            pull.validate_current_season(self.season)

    def test_preseason_requires_teams_but_not_unplayed_lineups(self):
        for team in self.season["teams"]:
            team.update(wins=0, losses=0)
        self.season["box_scores"] = {}
        pull.validate_current_season(self.season)
        self.season["teams"] = []
        with self.assertRaisesRegex(ValueError, "no teams"):
            pull.validate_current_season(self.season)

    def test_active_pull_failure_does_not_write_freshness_or_cached_season(self):
        with patch.object(pull, "YEARS", [pull.CURRENT_YEAR]), \
             patch.object(pull, "season_to_dict", side_effect=RuntimeError("ESPN unavailable")), \
             patch.object(pull, "write_season") as write, \
             patch.object(pull, "build_owners_index") as owners, \
             patch("builtins.print"):
            with self.assertRaisesRegex(RuntimeError, "ESPN unavailable"):
                pull.main()
            write.assert_not_called()
            owners.assert_not_called()


class RetryTests(unittest.TestCase):
    def run_build(self, directory, change_score=False):
        def fake_pull():
            (directory / "meta.json").write_text(json.dumps({"current_year": 2026, "updated_at": "new"}))
            if change_score:
                (directory / "seasons" / "2026.json").write_text('{"score": 101}')

        def fake_rankings():
            (directory / "power_rankings.json").write_text(json.dumps({"week": 5, "generated_at": "new"}))

        with ExitStack() as stack:
            stack.enter_context(patch.object(build, "DATA_DIR", directory))
            for module in (build.pull, build.postprocess, build.records, build.keepers,
                           build.adp, build.players, build.power_rankings):
                effect = fake_pull if module is build.pull else fake_rankings if module is build.power_rankings else None
                stack.enter_context(patch.object(module, "main", side_effect=effect))
            build.main()

    def test_unchanged_retry_preserves_exact_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / "seasons").mkdir()
            (directory / "seasons" / "2026.json").write_text('{"score": 100}')
            (directory / "meta.json").write_text('{"current_year": 2026, "updated_at": "old"}\n')
            (directory / "power_rankings.json").write_text('{"week": 5, "generated_at": "old"}\n')
            before = {p: p.read_bytes() for p in directory.rglob("*.json")}
            self.run_build(directory)
            self.assertEqual(before, {p: p.read_bytes() for p in directory.rglob("*.json")})

    def test_score_correction_advances_freshness_even_with_same_rankings(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / "seasons").mkdir()
            (directory / "seasons" / "2026.json").write_text('{"score": 100}')
            (directory / "meta.json").write_text('{"current_year": 2026, "updated_at": "old"}')
            (directory / "power_rankings.json").write_text('{"week": 5, "generated_at": "old"}')
            self.run_build(directory, change_score=True)
            self.assertEqual(json.loads((directory / "meta.json").read_text())["updated_at"], "new")
            self.assertEqual(json.loads((directory / "power_rankings.json").read_text())["generated_at"], "old")


if __name__ == "__main__":
    unittest.main()
