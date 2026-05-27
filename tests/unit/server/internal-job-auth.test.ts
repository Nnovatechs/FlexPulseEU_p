import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isInternalJobRequestAuthorized } from "@/lib/server/internal-job-auth";

const ORIGINAL_INTERNAL_JOB_SECRET = process.env.INTERNAL_JOB_SECRET;

function requestWithHeaders(headers: HeadersInit) {
  return new Request("https://example.test/api/internal/process-jobs", { headers });
}

describe("internal job auth", () => {
  beforeEach(() => {
    process.env.INTERNAL_JOB_SECRET = "expected-secret";
  });

  afterEach(() => {
    process.env.INTERNAL_JOB_SECRET = ORIGINAL_INTERNAL_JOB_SECRET;
  });

  it("rejects requests without an internal secret header", () => {
    expect(isInternalJobRequestAuthorized(requestWithHeaders({}))).toBe(false);
  });

  it("rejects requests with the wrong secret", () => {
    expect(
      isInternalJobRequestAuthorized(
        requestWithHeaders({ "x-internal-job-secret": "wrong-secret" }),
      ),
    ).toBe(false);
  });

  it("accepts x-internal-job-secret when it matches", () => {
    expect(
      isInternalJobRequestAuthorized(
        requestWithHeaders({ "x-internal-job-secret": "expected-secret" }),
      ),
    ).toBe(true);
  });

  it("accepts Authorization bearer when it matches", () => {
    expect(
      isInternalJobRequestAuthorized(
        requestWithHeaders({ authorization: "Bearer expected-secret" }),
      ),
    ).toBe(true);
  });
});
