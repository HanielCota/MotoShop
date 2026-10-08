import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { MotorcycleGarage } from "@/modules/motorcycles/components/motorcycle-garage";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { listSavedMotorcycles } from "@/modules/motorcycles/queries/saved-motorcycles";
import { CustomerAccountNavigation } from "@/modules/customers/components/customer-account-navigation";

export default async function MyMotorcyclesPage() {
  const session = await requireAuthenticatedUser("/account/motorcycles");
  const [fitments, savedMotorcycles] = await Promise.all([
    listActiveMotorcycleFitments(),
    listSavedMotorcycles(session.user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CustomerAccountNavigation pathname="/account/motorcycles" />
        <div className="flex min-w-0 flex-col gap-8">
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
              isPrimary: saved.isPrimary,
              available:
                saved.motorcycleFitment.motorcycleModel.active &&
                saved.motorcycleFitment.motorcycleModel.manufacturer.active,
              label: `${saved.motorcycleFitment.motorcycleModel.manufacturer.name} ${saved.motorcycleFitment.motorcycleModel.name} · ${saved.motorcycleFitment.version || "padrão"} · ${saved.motorcycleFitment.displacementCc} cc · ${saved.motorcycleFitment.year}`,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
