import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerLegalProfile } from "@/features/privacy/types";

const { requireCurrentSession, createSupabaseServerClient } = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

const profile: OwnerLegalProfile = {
  userId: "user-1",
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

function buildDuplicateInsertClient() {
  const single = vi.fn().mockResolvedValue({
    data: null,
    error: {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "dpa_acceptances_user_id_document_hash_key"',
    },
  });

  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single,
        })),
      })),
    })),
  };
}

function buildCurrentAcceptanceClient(row: Record<string, string>) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: row,
    error: null,
  });
  const eqHash = vi.fn(() => ({ maybeSingle }));
  const eqUser = vi.fn(() => ({ eq: eqHash }));
  const select = vi.fn(() => ({ eq: eqUser }));

  return {
    from: vi.fn(() => ({ select })),
  };
}

describe("DPA repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEGAL_PROCESSOR_NAME", "FlexPulseEU Operator");
    vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@platform.example");
    vi.stubEnv("LEGAL_PROCESSOR_ADDRESS", "Operator registered address");
    requireCurrentSession.mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("treats a duplicate DPA acceptance insert as success", async () => {
    const acceptedAt = "2026-07-20T12:00:00.000Z";
    const { buildDpaDocument } = await import("@/features/privacy/dpa");
    const document = buildDpaDocument(profile);

    createSupabaseServerClient
      .mockResolvedValueOnce(buildDuplicateInsertClient())
      .mockResolvedValueOnce(
        buildCurrentAcceptanceClient({
          id: "acc-1",
          user_id: "user-1",
          dpa_version: document.version,
          document_hash: document.documentHash,
          acceptance_statement: "accepted",
          accepted_at: acceptedAt,
        }),
      );

    const { recordCurrentDpaAcceptance } = await import(
      "@/features/privacy/dpa-repository"
    );

    await expect(recordCurrentDpaAcceptance(profile, document)).resolves.toMatchObject({
      id: "acc-1",
      userId: "user-1",
      dpaVersion: document.version,
      documentHash: document.documentHash,
      acceptedAt,
    });
  });
});
