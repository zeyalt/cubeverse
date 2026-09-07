import type { CllCase, CllCorner, CllSubcaseInfo } from "@/lib/trainer/cll";
import { DIAGRAM, checkLabelFor } from "@/lib/trainer/cll";

function tabPosition(corner: CllCorner, edge: CllSubcaseInfo["checkStickers"][number]["edge"], offset: number) {
  const pos = DIAGRAM.cornerPos[corner];
  if (edge === "top") {
    return { left: offset + pos.x + DIAGRAM.cell / 2 - DIAGRAM.tab / 2, top: offset + pos.y - DIAGRAM.tab };
  }
  if (edge === "bottom") {
    return { left: offset + pos.x + DIAGRAM.cell / 2 - DIAGRAM.tab / 2, top: offset + pos.y + DIAGRAM.cell };
  }
  if (edge === "left") {
    return { left: offset + pos.x - DIAGRAM.tab, top: offset + pos.y + DIAGRAM.cell / 2 - DIAGRAM.tab / 2 };
  }
  return { left: offset + pos.x + DIAGRAM.cell, top: offset + pos.y + DIAGRAM.cell / 2 - DIAGRAM.tab / 2 };
}

export function CllSubcaseDiagram({
  info,
  label,
  withTabs = false,
}: {
  info: CllSubcaseInfo;
  label?: string;
  withTabs?: boolean;
}) {
  const offset = withTabs ? DIAGRAM.cardOffset : DIAGRAM.pad;
  const size = withTabs ? DIAGRAM.cardSize : DIAGRAM.size;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => {
        const pos = DIAGRAM.cornerPos[corner];
        const lit = info.oppositeCorners.includes(corner);
        return (
          <span
            key={corner}
            className={`absolute flex items-center justify-center rounded-[3px] border text-[11px] font-extrabold ${
              lit
                ? "border-[#FFD500] bg-[#FFD500] text-[#4A3308]"
                : "border-token bg-surface text-token-muted"
            }`}
            style={{
              left: offset + pos.x,
              top: offset + pos.y,
              width: DIAGRAM.cell - 1,
              height: DIAGRAM.cell - 1,
            }}
          >
            {lit ? "O" : ""}
          </span>
        );
      })}
      {withTabs &&
        label &&
        info.checkStickers.map((sticker, index) => {
          const pos = tabPosition(sticker.corner, sticker.edge, offset);
          return (
            <span
              key={`${sticker.corner}-${sticker.edge}-${index}`}
              className="absolute flex items-center justify-center text-[13px] font-extrabold text-token"
              style={{ ...pos, width: DIAGRAM.tab, height: DIAGRAM.tab }}
            >
              {label}
            </span>
          );
        })}
    </div>
  );
}

export function CllCaseDiagram({ cubeCase }: { cubeCase: CllCase }) {
  return (
    <div
      className="relative aspect-square min-h-[5.5rem] min-w-[5.5rem] flex-1 overflow-hidden rounded-lg border border-token bg-surface"
      aria-label={`${cubeCase.id} colour diagram showing top, front, right, back, and left stickers`}
    >
      {/* Static local PNGs; next/image is a no-op under `output: "export"`. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cubeCase.image}
        alt=""
        className="absolute inset-[18%] h-[64%] w-[64%] object-contain"
        style={cubeCase.imageRotate ? { transform: `rotate(${cubeCase.imageRotate}deg)` } : undefined}
      />
      {[
        { side: "B", className: "left-1/2 top-0.5 -translate-x-1/2" },
        { side: "F", className: "bottom-0.5 left-1/2 -translate-x-1/2" },
        { side: "L", className: "left-0.5 top-1/2 -translate-y-1/2" },
        { side: "R", className: "right-0.5 top-1/2 -translate-y-1/2" },
      ].map((label) => (
        <span
          key={label.side}
          className={`absolute flex size-4 items-center justify-center rounded-full border border-token bg-surface text-[9px] font-black text-token ${label.className}`}
        >
          {label.side}
        </span>
      ))}
    </div>
  );
}

export function CllCaseCheckDiagram({ cubeCase, info }: { cubeCase: CllCase; info: CllSubcaseInfo }) {
  return <CllSubcaseDiagram info={info} label={checkLabelFor(cubeCase)} withTabs />;
}
