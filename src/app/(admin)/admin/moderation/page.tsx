import Link from "next/link";
import { MessageSquareOff } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { formatDate } from "@/lib/format";
import { AdminCard } from "@/modules/admin/components/admin-ui";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { ModerateContentButton } from "@/modules/moderation/components/moderate-content-button";
import { listModerationQueue, type ModerationKind } from "@/modules/moderation/queries/moderation-queue";
import { parseSearchParams, searchParam, type RawSearchParams } from "@/shared/validation/search-params";

export const metadata = { title: "Moderação · Admin" };

const kinds: { value: ModerationKind; label: string }[] = [
  { value: "question", label: "Perguntas" },
  { value: "product-review", label: "Avaliações de produtos" },
  { value: "seller-review", label: "Avaliações de lojas" },
];

const moderationSearchParams = {
  kind: searchParam(z.enum(["question", "product-review", "seller-review"] satisfies ModerationKind[]), "question"),
  page: searchParam(z.coerce.number().int().min(1), 1),
};

export default async function AdminModerationPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireAdminAccess();
  const { kind, page: requestedPage } = parseSearchParams(moderationSearchParams, await searchParams);
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
      {/* Abas do projeto: no celular a aba ativa fica centralizada e a borda esmaece quando há mais (DS-25). */}
      <ScrollableTabs
        aria-label="Tipo de conteúdo"
        activeKey={kind}
        wrapperClassName="-mx-1"
        className="gap-2 px-1 pb-1"
      >
        {kinds.map((item) => (
          <Link
            key={item.value}
            href={`/admin/moderation?kind=${item.value}`}
            aria-current={kind === item.value ? "page" : undefined}
            className="hover:bg-muted aria-[current=page]:bg-foreground aria-[current=page]:text-background inline-flex min-h-11 shrink-0 items-center rounded-md border px-3 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-9"
          >
            {item.label}
          </Link>
        ))}
      </ScrollableTabs>
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
