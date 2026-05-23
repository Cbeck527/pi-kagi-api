import { beforeEach, describe, expect, it, vi } from "vitest";
import { findTool, registerTools } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  extractContent: vi.fn(),
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

const emptySearchResponse = {
  meta: { trace: "trace-search", ms: 12 },
  data: {},
};

describe("kagi_search request mapping", () => {
  beforeEach(() => {
    mocks.search.mockReset();
    mocks.search.mockResolvedValue(emptySearchResponse);
  });

  it("maps the default workflow and limit through registered tool execution", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_search");

    await tool.execute("call-id", { query: "  site reliability engineering  " }, undefined, undefined);

    expect(mocks.search).toHaveBeenCalledWith({
      query: "site reliability engineering",
      workflow: "search",
      format: "json",
      limit: 10,
    });
  });

  it("maps an explicit workflow", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_search");

    await tool.execute("call-id", { query: "diagram", workflow: "images", limit: 3 }, undefined, undefined);

    expect(mocks.search).toHaveBeenCalledWith({
      query: "diagram",
      workflow: "images",
      format: "json",
      limit: 3,
    });
  });

  it("maps search filters and scalar options", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_search");

    await tool.execute(
      "call-id",
      {
        query: "kubernetes release",
        region: "US",
        after: "2026-01-01",
        before: "2026-02-01",
        page: 2,
        timeout: 1.5,
        safe_search: true,
      },
      undefined,
      undefined,
    );

    expect(mocks.search).toHaveBeenCalledWith({
      query: "kubernetes release",
      workflow: "search",
      format: "json",
      limit: 10,
      page: 2,
      timeout: 1.5,
      safeSearch: true,
      filters: {
        region: "US",
        after: "2026-01-01",
        before: "2026-02-01",
      },
    });
  });

  it("maps inline lens fields", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_search");

    await tool.execute(
      "call-id",
      {
        query: "postmortem templates",
        sites_included: ["example.com"],
        sites_excluded: ["blocked.example"],
        keywords_included: ["incident"],
        keywords_excluded: ["marketing"],
        file_type: "pdf",
        time_relative: "week",
      },
      undefined,
      undefined,
    );

    expect(mocks.search).toHaveBeenCalledWith({
      query: "postmortem templates",
      workflow: "search",
      format: "json",
      limit: 10,
      lens: {
        sitesIncluded: ["example.com"],
        sitesExcluded: ["blocked.example"],
        keywordsIncluded: ["incident"],
        keywordsExcluded: ["marketing"],
        fileType: "pdf",
        timeRelative: "week",
      },
    });
  });

  it("maps extract options for search results", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_search");

    await tool.execute(
      "call-id",
      { query: "distributed tracing", extract_count: 2, extract_timeout: 2.5 },
      undefined,
      undefined,
    );

    expect(mocks.search).toHaveBeenCalledWith({
      query: "distributed tracing",
      workflow: "search",
      format: "json",
      limit: 10,
      extract: { count: 2, timeout: 2.5 },
    });
  });

  it("rejects extract_timeout when extract_count is omitted", async () => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_search");

    await expect(
      tool.execute("call-id", { query: "latency", extract_timeout: 1 }, undefined, undefined),
    ).rejects.toThrow("kagi_search extract_timeout requires extract_count");
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it.each([
    [{ query: "latency", timeout: 0.1 }, "kagi_search timeout must be between 0.5 and 4 seconds."],
    [
      { query: "latency", extract_count: 1, extract_timeout: 4.1 },
      "kagi_search extract_timeout must be between 0.5 and 4 seconds.",
    ],
  ])("rejects out-of-range timeouts", async (params, message) => {
    const tool = findTool(registerTools(kagiApiExtension), "kagi_search");

    await expect(tool.execute("call-id", params, undefined, undefined)).rejects.toThrow(message);
    expect(mocks.search).not.toHaveBeenCalled();
  });
});
