"use client";

import Link from "next/link";
import { useState } from "react";
import { BENS, benRecord, summarizeBen, type BenGame, type BenPhase } from "@/lib/ben";

const PHASES = [
  { value: "all", label: "All games" },
  { value: "regular", label: "Regular season" },
  { value: "playoffs", label: "Playoffs" },
  { value: "consolation", label: "Consolation" },
] as const;
const PAIRS = BENS.flatMap((ben, i) => BENS.slice(i + 1).map((opponent) => ({ ben, opponent, key: `${ben.id}:${opponent.id}` })));
const surname = (id: string) => BENS.find((ben) => ben.id === id)?.surname ?? "Unknown";
const phaseLabel = (phase: BenPhase) => PHASES.find((item) => item.value === phase)?.label;
const score = (points: number) => points.toFixed(2);

export function BenDashboard({ games }: { games: BenGame[] }) {
  const [year, setYear] = useState("all");
  const [phase, setPhase] = useState("all");
  const [pairKey, setPairKey] = useState("all");
  const years = [...new Set(games.map((game) => game.year))].sort((a, b) => b - a);
  const filtered = games.filter((game) => (year === "all" || game.year === Number(year)) && (phase === "all" || game.phase === phase));
  const standings = BENS.map((ben) => ({ ...ben, ...summarizeBen(filtered, ben.id) }))
    .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || b.ppg - a.ppg || a.surname.localeCompare(b.surname));
  const selectedPair = PAIRS.find((pair) => pair.key === pairKey);
  const log = selectedPair ? filtered.filter((game) =>
    [game.homeId, game.awayId].includes(selectedPair.ben.id) && [game.homeId, game.awayId].includes(selectedPair.opponent.id),
  ) : filtered;
  const closest = [...filtered].sort((a, b) => Math.abs(a.homeScore - a.awayScore) - Math.abs(b.homeScore - b.awayScore))[0];
  const blowout = [...filtered].sort((a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0];
  const highScore = [...filtered].sort((a, b) => Math.max(b.homeScore, b.awayScore) - Math.max(a.homeScore, a.awayScore))[0];
  const shootout = [...filtered].sort((a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0];

  function selectPair(key: string) {
    setPairKey(key);
    document.getElementById("ben-game-log")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div id="ben-records" className="scroll-mt-24 space-y-8">
      <div className="premium-panel flex flex-wrap items-end justify-between gap-4 rounded-xl p-4">
        <div>
          <div className="kicker">Choose the battleground</div>
          <p className="mt-1 text-sm text-[#6f6a60]">Season and game type update every record below.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-bold">Season
            <select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-black/15 bg-[#fffdf7] px-3 text-sm">
              <option value="all">All time</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold">Game type
            <select value={phase} onChange={(event) => setPhase(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-black/15 bg-[#fffdf7] px-3 text-sm">
              {PHASES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <section aria-labelledby="ben-standings">
        <SectionTitle kicker="Bragging rights" title="The Ben standings" id="ben-standings" />
        <p className="mb-4 text-sm text-[#6f6a60]" aria-live="polite">{year === "all" ? "All time" : year} · {PHASES.find((item) => item.value === phase)?.label} · {filtered.length} meetings · Against fellow Bens only</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {standings.map((ben, index) => (
            <article key={ben.id} className={`stat-card rounded-xl p-5 ${index === 0 && ben.games ? "ring-2 ring-[#c8962d]/60" : ""}`}>
              <div className="flex items-center justify-between">
                <Link href={`/teams/${encodeURIComponent(ben.id)}`} className="text-xl font-black hover:underline">{ben.surname}</Link>
                <span className="text-xs font-bold text-[#8a6a22]">{ben.games ? `#${index + 1}` : "—"}</span>
              </div>
              <div className="mt-4 text-4xl font-black tracking-tight tabular-nums">{benRecord(ben)}</div>
              <div className="mt-1 text-xs font-semibold text-[#6f6a60]">{ben.games} games against Bens</div>
              <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-black/10 pt-4 text-sm">
                <div><dt className="text-xs text-[#6f6a60]">Win %</dt><dd className="mt-1 font-bold">{ben.games ? `${(ben.winPct * 100).toFixed(1)}%` : "—"}</dd></div>
                <div><dt className="text-xs text-[#6f6a60]">Pts / game</dt><dd className="mt-1 font-bold">{ben.games ? ben.ppg.toFixed(1) : "—"}</dd></div>
                <div><dt className="text-xs text-[#6f6a60]">Streak</dt><dd className="mt-1 font-bold">{ben.streak}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#6f6a60]">Ordered by win percentage, then wins, then points per game. Streaks use the selected season and game type.</p>
      </section>

      <section aria-labelledby="ben-matrix">
        <SectionTitle kicker="The quick answer" title="Who owns whom?" id="ben-matrix" />
        <p className="mb-4 text-sm text-[#6f6a60]">Read across: each row’s record against the Ben in that column. Tap a record to see the games.</p>
        <div className="table-shell rounded-xl">
          <table className="w-full min-w-[560px] text-center text-sm">
            <thead><tr><th scope="col" className="p-4 text-left">Ben ↓ vs. Ben →</th>{BENS.map((ben) => <th scope="col" key={ben.id} className="p-4">{ben.surname}</th>)}</tr></thead>
            <tbody>{BENS.map((ben) => <tr key={ben.id}>
              <th scope="row" className="p-4 text-left">{ben.surname}</th>
              {BENS.map((opp) => {
                const record = summarizeBen(filtered, ben.id, opp.id);
                const pair = PAIRS.find((item) => [item.ben.id, item.opponent.id].includes(ben.id) && [item.ben.id, item.opponent.id].includes(opp.id));
                return <td key={opp.id} className="border-t border-black/5 p-2">{ben.id === opp.id ? <span className="text-[#aaa294]">—</span> :
                  <button type="button" onClick={() => pair && selectPair(pair.key)} aria-label={`${ben.surname} vs ${opp.surname}: ${benRecord(record)}. View games.`} className={`min-h-11 min-w-20 rounded-lg px-3 font-black tabular-nums hover:underline ${record.wins > record.losses ? "bg-[#123d35]/10 text-[#123d35]" : record.wins < record.losses ? "text-[#7d1d1d]" : "text-[#6f6a60]"}`}>{record.games ? benRecord(record) : "No games"}</button>}
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ben-rivalries">
        <SectionTitle kicker="Six ways to hold a grudge" title="The rivalries" id="ben-rivalries" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PAIRS.map(({ ben, opponent, key }) => {
            const record = summarizeBen(filtered, ben.id, opponent.id);
            const leader = record.wins > record.losses ? ben.surname : opponent.surname;
            return <button type="button" key={key} onClick={() => selectPair(key)} className="premium-panel rounded-xl p-5 text-left transition hover:border-[#c8962d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#123d35]">
              <div className="text-sm font-bold">{ben.surname} <span className="font-normal text-[#6f6a60]">vs.</span> {opponent.surname}</div>
              <div className="mt-3 text-3xl font-black tabular-nums">{benRecord(record)}</div>
              <p className="mt-2 text-sm text-[#6f6a60]">{!record.games ? "No meetings in this view" : record.wins === record.losses ? "All square. Nobody gets the last word." : `${leader} leads the series.`}</p>
              <div className="mt-4 flex justify-between gap-2 border-t border-black/10 pt-3 text-xs font-bold"><span>{record.games} meetings</span><span className="text-[#8a6a22]">View games →</span></div>
            </button>;
          })}
        </div>
      </section>

      <section aria-labelledby="ben-highlights">
        <SectionTitle kicker="Ben there, done that" title="The Ben record book" id="ben-highlights" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Moment label="Biggest beatdown" game={blowout} value={blowout ? `${score(Math.abs(blowout.homeScore - blowout.awayScore))} pts` : "—"} />
          <Moment label="Closest call" game={closest} value={closest ? `${score(Math.abs(closest.homeScore - closest.awayScore))} pts` : "—"} />
          <Moment label="Highest Ben score" game={highScore} value={highScore ? score(Math.max(highScore.homeScore, highScore.awayScore)) : "—"} />
          <Moment label="Biggest shootout" game={shootout} value={shootout ? `${score(shootout.homeScore + shootout.awayScore)} pts` : "—"} />
        </div>
      </section>

      <section id="ben-game-log" aria-labelledby="ben-log-title" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle kicker="Receipts included" title="Every Ben matchup" id="ben-log-title" />
          <label className="mb-4 text-xs font-bold">Rivalry
            <select value={pairKey} onChange={(event) => setPairKey(event.target.value)} className="mt-1 block min-h-11 max-w-full rounded-lg border border-black/15 bg-[#fffdf7] px-3 text-sm">
              <option value="all">All six rivalries</option>
              {PAIRS.map((pair) => <option key={pair.key} value={pair.key}>{pair.ben.surname} vs. {pair.opponent.surname}</option>)}
            </select>
          </label>
        </div>
        <p className="mb-4 text-sm text-[#6f6a60]" aria-live="polite">{log.length} meetings · Newest first{selectedPair ? ` · ${selectedPair.ben.surname} vs. ${selectedPair.opponent.surname}` : ""}</p>
        {!log.length ? <div className="premium-panel rounded-xl p-8 text-center text-[#6f6a60]">No Ben matchups in this view. Try another season, game type, or rivalry.</div> :
          <div className="table-shell rounded-xl">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr>{["When", "Matchup", "Score", "Winner", "Margin"].map((heading) => <th scope="col" key={heading} className="px-4 py-3 text-left">{heading}</th>)}</tr></thead>
              <tbody>{log.map((game) => <tr key={game.id}>
                <td className="border-t border-black/5 px-4 py-3"><Link href={`/seasons/${game.year}`} className="whitespace-nowrap font-bold hover:underline">{game.year} · W{game.week}</Link><div className="mt-1 text-xs text-[#6f6a60]">{phaseLabel(game.phase)}</div></td>
                <td className="border-t border-black/5 px-4 py-3"><div className="font-bold">{surname(game.homeId)} vs. {surname(game.awayId)}</div><div className="mt-1 max-w-xs text-xs text-[#6f6a60]">{game.homeTeam} vs. {game.awayTeam}</div></td>
                <td className="border-t border-black/5 px-4 py-3 whitespace-nowrap font-bold tabular-nums">{score(game.homeScore)}–{score(game.awayScore)}</td>
                <td className="border-t border-black/5 px-4 py-3"><span className="badge badge-green">{game.homeScore === game.awayScore ? "Tie" : surname(game.homeScore > game.awayScore ? game.homeId : game.awayId)}</span></td>
                <td className="border-t border-black/5 px-4 py-3 tabular-nums">{score(Math.abs(game.homeScore - game.awayScore))}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>
    </div>
  );
}

function SectionTitle({ kicker, title, id }: { kicker: string; title: string; id: string }) {
  return <div className="mb-4"><div className="kicker">{kicker}</div><h2 id={id} className="mt-1 text-2xl font-black tracking-tight">{title}</h2></div>;
}

function Moment({ label, game, value }: { label: string; game?: BenGame; value: string }) {
  return <article className="premium-panel rounded-xl p-5">
    <h3 className="kicker">{label}</h3><div className="mt-3 text-3xl font-black tabular-nums">{value}</div>
    {game ? <><p className="mt-3 text-sm font-bold">{surname(game.homeId)} {score(game.homeScore)}<br />{surname(game.awayId)} {score(game.awayScore)}</p><p className="mt-2 text-xs text-[#6f6a60]">{game.year} · Week {game.week} · {phaseLabel(game.phase)}</p></> : <p className="mt-3 text-sm text-[#6f6a60]">No meetings in this view.</p>}
  </article>;
}
