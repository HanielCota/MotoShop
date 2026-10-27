import { PageSkeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return <PageSkeleton rows={4} label="Carregando finalização da compra" />;
}
