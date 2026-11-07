import { describe, expect, it } from "vitest";
import { scrambleProgress } from "./scrambleProgress";

const SCRAMBLE = "R2 U' F2 D";

const view = (applied: number) =>
  scrambleProgress(SCRAMBLE, applied).map((s) => `${s.move}:${s.state}${s.halfDone ? "½" : ""}`).join(" ");

describe("scramble progress", () => {
  it("shows the scramble as written, half turns and all", () => {
    expect(scrambleProgress(SCRAMBLE, 0).map((s) => s.move)).toEqual(["R2", "U'", "F2", "D"]);
  });

  it("keeps a half-done half turn as the current move, marked half done", () => {
    // The cube has reported one R of the R2: it is not done, and it is not untouched.
    expect(view(0)).toBe("R2:current U':todo F2:todo D:todo");
    expect(view(1)).toBe("R2:current½ U':todo F2:todo D:todo");
    expect(view(2)).toBe("R2:done U':current F2:todo D:todo");
  });

  it("moves through the scramble in step with the cube's quarter turns", () => {
    // R2 (2) + U' (1) = 3 quarters, then F2 takes two more.
    expect(view(3)).toBe("R2:done U':done F2:current D:todo");
    expect(view(4)).toBe("R2:done U':done F2:current½ D:todo");
    expect(view(6)).toBe("R2:done U':done F2:done D:done");
  });

  it("has exactly one current move until the scramble is done", () => {
    for (let applied = 0; applied < 6; applied++) {
      expect(scrambleProgress(SCRAMBLE, applied).filter((s) => s.state === "current")).toHaveLength(1);
    }
  });
});
