"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { buildDpaDocument, getDpaConfig, isDpaConfigComplete } from "./dpa";
import {
  getCurrentDpaAcceptance,
  recordCurrentDpaAcceptance,
} from "./dpa-repository";
import {
  getCurrentOwnerLegalProfile,
  saveCurrentOwnerLegalProfile,
} from "./repository";
import { isOwnerDpaProfileComplete } from "./types";

function readRequiredValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function savePrivacySettingsAction(formData: FormData) {
  const controllerName = readRequiredValue(formData, "controllerName");
  const controllerCountry = readRequiredValue(formData, "controllerCountry");
  const contactEmail = normalizeEmail(
    readRequiredValue(formData, "contactEmail"),
  );
  const privacyEmail = normalizeEmail(
    readRequiredValue(formData, "privacyEmail"),
  );
  const dpoEmailValue = normalizeEmail(readRequiredValue(formData, "dpoEmail"));
  const controllerAddress = readRequiredValue(formData, "controllerAddress");
  const representativeName = readRequiredValue(formData, "representativeName");
  const representativeTitle = readRequiredValue(formData, "representativeTitle");

  if (!controllerName || !controllerCountry || !contactEmail || !privacyEmail) {
    redirect(`${appRoutes.privacySettings}?error=missing-fields`);
  }

  if (
    !isValidEmail(contactEmail) ||
    !isValidEmail(privacyEmail) ||
    (dpoEmailValue && !isValidEmail(dpoEmailValue))
  ) {
    redirect(`${appRoutes.privacySettings}?error=invalid-email`);
  }

  await saveCurrentOwnerLegalProfile({
    controllerName,
    controllerCountry,
    contactEmail,
    privacyEmail,
    dpoEmail: dpoEmailValue || null,
    controllerAddress: controllerAddress || null,
    representativeName: representativeName || null,
    representativeTitle: representativeTitle || null,
  });

  revalidatePath(appRoutes.privacySettings);
  redirect(`${appRoutes.privacySettings}?saved=1`);
}

export async function acceptDpaAction(formData: FormData) {
  if (String(formData.get("accepted") ?? "") !== "true") {
    redirect(`${appRoutes.dpa}?error=acceptance-required`);
  }

  const profile = await getCurrentOwnerLegalProfile();
  if (!isOwnerDpaProfileComplete(profile)) {
    redirect(`${appRoutes.privacySettings}?error=dpa-fields-required`);
  }

  const config = getDpaConfig();
  if (!isDpaConfigComplete(config)) {
    redirect(`${appRoutes.dpa}?error=processor-config`);
  }

  const document = buildDpaDocument(profile, config);
  const displayedHash = readRequiredValue(formData, "documentHash");

  if (displayedHash !== document.documentHash) {
    redirect(`${appRoutes.dpa}?error=document-changed`);
  }

  const existing = await getCurrentDpaAcceptance(profile);
  if (!existing) {
    await recordCurrentDpaAcceptance(profile, document);
  }

  revalidatePath(appRoutes.privacySettings);
  revalidatePath(appRoutes.dpa);
  redirect(`${appRoutes.dpa}?accepted=1`);
}
