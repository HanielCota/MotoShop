"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";

import {
  attachProductImageAction,
  createProductImageUploadUrlAction,
  discardProductImageUploadAction,
  removeProductImageAction,
  reorderProductImagesAction,
  type ProductImageResult,
} from "@/modules/products/actions/product-image-actions";
import { findImageFileProblem, uploadImageToImageKit } from "@/shared/storage/upload-image";
import { formatCount } from "@/lib/format";

type ProductImage = { id: string; storageKey: string; altText: string | null; url: string | null };

function assertValidImageFile(file: File) {
  const problem = findImageFileProblem(file);
  if (problem != null) throw new Error(problem);
}

/** Removes the orphan upload, then rethrows the original error (with the cleanup error, if any). */
async function discardUploadAndRethrow(
  productId: string,
  storageKey: string,
  error: unknown,
  fallbackMessage: string,
): Promise<never> {
  const cleanup = await discardProductImageUploadAction({ productId, storageKey });
  if (!cleanup.error) throw error;

  throw new Error(`${error instanceof Error ? error.message : fallbackMessage} ${cleanup.error}`);
}

async function sendFileToStorage(
  productId: string,
  upload: { url: string; fields: Record<string, string>; key: string },
  file: File,
): Promise<string> {
  try {
    return await uploadImageToImageKit({ url: upload.url, fields: upload.fields, file });
  } catch (uploadError) {
    return discardUploadAndRethrow(productId, upload.key, uploadError, "Falha ao enviar a imagem.");
  }
}

async function uploadProductImage(productId: string, file: File): Promise<ProductImage> {
  assertValidImageFile(file);

  const upload = await createProductImageUploadUrlAction({
    productId,
    contentType: file.type,
    sizeInBytes: file.size,
  });
  if ("error" in upload) throw new Error(upload.error);

  const fileId = await sendFileToStorage(productId, upload, file);

  try {
    const attached: ProductImageResult = await attachProductImageAction({
      productId,
      storageKey: upload.key,
      fileId,
      altText: file.name.replace(/\.[^.]+$/, ""),
    });
    if ("error" in attached) throw new Error(attached.error);

    return attached.image;
  } catch (attachError) {
    // The attach request may have committed even if its response was lost;
    // the server-side cleanup keeps associated assets and removes only orphans.
    return discardUploadAndRethrow(productId, upload.key, attachError, "Falha ao associar a imagem.");
  }
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(undefined);
    setSuccess(undefined);
    if (images.length + files.length > 8) {
      setError(
        `Você pode adicionar mais ${formatCount(Math.max(0, 8 - images.length), "imagem", "imagens")} a este produto.`,
      );
      return;
    }
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const image = await uploadProductImage(productId, file);
        setImages((current) => [...current, image]);
      }

      setSuccess(
        files.length === 1
          ? "Imagem adicionada. Salve o produto e envie para aprovação quando terminar."
          : "Imagens adicionadas. Salve o produto e envie para aprovação quando terminar.",
      );
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
    setError(undefined);
    setSuccess(undefined);
    setBusyImageId(imageId);
    try {
      const result = await removeProductImageAction({ imageId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setImages((current) => current.filter((image) => image.id !== imageId));
      setSuccess("Imagem removida.");
    } catch {
      setError("Não foi possível remover a imagem. Tente novamente.");
    } finally {
      setBusyImageId(undefined);
    }
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
                  Serviço de imagens não configurado
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1 border-t p-2">
                <span className="text-muted-foreground mr-auto text-xs">
                  {index === 0 ? "Capa" : `Imagem ${index + 1}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={index === 1 ? "Tornar esta imagem a capa" : "Mover imagem para antes"}
                  disabled={uploading || busyImageId !== undefined || index === 0}
                  onClick={() => void moveImage(image.id, -1)}
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Mover imagem para depois"
                  disabled={uploading || busyImageId !== undefined || index === images.length - 1}
                  onClick={() => void moveImage(image.id, 1)}
                >
                  <ArrowRight aria-hidden="true" />
                </Button>
                <AlertDialog.Root>
                  <AlertDialog.Trigger
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-destructive")}
                    aria-label="Remover imagem"
                    disabled={uploading || busyImageId !== undefined}
                  >
                    <Trash2 aria-hidden="true" data-icon="inline-start" />
                    Remover
                  </AlertDialog.Trigger>
                  <AlertDialog.Portal>
                    <AlertDialog.Backdrop className="z-dialog fixed inset-0 bg-black/55" />
                    <AlertDialog.Popup className="bg-background text-foreground z-dialog fixed top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border p-5 shadow-xl">
                      <AlertDialog.Title className="text-lg font-semibold">Remover imagem?</AlertDialog.Title>
                      <AlertDialog.Description className="text-muted-foreground text-sm">
                        Esta imagem será retirada do produto. Essa ação não pode ser desfeita.
                      </AlertDialog.Description>
                      <div className="flex justify-end gap-2">
                        <AlertDialog.Close className={buttonVariants({ variant: "outline" })}>
                          Manter imagem
                        </AlertDialog.Close>
                        <AlertDialog.Close
                          className={buttonVariants({ variant: "destructive" })}
                          onClick={() => void removeImage(image.id)}
                        >
                          Remover
                        </AlertDialog.Close>
                      </div>
                    </AlertDialog.Popup>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={uploading || images.length >= 8}
        onChange={(event) => {
          const files = event.currentTarget.files;
          void uploadFiles(files);
          event.currentTarget.value = "";
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading || images.length >= 8}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload aria-hidden="true" className="size-4" />
        {uploading ? "Enviando imagens..." : "Adicionar imagens"}
      </Button>
      <FormMessage error={error ?? null} success={success ?? null} />
      {uploading ? (
        <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
          Enviando...
        </p>
      ) : null}
    </div>
  );
}
