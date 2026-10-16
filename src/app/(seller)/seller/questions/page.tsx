import Link from "next/link";
import type { Metadata, Route } from "next";
import { MessageCircleQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterDateRange, FilterForm, FilterSelect, FilterText } from "@/components/ui/filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { AnswerQuestionForm } from "@/modules/questions/components/answer-question-form";
import { listSellerQuestions } from "@/modules/questions/queries/questions";
import { loadSellerQuestionSearchParams, serializeSellerQuestionSearchParams } from "@/modules/questions/search-params";

export const metadata: Metadata = {
  title: "Perguntas · Central do Lojista",
  robots: { index: false, follow: false },
};

const basePath = "/seller/questions";
const questionFilterOptions = [
  { value: "ALL", label: "Todas as perguntas" },
  { value: "UNANSWERED", label: "Sem resposta" },
  { value: "ANSWERED", label: "Respondidas" },
];
const questionSortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigas" },
];

export default async function SellerQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const params = await loadSellerQuestionSearchParams(searchParams);
  const result = await listSellerQuestions(context.seller.id, {
    filter: params.questionFilter,
    q: params.questionQ,
    from: params.questionFrom,
    to: params.questionTo,
    sort: params.questionSort,
    page: params.questionPage,
  });
  const hasFilters = Boolean(
    params.questionQ || params.questionFrom || params.questionTo || params.questionFilter !== "ALL",
  );
  const pageHref = (page: number) =>
    serializeSellerQuestionSearchParams(basePath, { ...params, questionPage: page }) as Route;

  return (
    <>
      <PageHeader
        eyebrow="Atendimento"
        title="Perguntas dos clientes"
        description="Responda dúvidas publicamente para ajudar outros pilotos."
      />

      <details className="bg-card rounded-xl border p-4" open={hasFilters}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold [&::-webkit-details-marker]:hidden">
          Filtros das perguntas
        </summary>
        <div className="mt-3">
          <FilterForm resetHref={basePath} action={basePath} label="Filtrar perguntas">
            <FilterText
              label="Buscar pergunta"
              name="questionQ"
              value={params.questionQ}
              placeholder="Pergunta, produto ou e-mail completo"
            />
            <FilterSelect
              label="Exibir"
              name="questionFilter"
              value={params.questionFilter}
              options={questionFilterOptions}
            />
            <FilterDateRange
              fromName="questionFrom"
              toName="questionTo"
              from={params.questionFrom}
              to={params.questionTo}
            />
            <FilterSelect
              label="Ordenação"
              name="questionSort"
              value={params.questionSort}
              options={questionSortOptions}
            />
          </FilterForm>
        </div>
      </details>

      {result.questions.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title={hasFilters ? "Nenhuma pergunta encontrada" : "Ainda não há perguntas nos seus produtos."}
          description={
            hasFilters
              ? "Ajuste ou limpe os filtros para ver outras perguntas."
              : "Quando um cliente perguntar sobre um produto, a pergunta aparecerá aqui."
          }
          action={hasFilters ? { label: "Limpar filtros", href: basePath } : undefined}
        />
      ) : (
        <ul className="space-y-4">
          {result.questions.map((question) => (
            <li key={question.id}>
              <Card>
                <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/products/${question.product.slug}`}
                        className="text-brand-strong font-semibold hover:underline"
                      >
                        {question.product.name}
                      </Link>
                      {question.answer ? (
                        <Badge variant="success">Respondida</Badge>
                      ) : (
                        <Badge variant="warning">Sem resposta</Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {question.askedBy.name || "Cliente"} ·{" "}
                      <time dateTime={question.createdAt.toISOString()}>{formatDate(question.createdAt)}</time>
                    </span>
                  </div>
                  <p className="mt-3 text-base font-medium">{question.question}</p>
                  <AnswerQuestionForm questionId={question.id} currentAnswer={question.answer} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        ariaLabel="Paginação de perguntas"
        page={result.page}
        pageCount={result.pageCount}
        previousHref={pageHref(result.page - 1)}
        nextHref={pageHref(result.page + 1)}
        summary={
          <>
            {result.total} {result.total === 1 ? "pergunta" : "perguntas"}
          </>
        }
      />
    </>
  );
}
