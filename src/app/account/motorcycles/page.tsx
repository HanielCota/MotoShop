import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { MotorcycleGarage } from "@/modules/motorcycles/components/motorcycle-garage";
import { listActiveMotorcycleFitments } from "@/modules/motorcycles/queries/motorcycles";
import { listSavedMotorcycles } from "@/modules/motorcycles/queries/saved-motorcycles";

export default async function MyMotorcyclesPage() {
  const session = await requireAuthenticatedUser("/account/motorcycles");
  const [fitments, savedMotorcycles] = await Promise.all([
    listActiveMotorcycleFitments(),
    listSavedMotorcycles(session.user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <Badge variant="secondary">Minha conta</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Minhas motos</h1>
        <p className="text-muted-foreground mt-3">
          Guarde as configurações das suas motos. A principal aparece como atalho no catálogo e ajuda a conferir a
          compatibilidade dos produtos.
        </p>
        <Link
          href="/products"
          className="mt-4 inline-block text-sm font-medium text-[#bd4814] underline underline-offset-4"
        >
          Explorar catálogo
        </Link>
      </div>
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
    </main>
  );
}
