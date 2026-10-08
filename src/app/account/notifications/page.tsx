import type { Route } from "next";
import { redirect } from "next/navigation";

/** As preferências de e-mail agora ficam em "Dados cadastrais"; mantém links antigos funcionando. */
export default function NotificationPreferencesPage() {
  redirect("/account/profile#notificacoes" as Route);
}
