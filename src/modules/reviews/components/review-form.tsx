"use client";
import { Textarea } from "@/components/ui/textarea";

import { DesignSelect } from "@/components/ui/design-select";

import { useActionState } from "react";

import { createReviewAction, type ReviewActionState } from "@/modules/reviews/actions/review-actions";

const initialState: ReviewActionState = {};

export function ReviewForm({
  orderItemId,
  sellerAlreadyReviewed,
}: {
  orderItemId: string;
  sellerAlreadyReviewed: boolean;
}) {
  const [state, formAction, pending] = useActionState(createReviewAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3 rounded-xl border border-orange-100 bg-orange-50/60 p-4">
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <p className="text-sm font-semibold text-slate-900">Avalie sua compra</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-700">
          Produto
          <DesignSelect
            aria-label="Produto"
            name="productRating"
            required
            defaultValue="5"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} estrela{rating === 1 ? "" : "s"}
              </option>
            ))}
          </DesignSelect>
        </label>
        {!sellerAlreadyReviewed ? (
          <label className="text-sm text-slate-700">
            Seller
            <DesignSelect
              aria-label="Seller"
              name="sellerRating"
              required
              defaultValue="5"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} estrela{rating === 1 ? "" : "s"}
                </option>
              ))}
            </DesignSelect>
          </label>
        ) : null}
      </div>
      <Textarea
        name="comment"
        maxLength={1000}
        rows={3}
        placeholder="Conte como foi sua experiência (opcional)"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Publicando..." : "Publicar avaliação"}
      </button>
    </form>
  );
}
