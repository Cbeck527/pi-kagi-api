import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolOutputInfo } from "./types.js";

export async function prepareToolOutput(markdown: string, name: string) {
  const truncation = truncateHead(markdown, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  const output: ToolOutputInfo = {
    truncated: truncation.truncated,
    truncatedBy: truncation.truncatedBy,
    totalLines: truncation.totalLines,
    totalBytes: truncation.totalBytes,
    outputLines: truncation.outputLines,
    outputBytes: truncation.outputBytes,
  };

  if (!truncation.truncated) {
    return { text: markdown, output };
  }

  const fullOutputPath = await writeFullOutput(markdown, name);
  output.fullOutputPath = fullOutputPath;

  const notice = [
    `[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`,
    `(${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`,
    `Full output saved to: ${fullOutputPath}]`,
  ].join(" ");

  return {
    text: `${truncation.content}\n\n${notice}`,
    output,
  };
}

async function writeFullOutput(markdown: string, name: string) {
  const safeName = name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const directory = await mkdtemp(join(tmpdir(), "pi-kagi-api-"));
  const filePath = join(directory, `${safeName}.md`);

  await chmod(directory, 0o700);
  await writeFile(filePath, markdown, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await chmod(filePath, 0o600);

  return filePath;
}
