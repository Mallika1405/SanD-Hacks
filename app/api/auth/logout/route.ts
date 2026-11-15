import { NextResponse } from "next/server";
import { clearDeviceCookie } from "@/lib/device";

export async function POST() { await clearDeviceCookie(); return NextResponse.json({ ok: true }); }
