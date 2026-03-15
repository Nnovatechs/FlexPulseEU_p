import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { appRoutes } from "@/lib/config/routes";

const conceptOptions = [
  "Trusting Automation",
  "Thermal Comfort Zones",
  "Flexibility Necessities",
  "Heat Pump Adoption",
  "EV Charging Behaviour",
];

const languageOptions = ["English", "Croatian", "French", "Spanish", "Italian"];

export default function NewSurveyPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Generation flow"
        title="Create a new survey"
        description="This mockup models the first structured step: choose stakeholder, define source and respondent languages, and select ontology concepts."
      />

      <section className="content-grid content-grid--form">
        <article className="surface-card">
          <h2>Survey generation inputs</h2>
          <div className="stack-form">
            <label className="field">
              <span>Stakeholder type</span>
              <select defaultValue="Household">
                <option>Household</option>
                <option>Prosumer</option>
                <option>Retailer</option>
                <option>DSO</option>
                <option>Policy maker</option>
              </select>
            </label>

            <label className="field">
              <span>Source language</span>
              <select defaultValue="English">
                {languageOptions.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Respondent languages</span>
              <div className="chip-grid">
                {languageOptions.map((language) => (
                  <label key={language} className="choice-chip">
                    <input type="checkbox" defaultChecked={language !== "Italian"} />
                    <span>{language}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <h2>Ontology concepts</h2>
          <p>
            These cards represent the future ontology-backed concept picker that
            will drive automatic question suggestion.
          </p>
          <div className="chip-grid">
            {conceptOptions.map((concept) => (
              <label key={concept} className="choice-chip choice-chip--selected">
                <input type="checkbox" defaultChecked />
                <span>{concept}</span>
              </label>
            ))}
          </div>

          <div className="callout-box">
            <strong>Generated outcome</strong>
            <p>
              The next backend-powered step will transform these inputs into a
              draft survey structure ready for editing and validation.
            </p>
          </div>

          <div className="button-row">
            <Link
              href={appRoutes.surveyEdit("survey-thermal-comfort-003")}
              className="button button--primary"
            >
              Generate draft mockup
            </Link>
            <Link href={appRoutes.surveys} className="button button--ghost">
              Cancel
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
