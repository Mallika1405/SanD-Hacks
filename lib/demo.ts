export const DEMO_PASSWORD = "somewhere-demo";
export const DEMOS = [
  { handle: "maya_ocd", name: "Maya", blurb: "OCD · six weeks into ERP therapy" },
  { handle: "jordan_panic", name: "Jordan", blurb: "Panic attacks · CBT, one missed session" },
  { handle: "sam_burnout", name: "Sam", blurb: "Burnout and worry · a heavy recent entry" },
  { handle: "riley_social", name: "Riley", blurb: "Social anxiety · group therapy" },
  { handle: "alex_new", name: "Alex", blurb: "New here · almost nothing yet" },
];
export const demosEnabled = () => process.env.NODE_ENV !== "production" || process.env.DEMO_PROFILES === "1";
