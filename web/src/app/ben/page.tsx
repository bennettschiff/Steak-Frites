import { BenDashboard } from "@/components/BenDashboard";
import { buildBenGames } from "@/lib/ben";
import { loadAllSeasons, loadMeta } from "@/lib/data";

export const metadata = {
  title: "Ben — Steak Frites",
  description: "Four Bens. Six rivalries. Every recorded head-to-head matchup between Katz, Schiff, Wolbransky, and Goldstein.",
};

export default function BenPage() {
  const meta = loadMeta();
  const exclusions = Object.entries(meta.excluded_record_years ?? {});
  const games = buildBenGames(loadAllSeasons(), new Set(exclusions.map(([year]) => Number(year))));
  return (
    <div className="space-y-8">
      <header className="club-panel relative overflow-hidden rounded-xl p-6 md:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-3 -bottom-8 text-[10rem] leading-none font-black tracking-tighter text-white/5 md:text-[15rem]">BEN</div>
        <div className="relative">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-[#f7d77d]">The league within the league</div>
          <h1 className="mt-3 text-5xl font-black tracking-tight md:text-7xl">Ben vs. Ben.</h1>
          <p className="mt-4 max-w-xl text-lg text-[#f7edda]/80">Four Bens. Six rivalries. One very confusing group chat.</p>
          <p className="mt-2 text-sm font-semibold text-[#f7d77d]">Katz · Schiff · Wolbransky · Goldstein</p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#f7edda]/80">
            <span><strong className="text-white">{games.length}</strong> recorded meetings</span>
            <span><strong className="text-white">{new Set(games.map((game) => game.year)).size}</strong> seasons with Ben matchups</span>
            <a href="#ben-records" className="font-bold underline underline-offset-4">Settle the Ben debate ↓</a>
          </div>
        </div>
      </header>
      <BenDashboard games={games} />
      <aside className="rounded-xl border border-black/10 p-5 text-sm leading-relaxed text-[#6f6a60]">
        <h2 className="font-bold text-[#3b3328]">What counts as a Ben matchup?</h2>
        <p className="mt-1">Every scored meeting between these four owners in the league archive, including shared-team history. All games includes regular season, championship-bracket playoffs, and consolation games. Playoffs includes only the championship bracket. Records are W–L (–T when needed); ties count as half a win for win percentage.</p>
        {exclusions.map(([year, reason]) => <p key={year} className="mt-1">{year} excluded: {reason}</p>)}
        <p className="mt-1">These records refresh with the site’s league data. Latest recorded Ben matchup: {games[0] ? `${games[0].year}, Week ${games[0].week}` : "none yet"}.</p>
      </aside>
    </div>
  );
}
