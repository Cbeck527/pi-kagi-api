import { describe, expect, it } from "vitest";
import { formatExtractResponse, formatSearchResponse } from "../src/format.js";

describe("search formatting", () => {
  it("formats normal search results with title, time, and snippet", () => {
    const { markdown, summary } = formatSearchResponse(
      {
        meta: { trace: "trace-search", ms: 42 },
        data: {
          search: [
            {
              title: "Example result",
              url: "https://example.com/page",
              time: "2026-05-23",
              snippet: "First line\nSecond line",
            },
          ],
        },
      },
      { query: "example", workflow: "search" },
    );

    expect(summary.totalResults).toBe(1);
    expect(markdown).toContain("1. [Example result](<https://example.com/page>)");
    expect(markdown).toContain("   Time: 2026-05-23");
    expect(markdown).toContain("   Snippet:\n   First line\n   Second line");
  });

  it("escapes Markdown-sensitive title characters and normalizes title newlines", () => {
    const { markdown } = formatSearchResponse(
      {
        data: {
          search: [
            {
              title: "Use [brackets]\nand \\ slashes",
              url: "https://example.com/docs",
            },
          ],
        },
      },
      { query: "markdown", workflow: "search" },
    );

    expect(markdown).toContain("1. [Use \\[brackets\\] and \\\\ slashes](<https://example.com/docs>)");
  });

  it("redacts sensitive query parameters and keeps parenthesized URLs link-safe", () => {
    const { markdown } = formatSearchResponse(
      {
        data: {
          search: [
            {
              title: "Sensitive URL",
              url: "https://example.com/a_(b)?token=secret&ok=1",
            },
          ],
        },
      },
      { query: "redaction", workflow: "search" },
    );

    expect(markdown).toContain(
      "1. [Sensitive URL](<https://example.com/a_(b)?token=REDACTED&ok=1>)",
    );
    expect(markdown).not.toContain("secret");
  });

  it("renders invalid result URLs as plain text with a URL-unavailable note", () => {
    const { markdown } = formatSearchResponse(
      {
        data: {
          search: [
            {
              title: "Broken URL",
              url: "not a url",
            },
          ],
        },
      },
      { query: "broken", workflow: "search" },
    );

    expect(markdown).toContain("1. Broken URL (URL unavailable: invalid URL omitted)");
    expect(markdown).not.toContain("[Broken URL]");
    expect(markdown).not.toContain("not a url");
  });

  it("includes redacted image metadata and available dimensions", () => {
    const { markdown } = formatSearchResponse(
      {
        data: {
          image: [
            {
              title: "Diagram",
              url: "https://example.com/diagram",
              image: {
                url: "https://images.example/diagram.png?api_key=secret",
                width: 640,
                height: 480,
              },
            },
            {
              title: "Tall diagram",
              url: "https://example.com/tall",
              image: {
                url: "https://images.example/tall.png",
                height: 900,
              },
            },
          ],
        },
      },
      { query: "diagram", workflow: "images" },
    );

    expect(markdown).toContain(
      "   Image: [https://images.example/diagram.png?api_key=REDACTED](<https://images.example/diagram.png?api_key=REDACTED>)",
    );
    expect(markdown).toContain("   Image dimensions: 640x480");
    expect(markdown).toContain("   Image height: 900");
    expect(markdown).not.toContain("api_key=secret");
  });
});

describe("extract formatting", () => {
  it("puts summaries and errors before page content", () => {
    const largeBody = Array.from({ length: 100 }, (_, index) => `large body line ${index + 1}`).join("\n");
    const { markdown, summary } = formatExtractResponse({
      meta: { trace: "trace-extract", ms: 55 },
      data: [
        {
          url: "https://example.com/page?token=secret",
          markdown: largeBody,
        },
      ],
      errors: [
        {
          code: "fetch_failed",
          url: "https://example.com/page?token=secret",
          message: "Could not fetch https://example.com/page?token=secret",
          location: "https://example.com/page?token=secret",
        },
      ],
    });

    expect(summary.errorCount).toBe(1);
    expect(markdown.indexOf("## Extraction summary")).toBeLessThan(markdown.indexOf("## Page content"));
    expect(markdown.indexOf("### Error status")).toBeLessThan(markdown.indexOf("## Page content"));
    expect(markdown.indexOf("### Error status")).toBeLessThan(markdown.indexOf("large body line 1"));
    expect(markdown).toContain("token=REDACTED");
    expect(markdown).not.toContain("token=secret");
  });
});
