import { InlineNotice } from "@/components/ui/inline-notice";

import { getCompanyContact } from "../../application/company-contact";
import { getMarketplaceConfiguration } from "../../queries/marketplace-configuration";
import { companyContactFormValues } from "../../schemas/company-contact";
import { AdminCard } from "../admin-ui";
import { CommissionForm } from "../commission-form";
import { CompanyContactForm } from "../company-contact-form";

/** Admin › Configurações: one card per group, each saved on its own. */
export async function AdminCommissionSection() {
  const [configuration, companyContact] = await Promise.all([getMarketplaceConfiguration(), getCompanyContact()]);

  return (
    <div className="space-y-6">
      <AdminCard
        id="admin-commission"
        title="Comissão do marketplace"
        description="Defina a comissão padrão em percentual, com até duas casas decimais. Comissões individuais de lojistas continuam valendo."
      >
        {!configuration ? (
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
    </div>
  );
}
