import { z } from "zod";
import { q } from "@/lib/db";
import { currentDevice } from "@/lib/device";
import { brightEnabled } from "@/lib/brightdata";
import { liveDiscover, rank, suggest } from "@/lib/care";
import { out } from "@/lib/speech";

export const maxDuration = 60;
const Body = z.object({
  city: z.string().max(80).default("San Diego, CA"),
  goals: z.array(z.string().max(60)).max(8).default([]),
  budget: z.enum(["free", "low", "flexible"]).default("flexible"),
  insurance: z.string().max(60).default(""),
  language: z.string().max(40).default("English"),
  gender: z.string().max(30).default("No preference"),
  extras: z.array(z.string().max(60)).max(6).default([]),
  format: z.enum(["online", "in_person", "either"]).default("either"),
});

/** Streams newline-delimited JSON: status updates and re-ranked results while pages are read live. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return new Response("bad request", { status: 400 });
  const device = await currentDevice();
  const flows = device ? (await q<{ flow: string }>("SELECT DISTINCT flow FROM sessions WHERE device_id=$1 AND flow NOT IN ('unsure','checkin') AND started_at > now() - interval '90 days'", [device])).map((r) => r.flow) : [];
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (e: unknown) => { try { ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch {} };
      try {
        emit({ type: "status", text: "Thinking about what might fit…" });
        const specs = await suggest(p.data, flows);
        const names = specs.map((x) => x.name).slice(0, 3).join(", and ");
        emit({ type: "specialties", specialties: specs, say: out([
          { text: "Here are a few kinds of care you might explore.", pause_ms: 500 }, { text: `${names}.`, pause_ms: 600 },
          { text: "This isn't a diagnosis. It's just a starting point.", pause_ms: 500 },
          { text: "Everything on the list comes from public web pages and hasn't been verified. Please confirm insurance, cost, and availability with each provider.", pause_ms: 300 },
        ]) });
        if (brightEnabled()) await liveDiscover(p.data, specs, emit);
        else { emit({ type: "status", text: "Live search isn't set up, so this is from saved sources only." }); emit({ type: "results", ...(await rank(p.data, specs)) }); }
        emit({ type: "results", ...(await rank(p.data, specs)) });
        emit({ type: "done" });
      } catch (e) { console.error("care search failed", e); emit({ type: "error" }); }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
