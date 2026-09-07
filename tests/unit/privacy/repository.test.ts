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

const profileRow = {
  user_id: "user-1",
  controller_name: "University College Cork",
  controller_country: "Ireland",
  contact_email: "research@ucc.ie",
  privacy_email: "privacy@ucc.ie",
  dpo_email: null,
  controller_address: "College Road, Cork, Ireland",
  representative_name: "Authorised Researcher",
  representative_title: "Principal Investigator",
  created_at: "2026-07-16T10:00:00.000Z",
  updated_at: "2026-07-16T10:00:00.000Z",
};

function buildUpdateClient(row: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const upsert = vi.fn();

  return {
    from: vi.fn(() => ({ update, upsert, select: vi.fn() })),
    update,
    upsert,
  };
}

describe("owner legal profile repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSession.mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("updates only DPA signing columns so participant fields stay intact", async () => {
    const client = buildUpdateClient(profileRow);
    createSupabaseServerClient.mockResolvedValue(client);

    const { saveCurrentOwnerDpaSigningDetails } = await import(
      "@/features/privacy/repository"
    );

    await saveCurrentOwnerDpaSigningDetails({
      controllerAddress: "New Registered Address",
      representativeName: "New Representative",
      representativeTitle: "Legal Signatory",
    });

    expect(client.update).toHaveBeenCalledWith({
      controller_address: "New Registered Address",
      representative_name: "New Representative",
      representative_title: "Legal Signatory",
    });
    expect(client.upsert).not.toHaveBeenCalled();
  });
});
