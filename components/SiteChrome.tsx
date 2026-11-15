"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useCalm } from "./Motion";
import { applyMode, getMode, type Mode } from "./ThemeProvider";

const I = (d: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden dangerouslySetInnerHTML={{ __html: d }} />;
const NAV = [
  { href: "/", label: "Today", icon: I('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>') },
  { href: "/now", label: "Talk", icon: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>') },
  { href: "/diary", label: "Diary", icon: I('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M9 9h6M9 13h4"/>') },
  { href: "/care", label: "Care", icon: I('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>') },
];
const MORE = [
  { href: "/tracker", label: "Tracker" },
  { href: "/therapy", label: "Therapy" },
  { href: "/voice", label: "Voices" },
  { href: "/you", label: "My profile and settings" },
];
const HIDE = ["/login", "/welcome"];

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("system");
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then(setMe).catch(() => {}); setOpen(false); }, [path]);
  useEffect(() => {
    setMode(getMode());
    const f = () => setMode(getMode()); window.addEventListener("sw-mode-changed", f);
    const click = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", click);
    return () => { window.removeEventListener("sw-mode-changed", f); document.removeEventListener("mousedown", click); };
  }, []);
  if (HIDE.includes(path)) return null;
  const name: string = me?.profile?.name ?? me?.account?.handle ?? "";
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); router.push("/login"); router.refresh(); }
  return (
    <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur">
      <div className="max-w-[1040px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="serif" aria-label="Anchor, home">anchor</Link>
        <div className="flex items-center gap-2">
          <Link href="/now?sos=1" className="h-9 px-3.5 inline-flex items-center rounded-full bg-terrasoft text-terradeep text-[14px] font-semibold">I need help now</Link>
          <div className="relative" ref={box}>
            <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu" className="size-9 rounded-full bg-stone text-ink text-[14px] font-semibold inline-flex items-center justify-center">{(name[0] ?? "·").toUpperCase()}</button>
            {open && (
              <div role="menu" className="menu-pop absolute right-0 mt-2 w-60 card p-2 z-50">
                {name && <p className="px-3 py-2 text-[13px] text-ink2">Signed in as <b className="text-ink">{name}</b></p>}
                {MORE.map((m) => <Link key={m.href} href={m.href} role="menuitem" className="block px-3 py-2.5 rounded-lg text-[14.5px] hover:bg-stone">{m.label}</Link>)}
                <div className="px-3 py-2"><p className="text-[12.5px] text-ink2 mb-1.5">Appearance</p>
                  <div className="seg" role="group" aria-label="Theme">{([["system", "Auto"], ["light", "Light"], ["dark", "Dark"]] as const).map(([v, l]) => <button key={v} aria-pressed={mode === v} onClick={() => applyMode(v)}>{l}</button>)}</div></div>
                <button onClick={logout} role="menuitem" className="block w-full text-left px-3 py-2.5 rounded-lg text-[14.5px] text-ink2 hover:bg-stone">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function Dock() {
  const path = usePathname();
  const calm = useCalm();
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h) || (h === "/now" && path.startsWith("/session")));
  if (HIDE.includes(path)) return null;
  return (
    <motion.nav aria-label="Main" className="fixed bottom-4 inset-x-0 z-40 flex justify-center pointer-events-none" initial={calm ? false : { y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 24, delay: 0.25 }}>
      <div className="dock pointer-events-auto relative flex items-center gap-1 p-1.5 rounded-full">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={on(n.href) ? "page" : undefined} className={`dock-item relative inline-flex items-center gap-2 h-11 px-4 rounded-full text-[14px] font-medium ${on(n.href) ? "text-on-accent" : "text-ink2 hover:text-ink"}`}>
            {on(n.href) && <motion.span layoutId="dock-pill" aria-hidden className="dock-pill absolute inset-0 rounded-full" transition={calm ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }} />}
            <motion.span className="relative z-10 inline-flex items-center gap-2" whileTap={calm ? undefined : { scale: 0.92 }}>{n.icon}<span className={on(n.href) ? "" : "max-sm:hidden"}>{n.label}</span></motion.span>
          </Link>
        ))}
      </div>
    </motion.nav>
  );
}

export function Footer() {
  const path = usePathname();
  if (HIDE.includes(path)) return null;
  return (
    <footer className="mt-10 mb-24">
      <div className="max-w-[1040px] mx-auto px-4 lg:px-6 text-[12.5px] text-ink2 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[60ch]">Anchor is a demo, not a medical service. In danger? Call 911. Emotional crisis? Call or text <a className="underline" href="tel:988">988</a>.</p>
        <Link href="/crisis" className="underline">Crisis support</Link>
      </div>
    </footer>
  );
}
