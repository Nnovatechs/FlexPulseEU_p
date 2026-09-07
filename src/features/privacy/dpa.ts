import { createHash } from "crypto";
import { getLegalConfig } from "@/lib/config/legal";
import {
  isOwnerDpaProfileComplete,
  type OwnerLegalProfile,
} from "./types";

export const DPA_ACCEPTANCE_STATEMENT =
  "I confirm that I am authorised to accept this Data Processing Agreement on behalf of the Controller identified above.";
export const DPA_DOCUMENT_VERSION = "1.0";

export type DpaConfig = {
  required: boolean;
  version: string;
  processorName: string;
  processorAddress: string;
  processorPrivacyEmail: string;
};

export type DpaDocument = {
  title: "Data Processing Agreement";
  version: string;
  controller: {
    legalName: string;
    address: string;
    country: string;
    representativeName: string;
    representativeTitle: string;
    contactEmail: string;
    privacyEmail: string;
  };
  processor: {
    legalName: string;
    address: string;
    privacyEmail: string;
  };
  sections: Array<{
    title: string;
    paragraphs: string[];
    items?: string[];
  }>;
  documentHash: string;
};

export function getDpaConfig(): DpaConfig {
  const legal = getLegalConfig();
  const requiredValue = process.env.DPA_REQUIRED?.trim().toLowerCase();

  return {
    required: requiredValue === "1" || requiredValue === "true",
    version: DPA_DOCUMENT_VERSION,
    processorName: legal.processorName,
    processorAddress: legal.processorAddress,
    processorPrivacyEmail: legal.privacyEmail,
  };
}

export function getMissingDpaConfigFields(config: DpaConfig) {
  const missing: string[] = [];
  if (!config.processorName.trim()) {
    missing.push("processor name");
  }
  if (!config.processorAddress.trim()) {
    missing.push("processor registered address");
  }
  if (!config.processorPrivacyEmail.trim()) {
    missing.push("processor privacy email");
  }
  return missing;
}

export function isDpaConfigComplete(config: DpaConfig) {
  return Boolean(config.version.trim()) && getMissingDpaConfigFields(config).length === 0;
}

function buildDocumentPayload(
  profile: OwnerLegalProfile,
  config: DpaConfig,
): Omit<DpaDocument, "documentHash"> {
  if (!isOwnerDpaProfileComplete(profile)) {
    throw new Error("Controller DPA details are incomplete.");
  }

  if (!isDpaConfigComplete(config)) {
    throw new Error("Hosted DPA configuration is incomplete.");
  }

  return {
    title: "Data Processing Agreement",
    version: config.version,
    controller: {
      legalName: profile.controllerName,
      address: profile.controllerAddress as string,
      country: profile.controllerCountry,
      representativeName: profile.representativeName as string,
      representativeTitle: profile.representativeTitle as string,
      contactEmail: profile.contactEmail,
      privacyEmail: profile.privacyEmail,
    },
    processor: {
      legalName: config.processorName,
      address: config.processorAddress,
      privacyEmail: config.processorPrivacyEmail,
    },
    sections: [
      {
        title: "1. Purpose and scope",
        paragraphs: [
          "This DPA governs processing by the Processor on behalf of the Controller in connection with the hosted FlexPulseEU survey service.",
          "The hosted processing is limited to survey creation and publication, public response collection, consent recording, contextual enrichment where enabled, semantic mapping, behavioural profiling, analytics, authenticated dashboard access, and instructed data export.",
        ],
      },
      {
        title: "2. Duration",
        paragraphs: [
          "This DPA applies while the Processor processes personal data for the Controller through the hosted service. It ends when the processing services end and the personal data have been returned or deleted in accordance with the Controller's documented instructions, unless applicable law requires retention.",
          "This DPA does not itself create a service-level, uptime, long-term hosting, maintenance, or post-project support commitment.",
        ],
      },
      {
        title: "3. Roles and documented instructions",
        paragraphs: [
          "The Controller determines the purposes and essential means of processing. The Processor processes personal data only on documented instructions from the Controller, including instructions expressed through the configured use of the hosted platform, unless applicable law requires otherwise.",
          "The Processor shall inform the Controller before legally required processing where permitted, and shall immediately inform the Controller if, in its opinion, an instruction infringes applicable data protection law.",
        ],
      },
      {
        title: "4. Data and data subjects",
        paragraphs: [
          "Data subjects may include survey participants, household respondents, stakeholders, research participants, or other individuals invited by the Controller.",
        ],
        items: [
          "Survey responses, selected language, timestamps, and submission metadata.",
          "Country and postal code where enabled, subject to configured raw-data cleanup.",
          "Consent and privacy acknowledgement metadata.",
          "Mapped behavioural outputs and profile descriptors.",
          "Technical records needed to secure and operate the hosted workflow.",
        ],
      },
      {
        title: "5. Excluded data and Controller obligations",
        paragraphs: [
          "The Controller shall maintain an appropriate lawful basis, provide or approve respondent-facing information, define the survey purpose and audience, and avoid unnecessary personal data.",
          "The Controller shall not intentionally collect direct identifiers, financial account data, exact home addresses, or special-category data under Article 9 GDPR through the hosted service unless the Parties separately agree in writing on the purpose and additional safeguards.",
        ],
      },
      {
        title: "6. Processor obligations",
        paragraphs: [
          "The Processor shall ensure confidentiality of authorised persons; implement appropriate technical and organisational measures; assist with data-subject requests, security obligations, data protection impact assessments, and prior consultations taking into account the nature of processing and information available; notify relevant personal-data breaches without undue delay; and provide information reasonably necessary to demonstrate compliance.",
          "At the Controller's choice, the Processor shall return or delete personal data and existing copies at the end of processing unless applicable law requires retention.",
        ],
      },
      {
        title: "7. Security measures",
        paragraphs: [
          "Measures for the hosted service include restricted authenticated administration, ownership-based access controls, server-side enforcement of sensitive operations, row-level database security, protected service credentials, HTTPS/TLS, consent evidence, separation of public and authenticated access, bot protection where enabled, managed backup capabilities, data minimisation, and configured cleanup of temporary raw location inputs.",
        ],
      },
      {
        title: "8. Subprocessors",
        paragraphs: [
          "The Controller gives general written authorisation for the subprocessors listed below. The Processor shall impose substantially equivalent data-protection obligations, remains responsible for their performance as required by Article 28 GDPR, and shall give reasonable notice of intended material changes so the Controller can object on reasonable data-protection grounds.",
        ],
        items: [
          "Supabase — database, authentication, and backend infrastructure.",
          "Vercel — application hosting and delivery.",
          "Cloudflare Turnstile — bot prevention and submission security where enabled.",
          "Open-Meteo — regional geocoding and contextual enrichment where enabled.",
          "OpenAI or a configured compatible provider — survey generation, validation, and translation at design time; respondent answers are not sent to an LLM by the current response-mapping runtime.",
        ],
      },
      {
        title: "9. International transfers",
        paragraphs: [
          "Where processing involves a transfer outside the EEA, the Processor shall use a lawful transfer mechanism applicable to the relevant subprocessor, such as an adequacy decision or Standard Contractual Clauses, and make relevant information available to the Controller.",
        ],
      },
      {
        title: "10. Data-subject rights and personal-data breaches",
        paragraphs: [
          "The Controller is responsible for responding to data-subject requests. The Processor shall provide reasonable technical assistance where the relevant response can be identified.",
          "After becoming aware of a personal-data breach affecting Controller data, the Processor shall notify the Controller without undue delay and provide available information on its nature, affected data, likely consequences, and mitigation.",
        ],
      },
      {
        title: "11. Audit and compliance information",
        paragraphs: [
          "The Processor shall make information reasonably necessary to demonstrate Article 28 compliance available to the Controller and allow proportionate audits, including inspections, by the Controller or its mandated auditor. Documentation review should be preferred where sufficient. Reasonable notice, confidentiality, and security constraints apply except where urgency or a competent authority requires otherwise.",
        ],
      },
      {
        title: "12. Final terms",
        paragraphs: [
          "This DPA does not alter liability allocations or commercial terms agreed separately by the Parties, and nothing excludes liability where exclusion is prohibited by applicable law.",
          "Electronic acceptance forms a written agreement for the purposes of Article 28(9) GDPR. The accepting person confirms authority to bind the Controller.",
        ],
      },
    ],
  };
}

export function buildDpaDocument(
  profile: OwnerLegalProfile,
  config = getDpaConfig(),
): DpaDocument {
  const payload = buildDocumentPayload(profile, config);
  const documentHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  return { ...payload, documentHash };
}
