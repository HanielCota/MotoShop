"use client";

import { useState } from "react";
import Image from "next/image";

import {
  attachProductImageAction,
  createProductImageUploadUrlAction,
  removeProductImageAction,
  reorderProductImagesAction,
  type ProductImageResult,
} from "@/modules/products/actions/product-image-actions";

type ProductImage = { id: string; storageKey: string; altText: string | null; url: string | null };

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSizeInBytes = 5 * 1024 * 1024;

export function ProductImageManager({
  productId,
  initialImages,
}: {
  productId: string;
  initialImages: ProductImage[];
}) {
  const [images, setImages] = useState(initialImages);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string>();

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(undefined);
    setSuccess(undefined);
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (!allowedTypes.has(file.type)) throw new Error("Use imagens JPG, PNG ou WebP.");
        if (file.size > maxImageSizeInBytes) throw new Error("Cada imagem deve ter no máximo 5 MB.");

        const upload = await createProductImageUploadUrlAction({
          productId,
          contentType: file.type,
          sizeInBytes: file.size,
        });
        if ("error" in upload) throw new Error(upload.error);

        const response = await fetch(upload.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("Não foi possível enviar a imagem para o storage.");

        const attached: ProductImageResult = await attachProductImageAction({
          productId,
          storageKey: upload.key,
          altText: file.name.replace(/\.[^.]+$/, ""),
        });
        if ("error" in attached) throw new Error(attached.error);
        setImages((current) => [...current, attached.image]);
      }
      setSuccess("Imagem(ns) adicionada(s). Salve o produto e envie para aprovação quando terminar.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function moveImage(imageId: string, direction: -1 | 1) {
    const index = images.findIndex((image) => image.id === imageId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= images.length) return;

    setError(undefined);
    setSuccess(undefined);
    setBusyImageId(imageId);
    const nextImages = [...images];
    const currentImage = nextImages[index];
    const targetImage = nextImages[nextIndex];
    if (!currentImage || !targetImage) {
      setBusyImageId(undefined);
      return;
    }
    nextImages[index] = targetImage;
    nextImages[nextIndex] = currentImage;
    const result = await reorderProductImagesAction({ productId, imageIds: nextImages.map((image) => image.id) });
    setBusyImageId(undefined);
    if (result.error) {
      setError(result.error);
      return;
    }
    setImages(nextImages);
    setSuccess("Ordem das imagens atualizada.");
  }

  async function removeImage(imageId: string) {
    if (!window.confirm("Remover esta imagem do produto?")) return;
    setError(undefined);
    setSuccess(undefined);
    setBusyImageId(imageId);
    const result = await removeProductImageAction({ imageId });
    setBusyImageId(undefined);
    if (result.error) {
      setError(result.error);
      return;
    }
    setImages((current) => current.filter((image) => image.id !== imageId));
    setSuccess("Imagem removida.");
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">Imagens do produto</h3>
        <p className="text-muted-foreground text-xs">Até 8 imagens JPG, PNG ou WebP, com no máximo 5 MB cada.</p>
      </div>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-md border">
              {image.url ? (
                <Image
                  src={image.url}
                  alt={image.altText ?? "Imagem do produto"}
                  width={320}
                  height={320}
                  unoptimized
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex aspect-square items-center justify-center p-2 text-center text-xs">
                  URL pública do R2 não configurada
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1 border-t p-2">
                <span className="text-muted-foreground mr-auto text-xs">
                  {index === 0 ? "Capa" : `Imagem ${index + 1}`}
                </span>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                  aria-label="Mover imagem para cima"
                  disabled={uploading || busyImageId !== undefined || index === 0}
                  onClick={() => void moveImage(image.id, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                  aria-label="Mover imagem para baixo"
                  disabled={uploading || busyImageId !== undefined || index === images.length - 1}
                  onClick={() => void moveImage(image.id, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="text-destructive rounded border px-2 py-1 text-xs disabled:opacity-50"
                  aria-label="Remover imagem"
                  disabled={uploading || busyImageId !== undefined}
                  onClick={() => void removeImage(image.id)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={uploading || images.length >= 8}
        onChange={(event) => void uploadFiles(event.target.files)}
        className="block w-full text-sm"
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      {uploading ? <p className="text-muted-foreground text-sm">Enviando...</p> : null}
    </div>
  );
}
