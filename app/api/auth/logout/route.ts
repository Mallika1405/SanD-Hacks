import { NextResponse } from "next/server";
import { clearDeviceCookie, clearEntered } from "@/lib/device";

export async function POST() { await clearDeviceCookie(); await clearEntered(); return NextResponse.json({ ok: true }); }
