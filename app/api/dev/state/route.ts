import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { twilioEnabled } from "@/lib/twilio";

export async function GET() {
  const [user] = await q<any>("SELECT id, name FROM users ORDER BY created_at LIMIT 1");
  const contacts = user
    ? await q("SELECT id, name, phone, opted_in_at FROM contacts WHERE user_id=$1 ORDER BY name", [user.id])
    : [];
  return NextResponse.json({ user, contacts, twilio: twilioEnabled() });
}
