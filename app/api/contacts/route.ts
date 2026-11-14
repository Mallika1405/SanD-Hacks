import { NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { sendSms, twilioEnabled } from "@/lib/twilio";

const Body = z.object({ name: z.string().min(1).max(60), phone: z.string().min(7).max(20) });
const e164 = (p: string) => { const d = p.replace(/[^\d+]/g, ""); return d.startsWith("+") ? d : d.length === 10 ? `+1${d}` : `+${d}`; };

export async function GET() {
  const [u] = await q<any>("SELECT id, name FROM users ORDER BY created_at LIMIT 1");
  if (!u) return NextResponse.json({ user: null, contacts: [], twilio: twilioEnabled() });
  const contacts = await q("SELECT id, name, phone, opted_in_at FROM contacts WHERE user_id=$1 ORDER BY created_at", [u.id]);
  return NextResponse.json({ user: u, contacts, twilio: twilioEnabled() });
}

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  const [u] = await q<any>("SELECT id, name FROM users ORDER BY created_at LIMIT 1");
  if (!u) return NextResponse.json({ error: "No user. Run npm run seed." }, { status: 400 });
  const phone = e164(p.data.phone);
  const [c] = await q<any>("INSERT INTO contacts(user_id,name,phone) VALUES ($1,$2,$3) RETURNING id,name,phone,opted_in_at", [u.id, p.data.name, phone]);
  // Contacts only get alerts after they reply YES.
  await sendSms(phone, `${u.name} added you as a safety contact on Haven. If she ever asks for help, we'll call you. Reply YES to agree, or STOP to opt out. Haven does not replace 911.`).catch(() => {});
  return NextResponse.json(c);
}
