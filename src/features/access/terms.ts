import { createHash } from "crypto";
import { getLegalConfig } from "@/lib/config/legal";
import { TERMS_DOCUMENT_VERSION } from "./terms-config";

export const TERMS_ACCEPTANCE_STATEMENT =
  "I have read and accept the current Platform Access Terms.";

export type TermsDocument = {
  title: "Platform Access Terms";
  version: string;
  appliesTo: string;
  contactEmail: string;
  sections: Array<{
    title: string;
    paragraphs: string[];
    items?: string[];
  }>;
  documentHash: string;
};

function getAppName() {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || "FlexPulseEU";
}

function buildTermsDocumentPayload(): Omit<TermsDocument, "documentHash"> {
  const legal = getLegalConfig();
  const appName = getAppName();

  return {
    title: "Platform Access Terms",
    version: TERMS_DOCUMENT_VERSION,
    appliesTo: `${appName} hosted Stage 3 environment`,
    contactEmail: legal.privacyEmail,
    sections: [
      {
        title: "1. Purpose of access",
        paragraphs: [
          `Access to the ${appName} hosted platform is provided for controlled Stage 3 review, testing, validation, and pilot-facing evaluation activities under the O-CEI Open Call project.`,
          "The hosted environment is intended to support stakeholder review, pilot-facing testing, collection of feedback, controlled survey execution, and assessment of dashboard and interoperability workflows.",
          `The platform is made available to authorised users in order to review the implemented workflows, configure and test survey scenarios, inspect generated behavioural outputs, provide feedback, and support the preparation of the final Stage 3 deliverables.`,
          "Access to the hosted environment does not constitute a commercial software service, a production SaaS subscription, or a long-term hosting commitment.",
        ],
      },
      {
        title: "2. Authorised users",
        paragraphs: [
          "Access is limited to authorised project users, pilot stakeholders, reviewers, and invited collaborators.",
          "Users must not share their login credentials, transfer their account to another person, or allow unauthorised third parties to access the platform through their account.",
          "The project team may suspend, limit, or revoke access where this is necessary for security, data protection, system integrity, or project management reasons.",
        ],
      },
      {
        title: "3. Permitted use",
        paragraphs: [
          `The platform may be used only for activities related to ${appName} Stage 3 validation and pilot-facing evaluation, including:`,
        ],
        items: [
          "reviewing the hosted platform workflow;",
          "configuring, testing, and validating survey scenarios;",
          "generating and reviewing behavioural survey artefacts;",
          "collecting controlled survey responses where appropriate;",
          "inspecting behavioural mappings, profiles, dashboards, and exports;",
          "providing technical, operational, or methodological feedback.",
        ],
      },
      {
        title: "4. Data minimisation and prohibited content",
        paragraphs: [
          "Users must follow data minimisation and privacy-by-design principles when using the platform.",
          "Users must not intentionally enter, request, upload, or collect unnecessary personal data through the platform. In particular, users must not create surveys that request the following categories of data unless separately agreed in writing with appropriate safeguards:",
        ],
        items: [
          "names, email addresses, phone numbers, or direct contact details;",
          "exact home addresses;",
          "identification numbers;",
          "financial account details;",
          "health, biometric, genetic, political, religious, or other special-category data;",
          "any information that is not necessary for the behavioural flexibility use case.",
        ],
      },
      {
        title: "5. Survey respondents and consent",
        paragraphs: [
          "Where users distribute survey links to respondents, they are responsible for ensuring that distribution is appropriate for the intended validation or pilot-facing activity.",
          "Survey respondents must be provided with the applicable privacy information and consent mechanism before submitting responses. Users must not bypass, remove, or alter the consent and privacy mechanisms implemented in the platform.",
          "If a stakeholder uses the platform to collect real respondent data, the applicable controller/processor roles and any required data processing arrangements should be confirmed before wider dissemination.",
        ],
      },
      {
        title: "6. Hosted environment and availability",
        paragraphs: [
          `The ${appName} hosted environment is provided as a controlled project environment for Stage 3 validation, review, and pilot-facing evaluation.`,
          "During the Stage 3 project period, the project team will make reasonable efforts to keep the hosted environment available for authorised users, subject to ongoing development, testing, maintenance, security updates, and deployment activities.",
          "The hosted environment may be updated, modified, interrupted, or temporarily unavailable where reasonably necessary for technical, security, data protection, or project management reasons.",
          "Access under these terms does not by itself create a separate commercial hosting service, production service-level agreement, or indefinite maintenance obligation beyond the project period.",
        ],
      },
      {
        title: "7. Duration of access",
        paragraphs: [
          "Unless otherwise agreed in writing, controlled access to the hosted platform is provided for the duration of the Stage 3 activities, up to the submission of the final D3 deliverables on 30 September 2026.",
          "Where useful for review, feedback, continuity, or dissemination purposes, access may remain available for a reasonable period after the D3 submission at the discretion of the project team.",
          "Any continued operational use, production deployment, long-term hosting, maintenance, or support after the project period should be covered by a separate written agreement.",
        ],
      },
      {
        title: "8. Open-source code and hosted platform",
        paragraphs: [
          "The project may release project-specific software components as open-source code. The open-source code repository and the hosted platform environment are separate.",
          "The availability of open-source code does not grant unrestricted access to the hosted environment, hosted data, managed infrastructure, project secrets, or operational services.",
          "Use of the open-source code is governed by the applicable open-source licence. Use of the hosted environment is governed by these Platform Access Terms and any applicable project or data processing agreements.",
        ],
      },
      {
        title: "9. Security responsibilities",
        paragraphs: [
          "Users must use the platform responsibly and must not:",
        ],
        items: [
          "attempt to access data, surveys, responses, or accounts that they are not authorised to access;",
          "attempt to bypass authentication, authorisation, rate limits, consent flows, or security controls;",
          "test the platform with malicious payloads, automated abuse, scraping, or denial-of-service behaviour;",
          "disclose credentials, access links, or non-public project information to unauthorised parties.",
        ],
      },
      {
        title: "10. Feedback and project use",
        paragraphs: [
          "Users may provide feedback, comments, bug reports, suggestions, or pilot-related observations during the Stage 3 validation process.",
          `Such feedback may be used by the ${appName} project team to improve the platform, document validation activities, prepare project deliverables, and support future development or exploitation of the solution.`,
          "No confidential information should be submitted as feedback unless it is necessary and clearly identified as confidential.",
        ],
      },
      {
        title: "11. Limitation of use",
        paragraphs: [
          "The platform is provided for controlled project validation and pilot-facing review. It is not intended to be used as the sole basis for legal, regulatory, commercial, operational, or automated decision-making.",
          "Behavioural outputs generated by the platform should be interpreted as analytical and decision-support information, subject to validation, context, and appropriate human review.",
        ],
      },
      {
        title: "12. Changes to these terms",
        paragraphs: [
          "These Platform Access Terms may be updated where necessary for security, legal, operational, or project management reasons.",
          "If the terms are materially updated, users may be required to review and accept the updated version before continuing to use the hosted platform.",
        ],
      },
      {
        title: "13. Contact",
        paragraphs: [
          `For questions about platform access, acceptable use, data protection, or security matters related to the O-CEI project, contact the designated project lead or communication contact at ${legal.privacyEmail || "the designated project contact"}.`,
        ],
      },
    ],
  };
}

export function buildTermsDocument(): TermsDocument {
  const payload = buildTermsDocumentPayload();
  const documentHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  return { ...payload, documentHash };
}
