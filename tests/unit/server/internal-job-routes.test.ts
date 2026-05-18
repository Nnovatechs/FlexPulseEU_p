import { describe, expect, it } from "vitest";
import { GET as getCleanupResponseData } from "@/app/api/internal/cleanup-response-data/route";
import { GET as getProcessJobs } from "@/app/api/internal/process-jobs/route";

describe("internal job routes", () => {
  it("returns 404 for GET cleanup-response-data", async () => {
    const response = await getCleanupResponseData();
    expect(response.status).toBe(404);
  });

  it("returns 404 for GET process-jobs", async () => {
    const response = await getProcessJobs();
    expect(response.status).toBe(404);
  });
});
