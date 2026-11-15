"use client";
import { useState } from "react";

const INTL: Record<string, { label: string; lines: { name: string; sub: string; tel?: string; text?: string }[] }> = {
  us: { label: "United States", lines: [{ name: "988 Suicide & Crisis Lifeline", sub: "Call or text 988, free, any time", tel: "988" }, { name: "Emergency", sub: "Medical or immediate danger", tel: "911" }] },
  ca: { label: "Canada", lines: [{ name: "9-8-8 Suicide Crisis Helpline", sub: "Call or text 988, free, any time", tel: "988" }, { name: "Emergency", sub: "Medical or immediate danger", tel: "911" }] },
  uk: { label: "United Kingdom", lines: [{ name: "Samaritans", sub: "Free, any time", tel: "116123" }, { name: "NHS 111", sub: "Urgent mental health help, choose the mental health option", tel: "111" }, { name: "Emergency", sub: "Medical or immediate danger", tel: "999" }] },
  au: { label: "Australia", lines: [{ name: "Lifeline", sub: "24 hours", tel: "131114" }, { name: "Emergency", sub: "Medical or immediate danger", tel: "000" }] },
};

export default function Crisis() {
  const [region, setRegion] = useState("us");
  const r = INTL[region];
  return (
    <div className="space-y-6 fade-in">
      <section className="rounded-[28px] p-8 lg:p-12" style={{ background: "linear-gradient(135deg, rgba(188,237,220,.55), rgba(201,226,251,.45) 60%, rgba(250,248,245,.4))" }}>
        <span className="tag tag-terra"><i className="size-1.5 rounded-full bg-terra" />Help is available right now</span>
        <h1 className="mt-4 text-[2.6rem] lg:text-[3.4rem] leading-[1.08]">You are not alone.</h1>
        <p className="mt-4 text-[1.1rem] text-ink2 prose-narrow">Free, confidential, human support is there for you any time, day or night. If your chest feels tight or your thoughts feel unbearable, please choose a direct link below. You don't have to be in danger to reach out.</p>
        <div className="mt-5 flex flex-wrap gap-4 text-[14px] text-ink2"><span>No cost</span><span>No sign-up</span><span>Opens your phone's own call or text app</span></div>
      </section>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <div className="space-y-6">
          <article className="card p-6 lg:p-7">
            <div className="flex items-start justify-between gap-3">
              <div><p className="eyebrow">Immediate priority</p><h2 className="mt-1 text-[1.7rem]">988 Suicide & Crisis Lifeline</h2></div>
              <span className="tag tag-sage">Available 24/7</span>
            </div>
            <p className="mt-3 text-ink2 prose-narrow">Free, confidential emotional support and crisis care, in English and Spanish. You don't need to be in active danger to reach out.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="tel:988" className="b b-primary flex-1 min-w-[160px]">Call 988</a>
              <a href="sms:988" className="b b-soft flex-1 min-w-[160px] border border-line">Text 988</a>
              <a href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer" className="b b-ghost flex-1 min-w-[160px]">Chat online</a>
            </div>
            <p className="mt-4 text-[13px] text-ink2">Deaf or hard of hearing: dial 711, then 988.</p>
          </article>

          <article className="card p-5 flex flex-wrap items-center justify-between gap-4">
            <div><h3 className="text-[1.25rem]">Crisis Text Line</h3><p className="text-ink2 text-[14.5px]">Free, any time, by text with a trained volunteer counselor.</p></div>
            <a href="sms:741741?body=HOME" className="b b-soft border border-line">Text HOME to 741741</a>
          </article>

          <div className="grid sm:grid-cols-2 gap-6">
            <article className="card p-5 space-y-3">
              <span className="tag">LGBTQ+ youth</span><h3 className="text-[1.3rem]">The Trevor Project</h3>
              <p className="text-[14.5px] text-ink2">24/7 crisis support for LGBTQ+ young people.</p>
              <a href="tel:18664887386" className="b b-soft w-full border border-line">1-866-488-7386</a>
              <a href="sms:678678?body=START" className="b b-soft w-full border border-line">Text START to 678-678</a>
            </article>
            <article className="card p-5 space-y-3">
              <span className="tag tag-sage">Veterans & families</span><h3 className="text-[1.3rem]">Veterans Crisis Line</h3>
              <p className="text-[14.5px] text-ink2">Qualified responders for veterans, service members and loved ones.</p>
              <a href="tel:988" className="b b-primary w-full">Dial 988, then press 1</a>
              <a href="sms:838255" className="b b-soft w-full border border-line">Text 838255</a>
            </article>
          </div>

          <article className="card-flat p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-[1.3rem]">Outside the United States</h3>
              <label className="sr-only" htmlFor="region">Region</label>
              <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} className="!w-auto !min-w-[200px]">{Object.entries(INTL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            {r.lines.map((l) => (
              <div key={l.name} className="bg-white rounded-xl p-4 flex items-center justify-between gap-3 border border-line"><div><p className="font-semibold">{l.name}</p><p className="text-[13.5px] text-ink2">{l.sub}</p></div>
                <a href={`tel:${l.tel}`} className="b b-primary !min-h-[44px]">Call {l.tel}</a></div>
            ))}
          </article>
        </div>

        <aside className="space-y-6">
          <article className="card p-6">
            <p className="eyebrow !text-terra">While you wait</p><h2 className="mt-1 text-[1.6rem]">Three steps for right now</h2>
            <ol className="mt-4 space-y-3">
              {[["Feet flat on the floor", "Feel the weight of your body pressing down through your shoes."], ["Unclench your jaw", "Let your tongue drop from the roof of your mouth. Let your shoulders fall."], ["Name three things you can see", "Look around the room and say them to yourself."]].map(([t, d], i) => (
                <li key={t} className="flex gap-3 card-flat p-4"><span className="size-7 rounded-full bg-sagedeep text-white grid place-items-center text-sm font-semibold shrink-0">{i + 1}</span><span><span className="block font-semibold">{t}</span><span className="text-[14.5px] text-ink2">{d}</span></span></li>
              ))}
            </ol>
            <a href="/now?sos=1" className="b b-primary w-full mt-4">Guide me through it</a>
          </article>
          <article className="card-flat p-5">
            <h3 className="text-[1.2rem]">If anyone is in immediate danger</h3>
            <p className="mt-1 text-[14.5px] text-ink2">If you or someone near you has taken pills, has access to a weapon, or can't stay safe right now, call 911 or go to the nearest emergency room.</p>
            <a href="tel:911" className="b b-terrasoft w-full mt-3">Call 911</a>
          </article>
        </aside>
      </div>

      <section className="card-flat p-6"><h3 className="text-[1.2rem]">About Anchor</h3>
        <p className="mt-2 text-[14.5px] text-ink2 prose-narrow">Anchor is a demo and is not a medical service, therapist, or crisis line. It can't call anyone for you and can't tell what's wrong. The links on this page open your phone's own call or text app and connect you to independent services.</p></section>
    </div>
  );
}
