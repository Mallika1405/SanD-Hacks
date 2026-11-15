"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "In the Moment" },
  { href: "/between", label: "Between Moments" },
  { href: "/diary", label: "Voice Diary" },
  { href: "/care", label: "Find Care" },
  { href: "/crisis", label: "Crisis Support" },
];

export function Header() {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" || path.startsWith("/session") || path.startsWith("/breathe") : path.startsWith(h));
  return (
    <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1160px] mx-auto px-5 lg:px-8 h-[72px] flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Somewhere home">
          <span className="grid place-items-center size-10 rounded-xl bg-sage text-white" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="12" r="7.5" strokeDasharray="2 3" /></svg>
          </span>
          <span className="leading-tight hidden sm:block"><span className="serif text-[1.3rem] block">Somewhere</span><span className="text-[11px] text-ink2 tracking-wide">Space to breathe</span></span>
        </Link>
        <nav aria-label="Main" className="hidden md:flex mx-auto items-center gap-1 p-1 rounded-2xl bg-cream border border-line">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={on(n.href) ? "page" : undefined}
              className={`px-4 h-10 inline-flex items-center rounded-xl text-[14.5px] font-medium transition ${on(n.href) ? "bg-stone text-ink" : "text-ink2 hover:text-ink hover:bg-stone/60"}`}>{n.label}</Link>
          ))}
        </nav>
        <Link href="/?sos=1" className="ml-auto md:ml-0 shrink-0 h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-terrasoft text-terradeep text-[14px] font-semibold hover:bg-[#F3CFC2]">
          <i className="size-2 rounded-full bg-terra" aria-hidden /> SOS / Grounding
        </Link>
      </div>
      <nav aria-label="Main" className="md:hidden flex gap-1 px-4 pb-3 overflow-x-auto">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={on(n.href) ? "page" : undefined} className={`shrink-0 px-3.5 h-10 inline-flex items-center rounded-xl text-sm font-medium ${on(n.href) ? "bg-stone text-ink" : "bg-cream text-ink2"}`}>{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function SafetyBar() {
  return (
    <div className="max-w-[1160px] mx-auto px-5 lg:px-8 pt-4">
      <div className="rounded-2xl bg-stone/80 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <i className="size-2.5 rounded-full bg-terra shrink-0" aria-hidden />
        <p className="text-[14.5px] text-ink flex-1 min-w-[220px]">Need a person right now? Free, confidential support is here.</p>
        <div className="flex gap-2">
          <a href="tel:988" className="b b-terra !min-h-[40px] !px-4 !text-[14px]">Call 988</a>
          <a href="sms:741741?body=HOME" className="b b-soft !min-h-[40px] !px-4 !text-[14px] border border-line">Text HOME to 741741</a>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 bg-stone/70 border-t border-line">
      <div className="max-w-[1160px] mx-auto px-5 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13.5px] text-ink2 max-w-[62ch]">Somewhere is a supportive companion demo and not a medical service or crisis line. If you are in immediate danger, call 911. For emotional crisis, call or text 988.</p>
        <div className="flex gap-6 text-[12.5px] text-ink2"><span>Safety checks on every message</span><span>Private by default</span></div>
      </div>
    </footer>
  );
}
