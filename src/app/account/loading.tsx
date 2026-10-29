import { PageSkeleton } from "@/components/ui/skeleton";

// Covers every page under /account (profile, password, addresses, motorcycles, notifications).
export default function AccountLoading() {
  return <PageSkeleton rows={3} label="Carregando sua conta" />;
}
