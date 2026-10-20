import type { Season } from "./types";

// Canonical owner IDs survive team renames and merged ESPN accounts.
export const BENS = [
  { id: "{ECD9E4C2-4E30-4915-AC59-6C1700E34A69}", name: "Ben Katz", surname: "Katz" },
  { id: "{3A1A4E24-2A98-4038-9A4E-242A98803865}", name: "Bennett Schiff", surname: "Schiff" },
  { id: "{429F0506-3667-4F0B-A2ED-1761D0A3F682}", name: "Ben Wolbransky", surname: "Wolbransky" },
  { id: "{CBF6473A-C5A3-46D7-8EF8-BFAF0D868891}", name: "Ben Goldstein", surname: "Goldstein" },
] as const;

export type Ben = (typeof BENS)[number];
export type BenPhase = "regular" | "playoffs" | "consolation";
export type BenGame = {
  id: string;
  year: number;
  week: number;
  homeId: string;
  awayId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  phase: BenPhase;
};

export function buildBenGames(seasons: Season[], excludedYears: Set<number>): BenGame[] {
  const games: BenGame[] = [];
  const seen = new Set<string>();
  for (const season of seasons) {
    if (excludedYears.has(season.year)) continue;
    const teams = new Map(season.teams.map((team) => [team.team_id, team]));
    for (const matchup of season.matchups) {
      const { home_score: homeScore, away_score: awayScore } = matchup;
      if (homeScore == null || awayScore == null || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      // Match the archive's convention for unplayed schedule entries.
      if (homeScore <= 0 && awayScore <= 0) continue;
      const home = teams.get(matchup.home_team_id!);
      const away = teams.get(matchup.away_team_id!);
      if (!home || !away || home.team_id === away.team_id) continue;
      const homeBens = BENS.filter((ben) => home.owner_ids.includes(ben.id));
      const awayBens = BENS.filter((ben) => away.owner_ids.includes(ben.id));
      for (const homeBen of homeBens) {
        for (const awayBen of awayBens) {
          if (homeBen.id === awayBen.id) continue;
          const id = `${season.year}-${matchup.week}-${[homeBen.id, awayBen.id].sort().join("-")}`;
          if (seen.has(id)) continue;
          seen.add(id);
          games.push({
            id, year: season.year, week: matchup.week,
            homeId: homeBen.id, awayId: awayBen.id,
            homeTeam: home.name, awayTeam: away.name, homeScore, awayScore,
            phase: !matchup.is_playoff ? "regular"
              : matchup.matchup_type === "WINNERS_BRACKET" ? "playoffs" : "consolation",
          });
        }
      }
    }
  }
  return games.sort((a, b) => b.year - a.year || b.week - a.week || a.id.localeCompare(b.id));
}

export function summarizeBen(games: BenGame[], ownerId: string, opponentId?: string) {
  const meetings = games.filter((game) =>
    (game.homeId === ownerId || game.awayId === ownerId) &&
    (!opponentId || game.homeId === opponentId || game.awayId === opponentId),
  ).sort((a, b) => b.year - a.year || b.week - a.week);
  let wins = 0, losses = 0, ties = 0, pointsFor = 0, pointsAgainst = 0;
  let streak = "", streakCount = 0, streakEnded = false;
  for (const game of meetings) {
    const own = game.homeId === ownerId ? game.homeScore : game.awayScore;
    const opp = game.homeId === ownerId ? game.awayScore : game.homeScore;
    const result = own > opp ? "W" : own < opp ? "L" : "T";
    if (result === "W") wins++;
    else if (result === "L") losses++;
    else ties++;
    pointsFor += own;
    pointsAgainst += opp;
    if (!streak) streak = result;
    if (result !== streak) streakEnded = true;
    if (!streakEnded) streakCount++;
  }
  return {
    wins, losses, ties, pointsFor, pointsAgainst, games: meetings.length,
    winPct: meetings.length ? (wins + ties / 2) / meetings.length : 0,
    ppg: meetings.length ? pointsFor / meetings.length : 0,
    streak: meetings.length ? `${streak}${streakCount}` : "—",
  };
}

export function benRecord(record: { wins: number; losses: number; ties: number }) {
  return `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ""}`;
}
