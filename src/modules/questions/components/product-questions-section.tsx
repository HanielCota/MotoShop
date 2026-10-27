import Link from "next/link";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DesignSelect } from "@/components/ui/design-select";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import {
  buildProductInteractionHref,
  type ProductInteractionParams,
} from "@/modules/products/domain/product-interaction-href";

import { AskQuestionForm } from "./ask-question-form";

type ProductQuestion = {
  id: string;
  question: string;
  answer: string | null;
  createdAt: Date;
  askedBy: { name: string | null };
};

const SECTION_ID = "perguntas";

// With ten questions or fewer, sorting them takes more room than it helps.
const MIN_QUESTIONS_FOR_SORT = 11;
export function ProductQuestionsSection({
  slug,
  productId,
  params,
  questions,
  questionCount,
  page,
  pageCount,
  signedIn,
}: {
  slug: string;
  productId: string;
  params: ProductInteractionParams;
  questions: ProductQuestion[];
  questionCount: number;
  page: number;
  pageCount: number;
  signedIn: boolean;
}) {
  const pageHref = (questionPage: number) =>
    buildProductInteractionHref(slug, params, { questionPage }, SECTION_ID) as Route;

  return (
    <Card id={SECTION_ID} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Dúvidas sobre o produto</CardTitle>
        <CardDescription>Perguntas de clientes e respostas da loja.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questionCount >= MIN_QUESTIONS_FOR_SORT || params.questionSort !== "newest" ? (
          <form
            className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-lg p-3"
            method="get"
            action={`#${SECTION_ID}`}
          >
            {params.reviewRating !== null ? (
              <input type="hidden" name="reviewRating" value={params.reviewRating} />
            ) : null}
            {params.reviewSort !== "newest" ? (
              <input type="hidden" name="reviewSort" value={params.reviewSort} />
            ) : null}
            {params.reviewPage > 1 ? <input type="hidden" name="reviewPage" value={params.reviewPage} /> : null}
            {params.moto ? <input type="hidden" name="moto" value={params.moto} /> : null}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ordenar perguntas
              <DesignSelect
                aria-label="Ordenar perguntas"
                className="h-10"
                name="questionSort"
                defaultValue={params.questionSort}
              >
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
              </DesignSelect>
            </label>
            <Button type="submit" variant="outline">
              Aplicar
            </Button>
          </form>
        ) : null}
        {questions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ainda não há perguntas. Seja o primeiro a perguntar.</p>
        ) : (
          <ul className="divide-border divide-y">
            {questions.map((question) => (
              <li key={question.id} className="py-4 first:pt-0 last:pb-0">
                <article>
                  <h3 className="font-sans text-sm font-semibold tracking-normal">{question.question}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {question.askedBy.name ?? "Cliente"} ·{" "}
                    <time dateTime={question.createdAt.toISOString()}>{formatDate(question.createdAt)}</time>
                  </p>
                  {question.answer ? (
                    <div className="bg-surface-sunken mt-3 rounded-lg p-3 text-sm">
                      <p className="text-foreground font-semibold">Resposta da loja</p>
                      <p className="text-foreground mt-1 leading-6">{question.answer}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-sm italic">Aguardando resposta da loja.</p>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          ariaLabel="Paginação de perguntas"
          page={page}
          pageCount={pageCount}
          previousHref={pageHref(page - 1)}
          nextHref={pageHref(page + 1)}
          className="pt-2"
        />
        {signedIn ? (
          <AskQuestionForm productId={productId} />
        ) : (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed p-4 text-sm">
            <Link
              href={`/login?next=${encodeURIComponent(`/products/${slug}#${SECTION_ID}`)}` as Route}
              className="text-brand-strong font-semibold underline underline-offset-4"
            >
              Entre na sua conta
            </Link>{" "}
            para fazer uma pergunta.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
