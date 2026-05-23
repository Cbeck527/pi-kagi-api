# pi-kagi-api

A [pi](https://pi.dev) extension package that registers two tools backed by Kagi's v1 API and Kagi's official generated TypeScript SDK from `kagisearch/kagi-openapi-typescript`:

- `kagi_search` — call `POST https://kagi.com/api/v1/search` and format Kagi result buckets, including web/image/video/news/podcast results, as markdown.
- `kagi_extract` — call `POST https://kagi.com/api/v1/extract` and format markdown extraction from 1-10 HTTPS URLs.

The package builds `src/index.ts` into a Node 22 ESM bundle in `dist/`, emits TypeScript declarations, and keeps Pi/typebox packages as peer dependencies.

## Requirements

- Node.js 22+ (`package.json` enforces `>=22`, and the bundle targets Node 22)
- pnpm 11+ (`packageManager` is `pnpm@11.2.2`; the Nix dev shell provides `pnpm_11`)
- A Kagi API key from <https://kagi.com/api/keys> for live tool execution and live smoke tests

Set the API key before launching pi or running `pnpm test:live`:

```sh
export KAGI_API_KEY="..."
```

## Installation

_The npm registry package is the recommended install source for normal use because it contains the built extension bundle._

```sh
# From NPM
$ pi install npm:@christopherbecker/pi-kagi-api
$ pi install npm:@christopherbecker/pi-kagi-api@0.1.0

# From Github
pi install git:github.com/cbeck527/pi-kagi-api@v0.1.0
pi install git:github.com/cbeck527/pi-kagi-api
```

## Development

Install dependencies, then run the offline validation checks:

```sh
pnpm install
pnpm check
pnpm test
pnpm run smoke:dist
pnpm run pack:dry-run
```

`pnpm run smoke:dist` rebuilds the package before importing the built artifact and verifying that exactly `kagi_search` and `kagi_extract` register. `pnpm run pack:dry-run` exercises the package contents that will ship (`dist/`, `README.md`, and package metadata).

For the full local release-readiness sequence in one command:

```sh
pnpm run validate
```

`pnpm run validate` runs `check`, `test`, `smoke:dist`, and `pack:dry-run`. `pnpm test` is offline and does not require a Kagi API key. `pnpm test:live` builds the package, runs one direct live Kagi Search request, and skips cleanly when `KAGI_API_KEY` is unset:

```sh
pnpm test:live
```

## Try locally

Build the package, then load it into pi as a local package:

```sh
pnpm build
pi -e .
```

Or install it into a project-local pi settings file:

```sh
pi install -l .
```

## Tools

### `kagi_search`

Search Kagi using the official Search API. The tool trims the query, defaults to `workflow: "search"` and `limit: 10`, requests JSON from Kagi, formats populated result buckets into concise markdown, and stores summarized request/response metadata in Pi `details`.

Runtime validation rejects a blank query, out-of-range timeouts, and `extract_timeout` without `extract_count`.

Useful parameters:

- `query` — search query
- `workflow` — `search`, `images`, `videos`, `news`, or `podcasts`
- `limit` — maximum results returned, 1-1024
- `page` — page number, 1-10
- `timeout` — search timeout in seconds, 0.5-4
- `safe_search` — omit potentially NSFW content
- `region`, `after`, `before` — result filters
- `lens_id` — Kagi built-in lens identifier, shareable lens ID, or full Kagi lens URL
- `sites_included`, `sites_excluded` — optional domain filters for an inline lens
- `keywords_included`, `keywords_excluded` — optional keyword filters for an inline lens
- `file_type`, `time_relative` — optional file type and `day`/`week`/`month` inline lens filters
- `extract_count` — extract markdown from the top N results, 1-10; this incurs Extract API cost
- `extract_timeout` — per-page extraction timeout in seconds, 0.5-4; requires `extract_count`

### `kagi_extract`

Extract markdown from 1-10 HTTPS URLs using Kagi's Extract API. The tool trims and normalizes URLs, rejects empty/malformed/non-HTTPS/credential-bearing URLs before calling Kagi, requests JSON from Kagi, and formats extraction summary/status before page content.

Useful parameters:

- `urls` — array of 1-10 absolute HTTPS URLs. Embedded URL credentials are rejected, and token-like query parameters are redacted in formatted output.
- `timeout` — optional timeout in seconds for the bulk extraction operation, 0.5-10

## Output and truncation

Tool output is formatted as concise markdown for the model:

- `kagi_search` includes the query, workflow, Kagi trace/timing when present, and every populated result bucket returned by Kagi.
- `kagi_extract` includes an extraction summary, per-page status, extraction errors, and then the returned page markdown.

Formatted URLs omit embedded credentials and redact sensitive/token-like query parameters such as `token`, `api_key`, `session`, `signature`, and `password`. Invalid result URLs are omitted instead of echoed back to the model. Kagi SDK errors are surfaced with HTTP status, API messages, and trace IDs when available.

Pi `details` stores summarized request metadata, result summary metadata, timing/trace information, and truncation info; it does not duplicate the full SDK request or response bodies.

Like Pi's built-in tools, model-visible output is truncated to 50KB or 2000 lines, whichever comes first. When truncation happens, the extension writes the full markdown output to a unique directory under the OS temp directory and includes that path in the tool result. The temp directory is owner-only and the markdown file is written owner-readable/writable only.
