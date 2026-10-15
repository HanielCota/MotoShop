import { EmptyState } from "@/components/ui/empty-state";
import { domainIcons } from "@/shared/presentation/domain-icons";

export default function OrderNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="sr-only">Pedido não encontrado</h1>
      <EmptyState
        icon={domainIcons.notFound}
        title="Pedido não encontrado"
        description="Confira o número do pedido. Se você comprou sem conta, abra o link seguro enviado por e-mail após o checkout."
        action={{ label: "Ver meus pedidos", href: "/orders" }}
      />
    </main>
  );
}
