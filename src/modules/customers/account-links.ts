import type { Route } from "next";
import { Heart, KeyRound, MapPin, UserRound } from "lucide-react";
import { domainIcons } from "@/shared/presentation/domain-icons";

/** Customer area shortcuts, shared by the header account menu and the account side navigation. */
export const customerAccountLinks = [
  { href: "/orders", label: "Meus pedidos", icon: domainIcons.order },
  { href: "/favorites", label: "Favoritos", icon: Heart },
  { href: "/account/profile", label: "Dados cadastrais", icon: UserRound },
  { href: "/account/password", label: "Redefinir senha", icon: KeyRound },
  { href: "/account/addresses", label: "Meus endereços", icon: MapPin },
] as const satisfies ReadonlyArray<{ href: Route; label: string; icon: unknown }>;
