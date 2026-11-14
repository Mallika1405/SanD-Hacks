export default function Demo() {
  const L = ({ href, children, note }: { href: string; children: React.ReactNode; note: string }) => (
    <a href={href} className="block bg-surface rounded-2xl p-4 min-h-16"><p className="font-medium text-accent">{children}</p><p className="text-sm text-muted">{note}</p></a>
  );
  return (
    <main className="p-5 space-y-3">
      <h1 className="text-2xl font-semibold">Demo shortcuts</h1>
      <p className="text-sm text-muted">Uses the GPS simulator: Geisel Library → Pepper Canyon (UCSD). Run <code>npm run seed</code> first.</p>
      <L href="/?sim=route1" note="Home with simulator on. Pick Walk or Ride, then Start.">1 · Start with simulator</L>
      <L href="/dev" note="Hold-to-alert test page. Dry-run presses 1 for each contact.">2 · Alert engine test</L>
      <L href="/onboarding" note="Contacts and the code phrase.">3 · Contacts + code phrase</L>
      <L href="/911" note="Mock handoff. Never dials.">4 · Mock 911 handoff</L>
      <L href="/vault" note="Saved evidence, PDF export, share, delete.">5 · Evidence vault</L>
      <section className="bg-surface rounded-2xl p-4 text-sm space-y-2">
        <p className="font-medium">During an active ride/walk (browser console)</p>
        <p className="text-muted"><code>__haven.deviate()</code> — ride drifts off route (check-in after ~60s)</p>
        <p className="text-muted"><code>__haven.stop()</code> — car stops (check-in after 3 min)</p>
        <p className="text-muted">Say "help" or your code phrase to fire the alert instantly.</p>
      </section>
    </main>
  );
}
