"use client";
import { motion } from "motion/react";
import { useCalm } from "@/components/Motion";

// Re-mounts on every navigation, so each page eases in.
export default function Template({ children }: { children: React.ReactNode }) {
  const calm = useCalm();
  if (calm) return <div className="page">{children}</div>;
  return <motion.div className="page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}>{children}</motion.div>;
}
