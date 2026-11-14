import crypto from "crypto";
import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { baseUrl } from "@/lib/twilio";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = crypto.randomBytes(24).toString("base64url");
  const r = await q("UPDATE sessions SET share_token=$2, share_expires_at=now() + interval '48 hours' WHERE id=$1 RETURNING id", [id, token]);
  if (!r.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ url: `${baseUrl()}/e/${token}`, expires_in_hours: 48 });
}
