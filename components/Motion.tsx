"use client";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** True when the person (or their OS) wants no motion. Follows the layout setting on <html data-motion>. */
export function useCalm() {
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setCalm(mq.matches || document.documentElement.dataset.motion === "none");
    read();
    const mo = new MutationObserver(read); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    mq.addEventListener("change", read);
    return () => { mo.disconnect(); mq.removeEventListener("change", read); };
  }, []);
  return calm;
}

/** Fades and floats a block in when it appears. */
export function Reveal({ children, delay = 0, y = 14, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  const calm = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  if (calm) return <div className={className}>{children}</div>;
  return <motion.div ref={ref} className={className} initial={{ opacity: 0, y }} animate={seen ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}>{children}</motion.div>;
}

/** A number that counts up to its value. */
export function Count({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const calm = useCalm();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => { if (calm) { mv.set(to); return; } const c = animate(mv, to, { duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }); return () => c.stop(); }, [to, calm, mv]);
  return <motion.span>{text}</motion.span>;
}

/** Direction of travel for a step counter: 1 when moving forward, -1 when going back. */
export function useDir(step: number) {
  const prev = useRef(step);
  const dir: 1 | -1 = step >= prev.current ? 1 : -1;
  useEffect(() => { prev.current = step; }, [step]);
  return dir;
}

/** Slides the current step out and the next in, forward or back. Keep exactly one keyed child. */
export function Steps({ id, dir = 1, children, className }: { id: string | number; dir?: 1 | -1; children: React.ReactNode; className?: string }) {
  const calm = useCalm();
  if (calm) return <div className={className}>{children}</div>;
  return (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div key={id} custom={dir} className={className}
        variants={{ in: (d: number) => ({ opacity: 0, x: 32 * d, filter: "blur(4px)" }), on: { opacity: 1, x: 0, filter: "blur(0px)" }, out: (d: number) => ({ opacity: 0, x: -32 * d, filter: "blur(4px)" }) }}
        initial="in" animate="on" exit="out" transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}>{children}</motion.div>
    </AnimatePresence>
  );
}

/** Placeholder shape that shimmers while content loads. */
export function Skeleton({ className = "", lines = 0 }: { className?: string; lines?: number }) {
  if (lines) return <div className="space-y-2" aria-busy="true" aria-label="Loading">{Array.from({ length: lines }).map((_, i) => <div key={i} className={`skeleton h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />)}</div>;
  return <div className={`skeleton ${className}`} aria-busy="true" aria-label="Loading" />;
}

/** Show a small confirmation from anywhere: toast("Saved"). */
export const toast = (message: string) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sw-toast", { detail: message })); };
export function Toaster() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let t: any;
    const on = (e: Event) => { setMsg((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setMsg(""), 3200); };
    window.addEventListener("sw-toast", on); return () => { window.removeEventListener("sw-toast", on); clearTimeout(t); };
  }, []);
  return (
    <div className="fixed bottom-24 inset-x-0 z-50 flex justify-center pointer-events-none" role="status" aria-live="polite">
      <AnimatePresence>
        {msg && (
          <motion.div key={msg} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: "spring", stiffness: 360, damping: 28 }} className="toast pointer-events-auto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><motion.path d="m5 12.5 4.5 4.5L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.1 }} /></svg>
            <span>{msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Soft drifting color behind everything. Pure CSS, off when motion is off. */
export function Aurora() {
  return <div className="aurora" aria-hidden><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /></div>;
}
