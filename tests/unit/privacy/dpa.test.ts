import { describe, expect, it } from "vitest";
import {
  buildDpaDocument,
  isDpaConfigComplete,
  type DpaConfig,
} from "@/features/privacy/dpa";
import type { OwnerLegalProfile } from "@/features/privacy/types";

const profile: OwnerLegalProfile = {
  userId: "owner-1",
  controllerName: "University College Cork",
  controllerCountry: "Ireland",
  controllerAddress: "College Road, Cork, Ireland",
  representativeName: "Authorised Researcher",
  representativeTitle: "Principal Investigator",
  contactEmail: "research@ucc.ie",
  privacyEmail: "privacy@ucc.ie",
  dpoEmail: null,
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

const config: DpaConfig = {
  required: true,
  version: "1.0",
  processorName: "FlexPulseEU Operator",
  processorAddress: "Operator registered address",
  processorPrivacyEmail: "privacy@platform.example",
};

describe("DPA document", () => {
  it("requires a complete hosted Processor identity", () => {
    expect(isDpaConfigComplete(config)).toBe(true);
    expect(
      isDpaConfigComplete({ ...config, processorAddress: "" }),
    ).toBe(false);
  });

  it("generates a versioned document from Controller and Processor details", () => {
    const document = buildDpaDocument(profile, config);

    expect(document).toMatchObject({
      version: "1.0",
      controller: {
        legalName: "University College Cork",
        representativeTitle: "Principal Investigator",
      },
      processor: {
        legalName: "FlexPulseEU Operator",
      },
    });
    expect(document.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.sections.some((section) => section.title.includes("Subprocessors"))).toBe(
      true,
    );
  });

  it("invalidates the document hash when contractual party details change", () => {
    const original = buildDpaDocument(profile, config);
    const changed = buildDpaDocument(
      { ...profile, representativeName: "Different Representative" },
      config,
    );

    expect(changed.documentHash).not.toBe(original.documentHash);
  });

  it("does not make uptime or post-project support commitments", () => {
    const documentText = JSON.stringify(buildDpaDocument(profile, config));

    expect(documentText).toContain(
      "does not itself create a service-level, uptime, long-term hosting, maintenance, or post-project support commitment",
    );
  });
});
