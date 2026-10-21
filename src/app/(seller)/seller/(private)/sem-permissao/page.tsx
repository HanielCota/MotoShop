import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { hasSellerPermission, sellerPermissions } from "@/modules/auth/domain/seller-permissions";
import { requireSellerDashboardContext } from "@/modules/sellers/application/get-seller-dashboard-context";
import { getSellerMemberRoleLabel } from "@/modules/sellers/domain/member-roles";
import { describePermissionDenied } from "@/modules/sellers/domain/permission-denied";

export const metadata: Metadata = {
  title: "Área restrita · Central do Lojista",
  robots: { index: false, follow: false },
};

const permissionSchema = z.enum(sellerPermissions);

/** Where a store member lands when their role does not cover the area they opened. */
export default async function SellerPermissionDeniedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSellerDashboardContext();
  const permission = permissionSchema.safeParse((await searchParams).permissao);
  // A missing or unknown permission, or one the member actually has, has nothing to explain.
  if (!permission.success || hasSellerPermission(context.membership.role, permission.data)) redirect("/seller");

  const message = describePermissionDenied(
    permission.data,
    getSellerMemberRoleLabel(context.membership.role),
    context.store.name,
  );

  return (
    <>
      <PageHeader eyebrow="Área restrita" title={message.title} description={message.description} />
      <Card>
        <CardContent>
          <Link href="/seller" className={buttonVariants({ size: "lg" })}>
            Voltar para a Central do Lojista
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
