"use client";

import Image from "next/image";
import { useState } from "react";

import {
  attachStoreBrandingImageAction,
  createStoreBrandingUploadUrlAction,
  type StoreBrandingImageType,
  type StoreBrandingResult,
} from "../actions/store-branding-actions";

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

      const response = await fetch(upload.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Não foi possível enviar a imagem para o storage.");

      const attached: StoreBrandingResult = await attachStoreBrandingImageAction({ imageType, storageKey: upload.key });
      if ("error" in attached) throw new Error(attached.error);
      if (attached.image.url) {
        setImages((current) => ({
          ...current,
          [imageType === "logo" ? "logoUrl" : "bannerUrl"]: attached.image.url,
        }));
        setSuccess(`${imageType === "logo" ? "Logo" : "Banner"} atualizado.`);
      } else {
        setSuccess(
          `${imageType === "logo" ? "Logo" : "Banner"} associado. Configure R2_PUBLIC_URL para exibi-lo na vitrine.`,
        );
      }
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
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}
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
      <label className="text-primary inline-flex cursor-pointer text-sm font-medium underline underline-offset-4">
        {imageUrl ? "Substituir imagem" : "Enviar imagem"}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            event.currentTarget.value = "";
            onFile(file);
          }}
        />
      </label>
    </div>
  );
}
