import { PageSkeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return <PageSkeleton rows={4} label="Carregando pedido" />;
}
