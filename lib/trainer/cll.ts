export const CLL_TRAINER_KEY = "cll-222";
export const DEFAULT_TARGET = 10;
export const NOTE_MAX_LENGTH = 20;
export const PASS_HOLD_MS = 2000;

export type CllFamily = "Sune" | "Antisune" | "Pi" | "U" | "L" | "T" | "H";
export type CllCorner = "tl" | "tr" | "bl" | "br";
export type CllEdge = "top" | "right" | "bottom" | "left";

export interface CllCase {
  id: string;
  family: CllFamily;
  subcase?: string;
  sameCheck?: boolean;
  checkLabel?: "O" | "S" | "D";
  imageRotate?: number;
  image: string;
  solve: string;
}

export interface CllCheckSticker {
  corner: CllCorner;
  edge: CllEdge;
}

export interface CllSubcaseInfo {
  title: string;
  oppositeCorners: CllCorner[];
  checkStickers: CllCheckSticker[];
}

export interface CllCaseProgress {
  count: number;
  note: string;
  passed: boolean;
  easy: boolean;
}

export interface CllTrainerProgress {
  globalTarget: number;
  spinFamilies: Record<string, boolean>;
  cases: Record<string, CllCaseProgress>;
}

export const CLL_CASES: CllCase[] = [
  { id: "S1", family: "Sune", subcase: "diagonal", sameCheck: false, image: "/trainer/cll/sune-S1.png", solve: "R U R' U R U2 R'" },
  { id: "S4", family: "Sune", subcase: "adjacent-right", sameCheck: false, image: "/trainer/cll/sune-S4.png", solve: "R U R' U' R' F R F' R U R' U R U2 R'" },
  { id: "S3", family: "Sune", subcase: "adjacent-top", sameCheck: false, image: "/trainer/cll/sune-S3.png", solve: "F R' F' R U2 R U2 R'" },
  { id: "S2", family: "Sune", subcase: "adjacent-right", sameCheck: true, image: "/trainer/cll/sune-S2.png", solve: "L' U2 L U2 L F' L' F" },
  { id: "S5", family: "Sune", subcase: "adjacent-top", sameCheck: true, image: "/trainer/cll/sune-S5.png", solve: "L F' L' F L' U' L" },
  { id: "S6", family: "Sune", subcase: "diagonal", sameCheck: true, imageRotate: 180, image: "/trainer/cll/sune-S6.png", solve: "R U R' U R' F R F' R U2 R'" },
  { id: "AS1", family: "Antisune", subcase: "diagonal", sameCheck: false, image: "/trainer/cll/antisune-AS1.png", solve: "L' U' L U' L' U2 L" },
  { id: "AS2", family: "Antisune", subcase: "adjacent-left", sameCheck: false, image: "/trainer/cll/antisune-AS2.png", solve: "L' U' L U L F' L' F L' U' L U' L' U2 L" },
  { id: "AS3", family: "Antisune", subcase: "adjacent-right", sameCheck: false, image: "/trainer/cll/antisune-AS3.png", solve: "F' L F L' U2 L' U2 L" },
  { id: "AS4", family: "Antisune", subcase: "adjacent-left", sameCheck: true, image: "/trainer/cll/antisune-AS4.png", solve: "R U2 R' U2 R' F R F'" },
  { id: "AS5", family: "Antisune", subcase: "adjacent-right", sameCheck: true, image: "/trainer/cll/antisune-AS5.png", solve: "R' F R F' R U R'" },
  { id: "AS6", family: "Antisune", subcase: "diagonal", sameCheck: true, image: "/trainer/cll/antisune-AS6.png", solve: "R' U R U' R2 F R F' R U R' U' R" },
  { id: "P1", family: "Pi", subcase: "opposite", checkLabel: "O", image: "/trainer/cll/pi-P1.png", solve: "R U' R2 U R2 U R2 U' R" },
  { id: "P2", family: "Pi", subcase: "different", checkLabel: "D", image: "/trainer/cll/pi-P2.png", solve: "R' F2 R F' U2 R U' R' U' F" },
  { id: "P3", family: "Pi", subcase: "same", checkLabel: "S", imageRotate: -90, image: "/trainer/cll/pi-P3.png", solve: "U F R2 U' R2 U R2 U R2 F'" },
  { id: "P4", family: "Pi", subcase: "different", checkLabel: "D", image: "/trainer/cll/pi-P4.png", solve: "R U2 R' U' R U R' U2 R' F R F'" },
  { id: "P5", family: "Pi", subcase: "opposite", checkLabel: "O", image: "/trainer/cll/pi-P5.png", solve: "R U' R' F R' F R U R' F R" },
  { id: "P6", family: "Pi", subcase: "same", checkLabel: "S", imageRotate: 90, image: "/trainer/cll/pi-P6.png", solve: "U' R' U' R' F R F' R U' R' U2 R" },
  { id: "U1", family: "U", subcase: "same", checkLabel: "S", image: "/trainer/cll/u-U1.png", solve: "R2 F2 R U R' F R2 U2 R' U' R" },
  { id: "U2", family: "U", subcase: "same", checkLabel: "S", image: "/trainer/cll/u-U2.png", solve: "R U2 R U' R' F R' F2 U' F" },
  { id: "U3", family: "U", subcase: "different", checkLabel: "D", image: "/trainer/cll/u-U3.png", solve: "R' U R' F R F' R U2 R' U R" },
  { id: "U4", family: "U", subcase: "opposite", checkLabel: "O", image: "/trainer/cll/u-U4.png", solve: "F R' F' R U' R U' R' U2 R U' R'" },
  { id: "U5", family: "U", subcase: "different", checkLabel: "D", image: "/trainer/cll/u-U5.png", solve: "R U' R2 F R F' R U R' U' R U R'" },
  { id: "U6", family: "U", subcase: "opposite", checkLabel: "O", image: "/trainer/cll/u-U6.png", solve: "F R U R' U' F'" },
  { id: "L1", family: "L", image: "/trainer/cll/l-L1.png", solve: "R' U R' U2 R U' R' U R U' R2" },
  { id: "L2", family: "L", image: "/trainer/cll/l-L2.png", solve: "R U2 R2 F2 R U R' F2 R F'" },
  { id: "L3", family: "L", image: "/trainer/cll/l-L3.png", solve: "R U2 R' F' R U2 R' U R' F2 R" },
  { id: "L4", family: "L", image: "/trainer/cll/l-L4.png", solve: "F R' F' R U R U' R'" },
  { id: "L5", family: "L", image: "/trainer/cll/l-L5.png", solve: "F R U' R' U' R U R' F'" },
  { id: "L6", family: "L", image: "/trainer/cll/l-L6.png", solve: "R U2 R2 F R F' R U2 R'" },
  { id: "T1", family: "T", image: "/trainer/cll/t-T1.png", solve: "R' U R U2 R2 F' R U' R' F2 R2" },
  { id: "T2", family: "T", image: "/trainer/cll/t-T2.png", solve: "R' U R U2 R2 F R F' R" },
  { id: "T3", family: "T", image: "/trainer/cll/t-T3.png", solve: "L' U' L U L F' L' F" },
  { id: "T4", family: "T", image: "/trainer/cll/t-T4.png", solve: "F R U R' U' R U' R' U' R U R' F'" },
  { id: "T5", family: "T", image: "/trainer/cll/t-T5.png", solve: "R U R' U' R' F R F'" },
  { id: "T6", family: "T", image: "/trainer/cll/t-T6.png", solve: "F U' R U2 R' U' F2 R U R'" },
  { id: "H1", family: "H", image: "/trainer/cll/h-H1.png", solve: "R2 U2 R' U2 R2" },
  { id: "H2", family: "H", image: "/trainer/cll/h-H2.png", solve: "F R2 U' R2 U' R2 U R2 F'" },
  { id: "H3", family: "H", image: "/trainer/cll/h-H3.png", solve: "R U R' U R U L' U R' U' L" },
  { id: "H4", family: "H", image: "/trainer/cll/h-H4.png", solve: "x' U2 R U2 R2 F2 R U2 x" },
];

export const CLL_FAMILIES: CllFamily[] = ["Sune", "Antisune", "Pi", "U", "L", "T", "H"];

export const SUBCASE_ORDER: Partial<Record<CllFamily, string[]>> = {
  Antisune: ["adjacent-left", "adjacent-right", "diagonal"],
  Sune: ["adjacent-right", "adjacent-top", "diagonal"],
  Pi: ["opposite", "same", "different"],
  U: ["opposite", "same", "different"],
};

export const SUBCASE_INFO: Partial<Record<CllFamily, Record<string, CllSubcaseInfo>>> = {
  Antisune: {
    "adjacent-left": {
      title: "Top-left / bottom-left opposite",
      oppositeCorners: ["tl", "bl"],
      checkStickers: [
        { corner: "br", edge: "bottom" },
        { corner: "bl", edge: "left" },
      ],
    },
    "adjacent-right": {
      title: "Top-left / top-right opposite",
      oppositeCorners: ["tl", "tr"],
      checkStickers: [
        { corner: "br", edge: "bottom" },
        { corner: "tr", edge: "right" },
      ],
    },
    diagonal: {
      title: "Diagonal (top-right / bottom-left) opposite",
      oppositeCorners: ["tr", "bl"],
      checkStickers: [
        { corner: "br", edge: "bottom" },
        { corner: "tr", edge: "right" },
      ],
    },
  },
  Sune: {
    "adjacent-right": {
      title: "Top-right / bottom-right opposite",
      oppositeCorners: ["tr", "br"],
      checkStickers: [
        { corner: "bl", edge: "bottom" },
        { corner: "br", edge: "right" },
      ],
    },
    "adjacent-top": {
      title: "Top-right / top-left opposite",
      oppositeCorners: ["tr", "tl"],
      checkStickers: [
        { corner: "bl", edge: "bottom" },
        { corner: "tl", edge: "left" },
      ],
    },
    diagonal: {
      title: "Diagonal (top-left / bottom-right) opposite",
      oppositeCorners: ["tl", "br"],
      checkStickers: [
        { corner: "bl", edge: "bottom" },
        { corner: "tl", edge: "left" },
      ],
    },
  },
  Pi: {
    opposite: {
      title: "Right-top / right-bottom opposite",
      oppositeCorners: [],
      checkStickers: [
        { corner: "tr", edge: "right" },
        { corner: "br", edge: "right" },
      ],
    },
    same: {
      title: "Right-top / right-bottom same",
      oppositeCorners: [],
      checkStickers: [
        { corner: "tr", edge: "right" },
        { corner: "br", edge: "right" },
      ],
    },
    different: {
      title: "Right-top / right-bottom not opposite",
      oppositeCorners: [],
      checkStickers: [
        { corner: "tr", edge: "right" },
        { corner: "br", edge: "right" },
      ],
    },
  },
  U: {
    opposite: {
      title: "Right-top / right-bottom opposite",
      oppositeCorners: [],
      checkStickers: [
        { corner: "tr", edge: "right" },
        { corner: "br", edge: "right" },
      ],
    },
    same: {
      title: "Right-top / right-bottom same",
      oppositeCorners: [],
      checkStickers: [
        { corner: "tr", edge: "right" },
        { corner: "br", edge: "right" },
      ],
    },
    different: {
      title: "Right-top / right-bottom not opposite",
      oppositeCorners: [],
      checkStickers: [
        { corner: "tr", edge: "right" },
        { corner: "br", edge: "right" },
      ],
    },
  },
};

const DIAGRAM_CELL = 20;
const DIAGRAM_GAP = 0.4;
const DIAGRAM_PAD = 6;
const TAB_SIZE = 18;

export const DIAGRAM = {
  cell: DIAGRAM_CELL,
  gap: DIAGRAM_GAP,
  pad: DIAGRAM_PAD,
  tab: TAB_SIZE,
  cornerPos: {
    tl: { x: 0, y: 0 },
    tr: { x: DIAGRAM_CELL + DIAGRAM_GAP, y: 0 },
    bl: { x: 0, y: DIAGRAM_CELL + DIAGRAM_GAP },
    br: { x: DIAGRAM_CELL + DIAGRAM_GAP, y: DIAGRAM_CELL + DIAGRAM_GAP },
  } satisfies Record<CllCorner, { x: number; y: number }>,
  size: DIAGRAM_PAD * 2 + DIAGRAM_CELL * 2 + DIAGRAM_GAP,
  cardOffset: DIAGRAM_PAD + TAB_SIZE,
  cardSize: (DIAGRAM_PAD + TAB_SIZE) * 2 + DIAGRAM_CELL * 2 + DIAGRAM_GAP,
};

function emptyCaseProgress(): CllCaseProgress {
  return { count: 0, note: "", passed: false, easy: false };
}

export function emptyProgress(): CllTrainerProgress {
  return {
    globalTarget: DEFAULT_TARGET,
    spinFamilies: Object.fromEntries(CLL_FAMILIES.map((family) => [family, true])),
    cases: Object.fromEntries(CLL_CASES.map((cubeCase) => [cubeCase.id, emptyCaseProgress()])),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseCaseProgress(value: unknown): CllCaseProgress {
  const row = asRecord(value);
  return {
    count: Math.max(0, Number(row?.count) || 0),
    note: typeof row?.note === "string" ? row.note.slice(0, NOTE_MAX_LENGTH) : "",
    passed: row?.passed === true,
    easy: row?.easy === true,
  };
}

export function normalizeProgress(raw: unknown): CllTrainerProgress {
  const base = emptyProgress();
  const saved = asRecord(raw);
  if (!saved) return base;

  const nestedCases = asRecord(saved.cases);
  const source = nestedCases ?? saved;
  for (const cubeCase of CLL_CASES) {
    const legacyId = cubeCase.id.replace(/^AS/, "A");
    const row = source[cubeCase.id] ?? (legacyId !== cubeCase.id ? source[legacyId] : undefined);
    if (row) base.cases[cubeCase.id] = parseCaseProgress(row);
  }

  const target = Number(saved.globalTarget);
  if (Number.isFinite(target)) base.globalTarget = Math.max(1, Math.min(200, Math.round(target)));

  const spin = asRecord(saved.spinFamilies);
  if (spin) {
    for (const family of CLL_FAMILIES) {
      if (typeof spin[family] === "boolean") base.spinFamilies[family] = spin[family];
    }
  }
  return base;
}

export function caseProgress(progress: CllTrainerProgress, id: string): CllCaseProgress {
  return progress.cases[id] ?? emptyCaseProgress();
}

export function globalTarget(progress: CllTrainerProgress): number {
  return Math.max(1, Number(progress.globalTarget) || DEFAULT_TARGET);
}

export function tokenizeAlgorithm(algorithm: string): string[] {
  return algorithm
    .replace(/\n/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[()]/g, "").trim())
    .filter(Boolean);
}

export function invertMove(move: string): string {
  if (move.endsWith("2") || move.endsWith("2'")) return move.replace("2'", "2");
  if (move.endsWith("'")) return move.slice(0, -1);
  return `${move}'`;
}

export function reverseAlgorithm(algorithm: string): string {
  return tokenizeAlgorithm(algorithm).reverse().map(invertMove).join(" ");
}

export function progressPercent(count: number, target: number): number {
  return Math.min(100, Math.round((count / Math.max(1, target)) * 100));
}

export function familyUsesOppositeCorners(family: string): boolean {
  const info = SUBCASE_INFO[family as CllFamily];
  if (!info) return false;
  return Object.values(info).some((entry) => entry.oppositeCorners.length > 0);
}

export function checkLabelFor(cubeCase: CllCase): string {
  return cubeCase.checkLabel ?? (cubeCase.sameCheck ? "S" : "O");
}

export function filteredCases(
  progress: CllTrainerProgress,
  family: string,
  onlyIncomplete: boolean,
  onlyEasy: boolean
): CllCase[] {
  const target = globalTarget(progress);
  return CLL_CASES.filter((cubeCase) => {
    const entry = caseProgress(progress, cubeCase.id);
    const matchesFamily = family === "all" || cubeCase.family === family;
    const matchesProgress = !onlyIncomplete || entry.count < target;
    const matchesEasy = !onlyEasy || entry.easy;
    return matchesFamily && matchesProgress && matchesEasy;
  });
}

export function pickPractisedCase(pool: CllCase[], progress: CllTrainerProgress, random = Math.random): CllCase | null {
  if (!pool.length) return null;
  const practised = pool.filter((cubeCase) => caseProgress(progress, cubeCase.id).count > 0);
  const weightedPool = practised.length ? practised : pool;
  const totalWeight = weightedPool.reduce(
    (sum, cubeCase) => sum + Math.max(1, caseProgress(progress, cubeCase.id).count),
    0
  );
  let cursor = random() * totalWeight;
  for (const cubeCase of weightedPool) {
    cursor -= Math.max(1, caseProgress(progress, cubeCase.id).count);
    if (cursor <= 0) return cubeCase;
  }
  return weightedPool[weightedPool.length - 1] ?? null;
}

export function withCasePatch(
  progress: CllTrainerProgress,
  id: string,
  patch: Partial<CllCaseProgress>
): CllTrainerProgress {
  const current = caseProgress(progress, id);
  return {
    ...progress,
    cases: {
      ...progress.cases,
      [id]: { ...current, ...patch },
    },
  };
}

export function resetProgress(progress: CllTrainerProgress): CllTrainerProgress {
  return {
    ...progress,
    cases: Object.fromEntries(CLL_CASES.map((cubeCase) => [cubeCase.id, emptyCaseProgress()])),
  };
}

const progressMemory = new Map<string, CllTrainerProgress>();

export function rememberProgress(cuberId: string, progress: CllTrainerProgress): void {
  progressMemory.set(cuberId, progress);
}

export function rememberedProgress(cuberId: string): CllTrainerProgress | undefined {
  return progressMemory.get(cuberId);
}
