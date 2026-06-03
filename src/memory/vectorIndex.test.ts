import { describe, expect, it } from "vitest";
import { createInMemoryVectorIndex } from "./vectorIndex";

describe("createInMemoryVectorIndex", () => {
  it("returns nearest neighbors with deterministic score ordering", () => {
    const index = createInMemoryVectorIndex([
      { id: "far", vector: [0, 1] },
      { id: "near", vector: [1, 0] },
      { id: "diagonal", vector: [0.5, 0.5] },
    ]);

    expect(index.query([1, 0], { topK: 2 }).map((match) => match.id)).toEqual([
      "near",
      "diagonal",
    ]);
  });

  it("uses stable id tie-breaking and candidate caps", () => {
    const index = createInMemoryVectorIndex([
      { id: "b", vector: [1, 0] },
      { id: "a", vector: [1, 0] },
      { id: "c", vector: [1, 0] },
    ]);

    expect(
      index
        .query([1, 0], { topK: 3, candidateCap: 2 })
        .map((match) => match.id),
    ).toEqual(["a", "b"]);
  });

  it("handles empty indexes and dimension errors safely", () => {
    expect(createInMemoryVectorIndex([]).query([1, 0])).toEqual([]);
    expect(() =>
      createInMemoryVectorIndex([{ id: "x", vector: [1, 0] }]).query([1]),
    ).toThrow("does not match index dimension");
    expect(() =>
      createInMemoryVectorIndex([
        { id: "x", vector: [1, 0] },
        { id: "y", vector: [1] },
      ]),
    ).toThrow("Vector dimensions differ");
  });
});
