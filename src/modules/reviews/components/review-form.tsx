"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Textarea } from "@/components/ui/textarea";
import { findImageFileProblem, uploadFileToImageKit } from "@/shared/storage/upload-image";
import {
  createReviewAction,
  createReviewUploadUrlAction,
  removeReviewUploadAction,
  type ReviewActionState,
} from "@/modules/reviews/actions/review-actions";

import { useServerActionState } from "@/shared/forms/server-action-submit";

import { StarRatingInput } from "./star-rating-input";

const initialState: ReviewActionState = {};
type UploadedMedia = { key: string; fileId: string; contentType: string };

export function ReviewForm({
  orderItemId,
  sellerAlreadyReviewed,
}: {
  orderItemId: string;
  sellerAlreadyReviewed: boolean;
}) {
  const [state, formAction, pending] = useServerActionState(createReviewAction, initialState);
  const [productStars, setProductStars] = useState(5);
  const [sellerStars, setSellerStars] = useState(5);
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
      const problem = selected.map(findImageFileProblem).find((message) => message != null);
      if (problem != null) throw new Error(problem);
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
      {/* Stored in tenths so the schema stays as is; each review is a whole number of stars. */}
      <input type="hidden" name="productRatingTenths" value={productStars * 10} />
      {!sellerAlreadyReviewed ? <input type="hidden" name="sellerRating" value={sellerStars} /> : null}
      <input type="hidden" name="media" value="[]" />
      <p className="text-foreground text-sm font-semibold">Avalie sua compra</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <StarRatingInput
          label="Nota do produto"
          value={productStars}
          onValueChange={setProductStars}
          disabled={pending}
        />
        {!sellerAlreadyReviewed ? (
          <StarRatingInput label="Nota da loja" value={sellerStars} onValueChange={setSellerStars} disabled={pending} />
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
      <section aria-label="Fotos da avaliação" className="space-y-2">
        <p id={`review-files-label-${orderItemId}`} className="text-foreground block text-sm font-medium">
          Fotos <span className="text-muted-foreground font-normal">(opcional, até 3 imagens)</span>
        </p>
        <input
          id={`review-files-${orderItemId}`}
          aria-labelledby={`review-files-label-${orderItemId}`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
          className="peer-focus-visible:ring-ring/50 border-input bg-background hover:bg-muted inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-sm font-semibold transition-colors peer-focus-visible:ring-3 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          Selecionar fotos
        </label>
        <p className="text-muted-foreground text-xs">
          Imagens JPG, PNG ou WebP de até 5 MB cada. As fotos aparecem junto da avaliação.
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
