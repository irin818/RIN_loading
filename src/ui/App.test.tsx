import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the empty RIN project shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "RIN" })).toBeInTheDocument();
    expect(screen.getByText("model-layer")).toBeInTheDocument();
    expect(screen.getByText("memory-layer")).toBeInTheDocument();
  });
});
