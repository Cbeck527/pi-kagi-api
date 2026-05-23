import { beforeEach, describe, expect, it, vi } from "vitest";
import { findTool, registerTools } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  extractContent: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@kagi/api", () => ({
  ExtractRequestFormatEnum: { Json: "json", Markdown: "markdown" },
  SearchRequestFormatEnum: { Json: "json", Markdown: "markdown" },
  SearchRequestLensTimeRelativeEnum: { Day: "day", Week: "week", Month: "month" },
  SearchRequestWorkflowEnum: {
    Search: "search",
    Images: "images",
    Videos: "videos",
    News: "news",
    Podcasts: "podcasts",
  },
}));

vi.mock("../src/kagi.js", () => ({
  createKagiApis: () => ({
    search: { search: mocks.search },
    extract: { extractContent: mocks.extractContent },
  }),
  normalizeKagiError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
}));

import kagiApiExtension from "../src/index.js";
import { KAGI_EXTRACT_PARAMETERS } from "../src/schemas.js";

const emptyExtractResponse = {
  meta: { trace: "trace-extract", ms: 34 },
  data: [],
  errors: [],
};

describe("kagi_extract request mapping", () => {
  beforeEach(() => {
    mocks.extractContent.mockReset();
    mocks.extractContent.mockResolvedValue(emptyExtractResponse);
  });

  it("nudges callers toward absolute HTTPS URLs in the schema", () => {
    const urlsSchema = KAGI_EXTRACT_PARAMETERS.properties.urls;
    const itemSchema = urlsSchema.items;

    expect(urlsSchema.maxItems).toBe(10);
    expect(itemSchema.format).toBe("uri");
    expect(itemSchema.pattern).toBe("^https://");
    expect(itemSchema.description).toContain("Absolute HTTPS URL");
    expect(itemSchema.description).toContain("Embedded credentials are rejected at runtime");
  });

  it("trims, normalizes, and maps extract requests", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_extract");

    await tool.execute(
      "call-id",
      { urls: [" https://example.com/docs?safe=1 ", "https://example.net"], timeout: 3 },
      undefined,
      undefined,
    );

    expect(mocks.extractContent).toHaveBeenCalledWith({
      pages: [{ url: "https://example.com/docs?safe=1" }, { url: "https://example.net/" }],
      timeout: 3,
      format: "json",
    });
  });

  it.each([
    ["empty URL", "   ", "kagi_extract URL #1 must not be empty."],
    ["malformed absolute URL", "not a url", "kagi_extract URL #1 must be a valid absolute URL."],
    ["HTTP URL", "http://example.com/", "kagi_extract URL #1 must use HTTPS."],
    ["FTP URL", "ftp://example.com/", "kagi_extract URL #1 must use HTTPS."],
    [
      "credential-bearing URL",
      "https://user:password@example.com/private?token=secret",
      "kagi_extract URL #1 must not include embedded credentials.",
    ],
  ])("rejects %s at runtime", async (_label, url, message) => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_extract");

    const error = await captureError(tool.execute("call-id", { urls: [url] }, undefined, undefined));

    expect(error.message).toBe(message);
    expect(mocks.extractContent).not.toHaveBeenCalled();
  });

  it("does not echo credential-bearing raw URLs in validation errors", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_extract");
    const rawUrl = "https://user:password@example.com/private?token=secret";

    const error = await captureError(tool.execute("call-id", { urls: [rawUrl] }, undefined, undefined));

    expect(error.message).not.toContain(rawUrl);
    expect(error.message).not.toContain("user:password");
    expect(error.message).not.toContain("token=secret");
  });

  it("rejects out-of-range extract timeouts", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_extract");

    await expect(tool.execute("call-id", { urls: ["https://example.com"], timeout: 10.1 }, undefined, undefined))
      .rejects.toThrow("kagi_extract timeout must be between 0.5 and 10 seconds.");
    expect(mocks.extractContent).not.toHaveBeenCalled();
  });
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  throw new Error("Expected promise to reject.");
}
