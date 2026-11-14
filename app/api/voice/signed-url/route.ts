import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const fake = new URL(req.url).searchParams.get("persona") === "fake";
  const key = process.env.ELEVENLABS_API_KEY, agent = (fake && process.env.ELEVENLABS_FAKECALL_AGENT_ID) || process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agent) return NextResponse.json({ error: "voice not configured" }, { status: 503 });
  const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agent}`, { headers: { "xi-api-key": key } });
  if (!r.ok) return NextResponse.json({ error: "elevenlabs " + r.status }, { status: 502 });
  const j = await r.json();
  return NextResponse.json({ signedUrl: j.signed_url });
}
