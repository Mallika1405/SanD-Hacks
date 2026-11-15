import { NextResponse } from "next/server";
import { ensureDevice, setEntered } from "@/lib/device";

// Continue without an account. Data stays on this browser only.
export async function POST() { await ensureDevice(); await setEntered("guest"); return NextResponse.json({ ok: true }); }
