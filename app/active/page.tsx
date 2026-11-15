"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import MapView, { MapLine, MapMarker } from "@/components/MapView";
import { HoldButton, Pill, km, mins } from "@/components/ui";
import { useTracker } from "@/lib/client/useTracker";
import { RollingRecorder } from "@/lib/client/recorder";
import { distToRoute } from "@/lib/geo";
import { DEFAULT_CODE_PHRASE, ESCORT_PHONE } from "@/lib/presets";
import type { LL } from "@/lib/sim";

type View = "main" | "followed" | "alert" | "fake" | "map";
type Line = { role: "user" | "agent"; text: string; t: number };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export default function Page() {
  return <ConversationProvider><Active /></ConversationProvider>;
}

function Active() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<View>("main");
  const [quiet, setQuiet] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [alert, setAlert] = useState<{ token: string; ownerSecret: string } | null>(null);
  const [alertData, setAlertData] = useState<any>(null);
  const [followed, setFollowed] = useState<any>(null);
  const [followData, setFollowData] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [explain, setExplain] = useState("");
  const [places, setPlaces] = useState<any[]>([]);
  const [heat, setHeat] = useState<any[]>([]);
  const [checkin, setCheckin] = useState<{ reason: string; endsAt: number } | null>(null);
  const [persona, setPersona] = useState<string>("boyfriend");
  const [chips, setChips] = useState<Record<string, string>>({});
  const [timeline, setTimeline] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [voiceErr, setVoiceErr] = useState("");
  const [toast, setToast] = useState("");

  const { pos, trail } = useTracker(session?.id ?? null);
  const rec = useRef<RollingRecorder | null>(null);
  const persisted = useRef(false);
  const alertSent = useRef(false);
  const awaiting911 = useRef(false);
  const linesRef = useRef<Line[]>([]);
  const posRef = useRef(pos); posRef.current = pos;
  const sessionRef = useRef(session); sessionRef.current = session;
  const alertRef = useRef(alert); alertRef.current = alert;
  const checkinRef = useRef(checkin); checkinRef.current = checkin;
  const placesRef = useRef<any[]>([]); placesRef.current = places;
  const handlers = useRef<any>({});
  const off = useRef<{ since: number | null; snoozeUntil: number }>({ since: null, snoozeUntil: 0 });
  const hist = useRef<{ t: number; p: LL }[]>([]);

  const conv = useConversation({
    clientTools: {
      send_alert: (p: any) => handlers.current.send_alert(p),
      get_safe_places: () => handlers.current.get_safe_places(),
      start_directions: (p: any) => handlers.current.start_directions(p),
      log_event: (p: any) => handlers.current.log_event(p),
      end_session: () => handlers.current.end_session(),
    },
    onMessage: (m: any) => handlers.current.onMessage(m),
    onError: (e: any) => setVoiceErr(typeof e === "string" ? e : "Voice connection problem"),
  });

  /* ---------- load session ---------- */
  useEffect(() => {
    const s = localStorage.getItem("haven_session");
    if (!s) { router.replace("/"); return; }
    setSession(JSON.parse(s));
  }, [router]);

  /* ---------- helpers ---------- */
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 4000); };
  const post = (url: string, body: any) => fetch(url, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));

  const persistNow = useCallback(async (trigger: string) => {
    const s = sessionRef.current; if (!s || persisted.current) return;
    persisted.current = true;
    await post(`/api/sessions/${s.id}/persist`, { trigger });
    if (rec.current) {
      rec.current.onSegment = (b) => fetch(`/api/clips?sessionId=${s.id}&trigger=${trigger}`, { method: "POST", body: b, headers: { "Content-Type": b.type } }).catch(() => {});
      rec.current.trigger();
    }
    const recent = linesRef.current.filter((l) => Date.now() - l.t < 60_000);
    if (recent.length) post(`/api/sessions/${s.id}/transcript`, { lines: recent });
  }, []);

  const sendAlert = useCallback(async (reason: string) => {
    if (alertSent.current) return "Alert already sent. Your contacts are being called.";
    const s = sessionRef.current, p = posRef.current; if (!s) return "No active session.";
    alertSent.current = true;
    setView("alert");
    persistNow("alert");
    const j = await post("/api/alerts", { sessionId: s.id, reason, lat: p?.lat, lng: p?.lng, placeText: placesRef.current[0] ? placesRef.current[0].name : undefined });
    if (j.token) { setAlert({ token: j.token, ownerSecret: j.ownerSecret }); return "Alert sent. Your contacts are being called now."; }
    alertSent.current = false;
    return "I could not send the alert. Please call 911 if you are in danger.";
  }, [persistNow]);

  const loadPlaces = useCallback(async (category?: string) => {
    const p = posRef.current; if (!p) return [];
    const j = await fetch(`/api/safe-places?lat=${p.lat}&lng=${p.lng}&radius=1500&limit=4${category ? `&category=${category}` : ""}`).then((r) => r.json()).catch(() => ({ places: [] }));
    setPlaces(j.places ?? []); return j.places ?? [];
  }, []);

  const directionsTo = useCallback(async (pl: any) => {
    const p = posRef.current; if (!p || !pl) return "I don't have your location yet.";
    const j = await fetch(`/api/route?from=${p.lat},${p.lng}&to=${pl.lat},${pl.lng}`).then((r) => r.json()).catch(() => null);
    if (!j?.routes) return "I couldn't load directions. Head toward " + pl.name + ".";
    setRoutes(j.routes); setExplain(j.explanation);
    const best = j.routes.find((r: any) => r.chosen) ?? j.routes[0];
    return `Walking to ${pl.name}, about ${km(best.distance_m)}, around ${Math.max(1, Math.round(best.duration_s / 60))} minutes. ${j.explanation} It may not be open, so keep looking for people nearby.`;
  }, []);

  const speakToAgent = useCallback((msg: string, loud = false) => {
    try { if (loud) conv.setVolume({ volume: 1 }); conv.sendUserMessage(`[HAVEN_EVENT] ${msg}`); } catch {}
    if (conv.status !== "connected" && "speechSynthesis" in window) {
      const m = msg.replace(/^[A-Z_]+[:\s]*/, ""); speechSynthesis.speak(new SpeechSynthesisUtterance(m));
    }
  }, [conv]);

  const endSession = useCallback(async () => {
    const s = sessionRef.current;
    rec.current?.stop(); try { conv.endSession(); } catch {}
    if (s) await post(`/api/sessions/${s.id}/end`, {});
    localStorage.removeItem("haven_session");
    router.push("/");
    return "Session ended. I've stopped listening and tracking.";
  }, [conv, router]);

  /* ---------- watcher: code phrase or "help" fires instantly, no LLM wait ---------- */
  const handleUserText = useCallback((txt: string) => {
    const code = norm(localStorage.getItem("haven_code") || DEFAULT_CODE_PHRASE), n = norm(txt);
    if (awaiting911.current) {
      if (/\b(yes|yeah|yep|please|connect)\b/.test(n)) { awaiting911.current = false; router.push("/911"); return; }
      if (/\b(no|nope|not now)\b/.test(n)) awaiting911.current = false;
    }
    const c = checkinRef.current;
    if (c) {
      if (/\b(no|not|worried|scared|unsafe|help)\b/.test(n) && !/\b(not worried)\b/.test(n)) { resolveCheckin(false); return; }
      if (/\b(yes|yeah|yep|fine|ok|okay|good|safe)\b/.test(n)) { resolveCheckin(true); return; }
    }
    if ((code && n.includes(code)) || /\bhelp\b/.test(n)) {
      if (!alertSent.current) {
        sendAlert("voice trigger: " + (n.includes(code) ? "code phrase" : "help"));
        awaiting911.current = true;
        speakToAgent("ALERT_SENT. Contacts are being called. In one short sentence, say help is on the way, then ask ONE yes/no question: do you want me to connect you to emergency services? (demo handoff only)", true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendAlert, speakToAgent, router]);

  const addLine = useCallback((role: "user" | "agent", t: string) => {
    const l = { role, text: t, t: Date.now() };
    linesRef.current = [...linesRef.current.slice(-200), l]; setLines(linesRef.current);
    if (persisted.current && sessionRef.current) post(`/api/sessions/${sessionRef.current.id}/transcript`, { lines: [l] });
  }, []);

  /* ---------- check-in (ride) ---------- */
  function resolveCheckin(ok: boolean) {
    if (!checkinRef.current) return;
    const reason = checkinRef.current.reason;
    setCheckin(null); checkinRef.current = null;
    if (ok) { off.current.snoozeUntil = Date.now() + 5 * 60_000; off.current.since = null; flash("Glad you're okay. I'll keep watching."); post(`/api/sessions/${sessionRef.current.id}/event`, { note: `Check-in OK (${reason})` }); }
    else sendAlert(`ride check-in: worried (${reason})`);
  }
  const startCheckin = useCallback(async (reason: string) => {
    if (checkinRef.current || Date.now() < off.current.snoozeUntil) return;
    const c = { reason, endsAt: Date.now() + 20_000 }; setCheckin(c); checkinRef.current = c;
    const p = posRef.current, d = sessionRef.current?.destination;
    const tr = await fetch(`/api/traffic?lat=${p?.lat}&lng=${p?.lng}&dest=${d ? `${d.lat},${d.lng}` : ""}`).then((r) => r.json()).catch(() => ({}));
    const why = reason === "stopped" ? "The car has been stopped for a few minutes away from your destination." : "The ride has drifted off the expected route.";
    speakToAgent(`RIDE_CHECKIN. ${why} ${tr.note ? `Mention briefly, as a possible reason: ${tr.note}` : ""} In one short sentence say what you noticed, then ask ONE yes/no question: are you okay?`, true);
  }, [speakToAgent]);

  useEffect(() => {
    if (!checkin) return;
    const i = setInterval(() => { if (checkinRef.current && Date.now() >= checkinRef.current.endsAt) resolveCheckin(false); }, 500);
    return () => clearInterval(i);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkin]);

  useEffect(() => {
    if (!pos || session?.mode !== "ride" || !session.expected_route) return;
    const here: LL = [pos.lat, pos.lng], now = Date.now();
    const d = distToRoute(here, session.expected_route);
    if (d > 300) { if (!off.current.since) off.current.since = now; else if (now - off.current.since > 60_000) startCheckin("deviation"); } else off.current.since = null;
    hist.current.push({ t: now, p: here }); hist.current = hist.current.filter((h) => now - h.t < 200_000);
    const old = hist.current[0];
    if (old && now - old.t > 180_000 && session.destination) {
      const moved = distToRoute(here, [old.p, old.p]);
      const toDest = distToRoute(here, [[session.destination.lat, session.destination.lng], [session.destination.lat, session.destination.lng]]);
      if (moved < 25 && toDest > 200) startCheckin("stopped");
    }
  }, [pos, session, startCheckin]);

  /* ---------- tool handlers (updated every render) ---------- */
  handlers.current = {
    send_alert: (p: any) => sendAlert(p?.reason || "agent requested"),
    get_safe_places: async () => {
      const ps = await loadPlaces();
      if (!ps.length) return "I don't have verified nearby places cached for this spot. Head toward people and lights, and I can alert your contacts.";
      return ps.slice(0, 3).map((p: any) => `${p.name}, ${km(p.distance_m)} away, ${p.status.replace(/_/g, " ")}, source ${p.source_url ? new URL(p.source_url).hostname : "unknown"} checked ${mins(p.minutes_ago)}. ${p.hedge}`).join(" | ");
    },
    start_directions: async (p: any) => { const pl = placesRef.current.find((x) => x.id === p?.place_id) ?? placesRef.current[0]; return directionsTo(pl); },
    log_event: async (p: any) => { await post(`/api/sessions/${sessionRef.current.id}/event`, { note: p?.note ?? "" }); return "Logged."; },
    end_session: () => endSession(),
    onMessage: (m: any) => {
      const role = (m.source ?? m.role) === "user" ? "user" : "agent"; const t = String(m.message ?? m.text ?? "").trim(); if (!t) return;
      addLine(role, t); if (role === "user") handleUserText(t);
    },
  };

  /* ---------- lifecycle: recorder, voice, polling ---------- */
  const connectVoice = useCallback(async (personaVar = "haven") => {
    setVoiceErr("");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const j = await fetch(`/api/voice/signed-url${personaVar !== "haven" ? "?persona=fake" : ""}`).then((r) => r.json());
      if (!j.signedUrl) throw new Error(j.error || "voice unavailable");
      conv.startSession({ signedUrl: j.signedUrl, connectionType: "websocket", dynamicVariables: { persona: personaVar, mode: sessionRef.current?.mode ?? "walk" } } as any);
    } catch (e: any) { setVoiceErr("Voice is off (" + (e.message || "error") + "). You can still type, and every button works."); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    rec.current = new RollingRecorder(); rec.current.start().catch(() => {});
    connectVoice();
    if (session.mode === "emergency") sendAlert("emergency mode");
    return () => { rec.current?.stop(); try { conv.endSession(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => { try { conv.setVolume({ volume: quiet ? 0 : 1 }); } catch {} }, [quiet, conv.status]);

  const firstFix = useRef(false);
  useEffect(() => {
    if (!pos || firstFix.current) return; firstFix.current = true;
    loadPlaces();
    fetch(`/api/incidents?lat=${pos.lat}&lng=${pos.lng}`).then((r) => r.json()).then((j) => setHeat(j.cells ?? []));
    const d = sessionRef.current?.destination;
    if (d && sessionRef.current.mode === "walk") directionsTo(d).then((t) => { setExplain((e) => e || t); });
    if (sessionRef.current?.mode === "party" || sessionRef.current?.mode === "emergency") loadPlaces("hospital");
  }, [pos, loadPlaces, directionsTo]);

  useEffect(() => {
    if (!alert) return;
    const f = () => fetch(`/api/alerts/${alert.token}`).then((r) => r.json()).then(setAlertData).catch(() => {});
    f(); const i = setInterval(f, 3000); return () => clearInterval(i);
  }, [alert]);
  useEffect(() => {
    if (!followed?.token) return;
    const f = () => fetch(`/api/alerts/${followed.token}`).then((r) => r.json()).then(setFollowData).catch(() => {});
    f(); const i = setInterval(f, 3000); return () => clearInterval(i);
  }, [followed]);
  useEffect(() => {
    if (!session || !(view === "alert" || session.mode === "party")) return;
    const f = () => fetch(`/api/sessions/${session.id}`).then((r) => r.json()).then((j) => setTimeline(j.events ?? [])).catch(() => {});
    f(); const i = setInterval(f, 3000); return () => clearInterval(i);
  }, [session, view]);
  useEffect(() => {
    if (view !== "fake") return;
    const i = setInterval(() => {
      const txt = linesRef.current.filter((l) => l.role === "user").map((l) => l.text).join(". "); if (!txt) return;
      post("/api/evidence/extract", { sessionId: sessionRef.current?.id, transcript: txt, place: placesRef.current[0]?.name }).then((j) => j.chips && setChips(j.chips));
    }, 12_000);
    return () => clearInterval(i);
  }, [view]);

  /* ---------- actions ---------- */
  async function onFollowed() {
    const p = posRef.current; if (!session) return;
    setView("followed");
    persistNow("followed");
    const j = await post("/api/followed", { sessionId: session.id, lat: p?.lat ?? 32.8801, lng: p?.lng ?? -117.234 });
    setFollowed(j); if (j.places) setPlaces(j.places);
    if (j.nearest) {
      const t = await directionsTo(j.nearest);
      speakToAgent(`FOLLOWED. She pressed 'I'm being followed'. Buddies were softly notified and recording is on. Say, in two short sentences: nearest option is ${j.nearest.name}, ${km(j.nearest.distance_m)} away, it may be open (not guaranteed), then give the first direction. Directions info: ${t}`, true);
    } else speakToAgent("FOLLOWED. No cached staffed place nearby. Tell her calmly to move toward people and lights, and offer to call her contacts or start a fake call.", true);
  }
  async function startFake(pers: string) {
    setPersona(pers); setChips({}); setView("fake"); persistNow("fake_call");
    try { conv.endSession(); } catch {}
    setTimeout(() => connectVoice(pers), 700);
    post(`/api/sessions/${session.id}/event`, { note: `Fake call started (${pers})` });
  }
  function endFake() { try { conv.endSession(); } catch {} setTimeout(() => connectVoice("haven"), 700); setView(followed ? "followed" : "main"); }
  async function cancelAlert() {
    if (!alert) return;
    await post(`/api/alerts/${alert.token}/cancel`, { ownerSecret: alert.ownerSecret });
    alertSent.current = false; setAlert(null); setAlertData(null); setView("main"); flash("Alert cancelled. Your contacts were told you're okay.");
  }
  async function sendText() {
    const t = text.trim(); if (!t) return; setText("");
    addLine("user", t); handleUserText(t);
    if (conv.status === "connected") conv.sendUserMessage(t);
  }

  if (!session) return <main className="p-6 text-muted">Loading…</main>;

  const connected = conv.status === "connected";
  const lastAgent = [...lines].reverse().find((l) => l.role === "agent")?.text;
  const center = pos ?? { lat: 32.8801, lng: -117.234 };
  const mapMarkers: MapMarker[] = [
    ...(pos ? [{ lat: pos.lat, lng: pos.lng, color: "#B8A4FF", label: "You" }] : []),
    ...(session.destination ? [{ ...session.destination, color: "#5ED1C0", label: "Destination", shape: "pin" as const }] : []),
    ...places.map((p) => ({ lat: p.lat, lng: p.lng, color: "#FFC66B", label: p.name, shape: "pin" as const })),
  ];
  const mapLines: MapLine[] = [
    ...routes.filter((r) => !r.chosen).map((r) => ({ coords: r.coords, color: "#A9A4BC66", dashed: true })),
    ...routes.filter((r) => r.chosen).flatMap((r) => r.segments.map((s: any) => ({ coords: s.coords, color: "#5ED1C0", dashed: !s.lit }))),
    ...(session.expected_route && session.mode === "ride" ? [{ coords: session.expected_route, color: "#B8A4FF", dashed: false }] : []),
    ...(trail.length > 1 ? [{ coords: trail, color: "#B8A4FF99", dashed: false }] : []),
  ];
  const best = routes.find((r) => r.chosen);

  return (
    <main className="p-4 pb-10 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Pill color={connected ? "teal" : "amber"} icon={connected ? "●" : "◌"}>{connected ? (quiet ? "Quiet · listening" : "Listening") : "Voice off"}</Pill>
          <Pill color="accent" icon="◎">{session.mode}</Pill>
        </div>
        <button onClick={endSession} className="px-3 text-sm text-muted underline min-h-11">End</button>
      </header>
      {toast && <p role="status" className="bg-surface rounded-xl p-3 text-sm text-teal">{toast}</p>}
      {voiceErr && <p role="status" className="text-amber text-xs">{voiceErr}</p>}

      {checkin && (
        <div role="alertdialog" aria-label="Check-in" className="fixed inset-x-0 bottom-0 z-50 max-w-[480px] mx-auto bg-surface p-5 rounded-t-3xl space-y-3 shadow-2xl border-t-2 border-amber">
          <p className="text-lg font-semibold">Are you okay?</p>
          <p className="text-sm text-muted">{checkin.reason === "stopped" ? "Your ride has been stopped for a while." : "Your ride is off the expected route."} I'll alert your contacts if I don't hear back.</p>
          <CountdownBar endsAt={checkin.endsAt} />
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => resolveCheckin(true)} className="min-h-14 rounded-2xl bg-teal text-ground font-bold">✓ I'm okay</button>
            <button onClick={() => resolveCheckin(false)} className="min-h-14 rounded-2xl bg-coral text-ground font-bold">I'm worried</button>
          </div>
        </div>
      )}

      {/* ---------- MAIN ---------- */}
      {view === "main" && (
        <>
          <section aria-live="polite" className="bg-surface rounded-2xl p-4 min-h-24">
            <p className="text-xs text-muted mb-1">Haven</p>
            <p className="text-lg leading-snug">{lastAgent ?? (connected ? "I'm here. Tell me anything, or just keep walking." : "Tap below to connect voice.")}</p>
          </section>
          {!connected && <button onClick={() => connectVoice()} className="w-full min-h-12 rounded-2xl bg-surface text-accent">Connect voice</button>}
          <div role="group" aria-label="Voice mode" className="grid grid-cols-2 gap-2 bg-surface rounded-2xl p-1">
            {[false, true].map((q) => (
              <button key={String(q)} aria-pressed={quiet === q} onClick={() => setQuiet(q)} className={`min-h-11 rounded-xl text-sm font-medium ${quiet === q ? "bg-accent text-ground" : "text-muted"}`}>{q ? "Quiet" : "Companion"}</button>
            ))}
          </div>
          {session.mode === "walk" && explain && <p className="text-sm text-muted">{explain}</p>}
          {session.destination && <p className="text-sm text-muted">Heading to <span className="text-ink">{session.destination.name}</span>{best ? ` · ${km(best.distance_m)}, ~${Math.round(best.duration_s / 60)} min` : ""}</p>}
          {session.mode === "party" ? (
            <>
              <button onClick={async () => { const t = await sendAlert("feels off at a party"); flash(t); }} className="w-full min-h-36 rounded-3xl bg-amber text-ground text-2xl font-bold">I feel off</button>
              {places[0] && <PlaceCard p={places[0]} label="Nearest ER / staffed place" />}
            </>
          ) : (
            <button onClick={onFollowed} className="w-full min-h-36 rounded-3xl bg-coral text-ground text-2xl font-bold">I'm being followed</button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => startFake("boyfriend")} className="min-h-14 rounded-2xl bg-surface text-ink font-medium">Fake call</button>
            <button onClick={() => setView("map")} className="min-h-14 rounded-2xl bg-surface text-ink font-medium">Map</button>
          </div>
          <HoldButton label="Send alert" onFire={() => sendAlert("manual alert")} />
          <details className="text-sm text-muted"><summary className="min-h-11 flex items-center cursor-pointer">Type instead of talking</summary>
            <form onSubmit={(e) => { e.preventDefault(); sendText(); }} className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} className="flex-1 bg-surface rounded-xl px-3 min-h-11 text-ink" placeholder="Type a message" /><button className="px-4 rounded-xl bg-surface text-ink">Send</button></form></details>
          {session.mode === "party" && <Timeline items={timeline} />}
          <a href="/vault" className="block text-center text-sm text-muted underline min-h-11 leading-[44px]">Evidence vault</a>
        </>
      )}

      {/* ---------- FOLLOWED ---------- */}
      {view === "followed" && (
        <>
          <h1 className="text-2xl font-semibold">Stay with me.</h1>
          <p className="text-sm text-amber">● Recording on · your buddies were softly notified</p>
          {followed?.nearest ? <PlaceCard p={followed.nearest} label="Nearest staffed place" /> : <div className="bg-surface rounded-2xl p-4 text-sm">{followed ? "I don't have a verified staffed place nearby. Move toward lights and people." : "Finding the nearest staffed place…"}</div>}
          <section className="bg-surface rounded-2xl p-4 space-y-2" aria-label="Buddies">
            <h2 className="text-sm text-muted">Buddies</h2>
            {(followData?.calls ?? []).map((c: any) => {
              const watching = (followData.acks ?? []).some((a: any) => a.name === c.name);
              return <p key={c.id} className="text-sm">{c.name} — {watching ? "watching your location" : "texted"}</p>;
            })}
            {!followData && <p className="text-sm text-muted">Notifying…</p>}
          </section>
          {routes.length > 0 && <MapView center={center} markers={mapMarkers} lines={mapLines} className="h-56" />}
          <div className="grid grid-cols-1 gap-3">
            <a href={`tel:${ESCORT_PHONE}`} className="min-h-14 rounded-2xl bg-surface flex items-center justify-center font-medium">Call campus escort</a>
            <a href={`https://m.uber.com/ul/?action=setPickup&pickup=my_location${session.destination ? `&dropoff[latitude]=${session.destination.lat}&dropoff[longitude]=${session.destination.lng}` : ""}`} target="_blank" className="min-h-14 rounded-2xl bg-surface flex items-center justify-center font-medium">Open ride app</a>
            <button onClick={() => startFake("friend")} className="min-h-14 rounded-2xl bg-surface font-medium">Fake call</button>
          </div>
          <HoldButton label="Send full alert" onFire={() => sendAlert("followed: escalated")} />
          <button onClick={() => setView("main")} className="w-full min-h-12 text-muted underline">Back</button>
        </>
      )}

      {/* ---------- ALERT SENT ---------- */}
      {view === "alert" && (
        <>
          <h1 className="text-2xl font-semibold">Alert sent</h1>
          <p className={`inline-block px-3 py-2 rounded-full bg-surface ${alertData?.alert?.status === "claimed" ? "text-teal" : "text-amber"}`}>
            {alertData?.alert?.status === "claimed" ? `● ${alertData.alert.claimed_by_name} is responding` : "◌ Calling your contacts…"}</p>
          {(alertData?.acks ?? []).filter((a: any) => a.kind.startsWith("eta:")).map((a: any) => <p key={a.name} className="text-teal">{a.name} ETA ~{a.kind.slice(4)} min</p>)}
          <section className="bg-surface rounded-2xl p-4 space-y-2">
            {(alertData?.calls ?? []).map((c: any) => <p key={c.id} className="text-sm">{c.digit === "1" ? "✓" : "…"} {c.name} — {c.status === "dry_run" ? "calling (demo)" : c.status}{c.digit === "1" ? " · pressed 1" : ""}</p>)}
          </section>
          <Timeline items={alertData?.events ?? timeline} />
          <button onClick={() => router.push("/911")} className="w-full min-h-14 rounded-2xl bg-coral text-ground font-bold">Connect to 911 (demo handoff)</button>
          {places[0] && <PlaceCard p={places[0]} label="Nearest staffed place" />}
          <button onClick={() => startFake("dad")} className="w-full min-h-14 rounded-2xl bg-surface">Fake call</button>
          <button onClick={cancelAlert} className="w-full min-h-14 rounded-2xl border border-muted text-ink">I'm safe — cancel alert</button>
        </>
      )}

      {/* ---------- FAKE CALL ---------- */}
      {view === "fake" && (
        <>
          <div className="flex items-center justify-between"><Pill color="coral" icon="●">Recording</Pill><span className="text-sm text-muted capitalize">{persona}</span></div>
          <div className="flex gap-2" role="group" aria-label="Persona">{["boyfriend", "friend", "dad"].map((p) => <button key={p} onClick={() => startFake(p)} aria-pressed={persona === p} className={`px-3 min-h-11 rounded-full text-sm capitalize ${persona === p ? "bg-accent text-ground" : "bg-surface"}`}>{persona === p ? "✓ " : ""}{p}</button>)}</div>
          <section aria-live="polite" className="bg-surface rounded-2xl p-4 space-y-2 h-56 overflow-y-auto">
            {lines.slice(-8).map((l, i) => <p key={i} className={`text-sm ${l.role === "user" ? "text-muted" : "text-ink"}`}><b>{l.role === "user" ? "You" : persona}:</b> {l.text}</p>)}
            {!lines.length && <p className="text-sm text-muted">{connected ? "Connected. Just talk naturally." : "Connecting…"}</p>}
          </section>
          <section aria-label="Captured for your report"><h2 className="text-sm text-muted mb-2">Captured for your report</h2>
            <div className="flex flex-wrap gap-2">{Object.entries(chips).map(([k, v]) => <span key={k} className="px-3 py-2 rounded-xl bg-surface text-sm"><span className="text-accent capitalize">{k.replace("_", "/")}</span> · {v}</span>)}{!Object.keys(chips).length && <span className="text-sm text-muted">Nothing yet. Details appear as you talk.</span>}</div></section>
          <HoldButton label="Send alert" onFire={() => sendAlert("fake call escalated")} />
          <button onClick={endFake} className="w-full min-h-14 rounded-2xl bg-surface">End call</button>
        </>
      )}

      {/* ---------- MAP ---------- */}
      {view === "map" && (
        <>
          <MapView center={center} markers={mapMarkers} lines={mapLines} heat={heat} className="h-[60vh]" />
          <div className="text-xs text-muted space-y-1"><p>━ solid: lit route · ┄ dashed: dim or unknown lighting</p><p>Amber pins: staffed places (hours may have changed) · Red haze: recent anonymized reports</p>{explain && <p className="text-ink">{explain}</p>}</div>
          <button onClick={() => setView("main")} className="w-full min-h-12 rounded-2xl bg-surface">Back</button>
        </>
      )}
    </main>
  );
}

function PlaceCard({ p, label }: { p: any; label: string }) {
  const host = p.source_url ? (() => { try { return new URL(p.source_url).hostname.replace("www.", ""); } catch { return "source"; } })() : "no source";
  return (
    <section className="bg-surface rounded-2xl p-4 space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{p.name} <span className="text-muted text-sm font-normal">· {km(p.distance_m)}</span></p>
      <p className="text-sm">{p.status === "open_24h" ? "Listed as open 24 hours" : p.status === "may_be_open" ? "May be open now" : p.status === "may_be_closed" ? "May be closed now" : "Hours unknown"}{p.uncertain ? " · sources disagree" : ""}</p>
      <p className="text-xs text-muted">Source: {p.source_url ? <a className="underline" href={p.source_url} target="_blank">{host}</a> : host} · checked {mins(p.minutes_ago)}</p>
      <p className="text-xs text-amber">{p.hedge}</p>
    </section>
  );
}
function Timeline({ items }: { items: any[] }) {
  if (!items.length) return null;
  return <section className="bg-surface rounded-2xl p-4"><h2 className="text-sm text-muted mb-2">Timeline</h2><ul className="space-y-1 text-sm">{items.map((e, i) => <li key={i}><span className="text-muted">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> {e.note ?? e.kind}</li>)}</ul></section>;
}
function CountdownBar({ endsAt }: { endsAt: number }) {
  const [n, setN] = useState(20);
  useEffect(() => { const i = setInterval(() => setN(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 250); return () => clearInterval(i); }, [endsAt]);
  return <div><div className="h-2 rounded bg-ground overflow-hidden"><div className="h-full bg-amber" style={{ width: `${(n / 20) * 100}%` }} /></div><p className="text-xs text-muted mt-1">{n}s</p></div>;
}
