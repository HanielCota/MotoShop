import { PageSkeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return <PageSkeleton rows={5} label="Carregando área administrativa" />;
}
