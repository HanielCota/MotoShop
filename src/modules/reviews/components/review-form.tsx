"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { Textarea } from "@/components/ui/textarea";
import { DesignSelect } from "@/components/ui/design-select";
import { uploadFileToImageKit } from "@/shared/storage/upload-image";
import {
  createReviewAction,
  createReviewUploadUrlAction,
  removeReviewUploadAction,
  type ReviewActionState,
} from "@/modules/reviews/actions/review-actions";

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
  const [state, formAction, pending] = useActionState(createReviewAction, initialState);
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
    try {
      for (const file of files) {
        const authorization = await createReviewUploadUrlAction({
          orderItemId,
          contentType: file.type,
          sizeInBytes: file.size,
        });
        if ("error" in authorization) throw new Error(authorization.error);
        const fileId = await uploadFileToImageKit({ url: authorization.url, fields: authorization.fields, file });
        uploaded.push({ key: authorization.key, fileId, contentType: file.type });
      }
      formData.set("media", JSON.stringify(uploaded));
      uploadsToCleanup.current = uploaded;
      formAction(formData);
    } catch (error) {
      await Promise.all(uploaded.map(({ key }) => removeReviewUploadAction({ orderItemId, key })));
      setUploadError(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submitReview} className="border-moto-brand/20 bg-moto-brand/5 mt-4 space-y-4 rounded-xl border p-4">
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="productRatingTenths" value={ratingTenths} />
      <input type="hidden" name="media" value="[]" />
      <p className="text-sm font-semibold text-slate-900">Avalie sua compra</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-700" htmlFor={`product-rating-${orderItemId}`}>
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
              aria-valuetext={`${(ratingTenths / 10).toFixed(1).replace(".", ",")} de 5 estrelas`}
              className="review-rating-range min-h-10 flex-1"
            />
            <output
              htmlFor={`product-rating-${orderItemId}`}
              className="min-w-16 font-semibold text-slate-900 tabular-nums"
            >
              ★ {(ratingTenths / 10).toFixed(1).replace(".", ",")}/5
            </output>
          </div>
        </label>
        {!sellerAlreadyReviewed ? (
          <label className="text-sm text-slate-700">
            Nota do lojista
            <DesignSelect
              aria-label="Nota do lojista"
              name="sellerRating"
              required
              defaultValue="5"
              className="border-input bg-background mt-2 min-h-10 w-full rounded-lg border px-3 py-2"
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
        className="focus:border-moto-brand focus:ring-moto-brand/15 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2"
      />
      <section aria-label="Fotos e vídeos da avaliação" className="space-y-2">
        <p id={`review-files-label-${orderItemId}`} className="block text-sm font-medium text-slate-800">
          Fotos e vídeos <span className="font-normal text-slate-500">(opcional, até 3 arquivos)</span>
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
        <p className="text-xs text-slate-500">
          Imagens até 5 MB e vídeos até 10 MB cada. Os arquivos serão exibidos junto da avaliação.
        </p>
        {files.length && !state.success ? (
          <ul className="space-y-1 text-sm" aria-label="Arquivos anexados">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2"
              >
                <span className="min-w-0 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="text-slate-600 underline underline-offset-2"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {uploading ? (
          <p role="status" className="text-sm text-slate-600">
            Enviando arquivos e publicando avaliação…
          </p>
        ) : null}
        {uploadError ? (
          <p role="alert" className="text-sm text-red-700">
            {uploadError}
          </p>
        ) : null}
      </section>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || uploading || Boolean(state.success)}
        className="bg-moto-brand text-moto-brand-foreground min-h-11 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#e95f00] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Publicando..." : uploading ? "Enviando arquivos..." : "Publicar avaliação"}
      </button>
    </form>
  );
}
