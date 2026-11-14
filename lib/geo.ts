import type { LL } from "./sim";
const M = 111_320;
export function segDist(p: LL, a: LL, b: LL) {
  const k = Math.cos((p[0] * Math.PI) / 180), x = (q: LL) => [(q[1] - p[1]) * M * k, (q[0] - p[0]) * M];
  const [ax, ay] = x(a), [bx, by] = x(b), dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
export function distToRoute(p: LL, route: LL[]) {
  let m = Infinity;
  for (let i = 1; i < route.length; i++) m = Math.min(m, segDist(p, route[i - 1], route[i]));
  return m;
}
