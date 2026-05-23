export interface ToolOutputInfo {
  truncated: boolean;
  truncatedBy: "lines" | "bytes" | null;
  totalLines: number;
  totalBytes: number;
  outputLines: number;
  outputBytes: number;
  fullOutputPath?: string;
}

export interface SearchBucketSummary {
  name: string;
  count: number;
}

export interface SearchSummary {
  totalResults: number;
  buckets: SearchBucketSummary[];
  trace?: string;
  ms?: number;
}

export interface ExtractSummary {
  pageCount: number;
  extractedCount: number;
  errorCount: number;
  trace?: string;
  ms?: number;
}

export interface InlineLensMetadata {
  fields: string[];
  sitesIncludedCount?: number;
  sitesExcludedCount?: number;
  keywordsIncludedCount?: number;
  keywordsExcludedCount?: number;
}

export interface SearchLensMetadata {
  lensIdProvided: boolean;
  inlineLens?: InlineLensMetadata;
}

export interface SearchRequestMetadata {
  workflow: string;
  limit: number;
  page?: number;
  timeout?: number;
  safeSearch?: boolean;
  filters?: string[];
  lens?: SearchLensMetadata;
  extract?: {
    count?: number;
    timeout?: number;
  };
}

export interface ExtractRequestMetadata {
  urlCount: number;
  timeout?: number;
}

export interface KagiSearchDetails {
  kind: "kagi_search";
  requestMetadata: SearchRequestMetadata;
  summary: SearchSummary;
  output: ToolOutputInfo;
}

export interface KagiExtractDetails {
  kind: "kagi_extract";
  requestMetadata: ExtractRequestMetadata;
  summary: ExtractSummary;
  output: ToolOutputInfo;
}
