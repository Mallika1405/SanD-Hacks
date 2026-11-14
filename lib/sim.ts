// GPS simulator: replays a recorded route around UCSD; can inject a deviation.
export type LL = [number, number];
export const ROUTES: Record<string, { name: string; dest: { name: string; lat: number; lng: number }; points: LL[] }> = {
  route1: {
    name: "Geisel → Pepper Canyon",
    dest: { name: "Pepper Canyon Apartments", lat: 32.8785, lng: -117.2330 },
    points: [[32.88115, -117.2376], [32.8805, -117.2369], [32.8799, -117.2363], [32.8793, -117.2355], [32.8790, -117.2345], [32.8787, -117.2337], [32.8785, -117.2330]],
  },
};
const M = 111_320;
export function dist(a: LL, b: LL) {
  const dx = (b[1] - a[1]) * M * Math.cos((a[0] * Math.PI) / 180), dy = (b[0] - a[0]) * M;
  return Math.hypot(dx, dy);
}
export function densify(pts: LL[], stepM = 12): LL[] {
  const out: LL[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.round(dist(a, b) / stepM));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
export class Simulator {
  path: LL[]; i = 0; deviating = false; pos: LL; stopped = false;
  constructor(key = "route1") { this.path = densify(ROUTES[key].points); this.pos = this.path[0]; }
  deviate() { this.deviating = true; }
  stop(v = true) { this.stopped = v; }
  tick(): LL {
    if (this.stopped) return this.pos;
    if (this.deviating) this.pos = [this.pos[0] - 0.00008, this.pos[1] + 0.00022]; // drift SE ~25m/tick
    else { this.i = Math.min(this.i + 1, this.path.length - 1); this.pos = this.path[this.i]; }
    return this.pos;
  }
}
