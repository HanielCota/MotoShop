import { PageSkeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return <PageSkeleton rows={5} label="Carregando pedidos" />;
}
