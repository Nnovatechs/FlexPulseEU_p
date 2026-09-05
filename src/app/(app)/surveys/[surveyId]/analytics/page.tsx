import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";

type SurveyAnalyticsPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyAnalyticsPage({
  params,
}: SurveyAnalyticsPageProps) {
  const { surveyId } = await params;
  redirect(appRoutes.surveyAnalyticsV2(surveyId));
}
