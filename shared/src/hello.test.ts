import { describe, expect, it } from "vitest";
import { formatGreeting } from "./hello.js";

describe("formatGreeting", () => {
  it("appends an exclamation point when missing", () => {
    expect(formatGreeting("Hello, My App")).toBe("Hello, My App!");
  });

  it("leaves an existing exclamation point alone", () => {
    expect(formatGreeting("Hello, My App!")).toBe("Hello, My App!");
  });

  it("trims surrounding whitespace", () => {
    expect(formatGreeting("  hi  ")).toBe("hi!");
  });
});
