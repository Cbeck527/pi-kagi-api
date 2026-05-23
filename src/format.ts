import type {
  ErrorDetail,
  ExtractResponse,
  PageOutput,
  Search200Response,
  Search200ResponseData,
  SearchResult,
} from "@kagi/api";
import type { ExtractSummary, SearchSummary } from "./types.js";

const SEARCH_BUCKETS: Array<{ key: keyof Search200ResponseData; name: string }> = [
  { key: "search", name: "Search" },
  { key: "image", name: "Images" },
  { key: "video", name: "Videos" },
  { key: "podcast", name: "Podcasts" },
  { key: "podcastCreator", name: "Podcast creators" },
  { key: "news", name: "News" },
  { key: "interestingNews", name: "Interesting news" },
  { key: "interestingFinds", name: "Interesting finds" },
  { key: "adjacentQuestion", name: "Adjacent questions" },
  { key: "directAnswer", name: "Direct answers" },
  { key: "infobox", name: "Infoboxes" },
  { key: "code", name: "Code" },
  { key: "packageTracking", name: "Package tracking" },
  { key: "publicRecords", name: "Public records" },
  { key: "weather", name: "Weather" },
  { key: "relatedSearch", name: "Related searches" },
  { key: "listicle", name: "Listicles" },
  { key: "webArchive", name: "Web archive" },
];

const SENSITIVE_QUERY_PARAMETER_NAMES = new Set([
  "accesstoken",
  "apikey",
  "auth",
  "authorization",
  "code",
  "idtoken",
  "jwt",
  "key",
  "password",
  "passwd",
  "privatekey",
  "pwd",
  "refreshtoken",
  "saml",
  "secret",
  "session",
  "sessionid",
  "sid",
  "sig",
  "signature",
  "ticket",
  "token",
]);

const SENSITIVE_QUERY_PARAMETER_PARTS = [
  "apikey",
  "auth",
  "password",
  "privatekey",
  "secret",
  "session",
  "signature",
  "token",
];

export function formatSearchResponse(
  response: Search200Response,
  request: { query: string; workflow: string },
): { markdown: string; summary: SearchSummary } {
  const buckets = collectSearchBuckets(response.data);
  const totalResults = buckets.reduce((sum, bucket) => sum + bucket.results.length, 0);

  const summary: SearchSummary = {
    totalResults,
    buckets: buckets.map((bucket) => ({ name: bucket.name, count: bucket.results.length })),
    trace: response.meta?.trace,
    ms: response.meta?.ms,
  };

  const lines = [
    `# Kagi search: ${request.query}`,
    "",
    `Workflow: ${request.workflow}`,
    ...formatMeta(response.meta),
    "",
  ];

  if (buckets.length === 0) {
    lines.push("No results returned.");
    return { markdown: lines.join("\n"), summary };
  }

  for (const bucket of buckets) {
    lines.push(`## ${bucket.name} (${bucket.results.length})`, "");

    bucket.results.forEach((result, index) => {
      lines.push(formatSearchResult(result, index + 1), "");
    });
  }

  return { markdown: lines.join("\n").trimEnd(), summary };
}

export function formatExtractResponse(response: ExtractResponse): { markdown: string; summary: ExtractSummary } {
  const pages = response.data ?? [];
  const errors = response.errors ?? [];
  const extractedCount = pages.filter((page) => page.markdown?.trim()).length;
  const errorCount = errors.length;

  const summary: ExtractSummary = {
    pageCount: pages.length,
    extractedCount,
    errorCount,
    trace: response.meta?.trace,
    ms: response.meta?.ms,
  };

  const lines = ["# Kagi extract", "", ...formatMeta(response.meta), ""];

  lines.push("## Extraction summary", "");
  lines.push(`Pages returned: ${pages.length}`);
  lines.push(`Pages with markdown: ${extractedCount}`);
  lines.push(`Extraction errors: ${errorCount}`, "");

  if (pages.length > 0) {
    lines.push("### Page status", "");

    pages.forEach((page, index) => {
      const pageErrors = errors.filter((error) => urlsMatch(error.url, page.url));
      const status = page.markdown?.trim() ? "extracted" : "no markdown";
      const errorSuffix = pageErrors.length > 0 ? `; ${pageErrors.length} error(s)` : "";
      lines.push(`${index + 1}. ${status}${errorSuffix}: ${formatDisplayUrl(page.url)}`);
    });

    lines.push("");
  }

  if (errors.length > 0) {
    lines.push("### Error status", "");
    errors.forEach((error, index) => lines.push(formatExtractionError(error, index + 1)));
    lines.push("");
  }

  lines.push("## Page content", "");

  if (pages.length === 0) {
    lines.push("No page content returned.");
  }

  pages.forEach((page, index) => {
    lines.push(formatPageOutput(page, index + 1), "");
  });

  if (errors.length > 0) {
    lines.push("", "## Detailed extraction errors", "");
    errors.forEach((error, index) => lines.push(formatExtractionError(error, index + 1)));
  }

  return { markdown: lines.join("\n").trimEnd(), summary };
}

function collectSearchBuckets(data: Search200ResponseData | undefined) {
  if (!data) {
    return [];
  }

  return SEARCH_BUCKETS.flatMap((bucket) => {
    const results = data[bucket.key] as SearchResult[] | undefined;

    if (!results || results.length === 0) {
      return [];
    }

    return [{ ...bucket, results }];
  });
}

function formatSearchResult(result: SearchResult, index: number) {
  const lines = [`${index}. ${formatSearchResultTitle(result)}`];

  if (result.time) {
    lines.push(`   Time: ${result.time}`);
  }

  lines.push(...formatImageMetadata(result.image));

  if (result.snippet?.trim()) {
    lines.push("   Snippet:");
    lines.push(indent(result.snippet.trim(), "   "));
  }

  return lines.join("\n");
}

function formatSearchResultTitle(result: SearchResult) {
  const title = formatMarkdownLinkLabel(result.title);
  const formattedUrl = formatMarkdownUrl(result.url);

  if (!formattedUrl.destination) {
    return `${title} (${formattedUrl.unavailableNote})`;
  }

  return `[${title}](${formattedUrl.destination})`;
}

function formatImageMetadata(image: SearchResult["image"]) {
  if (!image) {
    return [];
  }

  const lines: string[] = [];
  const formattedUrl = formatMarkdownUrl(image.url);

  if (formattedUrl.destination) {
    const label = formatMarkdownLinkLabel(formattedUrl.displayUrl);
    lines.push(`   Image: [${label}](${formattedUrl.destination})`);
  } else {
    lines.push(`   Image: ${formattedUrl.unavailableNote}`);
  }

  if (image.width !== undefined && image.height !== undefined) {
    lines.push(`   Image dimensions: ${image.width}x${image.height}`);
    return lines;
  }

  if (image.width !== undefined) {
    lines.push(`   Image width: ${image.width}`);
  }

  if (image.height !== undefined) {
    lines.push(`   Image height: ${image.height}`);
  }

  return lines;
}

function formatMarkdownLinkLabel(value: string | undefined | null) {
  const normalized = value?.replace(/[\r\n]+/g, " ").replace(/[ \t]+/g, " ").trim() ?? "";
  const label = normalized || "Untitled result";

  return label.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function formatMarkdownUrl(value: string | undefined | null) {
  const displayUrl = formatDisplayUrl(value);

  if (displayUrl === "URL unavailable") {
    return { displayUrl, unavailableNote: "URL unavailable" };
  }

  if (displayUrl === "[invalid URL omitted]") {
    return { displayUrl, unavailableNote: "URL unavailable: invalid URL omitted" };
  }

  return {
    displayUrl,
    destination: `<${displayUrl}>`,
    unavailableNote: "",
  };
}

function formatPageOutput(page: PageOutput, index: number) {
  const lines = [`## ${index}. ${formatDisplayUrl(page.url)}`, ""];

  if (!page.markdown?.trim()) {
    lines.push("No markdown content returned for this URL.");
    return lines.join("\n");
  }

  lines.push(page.markdown.trim());
  return lines.join("\n");
}

function formatExtractionError(error: ErrorDetail, index: number) {
  const message = redactSensitiveUrlText(error.message ?? "Unknown Kagi extraction error");
  const url = error.url ? ` URL: ${formatDisplayUrl(error.url)}.` : "";
  const location = error.location ? ` Location: ${redactSensitiveUrlText(error.location)}.` : "";

  return `${index}. ${error.code}: ${message}${url}${location}`;
}

function urlsMatch(left: string | undefined, right: string | undefined) {
  if (!left || !right) {
    return false;
  }

  try {
    return new URL(left).toString() === new URL(right).toString();
  } catch {
    return left === right;
  }
}

function formatDisplayUrl(value: string | undefined | null) {
  if (!value?.trim()) {
    return "URL unavailable";
  }

  return redactUrl(value.trim());
}

function redactSensitiveUrlText(value: string) {
  return value.replace(/https?:\/\/[^\s<>"')\]]+/g, (match) => redactUrl(match));
}

function redactUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return "[invalid URL omitted]";
  }

  url.username = "";
  url.password = "";

  for (const key of [...url.searchParams.keys()]) {
    if (isSensitiveQueryParameter(key)) {
      url.searchParams.set(key, "REDACTED");
    }
  }

  return url.toString();
}

function isSensitiveQueryParameter(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (SENSITIVE_QUERY_PARAMETER_NAMES.has(normalized)) {
    return true;
  }

  return SENSITIVE_QUERY_PARAMETER_PARTS.some((part) => normalized.includes(part));
}

function formatMeta(meta: { trace?: string; ms?: number } | undefined) {
  const lines: string[] = [];

  if (meta?.trace) {
    lines.push(`Trace: ${meta.trace}`);
  }

  if (meta?.ms !== undefined) {
    lines.push(`Kagi duration: ${meta.ms}ms`);
  }

  return lines;
}

function indent(value: string, prefix: string) {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
