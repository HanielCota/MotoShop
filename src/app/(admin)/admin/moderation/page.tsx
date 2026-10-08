import Link from "next/link";
import { MessageSquareOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import { AdminCard } from "@/modules/admin/components/admin-ui";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { ModerateContentButton } from "@/modules/moderation/components/moderate-content-button";
import { listModerationQueue, type ModerationKind } from "@/modules/moderation/queries/moderation-queue";

export const metadata = { title: "Moderação · Admin" };

const kinds: { value: ModerationKind; label: string }[] = [
  { value: "question", label: "Perguntas" },
  { value: "product-review", label: "Avaliações de produtos" },
  { value: "seller-review", label: "Avaliações de lojas" },
];

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  await requireAdminAccess();
  const params = await searchParams;
  const kind = kinds.find((item) => item.value === params.kind)?.value ?? "question";
  const requestedPage = Number(params.page ?? 1);
  const result = await listModerationQueue(kind, requestedPage);
  const href = (page: number) => `/admin/moderation?kind=${kind}&page=${page}` as const;
  const kindLabel = kinds.find((item) => item.value === kind)?.label ?? "Conteúdo";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operação"
        title="Moderação pública"
        description="Ocultar não apaga o registro da compra nem o histórico de auditoria."
      />
      <nav aria-label="Tipo de conteúdo" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {kinds.map((item) => (
          <Link
            key={item.value}
            href={`/admin/moderation?kind=${item.value}`}
            aria-current={kind === item.value ? "page" : undefined}
            className="hover:bg-muted aria-[current=page]:bg-foreground aria-[current=page]:text-background shrink-0 rounded-md border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <AdminCard id="admin-moderation" title={`${kindLabel} (${result.total})`}>
        {result.items.length === 0 ? (
          <EmptyState
            icon={MessageSquareOff}
            title="Nenhum conteúdo nesta fila"
            description="Novas perguntas e avaliações aparecerão aqui para moderação."
          />
        ) : (
          <ul aria-label={kindLabel} className="flex flex-col gap-3">
            {result.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 space-y-2">
                  <p className="text-muted-foreground text-xs">
                    {item.context} · {formatDate(item.createdAt)}
                  </p>
                  <p className="text-sm break-words">{item.text}</p>
                  {item.detail ? (
                    <p className="text-muted-foreground text-sm break-words">Resposta: {item.detail}</p>
                  ) : null}
                  <Badge variant={item.hidden ? "neutral" : "success"}>
                    {item.hidden ? "Oculto do público" : "Visível ao público"}
                  </Badge>
                </div>
                <ModerateContentButton kind={kind} id={item.id} hidden={item.hidden} />
              </li>
            ))}
          </ul>
        )}
        <Pagination
          ariaLabel="Paginação da moderação"
          page={Math.min(result.page, result.pageCount)}
          pageCount={result.pageCount}
          previousHref={href(result.page - 1)}
          nextHref={href(result.page + 1)}
        />
      </AdminCard>
    </div>
  );
}
