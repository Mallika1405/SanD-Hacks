import crypto from "crypto";
import { q } from "./db";
import { recordIncident } from "./incidents";
import { baseUrl, client, isEmergencyNumber, sendSms, twilioEnabled, VoiceResponse } from "./twilio";

export type Alert = {
  id: string; user_id: string; session_id: string | null; token: string; owner_secret: string;
  kind: string; status: "active" | "claimed" | "cancelled"; reason: string | null; place_text: string | null;
  claimed_by: string | null; claimed_at: string | null; created_at: string; expires_at: string;
};
type Contact = { id: string; name: string; phone: string };
type CallRow = { id: string; alert_id: string; contact_id: string; call_sid: string | null; status: string; attempt: number };

export async function logEvent(alertId: string | null, sessionId: string | null, kind: string, note?: string, data?: unknown) {
  await q("INSERT INTO events(alert_id, session_id, kind, note, data) VALUES ($1,$2,$3,$4,$5)", [
    alertId, sessionId, kind, note ?? null, data ? JSON.stringify(data) : null,
  ]);
}

export async function createAlert(input: {
  userId: string; sessionId?: string | null; reason?: string; placeText?: string; lat?: number; lng?: number; kind?: "alert" | "soft";
}) {
  const token = crypto.randomBytes(24).toString("base64url");
  const ownerSecret = crypto.randomBytes(16).toString("base64url");
  const hasGeo = input.lat != null && input.lng != null;
  const [alert] = await q<Alert>(
    `INSERT INTO alerts(user_id, session_id, token, owner_secret, reason, place_text, kind, geom)
     VALUES ($1,$2,$3,$4,$5,$6,'${input.kind ?? "alert"}', ${hasGeo ? "ST_SetSRID(ST_MakePoint($8,$7),4326)::geography" : "NULL"})
     RETURNING *`,
    hasGeo
      ? [input.userId, input.sessionId ?? null, token, ownerSecret, input.reason ?? null, input.placeText ?? null, input.lat, input.lng]
      : [input.userId, input.sessionId ?? null, token, ownerSecret, input.reason ?? null, input.placeText ?? null],
  );
  await logEvent(alert.id, alert.session_id, "alert_created", input.reason ?? "alert");
  if (hasGeo && alert.kind === "alert") recordIncident(input.lat!, input.lng!, "alert").catch(() => {});
  if (alert.session_id) await q("UPDATE sessions SET persisted=true WHERE id=$1", [alert.session_id]).catch(() => {});
  await dialAll(alert, 1);
  return alert;
}

async function userName(userId: string) {
  const [u] = await q<{ name: string }>("SELECT name FROM users WHERE id=$1", [userId]);
  return u?.name ?? "Someone";
}

export async function briefing(alert: Alert) {
  const name = await userName(alert.user_id);
  const where = alert.place_text ? ` at ${alert.place_text}` : "";
  return `${name} asked for help${where}. Press 1 to say you are responding. If this is an emergency, call 9 1 1.`;
}

export function responderLink(alert: Alert, contactId?: string) {
  return `${baseUrl()}/r/${alert.token}${contactId ? `?c=${contactId}` : ""}`;
}

async function dialAll(alert: Alert, attempt: number, onlyContactIds?: string[]) {
  const contacts = await q<Contact>(
    "SELECT id, name, phone FROM contacts WHERE user_id=$1 AND opted_in_at IS NOT NULL", [alert.user_id]);
  const targets = onlyContactIds ? contacts.filter((c) => onlyContactIds.includes(c.id)) : contacts;
  const name = await userName(alert.user_id);
  const where = alert.place_text ? ` at ${alert.place_text}` : "";
  await Promise.allSettled(
    targets.map(async (c) => {
      const rows = await q<CallRow>(
        `INSERT INTO alert_calls(alert_id, contact_id, attempt) VALUES ($1,$2,$3)
         ON CONFLICT (alert_id, contact_id, attempt) DO NOTHING RETURNING *`, [alert.id, c.id, attempt]);
      const row = rows[0];
      if (!row) return;
      if (alert.kind === "soft") {
        await sendSms(c.phone, `${name} may be being followed${where}. She did not ask for a call. You can check in and watch her location: ${responderLink(alert, c.id)}`).catch(() => {});
        await q("UPDATE alert_calls SET status='texted', updated_at=now() WHERE id=$1", [row.id]);
        return;
      }
      if (attempt === 1)
        await sendSms(c.phone, `${name} asked for help${where}. Live link: ${responderLink(alert, c.id)} (Haven does not replace 911.)`).catch(() => {});
      if (!twilioEnabled()) {
        await q("UPDATE alert_calls SET status='dry_run', call_sid=$2, updated_at=now() WHERE id=$1", [row.id, "dry_" + row.id]);
        return;
      }
      if (isEmergencyNumber(c.phone)) {
        await q("UPDATE alert_calls SET status='blocked', updated_at=now() WHERE id=$1", [row.id]);
        return;
      }
      try {
        const call = await client().calls.create({
          to: c.phone, from: process.env.TWILIO_FROM_NUMBER!, timeout: 25,
          url: `${baseUrl()}/api/twilio/voice?callId=${row.id}`,
          statusCallback: `${baseUrl()}/api/twilio/status?callId=${row.id}`,
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        });
        await q("UPDATE alert_calls SET call_sid=$2, status='initiated', updated_at=now() WHERE id=$1", [row.id, call.sid]);
      } catch (e) {
        await q("UPDATE alert_calls SET status='failed', updated_at=now() WHERE id=$1", [row.id]);
        console.error("dial failed", e);
      }
    }),
  );
}

/** Retry once after 60s for contacts who haven't responded. Atomic guard makes it idempotent. */
export async function maybeRetry(alertId: string) {
  const [a] = await q<Alert>(
    `UPDATE alerts SET retried_at=now()
     WHERE id=$1 AND status='active' AND retried_at IS NULL AND created_at < now() - interval '60 seconds'
     RETURNING *`, [alertId]);
  if (!a) return;
  await logEvent(a.id, a.session_id, "retry", "No one has responded yet. Calling again.");
  await dialAll(a, 2);
}

/** Atomic claim: first to press 1 wins. */
export async function ackAlert(token: string, contactId: string, kind: string) {
  const [a] = await q<Alert>("SELECT * FROM alerts WHERE token=$1 AND expires_at>now()", [token]);
  if (!a) return null;
  const [c] = await q<Contact>("SELECT id,name,phone FROM contacts WHERE id=$1 AND user_id=$2 AND opted_in_at IS NOT NULL", [contactId, a.user_id]);
  if (!c) return null;
  if (kind === "responding" && a.kind === "alert") return claimAlert(a.id, c.id);
  const ins = await q("INSERT INTO alert_acks(alert_id,contact_id,kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id", [a.id, c.id, kind]);
  if (ins.length) await logEvent(a.id, a.session_id, "ack", kind.startsWith("eta:") ? `${c.name} can be there in about ${kind.slice(4)} min` : `${c.name} is ${kind === "watching" ? "watching" : "checking in"}`);
  return { won: false as const, alert: a, claimerName: null };
}

export async function claimAlert(alertId: string, contactId: string) {
  const [won] = await q<Alert>(
    `UPDATE alerts SET status='claimed', claimed_by=$2, claimed_at=now()
     WHERE id=$1 AND claimed_by IS NULL AND status='active' AND expires_at > now() RETURNING *`,
    [alertId, contactId]);
  if (won) {
    const [c] = await q<Contact>("SELECT id,name,phone FROM contacts WHERE id=$1", [contactId]);
    await logEvent(alertId, won.session_id, "claimed", `${c.name} is responding`);
    await notifyOthers(won, c);
    return { won: true as const, alert: won };
  }
  const [cur] = await q<Alert & { claimer_name: string | null }>(
    `SELECT a.*, c.name AS claimer_name FROM alerts a LEFT JOIN contacts c ON c.id=a.claimed_by WHERE a.id=$1`, [alertId]);
  return { won: false as const, alert: cur, claimerName: cur?.claimer_name ?? null };
}

function respondingTwiml(name: string) {
  const vr = new VoiceResponse();
  vr.say(`${name} is responding. You do not need to do anything else. Thank you.`);
  vr.hangup();
  return vr.toString();
}

async function notifyOthers(alert: Alert, winner: Contact) {
  const calls = await q<CallRow & { phone: string }>(
    `SELECT DISTINCT ON (ac.contact_id) ac.*, c.phone FROM alert_calls ac JOIN contacts c ON c.id=ac.contact_id
     WHERE ac.alert_id=$1 AND ac.contact_id<>$2 ORDER BY ac.contact_id, ac.attempt DESC`, [alert.id, winner.id]);
  await Promise.allSettled(
    calls.map(async (r) => {
      if (twilioEnabled() && r.call_sid && !r.call_sid.startsWith("dry_")) {
        try {
          if (["queued", "initiated", "ringing"].includes(r.status))
            await client().calls(r.call_sid).update({ status: "canceled" });
          else if (["in-progress", "answered"].includes(r.status))
            await client().calls(r.call_sid).update({ twiml: respondingTwiml(winner.name) });
        } catch {}
      }
      await sendSms(r.phone, `${winner.name} is responding. No action needed. Details: ${responderLink(alert)}`).catch(() => {});
    }),
  );
}

export async function cancelAlert(token: string, ownerSecret: string) {
  const [a] = await q<Alert>(
    `UPDATE alerts SET status='cancelled', cancelled_at=now() WHERE token=$1 AND owner_secret=$2 AND status<>'cancelled' RETURNING *`,
    [token, ownerSecret]);
  if (!a) return null;
  await logEvent(a.id, a.session_id, "cancelled", "Cancelled by sender. She is ok.");
  const contacts = await q<Contact>("SELECT id,name,phone FROM contacts WHERE user_id=$1 AND opted_in_at IS NOT NULL", [a.user_id]);
  const name = await userName(a.user_id);
  await Promise.allSettled(contacts.map((c) => sendSms(c.phone, `Update: ${name} cancelled the alert. No action needed.`)));
  return a;
}

/** Handle a keypad digit for a call. Returns TwiML-ready message. */
export async function handleDigit(callId: string, digit: string) {
  const [row] = await q<CallRow>("SELECT * FROM alert_calls WHERE id=$1", [callId]);
  if (!row) return { done: true, message: "Sorry, something went wrong." };
  await q("UPDATE alert_calls SET digit=$2, updated_at=now() WHERE id=$1", [callId, digit]);
  if (digit !== "1") return { done: false, message: "" };
  const r = await claimAlert(row.alert_id, row.contact_id);
  if (r.won) return { done: true, message: "You are responding. We just texted you a live link. Stay safe." };
  if (r.claimerName) return { done: true, message: `${r.claimerName} is responding. You do not need to do anything else.` };
  return { done: true, message: "This alert is no longer active." };
}
