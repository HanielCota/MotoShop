import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModerateContentButton } from "@/modules/moderation/components/moderate-content-button";
import { listModerationQueue, type ModerationKind } from "@/modules/moderation/queries/moderation-queue";

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
  const params = await searchParams;
  const kind = kinds.find((item) => item.value === params.kind)?.value ?? "question";
  const requestedPage = Number(params.page ?? 1);
  const result = await listModerationQueue(kind, requestedPage);
  const href = (page: number) => `/admin/moderation?kind=${kind}&page=${page}` as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Moderação pública</h2>
        <p className="text-muted-foreground text-sm">
          Ocultar não apaga o registro da compra nem o histórico de auditoria.
        </p>
      </div>
      <nav aria-label="Tipo de conteúdo" className="flex flex-wrap gap-2">
        {kinds.map((item) => (
          <Link
            key={item.value}
            href={`/admin/moderation?kind=${item.value}`}
            aria-current={kind === item.value ? "page" : undefined}
            className="rounded-md border px-3 py-2 text-sm aria-[current=page]:bg-slate-900 aria-[current=page]:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Card>
        <CardHeader>
          <CardTitle>
            {kinds.find((item) => item.value === kind)?.label} ({result.total})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {result.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum conteúdo nesta fila.</p>
          ) : null}
          {result.items.map((item) => (
            <article key={item.id} className="flex flex-col justify-between gap-4 rounded-md border p-4 sm:flex-row">
              <div className="min-w-0 space-y-2">
                <p className="text-muted-foreground text-xs">
                  {item.context} · {new Intl.DateTimeFormat("pt-BR").format(item.createdAt)}
                </p>
                <p className="text-sm break-words">{item.text}</p>
                {item.detail ? (
                  <p className="text-muted-foreground text-sm break-words">Resposta: {item.detail}</p>
                ) : null}
                <span className="text-xs font-medium">{item.hidden ? "Oculto do público" : "Visível ao público"}</span>
              </div>
              <ModerateContentButton kind={kind} id={item.id} hidden={item.hidden} />
            </article>
          ))}
          <Pagination
            ariaLabel="Paginação da moderação"
            page={Math.min(result.page, result.pageCount)}
            pageCount={result.pageCount}
            previousHref={href(result.page - 1)}
            nextHref={href(result.page + 1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
