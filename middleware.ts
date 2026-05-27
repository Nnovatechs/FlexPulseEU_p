import { NextResponse, type NextRequest } from "next/server";
import { appRoutes } from "@/lib/config/routes";
import { updateSession } from "@/lib/supabase/middleware";

const publicRoutes = new Set<string>(["/", appRoutes.login]);

function isPublicSurveyRoute(pathname: string): boolean {
  return /^\/s\/[^/]+(?:\/thank-you)?\/?$/.test(pathname);
}

function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  return target;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, user } = await updateSession(request);
  const isPublicRoute =
    publicRoutes.has(pathname) ||
    pathname.startsWith("/auth") ||
    isPublicSurveyRoute(pathname);

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = appRoutes.login;
    loginUrl.searchParams.set("next", pathname);

    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (user && (pathname === "/" || pathname === appRoutes.login)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = appRoutes.dashboard;
    dashboardUrl.searchParams.delete("next");

    return copyCookies(response, NextResponse.redirect(dashboardUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
