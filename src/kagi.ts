import {
  ApiException,
  createConfiguration,
  ExtractApi,
  SearchApi,
  type ErrorEnvelope,
  type Middleware,
  type RequestContext,
  type ResponseContext,
} from "@kagi/api";

const KAGI_API_KEY_ENV = "KAGI_API_KEY";

export function createKagiApis(signal?: AbortSignal) {
  requireKagiApiKey();

  const configuration = createConfiguration({
    authMethods: {
      kagi: {
        tokenProvider: {
          getToken: requireKagiApiKey,
        },
      },
    },
    promiseMiddleware: createAbortMiddleware(signal),
  });

  return {
    search: new SearchApi(configuration),
    extract: new ExtractApi(configuration),
  };
}

export function normalizeKagiError(error: unknown) {
  if (error instanceof ApiException) {
    return new Error(formatApiException(error));
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function requireKagiApiKey() {
  const apiKey = process.env[KAGI_API_KEY_ENV]?.trim();

  if (!apiKey) {
    throw new Error(
      `Kagi API key is not configured. Set ${KAGI_API_KEY_ENV} to a token from https://kagi.com/api/keys.`,
    );
  }

  return apiKey;
}

function createAbortMiddleware(signal: AbortSignal | undefined): Middleware[] {
  if (!signal) {
    return [];
  }

  return [
    {
      async pre(context: RequestContext) {
        context.setSignal(signal);
        return context;
      },
      async post(context: ResponseContext) {
        return context;
      },
    },
  ];
}

function formatApiException(error: ApiException<unknown>) {
  const body = error.body as Partial<ErrorEnvelope> | undefined;
  const messages = body?.error?.map(formatErrorDetail).filter(Boolean) ?? [];
  const trace = body?.meta?.trace ?? error.headers?.["x-kagi-trace"];

  const lines = [`Kagi API request failed with HTTP ${error.code}.`];

  if (messages.length > 0) {
    lines.push(...messages.map((message) => `- ${message}`));
  } else {
    lines.push(error.message);
  }

  if (trace) {
    lines.push(`Trace: ${trace}`);
  }

  return lines.join("\n");
}

function formatErrorDetail(detail: { code?: string; message?: string | null; location?: string | null }) {
  const prefix = detail.code ? `${detail.code}: ` : "";
  const suffix = detail.location ? ` (${detail.location})` : "";
  const message = detail.message ?? "Unknown Kagi API error";

  return `${prefix}${message}${suffix}`;
}
