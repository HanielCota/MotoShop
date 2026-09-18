import Link from "next/link";
import type { Route } from "next";

import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { AnswerQuestionForm } from "@/modules/questions/components/answer-question-form";
import { listSellerQuestions } from "@/modules/questions/queries/questions";
import { loadSellerQuestionSearchParams } from "@/modules/questions/search-params";

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

  function pageHref(page: number): Route {
    const query = new URLSearchParams();
    if (params.questionFilter !== "ALL") query.set("questionFilter", params.questionFilter);
    if (params.questionQ) query.set("questionQ", params.questionQ);
    if (params.questionFrom) query.set("questionFrom", params.questionFrom);
    if (params.questionTo) query.set("questionTo", params.questionTo);
    if (params.questionSort !== "newest") query.set("questionSort", params.questionSort);
    if (page > 1) query.set("questionPage", String(page));
    const serialized = query.toString();
    return (serialized ? `/seller/questions?${serialized}` : "/seller/questions") as Route;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-orange-600 uppercase">Central do lojista</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Perguntas dos clientes</h1>
          <p className="mt-2 text-slate-600">Responda dúvidas publicamente para ajudar outros pilotos.</p>
        </div>
        <Link href="/seller" className="text-sm font-semibold text-orange-700 hover:text-orange-800">
          Voltar ao painel
        </Link>
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        method="get"
      >
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Buscar pergunta
          <input
            name="questionQ"
            defaultValue={params.questionQ ?? ""}
            placeholder="Pergunta, produto ou e-mail"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Exibir
          <select
            name="questionFilter"
            defaultValue={params.questionFilter}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="ALL">Todas as perguntas</option>
            <option value="UNANSWERED">Sem resposta</option>
            <option value="ANSWERED">Respondidas</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          De
          <input name="questionFrom" type="date" defaultValue={params.questionFrom ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Até
          <input name="questionTo" type="date" defaultValue={params.questionTo ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Ordenação
          <select name="questionSort" defaultValue={params.questionSort} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </label>
        <button className="h-10 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>

      {result.questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Ainda não há perguntas nos seus produtos.
        </div>
      ) : (
        <div className="space-y-4">
          {result.questions.map((question) => (
            <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link
                  href={`/products/${question.product.slug}`}
                  className="font-semibold text-orange-700 hover:underline"
                >
                  {question.product.name}
                </Link>
                <span className="text-slate-500">
                  {question.askedBy.name ?? question.askedBy.email} · {question.createdAt.toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="mt-3 text-base font-medium text-slate-950">{question.question}</p>
              <AnswerQuestionForm questionId={question.id} currentAnswer={question.answer} />
            </article>
          ))}
        </div>
      )}
      {result.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginação de perguntas">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-slate-500">
            Página {result.page} de {result.pageCount} · {result.total} pergunta(s)
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
