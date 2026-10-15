import type { Route } from "next";
import { Heart, KeyRound, MapPin, PackageCheck, UserRound } from "lucide-react";

/** Customer area shortcuts, shared by the header account menu and the account side navigation. */
export const customerAccountLinks = [
  { href: "/orders", label: "Meus pedidos", icon: PackageCheck },
  { href: "/favorites", label: "Favoritos", icon: Heart },
  { href: "/account/profile", label: "Dados cadastrais", icon: UserRound },
  { href: "/account/password", label: "Alterar senha", icon: KeyRound },
  { href: "/account/addresses", label: "Meus endereços", icon: MapPin },
] as const satisfies ReadonlyArray<{ href: Route; label: string; icon: unknown }>;
