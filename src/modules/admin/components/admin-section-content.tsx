import type { ComponentType } from "react";

import type { adminWorkspaceSections } from "../admin-sections";
import { AdminAuditSection } from "./sections/admin-audit-section";
import { AdminCancellationsSection } from "./sections/admin-cancellations-section";
import { AdminCatalogSection } from "./sections/admin-catalog-section";
import { AdminCommissionSection } from "./sections/admin-commission-section";
import { AdminCouponsSection } from "./sections/admin-coupons-section";
import { AdminDisputesSection } from "./sections/admin-disputes-section";
import { AdminEmailsSection } from "./sections/admin-emails-section";
import { AdminIntegrationsSection } from "./sections/admin-integrations-section";
import { AdminOrdersSection } from "./sections/admin-orders-section";
import { AdminProductsSection } from "./sections/admin-products-section";
import { AdminReturnsSection } from "./sections/admin-returns-section";
import { AdminSellersSection } from "./sections/admin-sellers-section";
import { AdminVipSection } from "./sections/admin-vip-section";
import { AdminWebhooksSection } from "./sections/admin-webhooks-section";
import type { AdminSearchParams, AdminSectionProps } from "./sections/types";

type AdminWorkspaceSection = (typeof adminWorkspaceSections)[number];

/** Cada seção é um server component independente que carrega os próprios filtros e dados. */
const sectionComponents: Record<AdminWorkspaceSection, ComponentType<AdminSectionProps>> = {
  sellers: AdminSellersSection,
  products: AdminProductsSection,
  catalog: AdminCatalogSection,
  coupons: AdminCouponsSection,
  vip: AdminVipSection,
  commission: AdminCommissionSection,
  orders: AdminOrdersSection,
  cancellations: AdminCancellationsSection,
  returns: AdminReturnsSection,
  disputes: AdminDisputesSection,
  integrations: AdminIntegrationsSection,
  webhooks: AdminWebhooksSection,
  emails: AdminEmailsSection,
  audit: AdminAuditSection,
};

export default function AdminSectionContent({
  section,
  searchParams,
}: {
  section: AdminWorkspaceSection;
  searchParams: AdminSearchParams;
}) {
  const Section = sectionComponents[section];
  return <Section searchParams={searchParams} />;
}
