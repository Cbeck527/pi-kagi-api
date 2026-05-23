import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  ExtractRequestFormatEnum,
  SearchRequestFormatEnum,
  SearchRequestLensTimeRelativeEnum,
  SearchRequestWorkflowEnum,
  type ExtractRequest,
  type SearchRequest,
  type SearchRequestLens,
} from "@kagi/api";
import { formatExtractResponse, formatSearchResponse } from "./format.js";
import { createKagiApis, normalizeKagiError } from "./kagi.js";
import { prepareToolOutput } from "./output.js";
import {
  renderKagiExtractCall,
  renderKagiExtractResult,
  renderKagiSearchCall,
  renderKagiSearchResult,
} from "./renderers.js";
import {
  EXTRACT_TIMEOUT_SECONDS,
  KAGI_EXTRACT_PARAMETERS,
  KAGI_SEARCH_PARAMETERS,
  RELATIVE_TIME_FILTERS,
  SEARCH_EXTRACT_TIMEOUT_SECONDS,
  SEARCH_TIMEOUT_SECONDS,
  SEARCH_WORKFLOWS,
  type KagiExtractInput,
  type KagiSearchInput,
  type RelativeTimeFilter,
  type SearchWorkflow,
} from "./schemas.js";
import type { InlineLensMetadata, SearchRequestMetadata } from "./types.js";

type AssertExact<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;
type AssertTrue<Value extends true> = Value;
type SearchWorkflowSdkValue = `${SearchRequestWorkflowEnum}`;
type RelativeTimeFilterSdkValue = `${SearchRequestLensTimeRelativeEnum}`;
type _SearchWorkflowEnumDriftGuard = AssertTrue<AssertExact<SearchWorkflow, SearchWorkflowSdkValue>>;
type _RelativeTimeEnumDriftGuard = AssertTrue<AssertExact<RelativeTimeFilter, RelativeTimeFilterSdkValue>>;

const WORKFLOW_BY_VALUE: Record<SearchWorkflow, SearchRequestWorkflowEnum> = {
  search: SearchRequestWorkflowEnum.Search,
  images: SearchRequestWorkflowEnum.Images,
  videos: SearchRequestWorkflowEnum.Videos,
  news: SearchRequestWorkflowEnum.News,
  podcasts: SearchRequestWorkflowEnum.Podcasts,
};

const RELATIVE_TIME_BY_VALUE: Record<RelativeTimeFilter, SearchRequestLensTimeRelativeEnum> = {
  day: SearchRequestLensTimeRelativeEnum.Day,
  week: SearchRequestLensTimeRelativeEnum.Week,
  month: SearchRequestLensTimeRelativeEnum.Month,
};

assertExactEnumValues(SEARCH_WORKFLOWS, WORKFLOW_BY_VALUE, "Kagi search workflow");
assertExactEnumValues(RELATIVE_TIME_FILTERS, RELATIVE_TIME_BY_VALUE, "Kagi relative time filter");

export default function kagiApiExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "kagi_search",
    label: "Kagi Search",
    description:
      "Search Kagi using the official Kagi API. Output is truncated to 50KB/2000 lines; full output is saved to a temp file when truncated.",
    promptSnippet: "Search Kagi for web, image, video, news, or podcast results.",
    promptGuidelines: [
      "Use kagi_search when the user asks for current web information, Kagi results, or search-backed research.",
      "Set kagi_search extract_count only when the user needs markdown content from the top search results, because extraction has additional Kagi API cost.",
    ],
    parameters: KAGI_SEARCH_PARAMETERS,
    async execute(_toolCallId, params: KagiSearchInput, signal, onUpdate) {
      const query = params.query.trim();

      if (!query) {
        throw new Error("kagi_search requires a non-empty query.");
      }

      onUpdate?.({
        content: [{ type: "text", text: `Searching Kagi for: ${query}` }],
        details: {},
      });

      try {
        const workflow = params.workflow ?? "search";
        const request = buildSearchRequest({ ...params, query, workflow });
        const { search } = createKagiApis(signal);
        const response = await search.search(request);
        const formatted = formatSearchResponse(response, { query, workflow });
        const output = await prepareToolOutput(formatted.markdown, "kagi-search");

        return {
          content: [{ type: "text", text: output.text }],
          details: {
            kind: "kagi_search",
            requestMetadata: summarizeSearchRequest(request, workflow),
            summary: formatted.summary,
            output: output.output,
          },
        };
      } catch (error) {
        throw normalizeKagiError(error);
      }
    },
    renderCall: renderKagiSearchCall,
    renderResult: renderKagiSearchResult,
  });

  pi.registerTool({
    name: "kagi_extract",
    label: "Kagi Extract",
    description:
      "Extract markdown page content from 1-10 HTTPS URLs using the official Kagi Extract API. Output is truncated to 50KB/2000 lines; full output is saved to a temp file when truncated.",
    promptSnippet: "Extract markdown content from one or more HTTPS URLs with Kagi.",
    promptGuidelines: [
      "Use kagi_extract when the user asks to read, fetch, or extract markdown from one or more web pages by URL.",
      "Pass at most 10 URLs to kagi_extract, and only pass HTTPS URLs.",
    ],
    parameters: KAGI_EXTRACT_PARAMETERS,
    async execute(_toolCallId, params: KagiExtractInput, signal, onUpdate) {
      validateNumberRange(params.timeout, "kagi_extract timeout", EXTRACT_TIMEOUT_SECONDS);

      const urls = normalizeHttpsUrls(params.urls);

      onUpdate?.({
        content: [{ type: "text", text: `Extracting ${urls.length} URL(s) with Kagi.` }],
        details: {},
      });

      try {
        const request: ExtractRequest = {
          pages: urls.map((url) => ({ url })),
          timeout: params.timeout,
          format: ExtractRequestFormatEnum.Json,
        };
        const { extract } = createKagiApis(signal);
        const response = await extract.extractContent(request);
        const formatted = formatExtractResponse(response);
        const output = await prepareToolOutput(formatted.markdown, "kagi-extract");

        return {
          content: [{ type: "text", text: output.text }],
          details: {
            kind: "kagi_extract",
            requestMetadata: removeUndefined({ urlCount: urls.length, timeout: params.timeout }),
            summary: formatted.summary,
            output: output.output,
          },
        };
      } catch (error) {
        throw normalizeKagiError(error);
      }
    },
    renderCall: renderKagiExtractCall,
    renderResult: renderKagiExtractResult,
  });
}

function buildSearchRequest(params: KagiSearchInput): SearchRequest {
  if (params.extract_timeout !== undefined && params.extract_count === undefined) {
    throw new Error("kagi_search extract_timeout requires extract_count.");
  }

  validateNumberRange(params.timeout, "kagi_search timeout", SEARCH_TIMEOUT_SECONDS);
  validateNumberRange(
    params.extract_timeout,
    "kagi_search extract_timeout",
    SEARCH_EXTRACT_TIMEOUT_SECONDS,
  );

  const workflow = (params.workflow ?? "search") as SearchWorkflow;
  const request: SearchRequest = {
    query: params.query,
    workflow: WORKFLOW_BY_VALUE[workflow],
    format: SearchRequestFormatEnum.Json,
    limit: params.limit ?? 10,
    page: params.page,
    timeout: params.timeout,
    safeSearch: params.safe_search,
    lensId: params.lens_id,
    filters: buildFilters(params),
    lens: buildLens(params),
    extract: params.extract_count
      ? {
          count: params.extract_count,
          timeout: params.extract_timeout,
        }
      : undefined,
  };

  return removeUndefined(request);
}

function buildFilters(params: KagiSearchInput): SearchRequest["filters"] | undefined {
  const filters = removeUndefined({
    region: params.region,
    after: params.after,
    before: params.before,
  });

  if (Object.keys(filters).length === 0) {
    return undefined;
  }

  return filters;
}

function buildLens(params: KagiSearchInput): SearchRequestLens | undefined {
  const lens = removeUndefined({
    sitesIncluded: params.sites_included,
    sitesExcluded: params.sites_excluded,
    keywordsIncluded: params.keywords_included,
    keywordsExcluded: params.keywords_excluded,
    fileType: params.file_type,
    timeRelative: params.time_relative
      ? RELATIVE_TIME_BY_VALUE[params.time_relative as RelativeTimeFilter]
      : undefined,
  });

  if (Object.keys(lens).length === 0) {
    return undefined;
  }

  return lens;
}

function summarizeSearchRequest(request: SearchRequest, workflow: SearchWorkflow): SearchRequestMetadata {
  const filters = getDefinedKeys(request.filters);

  return removeUndefined({
    workflow,
    limit: request.limit ?? 10,
    page: request.page,
    timeout: request.timeout,
    safeSearch: request.safeSearch,
    filters: filters.length > 0 ? filters : undefined,
    lens: summarizeSearchLens(request),
    extract: request.extract
      ? removeUndefined({ count: request.extract.count, timeout: request.extract.timeout })
      : undefined,
  });
}

function summarizeSearchLens(request: SearchRequest) {
  const inlineLens = summarizeInlineLens(request.lens);

  if (request.lensId === undefined && inlineLens === undefined) {
    return undefined;
  }

  return removeUndefined({
    lensIdProvided: request.lensId !== undefined,
    inlineLens,
  });
}

function summarizeInlineLens(lens: SearchRequestLens | undefined): InlineLensMetadata | undefined {
  if (!lens) {
    return undefined;
  }

  const fields = getDefinedKeys(lens);

  if (fields.length === 0) {
    return undefined;
  }

  return removeUndefined({
    fields,
    sitesIncludedCount: lens.sitesIncluded?.length,
    sitesExcludedCount: lens.sitesExcluded?.length,
    keywordsIncludedCount: lens.keywordsIncluded?.length,
    keywordsExcludedCount: lens.keywordsExcluded?.length,
  });
}

function getDefinedKeys(value: object | undefined) {
  if (!value) {
    return [];
  }

  return Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key]) => key);
}

function normalizeHttpsUrls(urls: string[]) {
  return urls.map((url, index) => normalizeHttpsUrl(url, index + 1));
}

function normalizeHttpsUrl(value: string, index: number) {
  const label = `kagi_extract URL #${index}`;
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} must not be empty.`);
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`);
  }

  if (url.username || url.password) {
    throw new Error(`${label} must not include embedded credentials.`);
  }

  return url.toString();
}

function assertExactEnumValues<T extends string>(
  localValues: readonly T[],
  enumMap: Record<T, string>,
  label: string,
) {
  const localValueSet = new Set<string>(localValues);
  const mappedValueSet = new Set(Object.values(enumMap));
  const valuesMatch =
    localValueSet.size === mappedValueSet.size && [...localValueSet].every((value) => mappedValueSet.has(value));

  if (valuesMatch) {
    return;
  }

  throw new Error(`${label} values drifted from the generated Kagi SDK enum.`);
}

function validateNumberRange(
  value: number | undefined,
  label: string,
  range: Readonly<{ minimum: number; maximum: number }>,
) {
  if (value === undefined) {
    return;
  }

  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  if (value < range.minimum || value > range.maximum) {
    throw new Error(`${label} must be between ${range.minimum} and ${range.maximum} seconds.`);
  }
}

function removeUndefined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
