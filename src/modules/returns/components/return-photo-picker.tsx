"use client";

import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { imageFileProblem, uploadFileToImageKit } from "@/shared/storage/upload-image";

import { createReturnPhotoUploadAction, removeReturnPhotoUploadAction } from "../actions/return-actions";
import { MAX_RETURN_PHOTOS, returnPhotoContentTypes } from "../domain/return-photos";

type ReturnPhotoTarget = { orderNumber: string; orderItemId: string };
type UploadedPhoto = { key: string; fileId: string };

/** Confere tipo, tamanho e quantidade antes de aceitar a seleção; devolve a mensagem de erro ou null. */
export function validateReturnPhotoSelection(current: readonly File[], selected: readonly File[]): string | null {
  if (current.length + selected.length > MAX_RETURN_PHOTOS) return `Anexe no máximo ${MAX_RETURN_PHOTOS} fotos.`;

  return selected.map(imageFileProblem).find((problem) => problem != null) ?? null;
}

/**
 * Envia cada foto direto ao ImageKit com a autorização temporária do servidor. Se uma falhar,
 * apaga as que já subiram e repassa o erro.
 */
export async function uploadReturnPhotos(target: ReturnPhotoTarget, files: readonly File[]): Promise<UploadedPhoto[]> {
  const uploaded: UploadedPhoto[] = [];
  try {
    for (const file of files) {
      const authorization = await createReturnPhotoUploadAction({
        ...target,
        contentType: file.type,
        sizeInBytes: file.size,
      });
      if ("error" in authorization) throw new Error(authorization.error);
      const fileId = await uploadFileToImageKit({ url: authorization.url, fields: authorization.fields, file });
      uploaded.push({ key: authorization.key, fileId });
    }

    return uploaded;
  } catch (error) {
    await discardReturnPhotos(target, uploaded);
    throw error;
  }
}

/**
 * Apaga fotos enviadas que não entraram numa devolução. É limpeza de melhor esforço: uma falha aqui
 * nunca substitui o erro original que o cliente precisa ver.
 */
export async function discardReturnPhotos(target: ReturnPhotoTarget, photos: readonly UploadedPhoto[]): Promise<void> {
  await Promise.allSettled(photos.map((photo) => removeReturnPhotoUploadAction({ ...target, key: photo.key })));
}

/** Seleção de até 3 fotos opcionais para a devolução; o envio acontece só ao confirmar o formulário. */
export function ReturnPhotoPicker({
  files,
  onFilesChange,
  disabled,
}: {
  files: readonly File[];
  onFilesChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  function selectFiles(list: FileList | null) {
    if (list == null || list.length === 0) return;

    const selected = Array.from(list);
    const selectionError = validateReturnPhotoSelection(files, selected);
    setError(selectionError);
    if (selectionError != null) return;

    onFilesChange([...files, ...selected]);
  }

  return (
    <section aria-label="Fotos da devolução" className="space-y-2 sm:col-span-2">
      <p id={`${inputId}-label`} className="text-foreground text-xs font-medium">
        Fotos <span className="text-muted-foreground font-normal">(opcional, até 3 imagens)</span>
      </p>
      <input
        id={inputId}
        aria-labelledby={`${inputId}-label`}
        aria-describedby={`${inputId}-hint`}
        type="file"
        accept={returnPhotoContentTypes.join(",")}
        multiple
        disabled={disabled || files.length >= MAX_RETURN_PHOTOS}
        onChange={(event) => {
          selectFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        className="peer-focus-visible:ring-ring/50 border-input bg-background hover:bg-muted inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-sm font-semibold transition-colors peer-focus-visible:ring-3 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        Selecionar fotos
      </label>
      <p id={`${inputId}-hint`} className="text-muted-foreground text-xs">
        Imagens JPG, PNG ou WebP de até 5 MB cada. Só você, a loja e a equipe do Moto Shop veem as fotos.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
      {files.length > 0 ? (
        <ul className="space-y-1 text-sm" aria-label="Fotos anexadas">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.lastModified}-${index}`}
              className="border-border bg-card flex items-center justify-between gap-2 rounded-md border py-1 pr-1 pl-3"
            >
              <span className="min-w-0 truncate">{file.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Remover ${file.name}`}
                className={buttonVariants({ variant: "link-muted", size: "link" })}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
