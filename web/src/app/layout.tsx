import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { loadMeta } from "@/lib/data";
import { SiteHeader } from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Steak Frites — League History",
  description: "All-time history, records, and keeper tracker for the Steak Frites fantasy league.",
};

const NAV = [
  { href: "/records", label: "Record Book" },
  { href: "/versus", label: "Versus" },
  { href: "/ben", label: "Ben" },
  { href: "/champions", label: "Trophies" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/what-if", label: "What If" },
  { href: "/seasons", label: "Seasons" },
  { href: "/teams", label: "Owners" },
  { href: "/keepers", label: "Keepers" },
];

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months}mo ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const meta = loadMeta();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-[#17140f]">
        <SiteHeader
          nav={NAV}
          updatedLabel={`${meta.years[0]}–${meta.current_year} · Updated ${relativeTime(meta.updated_at)}`}
          updatedTitle={new Date(meta.updated_at).toLocaleString()}
        />
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 md:py-10">{children}</main>
        <footer className="border-t border-black/10 bg-[#123d35] text-xs text-[#f7edda]/75">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f7d77d]/15 text-[10px] font-black text-[#f7d77d]">SF</span>
              Steak Frites League Archive · est. {meta.years[0]}
            </span>
            <span>{meta.current_year - meta.years[0] + 1} seasons of standings, trophies, keepers, and scores.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
