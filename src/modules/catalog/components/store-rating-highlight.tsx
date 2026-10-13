import { formatRating } from "@/modules/reviews/domain/rating";

/** Store average shown large in the store header, linking to the reviews section. */
export function StoreRatingHighlight({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  if (!rating) return <span>Ainda sem avaliações</span>;

  const reviewLabel = `${reviewCount} ${reviewCount === 1 ? "avaliação" : "avaliações"}`;

  return (
    <a
      href="#avaliacoes-loja"
      aria-label={`Nota média da loja: ${formatRating(rating)} de 5, ${reviewLabel}`}
      className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 transition-colors hover:bg-white/15"
    >
      <span aria-hidden="true" className="text-moto-brand text-3xl leading-none">
        ★
      </span>
      <span aria-hidden="true" className="flex flex-col">
        <span className="text-3xl leading-none font-black text-white">
          {formatRating(rating)}
          <span className="text-base font-semibold text-white/70">/5</span>
        </span>
        <span className="text-xs text-white/70">nota média · {reviewLabel}</span>
      </span>
    </a>
  );
}
