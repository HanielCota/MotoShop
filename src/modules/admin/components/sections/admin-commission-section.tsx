import { InlineNotice } from "@/components/ui/inline-notice";

import { getCompanyContact } from "../../application/company-contact";
import { getStoredMarketplaceLimits } from "../../application/marketplace-limits";
import { getMarketplaceConfiguration } from "../../queries/marketplace-configuration";
import { companyContactFormValues } from "../../schemas/company-contact";
import { marketplaceLimitsFormValues } from "../../schemas/marketplace-limits";
import { AdminCard } from "../admin-ui";
import { CommissionForm } from "../commission-form";
import { CompanyContactForm } from "../company-contact-form";
import { MarketplaceLimitsForm } from "../marketplace-limits-form";

/** Admin › Configurações: one card per group, each saved on its own. */
export async function AdminCommissionSection() {
  const [configuration, companyContact, storedLimits] = await Promise.all([
    getMarketplaceConfiguration(),
    getCompanyContact(),
    getStoredMarketplaceLimits(),
  ]);

  return (
    <div className="space-y-6">
      <AdminCard
        id="admin-commission"
        title="Comissão do marketplace"
        description="Defina a comissão padrão em percentual, com até duas casas decimais. Comissões individuais de lojistas continuam valendo."
      >
        {configuration == null ? (
          <InlineNotice tone="warning" role="status">
            A comissão padrão ainda não foi configurada. O checkout depende desta definição.
          </InlineNotice>
        ) : null}
        <CommissionForm defaultCommissionBps={configuration?.defaultCommissionBps ?? null} />
      </AdminCard>
      <AdminCard
        id="admin-company-contact"
        title="Empresa e contato"
        description="Aparece no rodapé do site e no rodapé dos e-mails. Campo em branco usa o texto de hoje."
      >
        <CompanyContactForm defaultValues={companyContactFormValues(companyContact)} />
      </AdminCard>
      <AdminCard
        id="admin-limits"
        title="Limites"
        description="Valem a partir de agora para lojas e clientes. Campo em branco usa o valor de hoje, que aparece cinza dentro do campo."
      >
        <MarketplaceLimitsForm defaultValues={marketplaceLimitsFormValues(storedLimits)} />
      </AdminCard>
    </div>
  );
}
