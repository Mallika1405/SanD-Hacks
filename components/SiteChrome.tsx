"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/now", label: "Talk" },
  { href: "/diary", label: "Diary" },
  { href: "/tracker", label: "Tracker" },
  { href: "/therapy", label: "Therapy" },
  { href: "/care", label: "Find care" },
];

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
        <div className="ml-auto flex items-center gap-2">
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
