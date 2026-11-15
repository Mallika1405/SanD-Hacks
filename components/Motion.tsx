"use client";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
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

/** Slides one step out and the next in. Pass a changing `id` and a `dir` of 1 (forward) or -1 (back). */
export function Step({ id, dir = 1, children, className }: { id: string | number; dir?: 1 | -1; children: React.ReactNode; className?: string }) {
  const calm = useCalm();
  if (calm) return <div className={className}>{children}</div>;
  return <motion.div key={id} className={className} initial={{ opacity: 0, x: 28 * dir, filter: "blur(4px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}>{children}</motion.div>;
}

/** Soft drifting color behind everything. Pure CSS, off when motion is off. */
export function Aurora() {
  return <div className="aurora" aria-hidden><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /></div>;
}
