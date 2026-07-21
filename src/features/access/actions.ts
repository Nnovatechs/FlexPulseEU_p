"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { getCurrentTermsAcceptance, recordCurrentTermsAcceptance } from "./repository";
import { buildTermsDocument } from "./terms";

export async function acceptTermsAction(formData: FormData) {
  if (String(formData.get("accepted") ?? "") !== "true") {
    redirect(`${appRoutes.terms}?error=acceptance-required`);
  }

  const document = buildTermsDocument();
  const displayedHash = String(formData.get("documentHash") ?? "").trim();

  if (displayedHash !== document.documentHash) {
    redirect(`${appRoutes.terms}?error=document-changed`);
  }

  const existing = await getCurrentTermsAcceptance();
  if (!existing) {
    await recordCurrentTermsAcceptance(document);
  }

  revalidatePath(appRoutes.terms);
  revalidatePath(appRoutes.dashboard);
  redirect(appRoutes.dashboard);
}
