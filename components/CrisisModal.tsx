"use client";
const TRUST_MSG = "I'm having a hard time right now. Can you stay in touch with me?";

export default function CrisisModal({ kind, onClose, closeLabel = "I'm safe right now" }: { kind: "self_harm" | "medical"; onClose: () => void; closeLabel?: string }) {
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ text: TRUST_MSG }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(TRUST_MSG); alert("Copied. Paste it to someone you trust."); } catch { alert(TRUST_MSG); }
  };
  return (
    <>
      <div className="sheet-back" />
      <div role="alertdialog" aria-label="Crisis resources" className="fixed inset-0 z-[70] overflow-y-auto grid place-items-center p-4">
        <div className="card max-w-[520px] w-full p-7 space-y-4">
          <span className="tag tag-terra">{kind === "medical" ? "Possible medical emergency" : "Help is here"}</span>
          <h1 className="text-[2rem] leading-tight">{kind === "medical" ? "This could be a medical emergency." : "You're not alone. Help is here right now."}</h1>
          <p className="text-ink2">{kind === "medical" ? "Chest pain, trouble breathing, or feeling faint can be serious. Please call 911 now." : "If you might hurt yourself, please call or text 988, the US Suicide & Crisis Lifeline. It's free, and someone answers day and night."}</p>
          <a href={kind === "medical" ? "tel:911" : "tel:988"} className="b b-terra w-full !min-h-[56px] text-[17px]">{kind === "medical" ? "Call 911" : "Call 988"}</a>
          {kind !== "medical" && <a href="sms:988" className="b b-soft w-full border border-line">Text 988</a>}
          <a href={kind === "medical" ? "tel:988" : "tel:911"} className="b b-soft w-full border border-line">{kind === "medical" ? "Call 988 (emotional crisis)" : "Call 911 (medical emergency)"}</a>
          <button onClick={share} className="b b-ghost w-full">Message someone I trust</button>
          <a href="/crisis" className="b w-full text-ink2 underline">More support options</a>
          <button onClick={onClose} className="b w-full text-ink2 underline">{closeLabel}</button>
          <p className="text-[12px] text-ink2">Somewhere is a demo and not a medical service or crisis line. It can't call anyone for you; these buttons open your phone.</p>
        </div>
      </div>
    </>
  );
}
