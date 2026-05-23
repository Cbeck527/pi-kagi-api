import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";

export const SEARCH_WORKFLOWS = ["search", "images", "videos", "news", "podcasts"] as const;
export const RELATIVE_TIME_FILTERS = ["day", "week", "month"] as const;

export const SEARCH_TIMEOUT_SECONDS = { minimum: 0.5, maximum: 4 } as const;
export const SEARCH_EXTRACT_TIMEOUT_SECONDS = { minimum: 0.5, maximum: 4 } as const;
export const EXTRACT_TIMEOUT_SECONDS = { minimum: 0.5, maximum: 10 } as const;

export const KAGI_SEARCH_PARAMETERS = Type.Object({
  query: Type.String({
    minLength: 1,
    description: "Search query to run with Kagi.",
  }),
  workflow: Type.Optional(
    StringEnum(SEARCH_WORKFLOWS, {
      default: "search",
      description: "Type of Kagi results to return.",
    }),
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 1024,
      default: 10,
      description: "Maximum number of results to return. Defaults to 10 to keep tool output concise.",
    }),
  ),
  page: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 10,
      description: "Result page number for paginated searches.",
    }),
  ),
  timeout: Type.Optional(
    Type.Number({
      ...SEARCH_TIMEOUT_SECONDS,
      description: "Search timeout in seconds, from 0.5 to 4. Omit to use Kagi's recommended value.",
    }),
  ),
  safe_search: Type.Optional(
    Type.Boolean({
      description: "Whether Kagi should omit potentially NSFW content.",
    }),
  ),
  region: Type.Optional(
    Type.String({
      minLength: 2,
      description: "Optional ISO 3166-1 alpha-2 region code filter, for example US or GB.",
    }),
  ),
  after: Type.Optional(
    Type.String({
      format: "date",
      description: "Only return results published or updated after this YYYY-MM-DD date.",
    }),
  ),
  before: Type.Optional(
    Type.String({
      format: "date",
      description: "Only return results published or updated before this YYYY-MM-DD date.",
    }),
  ),
  lens_id: Type.Optional(
    Type.String({
      description: "Kagi built-in lens identifier, shareable lens ID, or full Kagi lens URL.",
    }),
  ),
  sites_included: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      description: "Optional domains to include in an inline lens.",
    }),
  ),
  sites_excluded: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      description: "Optional domains to exclude in an inline lens.",
    }),
  ),
  keywords_included: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      description: "Optional keywords that results must contain.",
    }),
  ),
  keywords_excluded: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), {
      description: "Optional keywords that results must not contain.",
    }),
  ),
  file_type: Type.Optional(
    Type.String({
      description: "Optional file type for an inline lens, for example pdf.",
    }),
  ),
  time_relative: Type.Optional(
    StringEnum(RELATIVE_TIME_FILTERS, {
      description: "Optional relative time filter for an inline lens.",
    }),
  ),
  extract_count: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 10,
      description:
        "Optionally ask Kagi Search to extract markdown from the top N search results. This incurs Extract API cost.",
    }),
  ),
  extract_timeout: Type.Optional(
    Type.Number({
      ...SEARCH_EXTRACT_TIMEOUT_SECONDS,
      description: "Per-page extraction timeout in seconds, from 0.5 to 4. Requires extract_count.",
    }),
  ),
});

export const KAGI_EXTRACT_PARAMETERS = Type.Object({
  urls: Type.Array(
    Type.String({
      format: "uri",
      pattern: "^https://",
      description:
        "Absolute HTTPS URL to extract markdown content from. Embedded credentials are rejected at runtime.",
    }),
    {
      minItems: 1,
      maxItems: 10,
      description: "One to ten HTTPS URLs to extract concurrently.",
    },
  ),
  timeout: Type.Optional(
    Type.Number({
      ...EXTRACT_TIMEOUT_SECONDS,
      description: "Optional timeout in seconds for the whole bulk extraction operation, from 0.5 to 10.",
    }),
  ),
});

export type KagiSearchInput = Static<typeof KAGI_SEARCH_PARAMETERS>;
export type KagiExtractInput = Static<typeof KAGI_EXTRACT_PARAMETERS>;
export type SearchWorkflow = (typeof SEARCH_WORKFLOWS)[number];
export type RelativeTimeFilter = (typeof RELATIVE_TIME_FILTERS)[number];
