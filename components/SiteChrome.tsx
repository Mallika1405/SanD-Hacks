"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { applyMode, getMode, type Mode } from "./ThemeProvider";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/now", label: "Talk" },
  { href: "/diary", label: "Diary" },
  { href: "/tracker", label: "Tracker" },
  { href: "/therapy", label: "Therapy" },
  { href: "/care", label: "Find care" },
];

function ModeToggle() {
  const [m, setM] = useState<Mode>("system");
  useEffect(() => { setM(getMode()); const f = () => setM(getMode()); window.addEventListener("sw-mode-changed", f); return () => window.removeEventListener("sw-mode-changed", f); }, []);
  const next: Mode = m === "system" ? "light" : m === "light" ? "dark" : "system";
  const label = m === "system" ? "Theme: match my device" : m === "light" ? "Theme: light" : "Theme: dark";
  return (
    <button onClick={() => applyMode(next)} aria-label={`${label}. Click to change.`} title={label} className="size-9 inline-flex items-center justify-center rounded-lg text-ink2 hover:text-ink hover:bg-stone">
      {m === "dark" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        : m === "light" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>}
    </button>
  );
}

export function Header() {
  const path = usePathname();
  const [me, setMe] = useState<any>(null);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then(setMe).catch(() => {}); }, [path]);
  if (path === "/login") return null;
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h) || (h === "/now" && path.startsWith("/session")));
  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur border-b border-line">
      <div className="max-w-[1040px] mx-auto px-4 lg:px-6 h-14 flex items-center gap-3">
        <Link href="/" className="serif text-[1.25rem] shrink-0" aria-label="Somewhere, home">somewhere</Link>
        <nav aria-label="Main" className="hidden md:flex items-center gap-0.5 ml-3">
          {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={on(n.href) ? "page" : undefined} className={`px-3 h-9 inline-flex items-center rounded-lg text-[14px] whitespace-nowrap ${on(n.href) ? "bg-stone font-medium text-ink" : "text-ink2 hover:text-ink"}`}>{n.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/voice" aria-label="Voices" title="Choose a voice" className="size-9 inline-flex items-center justify-center rounded-lg text-ink2 hover:text-ink hover:bg-stone"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg></Link>
          <ModeToggle />
          <Link href="/you" className="hidden sm:inline-flex items-center h-9 px-3 rounded-lg text-[14px] text-ink2 hover:text-ink">{me?.profile?.name ?? me?.account?.handle ?? "You"}</Link>
          <Link href="/now?sos=1" className="h-9 px-3.5 inline-flex items-center rounded-lg bg-terrasoft text-terradeep text-[14px] font-semibold hover:bg-[#F3CFC2]">I need help now</Link>
        </div>
      </div>
      <nav aria-label="Main" className="md:hidden flex gap-1 px-3 pb-2 overflow-x-auto">
        {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={on(n.href) ? "page" : undefined} className={`shrink-0 px-3 h-9 inline-flex items-center rounded-lg text-[14px] ${on(n.href) ? "bg-stone font-medium" : "text-ink2"}`}>{n.label}</Link>)}
        <Link href="/you" className="shrink-0 px-3 h-9 inline-flex items-center rounded-lg text-[14px] text-ink2">You</Link>
      </nav>
    </header>
  );
}

export function Footer() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <footer className="mt-14 border-t border-line">
      <div className="max-w-[1040px] mx-auto px-4 lg:px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink2">
        <p className="max-w-[60ch]">Somewhere is a demo, not a medical service. If you're in danger, call 911. For emotional crisis, call or text <a className="underline" href="tel:988">988</a>.</p>
        <Link href="/crisis" className="underline">Crisis support</Link>
      </div>
    </footer>
  );
}
