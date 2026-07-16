import { describe, it, expect } from "vitest";
import { escapeValue, formatMessage } from "../src/index.js";

describe("escapeValue", () => {
  it("returns plain strings unchanged", () => {
    expect(escapeValue("hello world")).toBe("hello world");
  });

  it("escapes pipe characters", () => {
    expect(escapeValue("a|b")).toBe("a||b");
  });

  it("escapes apostrophes", () => {
    expect(escapeValue("it's")).toBe("it|'s");
  });

  it("escapes newlines", () => {
    expect(escapeValue("line1\nline2")).toBe("line1|nline2");
  });

  it("escapes carriage returns", () => {
    expect(escapeValue("line1\rline2")).toBe("line1|rline2");
  });

  it("escapes opening brackets", () => {
    expect(escapeValue("[test")).toBe("|[test");
  });

  it("escapes closing brackets", () => {
    expect(escapeValue("test]")).toBe("test|]");
  });

  it("escapes unicode line separators", () => {
    expect(escapeValue("a\u0085b")).toBe("a|0x0085b");
    expect(escapeValue("a\u2028b")).toBe("a|0x2028b");
    expect(escapeValue("a\u2029b")).toBe("a|0x2029b");
  });

  it("strips ANSI escape codes", () => {
    expect(escapeValue("\x1B[31mred\x1B[0m")).toBe("red");
    expect(escapeValue("\x1B[1;32mbold green\x1B[0m")).toBe("bold green");
  });

  it("handles multiple escape characters", () => {
    expect(escapeValue("it's a [test]\nwith|pipes")).toBe("it|'s a |[test|]|nwith||pipes");
  });

  it("handles empty string", () => {
    expect(escapeValue("")).toBe("");
  });
});

describe("formatMessage", () => {
  it("formats a single-attribute message", () => {
    expect(formatMessage("testStarted", { name: "myTest" })).toBe(
      "##teamcity[testStarted name='myTest']",
    );
  });

  it("formats a multi-attribute message", () => {
    expect(formatMessage("testFinished", { name: "myTest", duration: 42 })).toBe(
      "##teamcity[testFinished name='myTest' duration='42']",
    );
  });

  it("escapes values in attributes", () => {
    expect(formatMessage("testStarted", { name: "it's a test" })).toBe(
      "##teamcity[testStarted name='it|'s a test']",
    );
  });

  it("handles numeric values", () => {
    expect(formatMessage("testFinished", { name: "test", duration: 100 })).toBe(
      "##teamcity[testFinished name='test' duration='100']",
    );
  });
});
