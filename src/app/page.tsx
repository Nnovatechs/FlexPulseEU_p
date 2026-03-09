import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";

export default function HomePage() {
  redirect(appRoutes.login);
}
