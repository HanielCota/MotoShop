export type CreateUploadUrlInput = {
  key: string;
  contentType: string;
  maxSizeInBytes: number;
  expiresInSeconds?: number;
  /** Arquivo privado: só abre por link assinado (fotos de devolução). */
  isPrivate?: boolean;
};

export type CreateUploadUrlResult = {
  key: string;
  url: string;
  expiresAt: Date;
  fields: Record<string, string>;
};

export type DeleteObjectInput = { key: string };

export interface StorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
  verifyImage(input: {
    key: string;
    fileId: string;
    maxSizeInBytes: number;
    contentTypes: readonly string[];
  }): Promise<void>;
}
