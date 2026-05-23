import { Text } from "@earendil-works/pi-tui";
import type { KagiExtractDetails, KagiSearchDetails } from "./types.js";

export function renderKagiSearchCall(args: { query?: string; workflow?: string }, theme: ToolTheme) {
  const query = args.query ? ` ${quote(args.query)}` : "";
  const workflow = args.workflow ? ` ${theme.fg("muted", args.workflow)}` : "";
  return new Text(`${theme.fg("toolTitle", theme.bold("kagi_search"))}${workflow}${query}`, 0, 0);
}

export function renderKagiExtractCall(args: { urls?: string[] }, theme: ToolTheme) {
  const count = args.urls?.length ?? 0;
  const label = count === 1 ? "1 URL" : `${count} URLs`;
  return new Text(`${theme.fg("toolTitle", theme.bold("kagi_extract"))} ${theme.fg("muted", label)}`, 0, 0);
}

export function renderKagiSearchResult(result: ToolRenderResult, options: RenderOptions, theme: ToolTheme) {
  if (options.isPartial) {
    return new Text(theme.fg("muted", "Searching Kagi..."), 0, 0);
  }

  const details = result.details as KagiSearchDetails | undefined;
  const summary = details?.summary;

  if (!summary) {
    return new Text(getTextContent(result), 0, 0);
  }

  const parts = [theme.fg("success", `Kagi returned ${summary.totalResults} result(s)`)];
  const buckets = summary.buckets.map((bucket) => `${bucket.name}: ${bucket.count}`).join(", ");

  if (buckets) {
    parts.push(theme.fg("dim", buckets));
  }

  addOutputNotice(parts, details.output, theme);
  addTrace(parts, summary.trace, theme);

  return new Text(parts.join("\n"), 0, 0);
}

export function renderKagiExtractResult(result: ToolRenderResult, options: RenderOptions, theme: ToolTheme) {
  if (options.isPartial) {
    return new Text(theme.fg("muted", "Extracting page markdown with Kagi..."), 0, 0);
  }

  const details = result.details as KagiExtractDetails | undefined;
  const summary = details?.summary;

  if (!summary) {
    return new Text(getTextContent(result), 0, 0);
  }

  const parts = [
    theme.fg(
      "success",
      `Kagi extracted ${summary.extractedCount} of ${summary.pageCount} page(s)`,
    ),
  ];

  if (summary.errorCount > 0) {
    parts.push(theme.fg("warning", `${summary.errorCount} extraction error(s)`));
  }

  addOutputNotice(parts, details.output, theme);
  addTrace(parts, summary.trace, theme);

  return new Text(parts.join("\n"), 0, 0);
}

interface ToolTheme {
  bold(value: string): string;
  fg(color: string, value: string): string;
}

interface ToolRenderResult {
  content?: Array<{ type: string; text?: string }>;
  details?: unknown;
}

interface RenderOptions {
  isPartial?: boolean;
}

function addOutputNotice(parts: string[], output: { truncated: boolean; fullOutputPath?: string }, theme: ToolTheme) {
  if (!output.truncated) {
    return;
  }

  const location = output.fullOutputPath ? ` Full output: ${output.fullOutputPath}` : "";
  parts.push(theme.fg("warning", `Output truncated.${location}`));
}

function addTrace(parts: string[], trace: string | undefined, theme: ToolTheme) {
  if (!trace) {
    return;
  }

  parts.push(theme.fg("dim", `Trace: ${trace}`));
}

function getTextContent(result: ToolRenderResult) {
  return result.content?.find((block) => block.type === "text")?.text ?? "No text content returned.";
}

function quote(value: string) {
  return JSON.stringify(value.length > 80 ? `${value.slice(0, 77)}...` : value);
}
