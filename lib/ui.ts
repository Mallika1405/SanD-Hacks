// Layout profiles: how the interface should feel for people with different kinds of anxiety.
// Defaults are a sensible starting point. Bright Data + Gemini research can refine them per condition (stored in Neon), and each person can override anything.
export type UiSettings = {
  density: "airy" | "cozy" | "compact";
  motion: "none" | "soft" | "normal";
  palette: "sage" | "slate" | "sand" | "mist";
  fontScale: number; // 0.95 to 1.2
  focus: "single" | "balanced"; // single = fewer things on screen at once
  contrast: "normal" | "high";
};
export const BASE: UiSettings = { density: "cozy", motion: "soft", palette: "sage", fontScale: 1, focus: "balanced", contrast: "normal" };

export const DEFAULTS: Record<string, { settings: UiSettings; rationale: string[] }> = {
  ocd: { settings: { density: "cozy", motion: "none", palette: "slate", fontScale: 1, focus: "single", contrast: "normal" }, rationale: ["Predictable, unchanging screens reduce the pull to check and re-check.", "One clear thing at a time means fewer decisions to second-guess.", "No animation keeps attention from getting caught on moving details."] },
  panic: { settings: { density: "airy", motion: "soft", palette: "sage", fontScale: 1.1, focus: "single", contrast: "high" }, rationale: ["Larger text and high contrast stay readable when vision narrows or hands shake.", "A single focus keeps the next step obvious in a hard moment.", "Gentle motion can pace breathing without feeling busy."] },
  gad: { settings: { density: "airy", motion: "soft", palette: "sand", fontScale: 1, focus: "single", contrast: "normal" }, rationale: ["Fewer things on screen gives a busy mind less to latch onto.", "Warm, muted color feels less stimulating than bright color."] },
  social: { settings: { density: "cozy", motion: "soft", palette: "mist", fontScale: 1, focus: "balanced", contrast: "normal" }, rationale: ["A soft, low-pressure look avoids feeling evaluated.", "Plain, friendly wording and no countdowns or streaks keep the pressure off."] },
  overwhelm: { settings: { density: "airy", motion: "none", palette: "mist", fontScale: 1.05, focus: "single", contrast: "normal" }, rationale: ["Lots of white space and no motion lowers sensory load.", "Showing only what matters now prevents overload."] },
  other: { settings: { ...BASE }, rationale: ["A calm, balanced default."] },
};

export const ENUMS = {
  density: ["airy", "cozy", "compact"], motion: ["none", "soft", "normal"], palette: ["sage", "slate", "sand", "mist"], focus: ["single", "balanced"], contrast: ["normal", "high"],
} as const;

export function clean(s: any): Partial<UiSettings> {
  const o: Partial<UiSettings> = {};
  if (ENUMS.density.includes(s?.density)) o.density = s.density;
  if (ENUMS.motion.includes(s?.motion)) o.motion = s.motion;
  if (ENUMS.palette.includes(s?.palette)) o.palette = s.palette;
  if (ENUMS.focus.includes(s?.focus)) o.focus = s.focus;
  if (ENUMS.contrast.includes(s?.contrast)) o.contrast = s.contrast;
  if (typeof s?.fontScale === "number") o.fontScale = Math.min(1.2, Math.max(0.95, s.fontScale));
  return o;
}

/** Merge order: base, then each of her conditions (later ones only fill what earlier ones left at default), then her own overrides. */
export function merge(conditionSettings: Partial<UiSettings>[], overrides: any): UiSettings {
  const out: UiSettings = { ...BASE };
  const first = conditionSettings[0] ?? {};
  Object.assign(out, first);
  // when someone has several conditions, take the calmer choice on each axis
  for (const s of conditionSettings.slice(1)) {
    if (s.motion === "none") out.motion = "none";
    if (s.focus === "single") out.focus = "single";
    if (s.contrast === "high") out.contrast = "high";
    if (s.density === "airy") out.density = "airy";
    if (s.fontScale && s.fontScale > out.fontScale) out.fontScale = s.fontScale;
  }
  return { ...out, ...clean(overrides) };
}
