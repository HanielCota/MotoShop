import { InlineNotice } from "@/components/ui/inline-notice";

import { getMarketplaceConfiguration } from "../../queries/marketplace-configuration";
import { AdminCard } from "../admin-ui";
import { CommissionForm } from "../commission-form";

export async function AdminCommissionSection() {
  const configuration = await getMarketplaceConfiguration();

  return (
    <AdminCard
      id="admin-commission"
      title="Comissão do marketplace"
      description="Defina a comissão padrão em basis points (100 bps = 1%). Comissões individuais de lojistas continuam valendo."
    >
      {!configuration ? (
        <InlineNotice tone="warning" role="status">
          A comissão padrão ainda não foi configurada. O checkout depende desta definição.
        </InlineNotice>
      ) : null}
      <CommissionForm defaultCommissionBps={configuration?.defaultCommissionBps ?? null} />
    </AdminCard>
  );
}
