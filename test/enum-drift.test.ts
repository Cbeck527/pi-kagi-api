import { describe, expect, it } from "vitest";
import { SearchRequestWorkflowEnum } from "../node_modules/@kagi/api/dist/models/SearchRequest.js";
import { SearchRequestLensTimeRelativeEnum } from "../node_modules/@kagi/api/dist/models/SearchRequestLens.js";
import { RELATIVE_TIME_FILTERS, SEARCH_WORKFLOWS } from "../src/schemas.js";

describe("Kagi SDK enum drift guards", () => {
  it("keeps local workflow schema values aligned with the generated SDK", () => {
    expect([...SEARCH_WORKFLOWS].sort()).toEqual(Object.values(SearchRequestWorkflowEnum).sort());
  });

  it("keeps local relative time schema values aligned with the generated SDK", () => {
    expect([...RELATIVE_TIME_FILTERS].sort()).toEqual(
      Object.values(SearchRequestLensTimeRelativeEnum).sort(),
    );
  });
});
