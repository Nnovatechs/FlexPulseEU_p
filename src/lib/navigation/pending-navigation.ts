import { appRoutes } from "@/lib/config/routes";

export type PendingNavigationCopy = {
  title: string;
  description: string;
};

export const creatingSurveyCopy: PendingNavigationCopy = {
  title: "Creating survey",
  description: "Opening the editor…",
};

function pathnameOf(href: string) {
  return href.split(/[?#]/)[0] ?? href;
}

export function getPendingNavigationCopy(
  href: string,
): PendingNavigationCopy | null {
  const path = pathnameOf(href);

  if (path === appRoutes.dashboard || path === appRoutes.surveys) {
    return {
      title: "Opening workspace",
      description: "Loading your surveys…",
    };
  }

  if (path === appRoutes.surveyNew) {
    return {
      title: "Opening new survey",
      description: "Getting the form ready…",
    };
  }

  if (/^\/surveys\/[^/]+\/analytics(?:-v2)?$/.test(path)) {
    return {
      title: "Opening analytics",
      description: "Loading survey analytics…",
    };
  }

  if (/^\/surveys\/[^/]+\/edit$/.test(path)) {
    return {
      title: "Opening survey",
      description: "Loading the editor…",
    };
  }

  if (/^\/surveys\/[^/]+$/.test(path)) {
    return {
      title: "Opening survey",
      description: "Loading the survey…",
    };
  }

  return null;
}
