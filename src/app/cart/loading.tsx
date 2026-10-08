import { PageSkeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return <PageSkeleton rows={3} label="Carregando carrinho" />;
}
