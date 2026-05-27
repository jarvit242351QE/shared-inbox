import { describe, it, expect } from "vitest";
import { renderTemplate } from "../../lib/automation-template";

describe("renderTemplate", () => {
  it("substitutes known variables", () => {
    expect(renderTemplate("Hey {{first_name}}!", { first_name: "Jordan" })).toBe(
      "Hey Jordan!"
    );
  });

  it("leaves missing variables empty without throwing", () => {
    expect(renderTemplate("Hi {{first_name}} ({{ig_username}})", {})).toBe("Hi  ()");
  });

  it("handles nullish gracefully", () => {
    expect(
      renderTemplate("ig=@{{ig_username}} name={{first_name}}", {
        first_name: null,
        ig_username: undefined,
      })
    ).toBe("ig=@ name=");
  });

  it("supports whitespace inside braces", () => {
    expect(renderTemplate("Hi {{  first_name  }}", { first_name: "X" })).toBe("Hi X");
  });

  it("ignores unknown variables", () => {
    expect(renderTemplate("ok {{bogus}}", { first_name: "X" })).toBe("ok ");
  });

  it("preserves literal braces when malformed", () => {
    expect(renderTemplate("not {a} variable", { first_name: "X" })).toBe("not {a} variable");
  });

  it("does not auto-escape — UI must escape on render", () => {
    // Surprise check: confirms we expect callers (React) to escape.
    expect(renderTemplate("hi {{first_name}}", { first_name: "<script>" })).toBe(
      "hi <script>"
    );
  });
});
