"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { saveCurrentOwnerLegalProfile } from "./repository";

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
  });

  revalidatePath(appRoutes.privacySettings);
  redirect(`${appRoutes.privacySettings}?saved=1`);
}
