import { beforeEach, describe, expect, it, vi } from "vitest";

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

function buildDuplicateInsertClient() {
  const single = vi.fn().mockResolvedValue({
    data: null,
    error: {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "terms_acceptances_user_id_document_hash_key"',
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
  const eqVersion = vi.fn(() => ({ eq: eqHash }));
  const eqUser = vi.fn(() => ({ eq: eqVersion }));
  const select = vi.fn(() => ({ eq: eqUser }));

  return {
    from: vi.fn(() => ({ select })),
  };
}

describe("terms repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "FlexPulseEU");
    vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@flexpulse.example");
    requireCurrentSession.mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("treats a duplicate terms acceptance insert as success", async () => {
    const acceptedAt = "2026-07-20T12:00:00.000Z";
    const { buildTermsDocument } = await import("@/features/access/terms");
    const document = buildTermsDocument();
    createSupabaseServerClient
      .mockResolvedValueOnce(buildDuplicateInsertClient())
      .mockResolvedValueOnce(
        buildCurrentAcceptanceClient({
          id: "acc-1",
          user_id: "user-1",
          terms_version: document.version,
          document_hash: document.documentHash,
          acceptance_statement: "accepted",
          accepted_at: acceptedAt,
        }),
      );

    const { recordCurrentTermsAcceptance } = await import(
      "@/features/access/repository"
    );

    await expect(recordCurrentTermsAcceptance(document)).resolves.toMatchObject({
      id: "acc-1",
      userId: "user-1",
      termsVersion: document.version,
      documentHash: document.documentHash,
      acceptedAt,
    });
  });
});
