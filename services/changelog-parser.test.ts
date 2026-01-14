import { extractChangelogSection } from "./changelog-parser"

describe("extractChangelogSection", () => {
  it("extracts the requested version section and stops at the next version", () => {
    const md = [
      "# expense-buddy",
      "",
      "## 2.1.0",
      "",
      "### Minor Changes",
      "",
      "- Added features and improvements:",
      "  - Analytics: moved filters",
      "",
      "## 2.0.0",
      "",
      "### Major Changes",
      "",
      "- BREAKING: Something",
      "",
    ].join("\n")

    expect(extractChangelogSection(md, "2.1.0")).toBe(
      [
        "### Minor Changes",
        "",
        "- Added features and improvements:",
        "  - Analytics: moved filters",
      ].join("\n")
    )
  })

  it("handles v-prefixed and bracketed headings", () => {
    const md = [
      "# expense-buddy",
      "",
      "## [v1.2.3]",
      "- Hello",
      "",
      "## 1.2.2",
      "- Bye",
    ].join("\n")

    expect(extractChangelogSection(md, "1.2.3")).toBe("- Hello")
    expect(extractChangelogSection(md, "v1.2.3")).toBe("- Hello")
  })

  it("matches headings that include extra text", () => {
    const md = [
      "# expense-buddy",
      "",
      "## 2.1.0 - 2026-01-14",
      "- A",
      "",
      "## 2.0.0",
      "- B",
    ].join("\n")

    expect(extractChangelogSection(md, "2.1.0")).toBe("- A")
  })

  it("does not throw on malformed markdown", () => {
    expect(() =>
      extractChangelogSection("just some text\n- bullet", "1.0.0")
    ).not.toThrow()
    expect(extractChangelogSection("just some text\n- bullet", "1.0.0")).toBe("")
  })

  it("returns empty string when version is not found", () => {
    expect(extractChangelogSection("# x\n\n## 1.0.0\n- A", "2.0.0")).toBe("")
  })
})
