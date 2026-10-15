import Image from "next/image";
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
import { toStarRating, type RatingDistribution } from "@/modules/products/domain/review-distribution";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

import { formatRating } from "../domain/rating";
import { ReviewStars } from "./review-stars";

type ProductReview = {
  id: string;
  ratingTenths: number;
  comment: string | null;
  createdAt: Date;
  user: { name: string | null };
  media: { id: string; storageKey: string; mediaType: string; contentType: string }[];
};

const SECTION_ID = "avaliacoes";

export function ProductReviewsSection({
  slug,
  params,
  reviews,
  average,
  reviewCount,
  distribution,
  page,
  pageCount,
}: {
  slug: string;
  params: ProductInteractionParams;
  reviews: ProductReview[];
  average: number | null;
  reviewCount: number;
  /** Distribuição 5★…1★ calculada no servidor para o mesmo recorte do filtro. */
  distribution: RatingDistribution;
  page: number;
  pageCount: number;
}) {
  const pageHref = (reviewPage: number) =>
    buildProductInteractionHref(slug, params, { reviewPage }, SECTION_ID) as Route;
  const filtered = params.reviewRating !== null;

  return (
    <Card id={SECTION_ID} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl">Avaliações do produto</h2>
        </CardTitle>
        <CardDescription>Notas de compradores verificados do Moto Shop.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-5">
          {average !== null && reviewCount > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <p className="font-heading text-foreground text-5xl leading-none font-bold tracking-tight">
                  {formatRating(average)}
                  <span className="sr-only"> de 5</span>
                </p>
                <div className="min-w-0 space-y-1">
                  <ReviewStars rating={average} className="text-xl" />
                  <p className="text-muted-foreground text-sm">
                    {reviewCount} {reviewCount === 1 ? "avaliação" : "avaliações"}
                    {filtered ? " no filtro atual" : ""}
                  </p>
                </div>
              </div>
              <RatingBars distribution={distribution} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {filtered ? "Nenhuma avaliação com essa nota mínima." : "Este produto ainda não tem avaliações."}
            </p>
          )}
          {reviewCount > 0 || filtered ? (
            <form
              className="bg-surface-sunken grid gap-3 rounded-lg p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end lg:grid-cols-1"
              method="get"
              action={`#${SECTION_ID}`}
            >
              <label className="flex flex-col gap-1 text-sm font-medium">
                Nota mínima
                <DesignSelect
                  aria-label="Filtrar por nota"
                  className="h-10"
                  name="reviewRating"
                  defaultValue={params.reviewRating ?? ""}
                >
                  <option value="">Todas as notas</option>
                  {/* "1 estrela ou mais" would equal "Todas as notas", and 5 is the top: no "ou mais". */}
                  {[5, 4, 3, 2].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating === 5 ? "5 estrelas" : `${rating} estrelas ou mais`}
                    </option>
                  ))}
                </DesignSelect>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Ordenar avaliações
                <DesignSelect
                  aria-label="Ordenar avaliações"
                  className="h-10"
                  name="reviewSort"
                  defaultValue={params.reviewSort}
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                </DesignSelect>
              </label>
              {params.questionSort !== "newest" ? (
                <input type="hidden" name="questionSort" value={params.questionSort} />
              ) : null}
              {params.questionPage > 1 ? <input type="hidden" name="questionPage" value={params.questionPage} /> : null}
              {params.moto ? <input type="hidden" name="moto" value={params.moto} /> : null}
              <Button type="submit" variant="outline" className="h-10 px-4">
                Aplicar
              </Button>
            </form>
          ) : null}
        </div>
        <div className="min-w-0 space-y-4">
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {filtered
                ? "Tente outra nota mínima para ver mais avaliações."
                : "As primeiras avaliações aparecerão aqui após compras verificadas."}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {reviews.map((review) => (
                <li key={review.id} className="py-4 first:pt-0 last:pb-0">
                  <article>
                    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <ReviewStars rating={toStarRating(review.ratingTenths)} />
                      <span className="text-muted-foreground text-xs">
                        {review.user.name ?? "Cliente"} ·{" "}
                        <time dateTime={review.createdAt.toISOString()}>{formatDate(review.createdAt)}</time>
                      </span>
                    </header>
                    {review.comment ? <p className="text-foreground mt-2 text-sm leading-6">{review.comment}</p> : null}
                    <ReviewMedia media={review.media} />
                  </article>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            ariaLabel="Paginação de avaliações"
            page={page}
            pageCount={pageCount}
            previousHref={pageHref(page - 1)}
            nextHref={pageHref(page + 1)}
            className="pt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RatingBars({ distribution }: { distribution: RatingDistribution }) {
  return (
    <ul className="space-y-1.5" aria-label="Distribuição das notas">
      {distribution.map((bucket) => (
        <li key={bucket.stars} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {bucket.stars}
            <span aria-hidden="true"> ★</span>
            <span className="sr-only"> {bucket.stars === 1 ? "estrela" : "estrelas"}</span>
          </span>
          <span className="bg-muted relative h-2 overflow-hidden rounded-full" aria-hidden="true">
            <span
              className="bg-warning absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${bucket.percentage}%` }}
            />
          </span>
          <span className="text-muted-foreground text-right tabular-nums">
            {bucket.count}
            <span className="sr-only"> {bucket.count === 1 ? "avaliação" : "avaliações"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReviewMedia({ media }: { media: ProductReview["media"] }) {
  if (media.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Fotos e vídeos da avaliação">
      {media.map((item, index) => {
        const url = getPublicStorageUrl(item.storageKey);
        if (!url) return null;
        return (
          <li key={item.id}>
            {item.mediaType === "video" ? (
              <video
                controls
                preload="metadata"
                className="border-border max-h-56 max-w-full rounded-lg border bg-black"
              >
                <source src={url} type={item.contentType} />
                Seu navegador não consegue reproduzir este vídeo.
              </video>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir foto ${index + 1} da avaliação em nova aba`}
                className="border-border bg-surface-sunken focus-visible:ring-ring/50 relative block size-24 overflow-hidden rounded-lg border focus-visible:ring-3 focus-visible:outline-none"
              >
                <Image
                  src={url}
                  alt={`Foto ${index + 1} anexada à avaliação`}
                  fill
                  unoptimized
                  sizes="96px"
                  className="object-cover"
                />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
