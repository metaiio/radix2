// Layout for "Spot the difference" games. Deterministic from the seed stored
// on the post, so every player gets the same puzzle.

export interface Spot {
  /** Centre and radius as fractions of the square picture's side. */
  x: number;
  y: number;
  r: number;
  /** Tint applied inside the circle. */
  hue: number;
}

const GRID = 5;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks `count` well-separated circles on a 5×5 grid. */
export function spotLayout(seed: number, count: number): Spot[] {
  const rnd = mulberry32(seed);
  const cells = Array.from({ length: GRID * GRID }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  const chosen: number[] = [];
  const touching = (a: number, b: number) => Math.abs((a % GRID) - (b % GRID)) <= 1 && Math.abs(Math.floor(a / GRID) - Math.floor(b / GRID)) <= 1;
  // Prefer cells that don't touch one already chosen; fall back to any if the grid gets crowded.
  for (const pass of [true, false]) {
    for (const c of cells) {
      if (chosen.length >= count) break;
      if (chosen.includes(c) || (pass && chosen.some((o) => touching(o, c)))) continue;
      chosen.push(c);
    }
  }
  return chosen.map((c) => ({
    x: ((c % GRID) + 0.5 + (rnd() - 0.5) * 0.3) / GRID,
    y: (Math.floor(c / GRID) + 0.5 + (rnd() - 0.5) * 0.3) / GRID,
    r: 0.07,
    hue: Math.floor(rnd() * 360),
  }));
}
