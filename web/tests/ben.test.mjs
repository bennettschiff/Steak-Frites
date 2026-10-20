import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BENS, benRecord, buildBenGames, summarizeBen } from "../src/lib/ben.ts";
import { buildVersusRecords } from "../src/lib/versus.ts";

const [katz, schiff, wolbransky, goldstein] = BENS;
const teams = BENS.map((ben, index) => ({
  team_id: index + 1, name: `Renamed team ${index}`, owner_ids: [ben.id, ben.id],
}));
const matchup = (overrides = {}) => ({
  week: 1, home_team_id: 1, away_team_id: 2, home_score: 120, away_score: 100,
  is_playoff: false, matchup_type: "NONE", ...overrides,
});
const season = (year, matchups) => ({ year, teams, matchups });

test("canonical owners, exclusions, duplicate rows, byes, and unplayed games", () => {
  const games = buildBenGames([
    season(2021, [matchup()]),
    season(2025, [
      matchup(), matchup(),
      matchup({ week: 2, home_score: 0, away_score: 0 }),
      matchup({ week: 3, away_team_id: null }),
      matchup({ week: 4, away_score: null }),
      matchup({ week: 5, away_team_id: 1 }),
      matchup({ week: 6, away_team_id: 999 }),
      matchup({ week: 7, home_score: 0, away_score: 80 }),
    ]),
  ], new Set([2021]));
  assert.equal(games.length, 2);
  assert.deepEqual(games.map((game) => game.week), [7, 1]);
  assert.equal(games[0].homeId, katz.id);
  assert.equal(games[0].homeTeam, "Renamed team 0");
  assert.equal(benRecord(summarizeBen(games, katz.id)), "1–1");
});

test("playoffs and consolation stay separate; ties and streaks respect perspective", () => {
  const games = buildBenGames([season(2025, [
    matchup({ week: 1, home_score: 100, away_score: 100 }),
    matchup({ week: 2, is_playoff: true, matchup_type: "WINNERS_BRACKET" }),
    matchup({ week: 3, home_team_id: 2, away_team_id: 1, home_score: 90, away_score: 110, is_playoff: true, matchup_type: "WINNERS_CONSOLATION_LADDER" }),
    matchup({ week: 4, home_team_id: 3, away_team_id: 4 }),
  ])], new Set());
  assert.deepEqual(games.map((game) => game.phase), ["regular", "consolation", "playoffs", "regular"]);
  const a = summarizeBen(games, katz.id, schiff.id);
  const b = summarizeBen(games, schiff.id, katz.id);
  assert.equal(benRecord(a), "2–0–1");
  assert.equal(a.streak, "W2");
  assert.equal(b.streak, "L2");
  assert.equal(a.winPct, 2.5 / 3);
  assert.equal(a.pointsFor, b.pointsAgainst);
  assert.equal(a.pointsAgainst, b.pointsFor);
  assert.equal(summarizeBen(games.filter((game) => game.phase === "playoffs"), katz.id).games, 1);
  assert.equal(summarizeBen(games, wolbransky.id, goldstein.id).wins, 1);
  assert.equal(summarizeBen([], katz.id).streak, "—");
  assert.equal(summarizeBen([], katz.id).winPct, 0);
});

test("committed archive reconciles with existing Versus records in both directions", () => {
  const read = (file) => JSON.parse(readFileSync(new URL(`../../data/${file}`, import.meta.url), "utf8"));
  const meta = read("meta.json");
  const owners = read("owners.json");
  const seasons = meta.years.map((year) => read(`seasons/${year}.json`));
  const excluded = new Set(Object.keys(meta.excluded_record_years).map(Number));
  const games = buildBenGames(seasons, excluded);
  const versus = buildVersusRecords(seasons, owners, excluded);
  assert.ok(games.length > 0);
  let appearances = 0, wins = 0, losses = 0, ties = 0;
  for (const ben of BENS) {
    assert.ok(owners.some((owner) => owner.owner_id === ben.id), `Missing canonical owner: ${ben.name}`);
    const total = summarizeBen(games, ben.id);
    appearances += total.games; wins += total.wins; losses += total.losses; ties += total.ties;
    for (const opponent of BENS.filter((other) => other.id !== ben.id)) {
      const actual = summarizeBen(games, ben.id, opponent.id);
      const expected = versus.find((record) => record.ownerId === ben.id && record.opponentId === opponent.id);
      assert.ok(expected, `${ben.surname} vs ${opponent.surname} must exist`);
      assert.equal(benRecord(actual), benRecord(expected));
      assert.ok(Math.abs(actual.pointsFor - expected.pointsFor) < 0.001);
      assert.equal(actual.streak, expected.currentStreak);
    }
  }
  assert.equal(appearances, games.length * 2);
  assert.equal(wins, losses);
  assert.equal(wins + ties / 2, games.length);
});
