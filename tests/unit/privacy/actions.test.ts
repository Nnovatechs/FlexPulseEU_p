import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDpaDocument, getDpaConfig } from "@/features/privacy/dpa";
import type { OwnerLegalProfile } from "@/features/privacy/types";

const {
  getCurrentOwnerLegalProfile,
  getCurrentDpaAcceptance,
  recordCurrentDpaAcceptance,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  getCurrentOwnerLegalProfile: vi.fn(),
  getCurrentDpaAcceptance: vi.fn(),
  recordCurrentDpaAcceptance: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/privacy/repository", () => ({
  getCurrentOwnerLegalProfile,
  saveCurrentOwnerLegalProfile: vi.fn(),
}));
vi.mock("@/features/privacy/dpa-repository", () => ({
  getCurrentDpaAcceptance,
  recordCurrentDpaAcceptance,
}));

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

describe("DPA acceptance action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEGAL_PROCESSOR_NAME", "FlexPulseEU Operator");
    vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@platform.example");
    vi.stubEnv("LEGAL_PROCESSOR_ADDRESS", "Operator registered address");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records the exact document displayed to the authorised Controller", async () => {
    getCurrentOwnerLegalProfile.mockResolvedValue(profile);
    getCurrentDpaAcceptance.mockResolvedValue(null);
    recordCurrentDpaAcceptance.mockResolvedValue({});
    const document = buildDpaDocument(profile, getDpaConfig());
    const formData = new FormData();
    formData.set("accepted", "true");
    formData.set("documentHash", document.documentHash);

    const { acceptDpaAction } = await import("@/features/privacy/actions");
    await acceptDpaAction(formData);

    expect(recordCurrentDpaAcceptance).toHaveBeenCalledWith(profile, document);
    expect(revalidatePath).toHaveBeenCalledWith("/account/privacy/dpa");
    expect(redirect).toHaveBeenCalledWith("/account/privacy/dpa?accepted=1");
  });
});
