import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { adminSections, isAdminWorkspaceSection } from "@/modules/admin/admin-sections";
import AdminSectionContent from "@/modules/admin/components/admin-section-content";
import { requireAdminAccess } from "@/modules/auth/application/authorization";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const definition = adminSections.find((item) => item.slug === section);
  return { title: definition ? `${definition.title} · Admin` : "Admin" };
}

export default async function AdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAccess();
  const { section } = await params;
  if (!isAdminWorkspaceSection(section)) notFound();

  const definition = adminSections.find((item) => item.slug === section);
  if (!definition) notFound();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={definition.group} title={definition.title} description={definition.description} />
      <AdminSectionContent section={section} searchParams={searchParams} />
    </div>
  );
}
