import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getCleanupResponseData } from "@/app/api/internal/cleanup-response-data/route";
import { GET as getProcessJobs } from "@/app/api/internal/process-jobs/route";

const ORIGINAL_INTERNAL_JOB_SECRET = process.env.INTERNAL_JOB_SECRET;

describe("internal job routes", () => {
  beforeEach(() => {
    process.env.INTERNAL_JOB_SECRET = "expected-secret";
  });

  afterEach(() => {
    process.env.INTERNAL_JOB_SECRET = ORIGINAL_INTERNAL_JOB_SECRET;
  });

  it("requires auth for GET cleanup-response-data", async () => {
    const response = await getCleanupResponseData(
      new Request("https://example.test/api/internal/cleanup-response-data"),
    );
    expect(response.status).toBe(401);
  });

  it("requires auth for GET process-jobs", async () => {
    const response = await getProcessJobs(
      new Request("https://example.test/api/internal/process-jobs"),
    );
    expect(response.status).toBe(401);
  });
});
