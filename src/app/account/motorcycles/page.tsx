import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { MotorcycleGarage } from "@/modules/motorcycles/components/motorcycle-garage";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import {
  countCompatibleProductsByFitment,
  listSavedMotorcycles,
} from "@/modules/motorcycles/queries/saved-motorcycles";
import { CustomerAccountShell } from "@/modules/customers/components/customer-account-shell";

export const metadata: Metadata = {
  title: "Minhas motos",
  robots: { index: false, follow: false },
};

export default async function MyMotorcyclesPage() {
  const session = await requireAuthenticatedUser("/account/motorcycles");
  const [fitments, savedMotorcycles] = await Promise.all([
    listActiveMotorcycleFitments(),
    listSavedMotorcycles(session.user.id),
  ]);
  const compatibleCounts = await countCompatibleProductsByFitment(
    savedMotorcycles.map((saved) => saved.motorcycleFitmentId),
  );

  return (
    <CustomerAccountShell pathname="/account/motorcycles" userName={session.user.name}>
      <PageHeader
        eyebrow="Minha conta"
        title="Minhas motos"
        description="Guarde as configurações das suas motos. A principal aparece como atalho no catálogo e ajuda a conferir a compatibilidade dos produtos."
        actions={
          <Link
            href="/products"
            className="text-brand-strong inline-flex min-h-10 items-center text-sm font-medium underline underline-offset-4"
          >
            Explorar catálogo
          </Link>
        }
      />
      <MotorcycleGarage
        fitments={fitments.map((fitment) => ({
          id: fitment.id,
          label: `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name} · ${fitment.version || "padrão"} · ${fitment.displacementCc} cc · ${fitment.year}`,
        }))}
        savedMotorcycles={savedMotorcycles.map((saved) => ({
          id: saved.id,
          motorcycleFitmentId: saved.motorcycleFitmentId,
          manufacturer: saved.motorcycleFitment.motorcycleModel.manufacturer.name,
          model: saved.motorcycleFitment.motorcycleModel.name,
          version: saved.motorcycleFitment.version,
          year: saved.motorcycleFitment.year,
          compatibleProductCount: compatibleCounts.get(saved.motorcycleFitmentId) ?? 0,
          isPrimary: saved.isPrimary,
          available:
            saved.motorcycleFitment.motorcycleModel.active &&
            saved.motorcycleFitment.motorcycleModel.manufacturer.active,
          label: `${saved.motorcycleFitment.motorcycleModel.manufacturer.name} ${saved.motorcycleFitment.motorcycleModel.name} · ${saved.motorcycleFitment.version || "padrão"} · ${saved.motorcycleFitment.displacementCc} cc · ${saved.motorcycleFitment.year}`,
        }))}
      />
    </CustomerAccountShell>
  );
}
