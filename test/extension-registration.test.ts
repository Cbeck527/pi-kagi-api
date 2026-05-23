import { describe, expect, it, vi } from "vitest";
import { findTool, registerTools } from "./helpers.js";

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
  createKagiApis: () => {
    throw new Error("createKagiApis should not be called during registration tests.");
  },
  normalizeKagiError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
}));

import kagiApiExtension from "../src/index.js";

describe("extension registration", () => {
  it("registers the Kagi search and extract tools", () => {
    const tools = registerTools(kagiApiExtension);

    expect(tools).toHaveLength(2);
    expect(tools.map((tool) => tool.name).sort()).toEqual(["kagi_extract", "kagi_search"]);

    for (const name of ["kagi_search", "kagi_extract"]) {
      const tool = findTool(tools, name);
      expect(tool.parameters).toEqual(expect.any(Object));
      expect(tool.execute).toEqual(expect.any(Function));
    }
  });
});
