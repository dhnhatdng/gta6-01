// Seeded random number generator and small math helpers for Solara Bay.
// Every random choice in the city build uses this so a seed rebuilds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    next: rand,
    range(min, max) { return min + rand() * (max - min); },
    int(min, max) { return Math.floor(min + rand() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(rand() * arr.length)]; },
    chance(p) { return rand() < p; },
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
