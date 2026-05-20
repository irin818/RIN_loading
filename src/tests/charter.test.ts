import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("project charter", () => {
  it("exists and defines the current implementation limits", () => {
    const charter = readFileSync(resolve("PROJECT_CHARTER.md"), "utf8");

    expect(charter).toContain("Slow variables control fast variables");
    expect(charter).toContain("Phase 0");
    expect(charter).toContain("Phase 1");
    expect(charter).toContain("must not implement");
  });
});
