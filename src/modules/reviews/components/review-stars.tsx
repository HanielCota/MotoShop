import { formatRating } from "../domain/rating";

/** Estrelas parciais (0–5) com rótulo acessível em pt-BR. */
export function ReviewStars({ rating, className }: { rating: number; className?: string }) {
  const percentage = Math.max(0, Math.min(rating / 5, 1)) * 100;
  return (
    <span className={className} role="img" aria-label={`${formatRating(rating)} de 5 estrelas`}>
      <span aria-hidden="true" className="text-border relative inline-block leading-none whitespace-nowrap">
        ★★★★★
        <span
          className="text-warning absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
          style={{ width: `${percentage}%` }}
        >
          ★★★★★
        </span>
      </span>
    </span>
  );
}
