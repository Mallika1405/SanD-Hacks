import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";

export async function GET() {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ account: null, profile: null });
  const [a] = await q<{ handle: string }>("SELECT handle FROM accounts WHERE device_id=$1", [device]);
  const [p] = await q<any>("SELECT display_name, conditions, onboarded FROM profiles WHERE device_id=$1", [device]);
  return NextResponse.json({ account: a ?? null, profile: p ? { name: p.display_name, conditions: p.conditions, onboarded: p.onboarded } : null });
}
