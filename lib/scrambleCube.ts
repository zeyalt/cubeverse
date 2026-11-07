/** WCA Western color scheme, using Cubeverse sticker colors. */
export const FACE_COLORS = {
  U: "#F4F1EA",
  D: "#FFD500",
  F: "#009B48",
  B: "#0046AD",
  L: "#FF5800",
  R: "#B71234",
} as const;

export type Face = keyof typeof FACE_COLORS;
export const FACES = ["U", "D", "F", "B", "L", "R"] as const;

export type Cube = { n: number; faces: Record<Face, string[]> };

export type CubePreview = {
  kind: "cube";
  n: number;
  U: string[][];
  D: string[][];
  F: string[][];
  B: string[][];
  L: string[][];
  R: string[][];
};

export type PyraFaceId = "F" | "R" | "L" | "D";

export type PyraminxPreview = {
  kind: "pyraminx";
  faces: Record<PyraFaceId, string[]>;
};

export type SkewbPreview = {
  kind: "skewb";
  centers: Record<Face, string>;
  corners: Record<"UFL" | "UFR" | "UBR" | "UBL" | "DFL" | "DFR" | "DBR" | "DBL", [string, string, string]>;
};

export type ClockPreview = {
  kind: "clock";
  front: number[];
  back: number[];
  pins: [boolean, boolean, boolean, boolean];
};

/** One Square-1 piece; `start` is its first 30° slot, clockwise from the back slice. */
export type Square1Piece = {
  kind: "edge" | "corner";
  start: number;
  face: string;
  /** Side sticker per 30° slot, in slot order (one for edges, two for corners). */
  sides: string[];
};

export type Square1Preview = {
  kind: "sq1";
  /** Both layers indexed by the same top-view slots, so the slice is shared. */
  top: Square1Piece[];
  bottom: Square1Piece[];
  middleFlipped: boolean;
};

export type ScramblePreviewModel =
  | CubePreview
  | PyraminxPreview
  | SkewbPreview
  | ClockPreview
  | Square1Preview;

function idx(n: number, row: number, col: number) {
  return row * n + col;
}

function asGrid(face: string[], n: number): string[][] {
  const grid: string[][] = [];
  for (let row = 0; row < n; row++) grid.push(face.slice(row * n, row * n + n));
  return grid;
}

export function solvedCube(n: number): Cube {
  return {
    n,
    faces: {
      U: Array(n * n).fill(FACE_COLORS.U),
      D: Array(n * n).fill(FACE_COLORS.D),
      F: Array(n * n).fill(FACE_COLORS.F),
      B: Array(n * n).fill(FACE_COLORS.B),
      L: Array(n * n).fill(FACE_COLORS.L),
      R: Array(n * n).fill(FACE_COLORS.R),
    },
  };
}

function rotateFace(face: string[], n: number, turns: number) {
  const times = ((turns % 4) + 4) % 4;
  if (times === 0) return;
  const src = face.slice();
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      let r = row;
      let c = col;
      for (let t = 0; t < times; t++) {
        const nextR = c;
        const nextC = n - 1 - r;
        r = nextR;
        c = nextC;
      }
      face[idx(n, r, c)] = src[idx(n, row, col)];
    }
  }
}

type Strip = { face: Face; cells: number[] };

function cycle(cube: Cube, strips: [Strip, Strip, Strip, Strip]) {
  const values = strips.map((strip) => strip.cells.map((cell) => cube.faces[strip.face][cell]));
  for (let i = 0; i < 4; i++) {
    const dest = strips[(i + 1) % 4];
    const src = values[i];
    dest.cells.forEach((cell, offset) => {
      cube.faces[dest.face][cell] = src[offset];
    });
  }
}

function rowStrip(face: Face, n: number, row: number, reversed = false): Strip {
  const cells = Array.from({ length: n }, (_, col) => idx(n, row, col));
  return { face, cells: reversed ? cells.reverse() : cells };
}

function colStrip(face: Face, n: number, col: number, reversed = false): Strip {
  const cells = Array.from({ length: n }, (_, row) => idx(n, row, col));
  return { face, cells: reversed ? cells.reverse() : cells };
}

function sideStrips(cube: Cube, face: Face, depth: number): [Strip, Strip, Strip, Strip] {
  const n = cube.n;
  const d = depth;
  switch (face) {
    case "U":
      // Clockwise looking down at U: R comes to F (red on green's top row).
      return [rowStrip("F", n, d), rowStrip("L", n, d), rowStrip("B", n, d), rowStrip("R", n, d)];
    case "D":
      // Clockwise looking at D: L comes to F (orange on green's bottom row).
      return [
        rowStrip("F", n, n - 1 - d),
        rowStrip("R", n, n - 1 - d),
        rowStrip("B", n, n - 1 - d),
        rowStrip("L", n, n - 1 - d),
      ];
    case "F":
      return [
        rowStrip("U", n, n - 1 - d),
        colStrip("R", n, d),
        rowStrip("D", n, d, true),
        colStrip("L", n, n - 1 - d, true),
      ];
    case "B":
      // U-top (reversed) → L-left → D-bot → R-right (reversed).
      return [
        rowStrip("U", n, d, true),
        colStrip("L", n, d),
        rowStrip("D", n, n - 1 - d),
        colStrip("R", n, n - 1 - d, true),
      ];
    case "R":
      // F-right → U-right → B-left (reversed) → D-right. The previous order
      // was the inverse (R'), so scramble images didn't match the notation.
      return [
        colStrip("F", n, n - 1 - d),
        colStrip("U", n, n - 1 - d),
        colStrip("B", n, d, true),
        colStrip("D", n, n - 1 - d),
      ];
    case "L":
      return [
        colStrip("U", n, d),
        colStrip("F", n, d),
        colStrip("D", n, d),
        colStrip("B", n, n - 1 - d, true),
      ];
  }
}

function turnFace(cube: Cube, face: Face, layers: number[], turns: number) {
  const times = ((turns % 4) + 4) % 4;
  for (let t = 0; t < times; t++) {
    if (layers.includes(0)) rotateFace(cube.faces[face], cube.n, 1);
    for (const depth of layers) cycle(cube, sideStrips(cube, face, depth));
  }
}

const NNN_MOVE = /(\d+)?([URFDLB])(w)?([2'])?/g;

export function parseNxnMoves(scramble: string) {
  const moves: { face: Face; layers: number[]; turns: number }[] = [];
  for (const match of scramble.matchAll(NNN_MOVE)) {
    const qty = match[1] ? Number(match[1]) : undefined;
    const face = match[2] as Face;
    const wide = Boolean(match[3]);
    const modifier = match[4];
    const turns = modifier === "'" ? 3 : modifier === "2" ? 2 : 1;
    let layers: number[];
    if (wide) layers = Array.from({ length: qty ?? 2 }, (_, depth) => depth);
    else if (qty && qty > 1) layers = [qty - 1];
    else layers = [0];
    moves.push({ face, layers, turns });
  }
  return moves;
}

export function applyNxnScramble(n: number, scramble: string): Cube {
  const cube = solvedCube(n);
  for (const move of parseNxnMoves(scramble)) turnFace(cube, move.face, move.layers, move.turns);
  return cube;
}

export function cubePreview(cube: Cube): CubePreview {
  return {
    kind: "cube",
    n: cube.n,
    U: asGrid(cube.faces.U, cube.n),
    D: asGrid(cube.faces.D, cube.n),
    F: asGrid(cube.faces.F, cube.n),
    B: asGrid(cube.faces.B, cube.n),
    L: asGrid(cube.faces.L, cube.n),
    R: asGrid(cube.faces.R, cube.n),
  };
}

function cubeSize(eventId: string): number | null {
  if (eventId === "222") return 2;
  if (eventId === "444") return 4;
  if (eventId === "555") return 5;
  if (eventId === "333" || eventId === "333oh" || eventId === "333bf") return 3;
  return null;
}

type Vec3 = [number, number, number];

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function len3(a: Vec3): number {
  return Math.sqrt(dot3(a, a));
}

function norm3(a: Vec3): Vec3 {
  const length = len3(a) || 1;
  return scale3(a, 1 / length);
}

function dist3(a: Vec3, b: Vec3): number {
  return len3(sub3(a, b));
}

/** Rotate `p` around `axis` (right-hand rule) by `radians`. */
function rotateAround(p: Vec3, axis: Vec3, radians: number): Vec3 {
  const u = norm3(axis);
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const d = dot3(u, p);
  const cross: Vec3 = [
    u[1] * p[2] - u[2] * p[1],
    u[2] * p[0] - u[0] * p[2],
    u[0] * p[1] - u[1] * p[0],
  ];
  return add3(add3(scale3(p, c), scale3(cross, s)), scale3(u, d * (1 - c)));
}

type Sticker3D = { color: string; rest: Vec3; pos: Vec3; bary: number };

function nearestColor(stickers: Sticker3D[], slot: Vec3): string {
  let best = stickers[0];
  let bestDist = Infinity;
  for (const sticker of stickers) {
    const d = dist3(sticker.pos, slot);
    if (d < bestDist) {
      bestDist = d;
      best = sticker;
    }
  }
  return best.color;
}

/**
 * Clockwise as viewed looking at the vertex from outside is a negative
 * rotation around the outward axis (right-hand thumb pointing out).
 */
function vertexTurnsToRadians(turns: number) {
  const folded = ((turns % 3) + 3) % 3;
  return -folded * ((2 * Math.PI) / 3);
}

type PyraVertex = "U" | "L" | "R" | "B";

const PYRA_VERTS: Record<PyraVertex, Vec3> = {
  U: [1, 1, 1],
  L: [1, -1, -1],
  R: [-1, 1, -1],
  B: [-1, -1, 1],
};

const PYRA_FACES: { id: PyraFaceId; verts: [PyraVertex, PyraVertex, PyraVertex]; color: string }[] = [
  { id: "F", verts: ["U", "L", "R"], color: FACE_COLORS.F },
  { id: "R", verts: ["U", "R", "B"], color: FACE_COLORS.R },
  { id: "L", verts: ["U", "B", "L"], color: FACE_COLORS.L },
  { id: "D", verts: ["L", "R", "B"], color: FACE_COLORS.D },
];

/** 9 slots per face, 1-3-5 triangulation, matching the SVG renderer. */
function pyraBarySlots() {
  const n = 3;
  const baryOf = (i: number, j: number): [number, number, number] => [
    (n - i) / n,
    (i - j) / n,
    j / n,
  ];
  const centroid = (p: [number, number, number][]) => [
    (p[0][0] + p[1][0] + p[2][0]) / 3,
    (p[0][1] + p[1][1] + p[2][1]) / 3,
    (p[0][2] + p[1][2] + p[2][2]) / 3,
  ];
  const slots: number[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      slots.push(centroid([baryOf(i, j), baryOf(i + 1, j), baryOf(i + 1, j + 1)]));
      if (j < i) {
        slots.push(centroid([baryOf(i, j), baryOf(i, j + 1), baryOf(i + 1, j + 1)]));
      }
    }
  }
  return slots;
}

const PYRA_BARY = pyraBarySlots();

function pyraSlot(verts: [PyraVertex, PyraVertex, PyraVertex], bary: readonly number[]): Vec3 {
  return add3(
    add3(scale3(PYRA_VERTS[verts[0]], bary[0]), scale3(PYRA_VERTS[verts[1]], bary[1])),
    scale3(PYRA_VERTS[verts[2]], bary[2]),
  );
}

function solvedPyraminxStickers(): { stickers: Sticker3D[]; slots: Record<PyraFaceId, Vec3[]> } {
  const stickers: Sticker3D[] = [];
  const slots = { F: [], R: [], L: [], D: [] } as Record<PyraFaceId, Vec3[]>;
  for (const face of PYRA_FACES) {
    for (const bary of PYRA_BARY) {
      const rest = pyraSlot(face.verts, bary);
      slots[face.id].push(rest);
      stickers.push({ color: face.color, rest, pos: rest, bary: bary[0] });
    }
  }
  return { stickers, slots };
}

function turnPyraminxVertex(stickers: Sticker3D[], vertex: PyraVertex, turns: number, tipOnly: boolean) {
  const axis = PYRA_VERTS[vertex];
  const radians = vertexTurnsToRadians(turns);
  const ranked = [...stickers].sort((a, b) => dot3(b.pos, axis) - dot3(a.pos, axis));
  // Tip = 3 stickers; deep layer = tip + 3 axials + 6 edge stickers.
  const count = tipOnly ? 3 : 12;
  for (const sticker of ranked.slice(0, count)) {
    sticker.pos = rotateAround(sticker.pos, axis, radians);
  }
}

export function applyPyraminxScramble(scramble: string): Record<PyraFaceId, string[]> {
  const { stickers, slots } = solvedPyraminxStickers();
  const moveRe = /([URLBulrb])([2'])?/g;
  const vertexOf: Record<string, PyraVertex> = {
    U: "U",
    R: "R",
    L: "L",
    B: "B",
    u: "U",
    r: "R",
    l: "L",
    b: "B",
  };
  for (const match of scramble.matchAll(moveRe)) {
    const letter = match[1];
    const vertex = vertexOf[letter];
    if (!vertex) continue;
    const turns = match[2] === "'" || match[2] === "2" ? 2 : 1;
    turnPyraminxVertex(stickers, vertex, turns, letter === letter.toLowerCase());
  }
  const faces = { F: [], R: [], L: [], D: [] } as Record<PyraFaceId, string[]>;
  for (const id of Object.keys(slots) as PyraFaceId[]) {
    faces[id] = slots[id].map((slot) => nearestColor(stickers, slot));
  }
  return faces;
}

type SkewbCornerId = keyof SkewbPreview["corners"];

const SKEWB_CORNERS: { id: SkewbCornerId; xyz: Vec3 }[] = [
  { id: "UFR", xyz: [1, 1, 1] },
  { id: "UFL", xyz: [-1, 1, 1] },
  { id: "UBR", xyz: [1, 1, -1] },
  { id: "UBL", xyz: [-1, 1, -1] },
  { id: "DFR", xyz: [1, -1, 1] },
  { id: "DFL", xyz: [-1, -1, 1] },
  { id: "DBR", xyz: [1, -1, -1] },
  { id: "DBL", xyz: [-1, -1, -1] },
];

const SKEWB_CENTER_POS: Record<Face, Vec3> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  L: [-1, 0, 0],
  R: [1, 0, 0],
};

/**
 * WCA Skewb notation (Regulation 12h), with the puzzle held white on top, green front-left and red
 * front-right (4d5) — so it's viewed corner-on, three faces visible:
 *
 * - R: the farthest visible bottom-right vertex — down-back-right
 * - U: the farthest visible upper vertex — up-back-left
 * - L: the farthest visible bottom-left vertex — down-front-left
 * - B: the farthest non-visible back vertex — down-back-left
 *
 * These used to be the four *top* corners ("Sarah's" notation, an older community convention).
 * Only U coincided, so three of the four moves turned the wrong corner and no Skewb scramble ever
 * matched a puzzle scrambled to WCA rules. The two sets aren't even the same shape — one corner
 * plus its three neighbours, against the four corners of a face — so the mismatch showed up in
 * the group structure itself: repeating "R U" restores a real Skewb after 45 times, and the old
 * model after 15. `scrambleCube.test.ts` checks this against the WCA-lineage reference.
 */
const SKEWB_MOVE_AXIS: Record<"U" | "L" | "R" | "B", Vec3> = {
  R: [1, -1, -1],
  U: [-1, 1, -1],
  L: [-1, -1, 1],
  B: [-1, -1, -1],
};

function solvedSkewbStickers(): Sticker3D[] {
  const stickers: Sticker3D[] = [];
  for (const face of FACES) {
    const rest = SKEWB_CENTER_POS[face];
    stickers.push({ color: FACE_COLORS[face], rest, pos: rest, bary: 0 });
  }
  const inset = 0.55;
  for (const corner of SKEWB_CORNERS) {
    const [x, y, z] = corner.xyz;
    const facelets: { face: Face; rest: Vec3 }[] = [
      { face: y > 0 ? "U" : "D", rest: [x * inset, y, z * inset] },
      { face: z > 0 ? "F" : "B", rest: [x * inset, y * inset, z] },
      { face: x > 0 ? "R" : "L", rest: [x, y * inset, z * inset] },
    ];
    for (const facelet of facelets) {
      stickers.push({ color: FACE_COLORS[facelet.face], rest: facelet.rest, pos: facelet.rest, bary: 0 });
    }
  }
  return stickers;
}

function turnSkewbVertex(stickers: Sticker3D[], axis: Vec3, turns: number) {
  const radians = vertexTurnsToRadians(turns);
  const unit = norm3(axis);
  for (const sticker of stickers) {
    // A Skewb's cut passes through its centre, so the moving half is everything on the corner's
    // side of zero. The threshold used to be 0.15, which left behind one sticker of each
    // neighbouring corner — those sit at ±0.058 — and tore three corners apart on every turn.
    if (dot3(sticker.pos, unit) <= 0) continue;
    sticker.pos = rotateAround(sticker.pos, axis, radians);
  }
}

export function applySkewbScramble(scramble: string): SkewbPreview {
  const stickers = solvedSkewbStickers();
  const moveRe = /([RULB])([2'])?/g;
  for (const match of scramble.matchAll(moveRe)) {
    const axis = SKEWB_MOVE_AXIS[match[1] as "R" | "U" | "L" | "B"];
    const turns = match[2] === "'" || match[2] === "2" ? 2 : 1;
    turnSkewbVertex(stickers, axis, turns);
  }
  const centers: Record<Face, string> = { ...FACE_COLORS };
  for (const face of FACES) {
    centers[face] = nearestColor(stickers, SKEWB_CENTER_POS[face]);
  }
  const corners = {} as SkewbPreview["corners"];
  const inset = 0.55;
  for (const corner of SKEWB_CORNERS) {
    const [x, y, z] = corner.xyz;
    const u = nearestColor(stickers, [x * inset, y, z * inset]);
    const f = nearestColor(stickers, [x * inset, y * inset, z]);
    const r = nearestColor(stickers, [x, y * inset, z * inset]);
    corners[corner.id] = [u, f, r];
  }
  return { kind: "skewb", centers, corners };
}

function mod12(value: number) {
  return ((value % 12) + 12) % 12;
}

/**
 * WCA Clock notation: 9 front turns, y2, 5 back turns, then leftover pins.
 * Wheel groups use the standard 3×3 layout 0 1 2 / 3 4 5 / 6 7 8.
 */
export function applyClockScramble(scramble: string): ClockPreview {
  const front = Array(9).fill(0);
  const back = Array(9).fill(0);
  const add = (side: number[], amount: number, cells: number[]) => {
    for (const cell of cells) side[cell] = mod12(side[cell] + amount);
  };
  const groups: Record<string, number[]> = {
    UR: [2, 1, 5, 4],
    DR: [8, 5, 7, 4],
    DL: [6, 3, 7, 4],
    UL: [0, 1, 3, 4],
    U: [1, 0, 2, 4],
    R: [5, 2, 8, 4],
    D: [7, 6, 8, 4],
    L: [3, 0, 6, 4],
    ALL: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  };
  const turnRe = /(UR|DR|DL|UL|ALL|[URDL])(\d+)([+-])/g;
  const tokens = scramble.trim().split(/\s+/);
  let side: number[] = front;
  const pins: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  for (const token of tokens) {
    if (token === "y2") {
      side = back;
      continue;
    }
    if (/^(UR|DR|DL|UL)$/.test(token) && !/\d/.test(token)) {
      const pinIndex = { UR: 1, DR: 3, DL: 2, UL: 0 }[token];
      if (pinIndex !== undefined) pins[pinIndex] = true;
      continue;
    }
    turnRe.lastIndex = 0;
    const match = turnRe.exec(token);
    if (!match) continue;
    const amount = Number(match[2]) * (match[3] === "-" ? -1 : 1);
    add(side, amount, groups[match[1]] ?? []);
  }
  return { kind: "clock", front, back, pins };
}

// ─── Square-1 ────────────────────────────────────────────────────────────────

type Sq1Slot = { id: string; kind: Square1Piece["kind"]; face: string; side: string };

/**
 * Slots run clockwise (viewed from the top) starting at the slice's back end,
 * which sits between UB and UBR; slots 0–5 are the right half that "/" turns.
 * Corners fill two slots. Checked against scrambow: any other offset or turn
 * direction makes scrambles slice through a corner.
 */
function solvedSq1Layer(layer: "U" | "D"): Sq1Slot[] {
  const pieces: [string, Face[]][] = [
    ["BR", ["B", "R"]], ["R", ["R"]], ["FR", ["R", "F"]], ["F", ["F"]],
    ["FL", ["F", "L"]], ["L", ["L"]], ["BL", ["L", "B"]], ["B", ["B"]],
  ];
  return pieces.flatMap(([name, sides]) =>
    sides.map((side) => ({
      id: layer + name,
      kind: sides.length === 2 ? ("corner" as const) : ("edge" as const),
      face: FACE_COLORS[layer],
      side: FACE_COLORS[side],
    })),
  );
}

function rotateSq1Layer(slots: Sq1Slot[], clockwiseFromTop: number): Sq1Slot[] {
  const next = [...slots];
  slots.forEach((slot, i) => (next[mod12(i + clockwiseFromTop)] = slot));
  return next;
}

function sq1Pieces(slots: Sq1Slot[]): Square1Piece[] {
  // Begin at a piece boundary so a corner straddling slot 11/0 stays whole.
  const first = slots.findIndex((slot, i) => slot.id !== slots[mod12(i - 1)].id);
  const pieces: Square1Piece[] = [];
  for (let offset = 0; offset < 12; ) {
    const start = mod12(first + offset);
    const slot = slots[start];
    const width = slot.kind === "corner" ? 2 : 1;
    const sides = Array.from({ length: width }, (_, k) => slots[mod12(start + k)].side);
    pieces.push({ kind: slot.kind, start, face: slot.face, sides });
    offset += width;
  }
  return pieces;
}

/**
 * Where a Square-1 slot angle lands on screen, as a unit vector (x right, y down).
 *
 * `deg` is measured clockwise from the back, viewed from the top — the frame every slot index uses.
 *
 * - **Top** is drawn looking down on it, back at the top of the picture.
 * - **Bottom** is drawn the way you look at it: tip the puzzle towards you, so the *front* edge is
 *   at the top of the picture and right stays on the right. That is also how the WCA's scramble
 *   images draw it. It used to be drawn as if the puzzle were rolled over sideways (back at the
 *   top, left and right swapped) — a valid view, but rotated 180° from both of those, so the
 *   bottom never matched a puzzle someone had just scrambled.
 */
export function square1ScreenDirection(view: "top" | "bottom", deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return view === "top"
    ? { x: Math.sin(rad), y: -Math.cos(rad) }
    : { x: Math.sin(rad), y: Math.cos(rad) };
}

/** WCA Square-1 notation: `(x, y)` turns U and D clockwise (each seen from its own face); `/` turns the right half. */
export function applySquare1Scramble(scramble: string): Square1Preview {
  let top = solvedSq1Layer("U");
  let bottom = solvedSq1Layer("D");
  let middleFlipped = false;
  for (const match of scramble.matchAll(/\((-?\d+),\s*(-?\d+)\)|\//g)) {
    if (match[0] === "/") {
      // 180° about the left–right axis: top slot i ↔ bottom slot 5 - i.
      const nextTop = [...top];
      const nextBottom = [...bottom];
      for (let i = 0; i < 6; i++) {
        nextTop[i] = bottom[5 - i];
        nextBottom[i] = top[5 - i];
      }
      top = nextTop;
      bottom = nextBottom;
      middleFlipped = !middleFlipped;
      continue;
    }
    top = rotateSq1Layer(top, Number(match[1]));
    bottom = rotateSq1Layer(bottom, -Number(match[2]));
  }
  return { kind: "sq1", top: sq1Pieces(top), bottom: sq1Pieces(bottom), middleFlipped };
}

export function previewFor(eventId: string, scramble: string | null): ScramblePreviewModel {
  const text = scramble ?? "";
  const n = cubeSize(eventId);
  if (n) return cubePreview(applyNxnScramble(n, text));
  if (eventId === "pyram") {
    return { kind: "pyraminx", faces: applyPyraminxScramble(text) };
  }
  if (eventId === "skewb") return applySkewbScramble(text);
  if (eventId === "clock") return applyClockScramble(text);
  if (eventId === "sq1") return applySquare1Scramble(text);
  return cubePreview(applyNxnScramble(3, text));
}
