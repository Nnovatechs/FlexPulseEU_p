import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SurveyList } from "@/components/surveys/survey-list";
import { getSurveys } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

export default async function SurveysPage() {
  const surveys = await getSurveys();

  return (
    <div className="page-stack">
      <PageHeader
        title="Survey library"
        description="Draft, validated, and published surveys in a single structured view."
        actions={
          <Link href={appRoutes.surveyNew} className="button button--primary">
            Generate new survey
          </Link>
        }
      />

      <SurveyList surveys={surveys} />
    </div>
  );
}
