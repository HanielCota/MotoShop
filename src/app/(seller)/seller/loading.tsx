import { PageSkeleton } from "@/components/ui/skeleton";

export default function SellerLoading() {
  return <PageSkeleton rows={4} label="Carregando a Central do Lojista" />;
}
