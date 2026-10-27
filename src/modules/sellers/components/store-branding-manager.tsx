"use client";
import { FormMessage } from "@/components/ui/form-message";

import Image from "next/image";
import { useRef, useState } from "react";

import {
  attachStoreBrandingImageAction,
  createStoreBrandingUploadUrlAction,
  discardStoreBrandingUploadAction,
  type StoreBrandingImageType,
  type StoreBrandingResult,
} from "../actions/store-branding-actions";
import { findImageFileProblem, uploadImageToImageKit } from "@/shared/storage/upload-image";
import { buttonVariants } from "@/components/ui/button";

type StoreBrandingImages = {
  logoUrl: string | null;
  bannerUrl: string | null;
};

type AttachedStoreBranding = Exclude<StoreBrandingResult, { error: string }>;

/** Runs an upload step; on failure discards the uploaded asset and rethrows, appending any cleanup error. */
async function runOrDiscardUpload<T>(
  operation: () => Promise<T>,
  discardUpload: () => Promise<{ error?: string }>,
  fallbackMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (operationError) {
    const cleanup = await discardUpload();
    if (cleanup.error) {
      throw new Error(`${operationError instanceof Error ? operationError.message : fallbackMessage} ${cleanup.error}`);
    }
    throw operationError;
  }
}

async function attachUploadedImage(input: {
  imageType: StoreBrandingImageType;
  storageKey: string;
  fileId: string;
}): Promise<AttachedStoreBranding> {
  const attached = await attachStoreBrandingImageAction(input);
  if ("error" in attached) throw new Error(attached.error);
  return attached;
}

export function StoreBrandingManager({ initialImages }: { initialImages: StoreBrandingImages }) {
  const [images, setImages] = useState(initialImages);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [uploading, setUploading] = useState<StoreBrandingImageType>();

  async function uploadFile(imageType: StoreBrandingImageType, file: File | null) {
    if (!file) return;
    setError(undefined);
    setSuccess(undefined);
    setUploading(imageType);

    try {
      const problem = findImageFileProblem(file);
      if (problem != null) throw new Error(problem);

      const upload = await createStoreBrandingUploadUrlAction({
        imageType,
        contentType: file.type,
        sizeInBytes: file.size,
      });
      if ("error" in upload) throw new Error(upload.error);

      const discardUpload = () => discardStoreBrandingUploadAction({ imageType, storageKey: upload.key });
      const fileId = await runOrDiscardUpload(
        () => uploadImageToImageKit({ url: upload.url, fields: upload.fields, file }),
        discardUpload,
        "Falha ao enviar a imagem.",
      );
      const attached = await runOrDiscardUpload(
        () => attachUploadedImage({ imageType, storageKey: upload.key, fileId }),
        discardUpload,
        "Falha ao associar a imagem.",
      );

      if (!attached.image.url) {
        setSuccess(
          `${imageType === "logo" ? "Logo" : "Banner"} associado. Configure IMAGEKIT_URL_ENDPOINT para exibi-lo na vitrine.`,
        );
        return;
      }

      setImages((current) => ({
        ...current,
        [imageType === "logo" ? "logoUrl" : "bannerUrl"]: attached.image.url,
      }));
      setSuccess(`${imageType === "logo" ? "Logo" : "Banner"} atualizado.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(undefined);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">Identidade visual</h3>
        <p className="text-muted-foreground text-xs">Use JPG, PNG ou WebP, com no máximo 5 MB por imagem.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BrandingImageField
          label="Logo"
          description="Exibida junto ao nome da loja."
          imageUrl={images.logoUrl}
          alt="Logo da loja"
          inputId="store-logo"
          disabled={uploading !== undefined}
          onFile={(file) => void uploadFile("logo", file)}
          aspectClassName="aspect-square max-w-48"
        />
        <BrandingImageField
          label="Banner"
          description="Exibido no topo da vitrine pública."
          imageUrl={images.bannerUrl}
          alt="Banner da loja"
          inputId="store-banner"
          disabled={uploading !== undefined}
          onFile={(file) => void uploadFile("banner", file)}
          aspectClassName="aspect-[3/1]"
        />
      </div>
      {uploading ? <p className="text-muted-foreground text-sm">Enviando {uploading}...</p> : null}
      <FormMessage error={error ?? null} success={success ?? null} />
    </div>
  );
}

function BrandingImageField({
  label,
  description,
  imageUrl,
  alt,
  inputId,
  disabled,
  onFile,
  aspectClassName,
}: {
  label: string;
  description: string;
  imageUrl: string | null;
  alt: string;
  inputId: string;
  disabled: boolean;
  onFile: (file: File | null) => void;
  aspectClassName: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div className={`bg-muted relative w-full overflow-hidden rounded-md border ${aspectClassName}`}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs">
            Nenhuma imagem configurada
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className={buttonVariants({ variant: "link", size: "link" })}
      >
        {imageUrl ? "Substituir imagem" : "Enviar imagem"}
      </button>
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          event.currentTarget.value = "";
          onFile(file);
        }}
      />
    </div>
  );
}
