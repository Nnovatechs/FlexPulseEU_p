"use server";

import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { invalidRequest } from "./api-errors";
import {
  createCurrentOwnerApiToken,
  parseScopeSelection,
  parseTokenExpiry,
  revokeCurrentOwnerApiToken,
} from "./api-token-repository";

export type CreateApiTokenActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
  token: string | null;
};

export async function createApiTokenAction(
  _previousState: CreateApiTokenActionState,
  formData: FormData,
): Promise<CreateApiTokenActionState> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const scopes = parseScopeSelection(formData.getAll("scopes"));
    const expiresAt = parseTokenExpiry(String(formData.get("expiresAt") ?? ""));
    const created = await createCurrentOwnerApiToken({
      name,
      scopes,
      expiresAt,
    });
    return {
      status: "success",
      message: `Token "${created.summary.name}" created. This token will only be shown once.`,
      token: created.token,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : invalidRequest("Could not create API token.").message;
    return {
      status: "error",
      message,
      token: null,
    };
  }
}

export async function revokeApiTokenAction(formData: FormData) {
  const tokenId = String(formData.get("tokenId") ?? "").trim();
  if (!tokenId) {
    redirect(`${appRoutes.accountApi}?error=missing-token`);
  }

  try {
    await revokeCurrentOwnerApiToken(tokenId);
  } catch {
    redirect(`${appRoutes.accountApi}?error=revoke-failed`);
  }

  redirect(`${appRoutes.accountApi}?revoked=1`);
}
