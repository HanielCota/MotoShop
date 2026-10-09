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
import { uploadImageToImageKit } from "@/shared/storage/upload-image";

type StoreBrandingImages = {
  logoUrl: string | null;
  bannerUrl: string | null;
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSizeInBytes = 5 * 1024 * 1024;

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
      if (!allowedTypes.has(file.type)) throw new Error("Use imagens JPG, PNG ou WebP.");
      if (file.size > maxImageSizeInBytes) throw new Error("A imagem deve ter no máximo 5 MB.");

      const upload = await createStoreBrandingUploadUrlAction({
        imageType,
        contentType: file.type,
        sizeInBytes: file.size,
      });
      if ("error" in upload) throw new Error(upload.error);

      let fileId: string;
      try {
        fileId = await uploadImageToImageKit({ url: upload.url, fields: upload.fields, file });
      } catch (uploadError) {
        const cleanup = await discardStoreBrandingUploadAction({ imageType, storageKey: upload.key });
        if (cleanup.error) {
          throw new Error(
            `${uploadError instanceof Error ? uploadError.message : "Falha ao enviar a imagem."} ${cleanup.error}`,
          );
        }
        throw uploadError;
      }

      let attached: StoreBrandingResult;
      try {
        attached = await attachStoreBrandingImageAction({
          imageType,
          storageKey: upload.key,
          fileId,
        });
        if ("error" in attached) throw new Error(attached.error);
      } catch (attachError) {
        const cleanup = await discardStoreBrandingUploadAction({ imageType, storageKey: upload.key });
        if (cleanup.error) {
          throw new Error(
            `${attachError instanceof Error ? attachError.message : "Falha ao associar a imagem."} ${cleanup.error}`,
          );
        }
        throw attachError;
      }
      if ("error" in attached) throw new Error(attached.error);
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
        className="text-brand-text focus-visible:ring-ring/40 inline-flex min-h-10 items-center rounded-md text-sm font-medium underline underline-offset-4 focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
