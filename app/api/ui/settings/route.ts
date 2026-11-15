import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentDevice, ensureDevice } from "@/lib/device";
import { BASE, clean, DEFAULTS, merge } from "@/lib/ui";

// The layout settings for THIS person: what research says helps people with their kind of anxiety, plus anything they changed themselves.
export async function GET() {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ settings: BASE, why: { conditions: [], rationale: [], sources: [] }, overrides: {} });
  const [p] = await q<any>("SELECT conditions, ui_overrides FROM profiles WHERE device_id=$1", [device]);
  const conds: string[] = p?.conditions?.length ? p.conditions : ["other"];
  const rows = await q<any>("SELECT condition, settings, rationale, sources, researched_at FROM ui_profiles WHERE condition = ANY($1)", [conds]);
  const by = new Map(rows.map((r) => [r.condition, r]));
  const sets = conds.map((c) => by.get(c)?.settings ?? DEFAULTS[c]?.settings ?? DEFAULTS.other.settings);
  const rationale = conds.flatMap((c) => by.get(c)?.rationale ?? DEFAULTS[c]?.rationale ?? []);
  const sources = conds.flatMap((c) => by.get(c)?.sources ?? []);
  return NextResponse.json({
    settings: merge(sets, p?.ui_overrides), overrides: p?.ui_overrides ?? {},
    why: { conditions: conds, rationale: [...new Set(rationale)].slice(0, 6), sources: sources.slice(0, 6), researched: rows.some((r) => (r.sources ?? []).length > 0) },
  });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const device = await ensureDevice();
  const o = body.reset ? {} : clean(body.overrides ?? {});
  await q("INSERT INTO profiles(device_id, ui_overrides) VALUES ($1,$2) ON CONFLICT (device_id) DO UPDATE SET ui_overrides=$2", [device, JSON.stringify(o)]);
  return NextResponse.json({ ok: true });
}
