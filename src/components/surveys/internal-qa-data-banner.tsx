import { DASHBOARD_QA_BANNER } from "@/features/surveys/dashboard-qa/constants";

export function InternalQaDataBanner() {
  return (
    <div className="notice notice--warning" role="status">
      {DASHBOARD_QA_BANNER}
    </div>
  );
}
