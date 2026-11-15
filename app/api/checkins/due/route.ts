import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";

export async function GET() {
  const device = await currentDevice();
  if (!device) return NextResponse.json({ due: null });
  const [c] = await q<{ id: string; due_at: string }>("SELECT id, due_at FROM checkins WHERE device_id=$1 AND done_at IS NULL AND due_at <= now() ORDER BY due_at LIMIT 1", [device]);
  return NextResponse.json({ due: c ?? null });
}
