"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";
import { DesignSelect } from "@/components/ui/design-select";
import { uploadFileToImageKit } from "@/shared/storage/upload-image";
import {
  createReviewAction,
  createReviewUploadUrlAction,
  removeReviewUploadAction,
  type ReviewActionState,
} from "@/modules/reviews/actions/review-actions";

import { formatRating } from "../domain/rating";
import { useServerActionState } from "@/shared/forms/server-action-submit";

const initialState: ReviewActionState = {};
const allowedTypes: Record<string, number> = {
  "image/jpeg": 5 * 1024 * 1024,
  "image/png": 5 * 1024 * 1024,
  "image/webp": 5 * 1024 * 1024,
  "video/mp4": 10 * 1024 * 1024,
  "video/webm": 10 * 1024 * 1024,
  "video/quicktime": 10 * 1024 * 1024,
};
type UploadedMedia = { key: string; fileId: string; contentType: string };

export function ReviewForm({
  orderItemId,
  sellerAlreadyReviewed,
}: {
  orderItemId: string;
  sellerAlreadyReviewed: boolean;
}) {
  const [state, formAction, pending] = useServerActionState(createReviewAction, initialState);
  const [ratingTenths, setRatingTenths] = useState(50);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const uploadsToCleanup = useRef<UploadedMedia[]>([]);

  useEffect(() => {
    if (state.error && uploadsToCleanup.current.length) {
      const uploads = uploadsToCleanup.current;
      uploadsToCleanup.current = [];
      void Promise.all(uploads.map(({ key }) => removeReviewUploadAction({ orderItemId, key })));
    }
    if (state.success) {
      uploadsToCleanup.current = [];
    }
  }, [orderItemId, state]);

  function selectFiles(selectedFiles: FileList | null) {
    if (!selectedFiles?.length) return;
    setUploadError(undefined);
    try {
      const selected = Array.from(selectedFiles);
      if (files.length + selected.length > 3) throw new Error("Anexe no máximo 3 arquivos por avaliação.");
      for (const file of selected) {
        const maxSize = allowedTypes[file.type];
        if (!maxSize) throw new Error("Use imagens JPG, PNG ou WebP, ou vídeos MP4, WebM e MOV.");
        if (file.size > maxSize)
          throw new Error(`O arquivo ${file.name} excede o limite de ${maxSize / 1024 / 1024} MB.`);
      }
      setFiles((current) => [...current, ...selected]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível selecionar o arquivo.");
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading) return;
    setUploadError(undefined);
    setUploading(true);
    const formData = new FormData(event.currentTarget);
    const uploaded: UploadedMedia[] = [];
    const uploadKeysToCleanup: string[] = [];
    try {
      for (const file of files) {
        const authorization = await createReviewUploadUrlAction({
          orderItemId,
          contentType: file.type,
          sizeInBytes: file.size,
        });
        if ("error" in authorization) throw new Error(authorization.error);
        uploadKeysToCleanup.push(authorization.key);
        const fileId = await uploadFileToImageKit({ url: authorization.url, fields: authorization.fields, file });
        uploaded.push({ key: authorization.key, fileId, contentType: file.type });
      }
      formData.set("media", JSON.stringify(uploaded));
      uploadsToCleanup.current = uploaded;
      formAction(formData);
    } catch (error) {
      await Promise.all(uploadKeysToCleanup.map((key) => removeReviewUploadAction({ orderItemId, key })));
      setUploadError(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={submitReview}
      className="border-moto-brand/30 bg-moto-brand-surface mt-4 space-y-4 rounded-xl border p-4"
    >
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="productRatingTenths" value={ratingTenths} />
      <input type="hidden" name="media" value="[]" />
      <p className="text-foreground text-sm font-semibold">Avalie sua compra</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-foreground text-sm font-medium" htmlFor={`product-rating-${orderItemId}`}>
          Nota do produto
          <div className="mt-2 flex items-center gap-3">
            <input
              id={`product-rating-${orderItemId}`}
              type="range"
              min={1}
              max={50}
              step={1}
              value={ratingTenths}
              onChange={(event) => setRatingTenths(Number(event.currentTarget.value))}
              aria-valuetext={`${formatRating(ratingTenths / 10)} de 5 estrelas`}
              className="review-rating-range min-h-10 flex-1"
            />
            <output
              htmlFor={`product-rating-${orderItemId}`}
              className="text-foreground min-w-16 font-semibold tabular-nums"
            >
              <span aria-hidden="true" className="text-warning">
                ★
              </span>{" "}
              {formatRating(ratingTenths / 10)}/5
            </output>
          </div>
        </label>
        {!sellerAlreadyReviewed ? (
          <label className="text-foreground text-sm font-medium">
            Nota do lojista
            <DesignSelect aria-label="Nota do lojista" name="sellerRating" required defaultValue="5" className="mt-2">
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
        aria-label="Comentário da avaliação"
        placeholder="Conte como foi sua experiência (opcional)"
        className="bg-card w-full"
      />
      <section aria-label="Fotos e vídeos da avaliação" className="space-y-2">
        <p id={`review-files-label-${orderItemId}`} className="text-foreground block text-sm font-medium">
          Fotos e vídeos <span className="text-muted-foreground font-normal">(opcional, até 3 arquivos)</span>
        </p>
        <input
          id={`review-files-${orderItemId}`}
          aria-labelledby={`review-files-label-${orderItemId}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          multiple
          disabled={pending || uploading || Boolean(state.success) || files.length >= 3}
          onChange={(event) => {
            selectFiles(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
          className="peer sr-only"
        />
        <label
          htmlFor={`review-files-${orderItemId}`}
          className="peer-focus-visible:ring-ring/50 border-input bg-background hover:bg-muted inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-semibold transition-colors peer-focus-visible:ring-3 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          Selecionar fotos ou vídeos
        </label>
        <p className="text-muted-foreground text-xs">
          Imagens até 5 MB e vídeos até 10 MB cada. Os arquivos serão exibidos junto da avaliação.
        </p>
        {files.length && !state.success ? (
          <ul className="space-y-1 text-sm" aria-label="Arquivos anexados">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className="border-border bg-card flex items-center justify-between gap-2 rounded-md border py-1 pr-1 pl-3"
              >
                <span className="min-w-0 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`Remover ${file.name}`}
                  className={buttonVariants({ variant: "link-muted", size: "link" })}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {uploading ? (
          <p role="status" className="text-muted-foreground text-sm">
            Enviando arquivos e publicando avaliação…
          </p>
        ) : null}
        <FormMessage error={uploadError ?? null} />
      </section>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
      <Button type="submit" size="lg" disabled={pending || uploading || Boolean(state.success)} className="px-4">
        {pending ? "Publicando..." : uploading ? "Enviando arquivos..." : "Publicar avaliação"}
      </Button>
    </form>
  );
}
