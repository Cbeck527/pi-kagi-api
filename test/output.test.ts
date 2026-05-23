import { readFile, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareToolOutput } from "../src/output.js";

const temporaryDirectories = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })),
  );
  temporaryDirectories.clear();
});

describe("tool output preparation", () => {
  it("truncates large output and stores the full markdown with private permissions", async () => {
    const markdown = Array.from({ length: 2100 }, (_, index) => `line ${index + 1}`).join("\n");

    const result = await prepareToolOutput(markdown, "kagi-search");

    expect(result.output.truncated).toBe(true);
    expect(result.output.fullOutputPath).toEqual(expect.any(String));
    expect(result.text).toContain("Full output saved to:");

    const fullOutputPath = result.output.fullOutputPath;

    if (!fullOutputPath) {
      throw new Error("Expected fullOutputPath to be set for truncated output.");
    }

    const directory = dirname(fullOutputPath);
    temporaryDirectories.add(directory);

    await expect(readFile(fullOutputPath, "utf8")).resolves.toBe(markdown);

    if (process.platform === "win32") {
      return;
    }

    const directoryMode = (await stat(directory)).mode & 0o777;
    const fileMode = (await stat(fullOutputPath)).mode & 0o777;

    expect(directoryMode).toBe(0o700);
    expect(fileMode).toBe(0o600);
  });
});
